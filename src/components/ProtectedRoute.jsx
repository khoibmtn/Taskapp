import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Loader2, AlertTriangle } from "lucide-react";

export default function ProtectedRoute({ children }) {
    const { currentUser, userProfile, error } = useAuth();

    if (!currentUser) {
        return <Navigate to="/login" />;
    }

    if (error || (currentUser && userProfile === null)) {
        return (
            <div className="min-h-dvh flex items-center justify-center bg-gray-50 px-4">
                <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-danger-50 mb-4">
                        <AlertTriangle className="w-7 h-7 text-danger-500" />
                    </div>
                    <h3 className="font-heading font-bold text-lg text-gray-900 mb-2">Không thể tải hồ sơ</h3>
                    <p className="text-sm text-gray-500 mb-3">{error || "User profile not found."}</p>
                    <p className="text-xs text-gray-400">UID: <code className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">{currentUser.uid}</code></p>
                    <p className="text-xs text-gray-400 mt-2">Vui lòng liên hệ Admin.</p>
                </div>
            </div>
        );
    }

    if (userProfile && (userProfile.status === "pending" || userProfile.status === "reject_request" || userProfile.status === "rejected" || userProfile.status === "inactive")) {
        return <Navigate to="/waiting-approval" />;
    }

    return children;
}
