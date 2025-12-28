import { createContext, useContext, useEffect, useState } from "react";
import { auth, db, messaging } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp, onSnapshot } from "firebase/firestore";
import { getToken, onMessage } from "firebase/messaging";

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

const VAPID_KEY = "BDd2-vXy8G2Kj2G_2_0_q_w_u_v_x_y_z_0_1_2_3_4_5_6_7_8_9_A_B_C_D_E_F"; // Placeholder VAPID key

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // FCM Registration
    const setupNotifications = async (uid) => {
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const token = await getToken(messaging, {
                    vapidKey: "BEn6T4S9r_x2rLWxk7M8e3A9d6F2J2L2K2M2N2P2Q2R2S2T2U2V2W2X2Y2Z" // Note: Real VAPID needed if using custom key, but often default works for basic setup
                });

                if (token) {
                    console.log("FCM Token:", token);
                    await updateDoc(doc(db, "users", uid), {
                        fcmTokens: arrayUnion(token)
                    });
                }
            }
        } catch (err) {
            console.warn("FCM registration failed:", err);
            // Don't block whole app for notification failure
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

        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            setError(null);

            if (user) {
                const docRef = doc(db, "users", user.uid);

                // 1. One-time fetch for migration logic
                try {
                    const docSnap = await getDoc(docRef);
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
                            await updateDoc(docRef, updates);
                        }
                        setupNotifications(user.uid);
                    } else {
                        // Create basic profile if missing
                        const initialProfile = {
                            fullName: user.displayName || user.email?.split('@')[0] || "New User",
                            email: user.email,
                            authEmail: user.email,
                            role: "staff",
                            status: "pending",
                            departmentIds: [],
                            createdAt: serverTimestamp()
                        };
                        await setDoc(docRef, initialProfile);
                    }
                } catch (err) {
                    console.error("Migration/Setup error:", err);
                }

                // 2. Start real-time listener for profile
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

            } else {
                setUserProfile(null);
                setLoading(false);
            }
        });

        // Listen for foreground messages
        const unsubscribeMessaging = onMessage(messaging, (payload) => {
            console.log('Message received in foreground: ', payload);

            // 1. Show native browser notification
            if (Notification.permission === 'granted') {
                new Notification(payload.notification.title, {
                    body: payload.notification.body,
                    icon: '/logo192.png'
                });
            }

            // 2. Play a subtle sound (Optional, but good for UX)
            // const audio = new Audio('/notification.mp3'); 
            // audio.play().catch(e => console.log('Audio play failed', e));

            // Note: UI updates happen automatically via Firestore onSnapshot listeners
            // which are already implemented in dashboards.
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeProfile) unsubscribeProfile();
            unsubscribeMessaging();
        };
    }, []);

    const value = { currentUser, userProfile, loading, error, switchDepartment };

    return (
        <AuthContext.Provider value={value}>
            {loading ? <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div> : children}
        </AuthContext.Provider>
    );
}
