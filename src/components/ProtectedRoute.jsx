import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute({ children }) {
    const { currentUser, userProfile, error } = useAuth();

    if (!currentUser) {
        return <Navigate to="/login" />;
    }

    if (error || (currentUser && userProfile === null)) {
        return (
            <div style={{ padding: 20, color: 'red', fontFamily: 'monospace' }}>
                <h3>Error: Unable to load profile.</h3>
                <p style={{ background: '#FFEEEE', padding: '10px', border: '1px solid red' }}>
                    {error || "User profile not found."}
                </p>
                <p>Please contact admin.</p>
                <p style={{ background: '#eee', padding: '10px', display: 'inline-block' }}>
                    <strong>Your UID:</strong> {currentUser.uid}
                </p>
            </div>
        );
    }

    if (userProfile && (userProfile.status === "pending" || userProfile.status === "reject_request" || userProfile.status === "rejected" || userProfile.status === "inactive")) {
        return <Navigate to="/waiting-approval" />;
    }

    return children;
}
