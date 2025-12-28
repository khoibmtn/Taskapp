// HƯỚNG DẪN: Copy toàn bộ code này và paste vào Console của trình duyệt
// khi bạn đang mở Firebase Console ở trang Firestore Database

import { doc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "./firebase";

const createAdminAccount = async () => {
    const uid = "YCZaE000OsXWegO3CuA1hoQveXC3";

    try {
        await setDoc(doc(db, "users", uid), {
            approvedAt: Timestamp.fromDate(new Date("2025-12-19T17:02:42+07:00")),
            approvedBy: "A6aInz5YEFQVvWjPPYBxEBGRqGg2",
            authEmail: "khoibm.tn@gmail.com",
            createdAt: Timestamp.fromDate(new Date("2025-12-19T13:59:57+07:00")),
            departmentId: "jiL2fsXoQyynBsJOWCAf",
            departmentIds: ["jiL2fsXoQyynBsJOWCAf"],
            email: "khoibm.tn@gmail.com",
            fullName: "Quản trị viên",
            phone: "0904900511",
            phoneNumber: "904900511", // For unified login
            position: "Admin",
            role: "admin",
            selectedDepartmentId: "xnSnG0saiXU6leHBSddK",
            status: "active"
        });

        console.log("✅ Tạo tài khoản admin thành công!");
    } catch (error) {
        console.error("❌ Lỗi:", error);
    }
};

createAdminAccount();
