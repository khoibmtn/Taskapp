import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, getDocs, collection, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import { ArrowLeft, Loader2, Check, X, RotateCcw, Shield, Trash2, AlertTriangle } from "lucide-react";

export default function AdminUserDetail() {
    const { uid } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [departments, setDepartments] = useState([]);

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
                const deptSnap = await getDocs(collection(db, "departments"));
                const depts = [];
                deptSnap.forEach(d => depts.push({ id: d.id, ...d.data() }));
                setDepartments(depts);

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
                    navigate("/admin/management");
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
            navigate("/admin/management");
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
            navigate("/admin/management");
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

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
                <span className="ml-2 text-sm text-gray-400">Đang tải thông tin...</span>
            </div>
        );
    }
    if (!user) return null;

    const POSITIONS = ["Admin", "Trưởng khoa", "Trưởng phòng", "Phó trưởng khoa", "Phó trưởng phòng", "Điều dưỡng trưởng", "Bác sĩ", "Điều dưỡng", "Nhân viên"];

    return (
        <div className="max-w-2xl mx-auto">
            {/* Back */}
            <button
                onClick={() => navigate("/admin/management")}
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-6 min-h-[40px]"
            >
                <ArrowLeft className="w-4 h-4" /> Quay lại Quản lý hệ thống
            </button>

            {/* Card */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-6 py-5 border-b border-gray-100">
                    <h2 className="font-heading text-lg font-bold text-gray-900">Chi tiết người dùng</h2>
                </div>

                <div className="p-6 space-y-6">
                    {/* Section: Personal Info */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Thông tin hành chính</h3>
                        <div className="space-y-4">
                            <FormField label="Họ và tên">
                                <input
                                    value={formData.fullName}
                                    onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                                />
                            </FormField>

                            <FormField label="Số điện thoại">
                                <input
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                                />
                            </FormField>
                        </div>
                    </div>

                    {/* Section: Department */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Khoa / Phòng công tác (Chọn nhiều)</h3>
                        <div className="grid grid-cols-2 gap-2 p-3 border border-gray-200 rounded-lg max-h-[200px] overflow-y-auto bg-gray-50">
                            {departments.map(dept => (
                                <label key={dept.id} className="inline-flex items-center gap-2 cursor-pointer text-sm text-gray-700 p-1.5 rounded hover:bg-gray-100 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={formData.departmentIds.includes(dept.id)}
                                        onChange={() => toggleDepartment(dept.id)}
                                        className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
                                    />
                                    {dept.name}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Section: Position & Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <FormField label="Vị trí công tác">
                            <select
                                value={formData.position}
                                onChange={e => setFormData({ ...formData, position: e.target.value })}
                                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white transition-colors"
                            >
                                <option value="">-- Chọn Vị trí --</option>
                                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </FormField>

                        <FormField label="Email liên hệ">
                            <input
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                            />
                        </FormField>
                    </div>

                    {/* Section: Role */}
                    <div>
                        <h3 className="text-sm font-semibold text-primary-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Shield className="w-4 h-4" /> Quyền hệ thống (Role)
                        </h3>
                        <select
                            value={formData.role}
                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                            className="w-full px-3 py-2.5 text-sm font-semibold border-2 border-primary-300 rounded-lg bg-primary-50 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                        >
                            <option value="staff">Nhân viên (Staff)</option>
                            <option value="asigner">Giao việc (Asigner)</option>
                            <option value="manager">Trưởng khoa, phòng (Manager)</option>
                            <option value="admin">Admin (Quản trị hệ thống)</option>
                        </select>
                        <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                            <p>• <strong>Trưởng khoa, phòng</strong>: Quản lý công việc + Phê duyệt/Xóa user trong khoa phòng.</p>
                            <p>• <strong>Giao việc</strong>: Chỉ quản lý công việc, không quản lý nhân sự.</p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-5 border-t border-gray-100">
                        {user.status === 'pending' && (
                            <div className="flex flex-wrap gap-3">
                                <ActionButton icon={Check} label="Duyệt & Kích hoạt" variant="success" onClick={() => handleUpdate('active')} />
                                <ActionButton icon={X} label="Từ chối" variant="danger" onClick={() => handleUpdate('rejected')} />
                            </div>
                        )}

                        {user.status === 'active' && (
                            <div className="flex flex-wrap gap-3">
                                <ActionButton icon={Check} label="Lưu thay đổi thông tin" variant="primary" onClick={() => handleUpdate('active')} />
                                <ActionButton
                                    icon={Trash2}
                                    label="Xóa người dùng"
                                    variant="danger"
                                    onClick={() => { if (window.confirm('Bạn có chắc chắn muốn NGỪNG HOẠT ĐỘNG tài khoản này?')) handleUpdate('inactive'); }}
                                />
                            </div>
                        )}

                        {user.status === 'delete_request' && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-semibold">
                                    <AlertTriangle className="w-4 h-4 flex-shrink-0" /> Manager yêu cầu XÓA user này.
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <ActionButton icon={X} label="Xác nhận NGỪNG hoạt động" variant="danger" onClick={() => handleUpdate('inactive')} />
                                    <ActionButton icon={RotateCcw} label="Hủy yêu cầu xóa" variant="muted" onClick={() => handleUpdate('active')} />
                                </div>
                            </div>
                        )}

                        {user.status === 'reject_request' && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-semibold">
                                    <AlertTriangle className="w-4 h-4 flex-shrink-0" /> Manager yêu cầu TỪ CHỐI user này.
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <ActionButton icon={X} label="Xác nhận TỪ CHỐI" variant="danger" onClick={() => handleUpdate('rejected')} />
                                    <ActionButton icon={RotateCcw} label="Hủy yêu cầu từ chối" variant="muted" onClick={() => handleUpdate('pending')} />
                                </div>
                            </div>
                        )}

                        {user.status === 'rejected' && (
                            <div className="space-y-3">
                                <div className="p-3 bg-gray-100 border border-gray-200 rounded-lg text-gray-600 text-sm font-semibold">
                                    Tài khoản này đã bị TỪ CHỐI.
                                </div>
                                <div className="flex flex-wrap gap-3">
                                    <ActionButton icon={RotateCcw} label="Hủy từ chối (Khôi phục)" variant="primary" onClick={() => handleUpdate('pending')} />
                                    <ActionButton icon={Trash2} label="Xóa vĩnh viễn" variant="danger-outline" onClick={handleDeletePermanent} />
                                </div>
                            </div>
                        )}

                        {user.status === 'inactive' && (
                            <div className="space-y-3">
                                <div className="p-3 bg-gray-100 border border-gray-200 rounded-lg text-gray-500 text-sm font-semibold">
                                    Tài khoản này đang NGỪNG HOẠT ĐỘNG.
                                </div>
                                <ActionButton icon={RotateCcw} label="Khôi phục hoạt động" variant="success" onClick={() => handleUpdate('active')} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function FormField({ label, children }) {
    return (
        <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
            {children}
        </div>
    );
}

function ActionButton({ icon: Icon, label, variant, onClick }) {
    const styles = {
        primary: 'bg-primary-600 hover:bg-primary-700 text-white',
        success: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        danger: 'bg-red-600 hover:bg-red-700 text-white',
        'danger-outline': 'bg-white border-2 border-red-500 text-red-600 hover:bg-red-50',
        muted: 'bg-gray-500 hover:bg-gray-600 text-white',
    };

    return (
        <button
            onClick={onClick}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors min-h-[44px] ${styles[variant] || styles.primary}`}
        >
            <Icon className="w-4 h-4" /> {label}
        </button>
    );
}
