import { createContext, useContext, useEffect, useState } from "react";
import { auth, db, messagingReady } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp, onSnapshot } from "firebase/firestore";
import { playNotificationSound } from "../utils/notificationSound";

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

const VAPID_KEY = "BDqNpCBZA1DPpuQUNVVjpV5PPBv21uugmcWUs2gWzfWL7lpqJarIDsrlmDdUcd--jnh1SeYkXBe-pWHjEs6Xi-w";

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // FCM Registration — fully lazy, safe on all browsers
    const setupNotifications = async (uid) => {
        try {
            await messagingReady;
            const { messaging } = await import("../firebase");
            if (!messaging) return;
            if (!('Notification' in window)) return;

            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return;

            // Dynamic import firebase/messaging — never loaded on unsupported browsers
            const { getToken } = await import("firebase/messaging");
            const token = await getToken(messaging, { vapidKey: VAPID_KEY });

            if (token) {
                await updateDoc(doc(db, "users", uid), {
                    fcmTokens: arrayUnion(token)
                });
            }
        } catch (err) {
            console.warn("FCM registration failed:", err);
        }
    };

    const switchDepartment = async (deptId) => {
        if (!currentUser) return;
        try {
            await updateDoc(doc(db, "users", currentUser.uid), {
                selectedDepartmentId: deptId
            });
            setUserProfile(prev => ({ ...prev, selectedDepartmentId: deptId }));
        } catch (err) {
            console.error("Error switching department:", err);
            alert("Không thể chuyển khoa/phòng: " + err.message);
        }
    };

    useEffect(() => {
        let unsubscribeProfile = null;
        let unsubscribeMessaging = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            setError(null);

            if (user) {
                const docRef = doc(db, "users", user.uid);

                // 1. Immediately attach listener so UI can stop "Loading..."
                unsubscribeProfile = onSnapshot(docRef, (snap) => {
                    if (snap.exists()) {
                        setUserProfile(snap.data());
                    } else {
                        setError("Profile disconnected.");
                        setUserProfile(null);
                    }
                    setLoading(false);
                }, (err) => {
                    console.error("Profile listen error:", err);
                    setError(err.message);
                    setLoading(false);
                });

                // 2. Perform migration checks asynchronously WITHOUT blocking thread
                getDoc(docRef).then(async (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        const isPolluted = data.email && data.email.endsWith('@task.app');
                        const needsMigration = !data.fullName || !data.role || !data.status || !data.departmentIds || isPolluted || !data.authEmail;

                        if (needsMigration) {
                            const initialDeptIds = data.departmentIds || (data.departmentId ? [data.departmentId] : []);
                            const updates = {
                                fullName: data.fullName || data.displayName || user.email?.split('@')[0] || "User",
                                role: data.role || "staff",
                                status: data.status || "active",
                                email: (data.email && !data.email.endsWith('@task.app')) ? data.email : (user.email?.endsWith('@task.app') ? null : user.email),
                                authEmail: user.email,
                                departmentIds: initialDeptIds,
                                selectedDepartmentId: data.selectedDepartmentId || (initialDeptIds.length > 0 ? initialDeptIds[0] : ""),
                                position: data.position || ""
                            };
                            await updateDoc(docRef, updates).catch(console.error);
                        }
                        setupNotifications(user.uid);
                    } else {
                        const initialProfile = {
                            fullName: user.displayName || user.email?.split('@')[0] || "New User",
                            email: user.email,
                            authEmail: user.email,
                            role: "staff",
                            status: "pending",
                            departmentIds: [],
                            createdAt: serverTimestamp()
                        };
                        await setDoc(docRef, initialProfile).catch(console.error);
                    }
                }).catch(err => console.error("Migration/Setup error:", err));

            } else {
                setUserProfile(null);
                setLoading(false);
            }
        });

        // Foreground message listener — fully lazy
        const setupForegroundListener = async () => {
            try {
                await messagingReady;
                const { messaging } = await import("../firebase");
                if (!messaging) return;

                const { onMessage } = await import("firebase/messaging");
                unsubscribeMessaging = onMessage(messaging, (payload) => {
                    if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification(payload.notification?.title || 'Thông báo', {
                            body: payload.notification?.body || '',
                            icon: '/logo192.png'
                        });
                    }
                    playNotificationSound();
                });
            } catch (err) {
                // Non-critical
            }
        };
        setupForegroundListener();

        return () => {
            unsubscribeAuth();
            if (unsubscribeProfile) unsubscribeProfile();
            if (unsubscribeMessaging) unsubscribeMessaging();
        };
    }, []);

    const value = { currentUser, userProfile, loading, error, switchDepartment };

    return (
        <AuthContext.Provider value={value}>
            {loading ? <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div> : children}
        </AuthContext.Provider>
    );
}
