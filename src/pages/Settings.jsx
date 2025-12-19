import { useAuth } from "../contexts/AuthContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function Settings() {
    const { currentUser } = useAuth();

    const handleGrantAdmin = async () => {
        if (!currentUser) return;
        try {
            await updateDoc(doc(db, "users", currentUser.uid), {
                role: "admin",
                status: "active" // Ensure active status too
            });
            alert("Đã cấp quyền Admin thành công! Vui lòng tải lại trang.");
            window.location.reload();
        } catch (error) {
            console.error(error);
            alert("Lỗi: " + error.message);
        }
    };

    return (
        <div>
            <h2>Cài đặt</h2>
            <p>Cấu hình hệ thống sẽ hiển thị ở đây.</p>

            <div style={{ marginTop: '50px', padding: '20px', background: '#ffebee', border: '1px solid #ffcdd2' }}>
                <h3>Khu vực dành cho Developer</h3>
                <button onClick={handleGrantAdmin} style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}>
                    ⚡ Cấp quyền Admin cho tôi (Dev Only)
                </button>
            </div>
        </div>
    );
}
