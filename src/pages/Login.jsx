import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";

export default function Login() {
    const [identifier, setIdentifier] = useState(""); // Can be email or phone
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const normalizePhone = (p) => {
        const clean = p.replace(/\D/g, '');
        return clean.startsWith('0') ? clean.substring(1) : clean;
    };

    const padPassword = (pw) => {
        if (!pw) return pw;
        return pw.padStart(6, '0');
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        let loginEmail = identifier.trim();

        // 1. Logic for phone or real email lookup
        const digitsOnly = loginEmail.replace(/\D/g, '');
        const isPotentialPhone = digitsOnly.length >= 8 && !loginEmail.includes('@');

        if (isPotentialPhone) {
            const normalized = normalizePhone(digitsOnly);
            loginEmail = `${normalized}@task.app`;
        } else if (loginEmail.includes('@') && !loginEmail.endsWith('@task.app')) {
            // It's a real email, look up the authEmail in Firestore
            try {
                const q = query(collection(db, "users"), where("email", "==", loginEmail));
                const querySnapshot = await getDocs(q);
                if (querySnapshot.empty) {
                    setError("Email này chưa được đăng ký trong hệ thống.");
                    setLoading(false);
                    return;
                }
                // Use the authEmail stored in the user document
                loginEmail = querySnapshot.docs[0].data().authEmail;
            } catch (err) {
                console.error("Error looking up email:", err);
                setError("Lỗi khi kiểm tra tài khoản: " + err.message);
                setLoading(false);
                return;
            }
        }

        const paddedPassword = padPassword(password);

        try {
            await signInWithEmailAndPassword(auth, loginEmail, paddedPassword);
            navigate("/app");
        } catch (err) {
            console.error(err);
            if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                setError("Thông tin đăng nhập không chính xác.");
            } else {
                setError("Đã xảy ra lỗi: " + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f5f7fa', padding: '20px' }}>
            <div style={{ background: '#fff', padding: '40px', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.1)', maxWidth: '400px', width: '100%' }}>
                <h2 style={{ color: '#1976d2', textAlign: 'center', marginBottom: '30px' }}>Đăng nhập hệ thống</h2>

                {error && <div style={{ background: '#ffebee', color: '#c62828', padding: '12px', borderRadius: '4px', marginBottom: '20px', fontSize: '14px' }}>{error}</div>}

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#37474f' }}>Email hoặc Số điện thoại</label>
                        <input
                            type="text"
                            placeholder="Nhập email hoặc SĐT"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            required
                            style={{ width: '100%', padding: '12px', border: '1px solid #cfd8dc', borderRadius: '6px', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#37474f' }}>Mật khẩu</label>
                        <input
                            type="password"
                            placeholder="Nhập mật khẩu"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            style={{ width: '100%', padding: '12px', border: '1px solid #cfd8dc', borderRadius: '6px', boxSizing: 'border-box' }}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            padding: '14px',
                            background: '#1976d2',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            marginTop: '10px'
                        }}
                    >
                        {loading ? "Đang đăng nhập..." : "Đăng nhập"}
                    </button>
                </form>

                <div style={{ marginTop: '25px', textAlign: 'center', fontSize: '14px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                    Chưa có tài khoản? <Link to="/register" style={{ color: '#1976d2', textDecoration: 'none', fontWeight: '600' }}>Đăng ký ngay</Link>
                </div>
            </div>
        </div>
    );
}
