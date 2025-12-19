import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, addDoc, updateDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";

export default function AdminDepartmentDetail() {
    const { deptId } = useParams(); // 'new' or actual ID
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    const isNew = deptId === 'new';
    const [loading, setLoading] = useState(!isNew); // If new, no loading needed initially
    const [formData, setFormData] = useState({
        name: "",
        type: "khoa", // Default
        isActive: true
    });

    useEffect(() => {
        if (!isNew && deptId) {
            async function fetchDept() {
                try {
                    const docRef = doc(db, "departments", deptId);
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {
                        setFormData({
                            name: snap.data().name || "",
                            type: snap.data().type || "khoa",
                            isActive: snap.data().isActive !== undefined ? snap.data().isActive : true
                        });
                    } else {
                        alert("Không tìm thấy đơn vị.");
                        navigate("/admin/departments");
                    }
                } catch (err) {
                    console.error("Error fetching dept:", err);
                } finally {
                    setLoading(false);
                }
            }
            fetchDept();
        }
    }, [deptId, isNew, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            alert("Vui lòng nhập tên đơn vị.");
            return;
        }

        try {
            if (isNew) {
                // Add new
                await addDoc(collection(db, "departments"), {
                    ...formData,
                    createdBy: currentUser.uid,
                    createdAt: serverTimestamp()
                });
                alert("Thêm mới thành công!");
            } else {
                // Update
                await updateDoc(doc(db, "departments", deptId), {
                    ...formData,
                    updatedBy: currentUser.uid,
                    updatedAt: serverTimestamp()
                });
                alert("Cập nhật thành công!");
            }
            navigate("/admin/departments");
        } catch (err) {
            console.error("Error saving dept:", err);
            alert("Lỗi khi lưu dữ liệu.");
        }
    };

    if (loading) return <div>Đang tải dữ liệu...</div>;

    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
            <button onClick={() => navigate("/admin/departments")} style={{ marginBottom: '20px', cursor: 'pointer', border: 'none', background: 'transparent', color: '#666' }}>
                &larr; Quay lại danh sách
            </button>

            <div style={{ background: '#fff', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <h2 style={{ marginTop: 0, marginBottom: '20px' }}>
                    {isNew ? "Thêm Khoa / Phòng mới" : "Cập nhật Khoa / Phòng"}
                </h2>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* Name */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Tên đơn vị <span style={{ color: 'red' }}>*</span></label>
                        <input
                            autoFocus
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Ví dụ: Khoa Ngoại Tổng Hợp"
                            style={{ width: '100%', padding: '10px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
                        />
                    </div>

                    {/* Type */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Phân loại</label>
                        <div style={{ display: 'flex', gap: '20px' }}>
                            <label style={{ cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="type"
                                    value="khoa"
                                    checked={formData.type === 'khoa'}
                                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    style={{ marginRight: '8px' }}
                                />
                                Khoa (Chuyên môn)
                            </label>
                            <label style={{ cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="type"
                                    value="phong"
                                    checked={formData.type === 'phong'}
                                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    style={{ marginRight: '8px' }}
                                />
                                Phòng (Chức năng)
                            </label>
                        </div>
                    </div>

                    {/* Active Status */}
                    <div>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', background: '#f9f9f9', padding: '10px', borderRadius: '4px', border: '1px solid #eee' }}>
                            <input
                                type="checkbox"
                                checked={formData.isActive}
                                onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                style={{ marginRight: '10px', width: '20px', height: '20px' }}
                            />
                            <strong>Đang hoạt động (Active)</strong>
                        </label>
                        <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                            Nếu bỏ chọn, đơn vị này sẽ không xuất hiện khi tạo mới user.
                        </small>
                    </div>

                    {/* Actions */}
                    <div style={{ paddingTop: '20px', borderTop: '1px solid #eee' }}>
                        <button
                            type="submit"
                            style={{
                                padding: '12px 24px',
                                background: '#1976d2',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                width: '100%'
                            }}
                        >
                            {isNew ? "Tạo đơn vị mới" : "Lưu thay đổi"}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
