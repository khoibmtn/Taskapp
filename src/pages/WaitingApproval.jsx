import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { auth } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

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

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f5f7fa', padding: '20px' }}>
            <div style={{ background: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '500px', width: '100%' }}>
                <div style={{ fontSize: '60px', color: (userProfile?.status === 'rejected' || userProfile?.status === 'reject_request' || userProfile?.status === 'inactive') ? '#f44336' : '#ff9800', marginBottom: '20px' }}>
                    {(userProfile?.status === 'rejected' || userProfile?.status === 'reject_request') ? '🚫' : userProfile?.status === 'inactive' ? '🔒' : '⏳'}
                </div>
                <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>
                    {userProfile?.status === 'rejected' ? 'Tài khoản đã bị từ chối' :
                        userProfile?.status === 'inactive' ? 'Tài khoản đã ngừng hoạt động' :
                            userProfile?.status === 'reject_request' ? 'Đang xử lý từ chối' : 'Tài khoản đang chờ duyệt'}
                </h2>
                <p style={{ color: '#546e7a', lineHeight: '1.6', marginBottom: '25px', textAlign: 'left' }}>
                    Xin chào <strong>{userProfile?.fullName || "bạn"}</strong>,<br /><br />
                    {userProfile?.status === 'rejected' ? (
                        <>Tài khoản của bạn đã bị <strong>Từ chối</strong> bởi Quản trị viên. Bạn không có quyền truy cập vào hệ thống.</>
                    ) : userProfile?.status === 'inactive' ? (
                        <>Tài khoản của bạn đã được chuyển sang trạng thái <strong>Ngừng hoạt động</strong>. Vui lòng liên hệ Admin nếu có nhầm lẫn.</>
                    ) : userProfile?.status === 'reject_request' ? (
                        <>Yêu cầu đăng ký của bạn đang được xem xét để <strong>Từ chối</strong>. Vui lòng liên hệ Admin nếu có nhầm lẫn.</>
                    ) : (
                        <>Tài khoản của bạn hiện đang ở trạng thái <strong>Chờ phê duyệt</strong> từ Quản trị viên. Vui lòng quay lại sau khi đã được cấp quyền truy cập.</>
                    )}
                </p>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => window.location.reload()}
                        style={{ flex: 1, padding: '12px', background: '#f5f5f5', color: '#333', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        Kiểm tra lại
                    </button>
                    <button
                        onClick={handleLogout}
                        style={{ flex: 1, padding: '12px', background: '#c62828', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        Đăng xuất
                    </button>
                </div>
            </div>
        </div>
    );
}
