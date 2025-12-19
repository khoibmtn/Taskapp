import { createContext, useContext, useEffect, useState } from "react";
import { auth, db, messaging } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
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
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            setError(null);
            if (user) {
                try {
                    const docRef = doc(db, "users", user.uid);
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        let data = docSnap.data();

                        // Setup Notifications
                        setupNotifications(user.uid);

                        // ... (Schema migration logic)
                        const needsMigration = !data.fullName || !data.role || !data.status || !data.departmentIds;
                        if (needsMigration) {
                            // Convert single departmentId to array if needed
                            const initialDeptIds = data.departmentIds || (data.departmentId ? [data.departmentId] : []);

                            const updates = {
                                fullName: data.fullName || data.displayName || user.email?.split('@')[0] || "User",
                                role: data.role || "staff",
                                status: data.status || "active",
                                email: data.email || user.email,
                                authEmail: user.email,
                                departmentIds: initialDeptIds,
                                selectedDepartmentId: data.selectedDepartmentId || (initialDeptIds.length > 0 ? initialDeptIds[0] : ""),
                                position: data.position || ""
                            };
                            await setDoc(docRef, updates, { merge: true });
                            data = { ...data, ...updates };
                        }
                        setUserProfile(data);

                    } else {
                        setError(`Profile document not found for UID: ${user.uid}`);
                        setUserProfile(null);
                    }
                } catch (err) {
                    console.error("Error fetching user profile:", err);
                    setError(err.message);
                    setUserProfile(null);
                }
            } else {
                setUserProfile(null);
            }
            setLoading(false);
        });

        // Listen for foreground messages
        onMessage(messaging, (payload) => {
            console.log('Message received in foreground: ', payload);
            // Optionally trigger a toast or browser notification
            new Notification(payload.notification.title, {
                body: payload.notification.body
            });
        });

        return unsubscribe;
    }, []);

    const value = { currentUser, userProfile, loading, error, switchDepartment };

    return (
        <AuthContext.Provider value={value}>
            {loading ? <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div> : children}
        </AuthContext.Provider>
    );
}
