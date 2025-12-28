import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, getDocs, collection, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";

export default function AdminUserDetail() {
    const { uid } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth(); // Admin's user

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [departments, setDepartments] = useState([]);

    // Form State
    const [formData, setFormData] = useState({
        fullName: "",
        departmentIds: [],
        position: "",
        role: "staff",
        email: "",
        phone: ""
    });

    useEffect(() => {
        async function fetchData() {
            try {
                // Fetch Departments
                const deptSnap = await getDocs(collection(db, "departments"));
                const depts = [];
                deptSnap.forEach(d => depts.push({ id: d.id, ...d.data() }));
                setDepartments(depts);

                // Fetch Target User
                const userRef = doc(db, "users", uid);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    const data = userSnap.data();
                    setUser({ id: userSnap.id, ...data });
                    setFormData({
                        fullName: data.fullName || data.displayName || "",
                        departmentIds: data.departmentIds || (data.departmentId ? [data.departmentId] : []),
                        position: data.position || "",
                        role: data.role || "staff",
                        email: data.email || "",
                        phone: data.phone || ""
                    });
                } else {
                    alert("Người dùng không tồn tại");
                    navigate("/admin/users");
                }
            } catch (err) {
                console.error("Error fetching admin detail:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [uid, navigate]);

    const handleUpdate = async (newStatus) => {
        try {
            // Ensure selectedDepartmentId is valid
            let selectedDeptId = user.selectedDepartmentId;
            if (formData.departmentIds.length > 0 && !formData.departmentIds.includes(selectedDeptId)) {
                selectedDeptId = formData.departmentIds[0];
            }

            const updates = {
                ...formData,
                status: newStatus,
                selectedDepartmentId: selectedDeptId
            };

            if (newStatus === 'active') {
                updates.approvedAt = serverTimestamp();
                updates.approvedBy = currentUser.uid;
            }

            await updateDoc(doc(db, "users", uid), updates);
            alert("Cập nhật thành công!");
            navigate("/admin/users");
        } catch (err) {
            console.error("Error updating user:", err);
            alert("Lỗi khi cập nhật.");
        }
    };

    const handleDeletePermanent = async () => {
        if (!window.confirm("BẠN CÓ CHẮC CHẮN muốn XÓA VĨNH VIỄN người dùng này? Thao tác này KHÔNG THỂ khôi phục.")) return;

        try {
            const { deleteDoc } = await import("firebase/firestore");
            await deleteDoc(doc(db, "users", uid));
            alert("Đã xóa người dùng vĩnh viễn.");
            navigate("/admin/users");
        } catch (err) {
            console.error("Error deleting user:", err);
            alert("Lỗi khi xóa người dùng: " + err.message);
        }
    };

    const toggleDepartment = (deptId) => {
        setFormData(prev => {
            const current = prev.departmentIds || [];
            if (current.includes(deptId)) {
                return { ...prev, departmentIds: current.filter(id => id !== deptId) };
            } else {
                return { ...prev, departmentIds: [...current, deptId] };
            }
        });
    };

    if (loading) return <div>Đang tải thông tin...</div>;
    if (!user) return null;

    return (
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <button onClick={() => navigate("/admin/users")} style={{ marginBottom: '20px', cursor: 'pointer' }}>&larr; Quay lại danh sách</button>

            <div style={{ background: '#fff', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <h2 style={{ marginBottom: '20px', marginTop: 0 }}>Chi tiết người dùng</h2>

                <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Thông tin hành chính</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
                    <div>
                        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Họ và tên</label>
                        <input
                            value={formData.fullName}
                            onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                            style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }}
                        />
                    </div>
                    <div>
                        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Số điện thoại</label>
                        <input
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }}
                        />
                    </div>
                </div>

                <div>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Khoa / Phòng công tác (Chọn nhiều)</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', border: '1px solid #ccc', padding: '15px', borderRadius: '4px', maxHeight: '200px', overflowY: 'auto' }}>
                        {departments.map(dept => (
                            <label key={dept.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={formData.departmentIds.includes(dept.id)}
                                    onChange={() => toggleDepartment(dept.id)}
                                />
                                {dept.name}
                            </label>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Vị trí công tác</label>
                        <select
                            value={formData.position}
                            onChange={e => setFormData({ ...formData, position: e.target.value })}
                            style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }}
                        >
                            <option value="">-- Chọn Vị trí --</option>
                            <option value="Admin">Admin</option>
                            <option value="Trưởng khoa">Trưởng khoa</option>
                            <option value="Trưởng phòng">Trưởng phòng</option>
                            <option value="Phó trưởng khoa">Phó trưởng khoa</option>
                            <option value="Phó trưởng phòng">Phó trưởng phòng</option>
                            <option value="Điều dưỡng trưởng">Điều dưỡng trưởng</option>
                            <option value="Bác sĩ">Bác sĩ</option>
                            <option value="Điều dưỡng">Điều dưỡng</option>
                            <option value="Nhân viên">Nhân viên</option>
                        </select>
                    </div>
                    <div>
                        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Email liên hệ</label>
                        <input
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            style={{ width: '100%', padding: '8px', border: '1px solid #ccc' }}
                        />
                    </div>
                </div>

                <div>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px', color: '#1565c0' }}>Quyền hệ thống (Role)</label>
                    <select
                        value={formData.role}
                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                        style={{ width: '100%', padding: '10px', border: '1px solid #1565c0', borderRadius: '4px', background: '#e3f2fd', fontWeight: 'bold' }}
                    >
                        <option value="staff">Nhân viên (Staff)</option>
                        <option value="asigner">Giao việc (Asigner)</option>
                        <option value="manager">Trưởng khoa, phòng (Manager)</option>
                        <option value="admin">Admin (Quản trị hệ thống)</option>
                    </select>
                    <div style={{ marginTop: '5px', fontSize: '0.85em', color: '#666' }}>
                        - <strong>Trưởng khoa, phòng</strong>: Quản lý công việc + Phê duyệt/Xóa user trong khoa phòng.<br />
                        - <strong>Giao việc</strong>: Chỉ quản lý công việc, không quản lý nhân sự.
                    </div>
                </div>
                {/* Actions */}
                <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #eee', display: 'flex', gap: '15px' }}>
                    {user.status === 'pending' && (
                        <>
                            <button
                                onClick={() => handleUpdate('active')}
                                style={{ padding: '10px 20px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                &#10003; Duyệt & Kích hoạt
                            </button>
                            <button
                                onClick={() => handleUpdate('rejected')}
                                style={{ padding: '10px 20px', background: '#c62828', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                &#10005; Từ chối
                            </button>
                        </>
                    )}

                    {user.status === 'active' && (
                        <button
                            onClick={() => handleUpdate('active')}
                            style={{ padding: '10px 20px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                            Lưu thay đổi thông tin
                        </button>
                    )}

                    {user.status === 'delete_request' && (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%' }}>
                            <div style={{ color: 'red', fontWeight: 'bold', flex: 1 }}>⚠ Manager yêu cầu XÓA user này.</div>
                            <button
                                onClick={() => handleUpdate('inactive')}
                                style={{ padding: '10px 20px', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                Xác nhận NGỪNG hoạt động
                            </button>
                            <button
                                onClick={() => handleUpdate('active')}
                                style={{ padding: '10px 20px', background: '#757575', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                Hủy yêu cầu xóa
                            </button>
                        </div>
                    )}

                    {user.status === 'reject_request' && (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%' }}>
                            <div style={{ color: 'red', fontWeight: 'bold', flex: 1 }}>⚠ Manager yêu cầu TỪ CHỐI user này.</div>
                            <button
                                onClick={() => handleUpdate('rejected')}
                                style={{ padding: '10px 20px', background: '#c62828', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                Xác nhận TỪ CHỐI
                            </button>
                            <button
                                onClick={() => handleUpdate('pending')}
                                style={{ padding: '10px 20px', background: '#757575', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                Hủy yêu cầu từ chối
                            </button>
                        </div>
                    )}
                    {user.status === 'rejected' && (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%' }}>
                            <div style={{ color: '#666', fontWeight: 'bold', flex: 1 }}>Tài khoản này đã bị TỪ CHỐI.</div>
                            <button
                                onClick={() => handleUpdate('pending')}
                                style={{ padding: '10px 20px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                Hủy từ chối (Khôi phục)
                            </button>
                            <button
                                onClick={handleDeletePermanent}
                                style={{ padding: '10px 20px', background: 'transparent', color: '#d32f2f', border: '1px solid #d32f2f', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                Xóa vĩnh viễn
                            </button>
                        </div>
                    )}

                    {user.status === 'inactive' && (
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%' }}>
                            <div style={{ color: '#757575', fontWeight: 'bold', flex: 1 }}>Tài khoản này đang NGỪNG HOẠT ĐỘNG.</div>
                            <button
                                onClick={() => handleUpdate('active')}
                                style={{ padding: '10px 20px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                            >
                                Khôi phục hoạt động
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
