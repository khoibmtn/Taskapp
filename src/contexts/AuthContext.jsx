import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        console.time("AuthCheck");
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            console.timeLog("AuthCheck", "User state changed:", user ? "LoggedIn" : "LoggedOut");
            setCurrentUser(user);
            setError(null); // Reset error on auth change
            if (user) {
                // Fetch user profile from Firestore
                try {
                    console.time("ProfileFetch");
                    const docRef = doc(db, "users", user.uid);
                    const docSnap = getDoc(docRef);

                    // We wait for the promise to resolve
                    const snapshot = await docSnap;
                    console.timeEnd("ProfileFetch");

                    if (snapshot.exists()) {
                        setUserProfile(snapshot.data());
                    } else {
                        console.error("No such user profile! UID:", user.uid);
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
            console.timeEnd("AuthCheck");
        });

        return unsubscribe;
    }, []);

    const value = {
        currentUser,
        userProfile,
        loading,
        error
    };

    return (
        <AuthContext.Provider value={value}>
            {loading ? <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading...</div> : children}
        </AuthContext.Provider>
    );
}
