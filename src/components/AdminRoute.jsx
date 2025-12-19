import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function AdminRoute({ children }) {
    const { currentUser, userProfile, loading } = useAuth();

    if (loading) {
        return <div>Đang kiểm tra quyền truy cập...</div>;
    }

    if (!currentUser) {
        return <Navigate to="/login" />;
    }

    if (userProfile?.role !== "admin") {
        // Not an admin, redirect to main app
        return <Navigate to="/app" />;
    }

    return children;
}
