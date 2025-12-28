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
        </div>
    );
}
