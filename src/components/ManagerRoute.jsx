import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function ManagerRoute({ children }) {
    const { currentUser, userProfile, loading } = useAuth();

    if (loading) {
        return <div>Đang kiểm tra quyền truy cập...</div>;
    }

    if (!currentUser) {
        return <Navigate to="/login" />;
    }

    if (userProfile?.role !== "manager" && userProfile?.role !== "admin" && userProfile?.role !== "asigner") {
        // Not a manager, admin, or asigner, redirect to Personal Dashboard
        return <Navigate to="/app" />
    }

    return children;
}
