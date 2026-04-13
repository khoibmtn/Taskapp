import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { auth } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { Clock, XCircle, Lock, RefreshCw, LogOut } from "lucide-react";

export default function WaitingApproval() {
    const navigate = useNavigate();
    const { userProfile } = useAuth();

    const handleLogout = async () => {
        await auth.signOut();
        navigate("/login");
    };

    useEffect(() => {
        if (userProfile?.status === 'active') {
            navigate("/");
        }
    }, [userProfile, navigate]);

    const isRejected = userProfile?.status === 'rejected' || userProfile?.status === 'reject_request';
    const isInactive = userProfile?.status === 'inactive';

    const StatusIcon = isRejected ? XCircle : isInactive ? Lock : Clock;
    const iconColor = isRejected || isInactive ? 'text-danger-500 bg-danger-50' : 'text-warning-500 bg-warning-50';

    const title = userProfile?.status === 'rejected' ? 'Tài khoản đã bị từ chối'
        : isInactive ? 'Tài khoản đã ngừng hoạt động'
        : userProfile?.status === 'reject_request' ? 'Đang xử lý từ chối'
        : 'Tài khoản đang chờ duyệt';

    const message = userProfile?.status === 'rejected'
        ? <>Tài khoản của bạn đã bị <strong className="text-gray-700">Từ chối</strong> bởi Quản trị viên. Bạn không có quyền truy cập vào hệ thống.</>
        : isInactive
        ? <>Tài khoản đã được chuyển sang trạng thái <strong className="text-gray-700">Ngừng hoạt động</strong>. Vui lòng liên hệ Admin nếu có nhầm lẫn.</>
        : userProfile?.status === 'reject_request'
        ? <>Yêu cầu đăng ký đang được xem xét để <strong className="text-gray-700">Từ chối</strong>. Vui lòng liên hệ Admin nếu có nhầm lẫn.</>
        : <>Tài khoản hiện đang ở trạng thái <strong className="text-gray-700">Chờ phê duyệt</strong> từ Quản trị viên. Vui lòng quay lại sau khi đã được cấp quyền truy cập.</>;

    return (
        <div className="min-h-dvh flex items-center justify-center bg-gray-50 px-4 py-8">
            <div className="w-full max-w-sm">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
                    {/* Status Icon */}
                    <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${iconColor} mb-5`}>
                        <StatusIcon className="w-8 h-8" />
                    </div>

                    <h2 className="font-heading text-xl font-bold text-gray-900 mb-3">{title}</h2>

                    <p className="text-sm text-gray-500 leading-relaxed text-left mb-6">
                        Xin chào <strong className="text-gray-700">{userProfile?.fullName || "bạn"}</strong>,
                        <br /><br />
                        {message}
                    </p>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors min-h-[48px]"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Kiểm tra lại
                        </button>
                        <button
                            onClick={handleLogout}
                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-danger-600 hover:bg-danger-500 text-white font-semibold rounded-xl transition-colors min-h-[48px]"
                        >
                            <LogOut className="w-4 h-4" />
                            Đăng xuất
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
