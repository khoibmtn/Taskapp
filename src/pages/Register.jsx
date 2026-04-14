import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs, setDoc, doc, serverTimestamp, getDoc, runTransaction } from "firebase/firestore";
import { auth, db } from "../firebase";
import { ClipboardCheck, CheckCircle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export default function Register() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        fullName: "",
        nickname: "",
        phone: "",
        email: "",
        departmentId: "",
        position: "Nhân viên",
        password: "",
        confirmPassword: ""
    });
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        async function fetchDepts() {
            try {
                const q = query(collection(db, "departments"), where("isActive", "==", true));
                const snap = await getDocs(q);
                const list = snap.docs.map(d => ({ id: d.id, name: d.data().name }));
                setDepartments(list);
            } catch (err) {
                console.error("Error fetching departments:", err);
            }
        }
        fetchDepts();
    }, []);

    const normalizePhone = (p) => {
        const clean = p.replace(/\D/g, '');
        return clean.startsWith('0') ? clean.substring(1) : clean;
    };

    const padPassword = (pw) => {
        if (!pw) return pw;
        return pw.padStart(6, '0');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const { fullName, nickname, phone, email, departmentId, position, password, confirmPassword } = formData;

        if (!fullName || !phone || !departmentId || !password) {
            toast.error("Vui lòng điền đầy đủ thông tin bắt buộc.");
            setLoading(false);
            return;
        }
        
        let finalNickname = nickname ? nickname.trim().toLowerCase() : "";
        if (finalNickname && !/^[a-z0-9_]{3,20}$/.test(finalNickname)) {
            toast.error("Nickname phải từ 3-20 kí tự, chỉ gồm chữ thường, số, dấu gạch dưới.");
            setLoading(false);
            return;
        }

        if (password !== confirmPassword) {
            toast.error("Mật khẩu xác nhận không khớp.");
            setLoading(false);
            return;
        }

        const paddedPassword = padPassword(password);
        const normalizedPhone = normalizePhone(phone);
        if (!normalizedPhone) {
            toast.error("Số điện thoại không hợp lệ.");
            setLoading(false);
            return;
        }

        try {
            const phoneQuery1 = query(collection(db, "users"), where("phone", "==", normalizedPhone));
            const phoneQuery2 = query(collection(db, "users"), where("phoneNumber", "==", normalizedPhone));
            const [phoneSnap1, phoneSnap2] = await Promise.all([getDocs(phoneQuery1), getDocs(phoneQuery2)]);
            if (!phoneSnap1.empty || !phoneSnap2.empty) {
                throw new Error("Số điện thoại này đã được sử dụng.");
            }

            if (email) {
                const emailQuery = query(collection(db, "users"), where("email", "==", email));
                const emailSnap = await getDocs(emailQuery);
                if (!emailSnap.empty) {
                    throw new Error("Email này đã được sử dụng.");
                }
            }

            if (finalNickname) {
                const nickSnap = await getDoc(doc(db, "nicknames", finalNickname));
                if (nickSnap.exists()) {
                    throw new Error("Nickname này đã có người sử dụng. Vui lòng chọn tên khác!");
                }
            }

            const authEmail = `${normalizedPhone}@task.app`;
            const userCredential = await createUserWithEmailAndPassword(auth, authEmail, paddedPassword);
            const user = userCredential.user;

            await runTransaction(db, async (transaction) => {
                if (finalNickname) {
                    const newNicknameRef = doc(db, "nicknames", finalNickname);
                    const newNickDoc = await transaction.get(newNicknameRef);
                    if (newNickDoc.exists()) {
                        throw new Error("Nickname này vừa bị người khác đăng ký.");
                    }
                    transaction.set(newNicknameRef, { uid: user.uid, createdAt: serverTimestamp() });
                }

                transaction.set(doc(db, "users", user.uid), {
                    fullName,
                    displayName: fullName,
                    nickname: finalNickname,
                    phone: normalizedPhone,
                    phoneNumber: normalizedPhone,
                    email: (email && email.trim()) || null,
                    authEmail: authEmail,
                    departmentId,
                    departmentIds: [departmentId],
                    position,
                    role: "staff",
                    status: "pending",
                    createdAt: serverTimestamp()
                });
            });

            setSuccess(true);
            setLoading(false);
        } catch (err) {
            console.error(err);
            toast.error(err.message.includes("auth/email-already-in-use") ? "Số điện thoại này đã được đăng ký." : err.message);
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-dvh flex items-center justify-center bg-gray-50 px-4 py-8">
                <div className="w-full max-w-sm text-center">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success-100 mb-4">
                            <CheckCircle className="w-8 h-8 text-success-500" />
                        </div>
                        <h2 className="font-heading text-xl font-bold text-gray-900 mb-3">Đăng ký thành công</h2>
                        <p className="text-sm text-gray-500 leading-relaxed mb-6">
                            Tài khoản đã được khởi tạo. Vui lòng chờ <strong className="text-gray-700">Admin duyệt</strong> trước khi đăng nhập.
                        </p>
                        <button
                            onClick={() => navigate("/login")}
                            className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors min-h-[48px]"
                        >
                            Quay lại Đăng nhập
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const inputClass = "w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-base text-gray-900 placeholder:text-gray-400 focus-ring transition-colors";
    const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

    return (
        <div className="min-h-dvh flex items-center justify-center bg-gray-50 px-4 py-8">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-100 mb-4">
                        <ClipboardCheck className="w-7 h-7 text-primary-600" />
                    </div>
                    <h1 className="font-heading text-2xl font-bold text-gray-900">Đăng ký tài khoản</h1>
                    <p className="text-sm text-gray-500 mt-1">Tạo tài khoản mới để sử dụng hệ thống</p>
                </div>

                {/* Form Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className={labelClass}>Họ và tên <span className="text-danger-500">*</span></label>
                            <input
                                type="text"
                                placeholder="Nhập họ và tên đầy đủ"
                                value={formData.fullName}
                                onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                                required
                                className={inputClass}
                            />
                        </div>
                        
                        <div>
                            <label className={labelClass}>
                                Nickname <span className="text-gray-400 font-normal">(Không bắt buộc)</span>
                            </label>
                            <input
                                type="text"
                                value={formData.nickname}
                                onChange={e => setFormData({ ...formData, nickname: e.target.value })}
                                className={`${inputClass} lowercase`}
                                placeholder="lynh_190"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Số điện thoại <span className="text-danger-500">*</span></label>
                                <input
                                    type="tel"
                                    placeholder="09xxxxxxx"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    required
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Email <span className="text-gray-400 font-normal">(Tùy chọn)</span></label>
                                <input
                                    type="email"
                                    placeholder="example@gmail.com"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className={inputClass}
                                />
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>Khoa / Phòng công tác <span className="text-danger-500">*</span></label>
                            <select
                                value={formData.departmentId}
                                onChange={e => setFormData({ ...formData, departmentId: e.target.value })}
                                required
                                className={inputClass}
                            >
                                <option value="">-- Chọn Khoa/Phòng --</option>
                                {departments.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className={labelClass}>Vị trí công tác</label>
                            <select
                                value={formData.position}
                                onChange={e => setFormData({ ...formData, position: e.target.value })}
                                className={inputClass}
                            >
                                <option value="Trưởng khoa">Trưởng khoa</option>
                                <option value="Trưởng phòng">Trưởng phòng</option>
                                <option value="Phó trưởng khoa">Phó trưởng khoa</option>
                                <option value="Phó trưởng phòng">Phó trưởng phòng</option>
                                <option value="Điều dưỡng trưởng">Điều dưỡng trưởng</option>
                                <option value="Nhân viên">Nhân viên</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Mật khẩu <span className="text-danger-500">*</span></label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    required
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Xác nhận mật khẩu <span className="text-danger-500">*</span></label>
                                <input
                                    type="password"
                                    value={formData.confirmPassword}
                                    onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                                    required
                                    className={inputClass}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 py-3 mt-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold rounded-xl text-base transition-colors min-h-[48px]"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Đang xử lý...
                                </>
                            ) : (
                                "Đăng ký"
                            )}
                        </button>

                        <div className="text-center text-sm text-gray-500 pt-2">
                            Đã có tài khoản?{' '}
                            <Link to="/login" className="text-primary-600 font-semibold hover:text-primary-700">
                                Đăng nhập ngay
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
