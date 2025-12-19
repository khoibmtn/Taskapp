import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

export default function WaitingApproval() {
    const navigate = useNavigate();
    const { userProfile } = useAuth();

    const handleLogout = async () => {
        await auth.signOut();
        navigate("/login");
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f5f7fa', padding: '20px' }}>
            <div style={{ background: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '500px', width: '100%' }}>
                <div style={{ fontSize: '60px', color: '#ff9800', marginBottom: '20px' }}>⏳</div>
                <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>Tài khoản đang chờ duyệt</h2>
                <p style={{ color: '#546e7a', lineHeight: '1.6', marginBottom: '25px', textAlign: 'left' }}>
                    Xin chào <strong>{userProfile?.fullName || "bạn"}</strong>,<br /><br />
                    Tài khoản của bạn đã được đăng ký thành công nhưng hiện đang ở trạng thái <strong>Chờ phê duyệt</strong> từ Quản trị viên.<br /><br />
                    Vui lòng liên hệ với bộ phận phụ trách hoặc quay lại sau khi đã được cấp quyền truy cập.
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
