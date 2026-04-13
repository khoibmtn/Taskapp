import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, addDoc, updateDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function AdminDepartmentDetail() {
    const { deptId } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    const isNew = deptId === 'new';
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        type: "khoa",
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
                        navigate("/admin/management");
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

        setSaving(true);
        try {
            if (isNew) {
                await addDoc(collection(db, "departments"), {
                    ...formData,
                    createdBy: currentUser.uid,
                    createdAt: serverTimestamp()
                });
                alert("Thêm mới thành công!");
            } else {
                await updateDoc(doc(db, "departments", deptId), {
                    ...formData,
                    updatedBy: currentUser.uid,
                    updatedAt: serverTimestamp()
                });
                alert("Cập nhật thành công!");
            }
            navigate("/admin/management");
        } catch (err) {
            console.error("Error saving dept:", err);
            alert("Lỗi khi lưu dữ liệu.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
                <span className="ml-2 text-sm text-gray-400">Đang tải...</span>
            </div>
        );
    }

    return (
        <div className="max-w-lg mx-auto">
            {/* Back */}
            <button
                onClick={() => navigate("/admin/management")}
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-6 min-h-[40px]"
            >
                <ArrowLeft className="w-4 h-4" /> Quay lại danh sách
            </button>

            {/* Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-6 py-5 border-b border-gray-100">
                    <h2 className="font-heading text-lg font-bold text-gray-900">
                        {isNew ? "Thêm Khoa / Phòng mới" : "Cập nhật Khoa / Phòng"}
                    </h2>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            Tên đơn vị <span className="text-red-500">*</span>
                        </label>
                        <input
                            autoFocus
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="Ví dụ: Khoa Ngoại Tổng Hợp"
                            className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors placeholder:text-gray-400"
                        />
                    </div>

                    {/* Type */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Phân loại</label>
                        <div className="flex gap-6">
                            {[
                                { value: 'khoa', label: 'Khoa (Chuyên môn)' },
                                { value: 'phong', label: 'Phòng (Chức năng)' },
                            ].map(opt => (
                                <label key={opt.value} className="inline-flex items-center gap-2 cursor-pointer text-sm text-gray-700">
                                    <input
                                        type="radio"
                                        name="type"
                                        value={opt.value}
                                        checked={formData.type === opt.value}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                        className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                                    />
                                    {opt.label}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Active Status */}
                    <div>
                        <label className="flex items-center gap-3 cursor-pointer bg-gray-50 p-3.5 rounded-lg border border-gray-200 transition-colors hover:bg-gray-100">
                            <input
                                type="checkbox"
                                checked={formData.isActive}
                                onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm font-semibold text-gray-700">Đang hoạt động (Active)</span>
                        </label>
                        <p className="text-xs text-gray-400 mt-1.5 ml-1">
                            Nếu bỏ chọn, đơn vị này sẽ không xuất hiện khi tạo mới user.
                        </p>
                    </div>

                    {/* Submit */}
                    <div className="pt-4 border-t border-gray-100">
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white text-sm font-semibold rounded-lg transition-colors min-h-[44px] flex items-center justify-center gap-2"
                        >
                            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                            {saving ? "Đang lưu..." : isNew ? "Tạo đơn vị mới" : "Lưu thay đổi"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
