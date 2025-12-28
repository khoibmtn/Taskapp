import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs, setDoc, doc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function Register() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        fullName: "",
        phone: "",
        email: "",
        departmentId: "",
        position: "Nhân viên",
        password: "",
        confirmPassword: ""
    });
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    // Fetch active departments
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
        const clean = p.replace(/\D/g, ''); // Keep only digits
        return clean.startsWith('0') ? clean.substring(1) : clean;
    };

    const padPassword = (pw) => {
        if (!pw) return pw;
        return pw.padStart(6, '0');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const { fullName, phone, email, departmentId, position, password, confirmPassword } = formData;

        // Basic validations
        if (!fullName || !phone || !departmentId || !password) {
            setError("Vui lòng điền đầy đủ thông tin bắt buộc.");
            setLoading(false);
            return;
        }

        if (password !== confirmPassword) {
            setError("Mật khẩu xác nhận không khớp.");
            setLoading(false);
            return;
        }

        const paddedPassword = padPassword(password);
        const normalizedPhone = normalizePhone(phone);
        if (!normalizedPhone) {
            setError("Số điện thoại không hợp lệ.");
            setLoading(false);
            return;
        }

        try {
            // 1. Check Uniqueness
            // ... (keep uniqueness checks)
            // Phone check
            const phoneQuery = query(collection(db, "users"), where("phone", "==", normalizedPhone));
            const phoneSnap = await getDocs(phoneQuery);
            if (!phoneSnap.empty) {
                throw new Error("Số điện thoại này đã được sử dụng.");
            }

            // Email check (if provided)
            if (email) {
                const emailQuery = query(collection(db, "users"), where("email", "==", email));
                const emailSnap = await getDocs(emailQuery);
                if (!emailSnap.empty) {
                    throw new Error("Email này đã được sử dụng.");
                }
            }

            // 2. Create Auth User
            const authEmail = `${normalizedPhone}@task.app`;
            const userCredential = await createUserWithEmailAndPassword(auth, authEmail, paddedPassword);
            const user = userCredential.user;

            // 3. Create Firestore Document
            await setDoc(doc(db, "users", user.uid), {
                fullName,
                phone: normalizedPhone,
                email: (email && email.trim()) || null,
                authEmail: authEmail,
                departmentId,
                position,
                role: "staff",
                status: "pending",
                createdAt: serverTimestamp()
            });

            setSuccess(true);
            setLoading(false);
        } catch (err) {
            console.error(err);
            setError(err.message.includes("auth/email-already-in-use") ? "Số điện thoại này đã được đăng ký." : err.message);
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f5f7fa', padding: '20px' }}>
                <div style={{ background: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '450px', width: '100%' }}>
                    <div style={{ fontSize: '50px', color: '#4caf50', marginBottom: '20px' }}>✓</div>
                    <h2 style={{ color: '#2c3e50', marginBottom: '15px' }}>Đăng ký thành công</h2>
                    <p style={{ color: '#546e7a', lineHeight: '1.6', marginBottom: '25px' }}>
                        Tài khoản của bạn đã được khởi tạo thành công. Vui lòng chờ <strong>Admin duyệt</strong> trước khi đăng nhập vào hệ thống.
                    </p>
                    <button
                        onClick={() => navigate("/login")}
                        style={{ width: '100%', padding: '12px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        Quay lại Đăng nhập
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f5f7fa', padding: '40px 20px' }}>
            <div style={{ background: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.1)', maxWidth: '500px', width: '100%' }}>
                <h2 style={{ color: '#1976d2', textAlign: 'center', marginBottom: '30px', fontSize: '24px' }}>Đăng ký tài khoản</h2>

                {error && <div style={{ background: '#ffebee', color: '#c62828', padding: '12px', borderRadius: '4px', marginBottom: '20px', fontSize: '14px' }}>{error}</div>}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600', color: '#37474f' }}>Họ và tên <span style={{ color: 'red' }}>*</span></label>
                        <input
                            type="text"
                            placeholder="Nhập họ và tên đầy đủ"
                            value={formData.fullName}
                            onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                            required
                            style={{ width: '100%', padding: '10px', border: '1px solid #cfd8dc', borderRadius: '6px', boxSizing: 'border-box' }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600', color: '#37474f' }}>Số điện thoại <span style={{ color: 'red' }}>*</span></label>
                            <input
                                type="tel"
                                placeholder="09xxxxxxx"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                required
                                style={{ width: '100%', padding: '10px', border: '1px solid #cfd8dc', borderRadius: '6px', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600', color: '#37474f' }}>Email (Tùy chọn)</label>
                            <input
                                type="email"
                                placeholder="example@gmail.com"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                style={{ width: '100%', padding: '10px', border: '1px solid #cfd8dc', borderRadius: '6px', boxSizing: 'border-box' }}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600', color: '#37474f' }}>Khoa / Phòng công tác <span style={{ color: 'red' }}>*</span></label>
                        <select
                            value={formData.departmentId}
                            onChange={e => setFormData({ ...formData, departmentId: e.target.value })}
                            required
                            style={{ width: '100%', padding: '10px', border: '1px solid #cfd8dc', borderRadius: '6px', boxSizing: 'border-box', background: '#fff' }}
                        >
                            <option value="">-- Chọn Khoa/Phòng --</option>
                            {departments.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600', color: '#37474f' }}>Vị trí công tác</label>
                        <select
                            value={formData.position}
                            onChange={e => setFormData({ ...formData, position: e.target.value })}
                            style={{ width: '100%', padding: '10px', border: '1px solid #cfd8dc', borderRadius: '6px', boxSizing: 'border-box', background: '#fff' }}
                        >
                            <option value="Trưởng khoa">Trưởng khoa</option>
                            <option value="Trưởng phòng">Trưởng phòng</option>
                            <option value="Phó trưởng khoa">Phó trưởng khoa</option>
                            <option value="Phó trưởng phòng">Phó trưởng phòng</option>
                            <option value="Điều dưỡng trưởng">Điều dưỡng trưởng</option>
                            <option value="Nhân viên">Nhân viên</option>
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600', color: '#37474f' }}>Mật khẩu <span style={{ color: 'red' }}>*</span></label>
                            <input
                                type="password"
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                required
                                style={{ width: '100%', padding: '10px', border: '1px solid #cfd8dc', borderRadius: '6px', boxSizing: 'border-box' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '600', color: '#37474f' }}>Xác nhận mật khẩu <span style={{ color: 'red' }}>*</span></label>
                            <input
                                type="password"
                                value={formData.confirmPassword}
                                onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                                required
                                style={{ width: '100%', padding: '10px', border: '1px solid #cfd8dc', borderRadius: '6px', boxSizing: 'border-box' }}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            marginTop: '10px',
                            padding: '14px',
                            background: '#1976d2',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            transition: 'background 0.3s'
                        }}
                    >
                        {loading ? "Đang xử lý..." : "Đăng ký"}
                    </button>

                    <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '14px' }}>
                        Đã có tài khoản? <Link to="/login" style={{ color: '#1976d2', textDecoration: 'none', fontWeight: '600' }}>Đăng nhập ngay</Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
