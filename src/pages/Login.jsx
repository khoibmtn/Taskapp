import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useNavigate, Link } from "react-router-dom";
import { ClipboardCheck, Eye, EyeOff, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export default function Login() {
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
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
        setLoading(true);

        let loginEmail = identifier.trim();
        let targetAuthEmail = null;

        try {
            if (loginEmail.includes('@')) {
                const q = query(collection(db, "users"), where("email", "==", loginEmail), limit(1));
                const snap = await getDocs(q);

                if (!snap.empty) {
                    targetAuthEmail = snap.docs[0].data().authEmail;
                } else {
                    toast.error("Không tìm thấy tài khoản với email này.");
                    setLoading(false);
                    return;
                }
            } else {
                const cleanPhone = loginEmail.replace(/\s/g, '');
                const q = query(collection(db, "users"), where("phone", "==", cleanPhone), limit(1));
                const snap = await getDocs(q);

                if (!snap.empty) {
                    targetAuthEmail = snap.docs[0].data().authEmail;
                } else {
                    toast.error("Không tìm thấy tài khoản với số điện thoại này.");
                    setLoading(false);
                    return;
                }
            }
        } catch (err) {
            console.error("Lookup error:", err);
            toast.error("Lỗi khi tìm kiếm tài khoản: " + err.message);
            setLoading(false);
            return;
        }

        loginEmail = targetAuthEmail;
        const paddedPassword = padPassword(password);

        try {
            await signInWithEmailAndPassword(auth, loginEmail, paddedPassword);
            navigate("/app");
        } catch (err) {
            console.error(err);
            if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                toast.error("Thông tin đăng nhập không chính xác.");
            } else {
                toast.error("Đã xảy ra lỗi: " + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-dvh flex items-center justify-center bg-gray-50 px-4 py-8">
            <div className="w-full max-w-sm">
                {/* Logo & Title */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-100 mb-4">
                        <ClipboardCheck className="w-7 h-7 text-primary-600" />
                    </div>
                    <h1 className="font-heading text-2xl font-bold text-gray-900">TaskApp</h1>
                    <p className="text-sm text-gray-500 mt-1">Đăng nhập để tiếp tục</p>
                </div>

                {/* Form Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Email hoặc Số điện thoại
                            </label>
                            <input
                                type="text"
                                placeholder="Nhập email hoặc SĐT"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                required
                                autoComplete="username"
                                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-base text-gray-900 placeholder:text-gray-400 focus-ring transition-colors"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                Mật khẩu
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Nhập mật khẩu"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                    className="w-full px-3.5 py-2.5 pr-11 rounded-xl border border-gray-300 text-base text-gray-900 placeholder:text-gray-400 focus-ring transition-colors"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold rounded-xl text-base transition-colors min-h-[48px]"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Đang đăng nhập...
                                </>
                            ) : (
                                "Đăng nhập"
                            )}
                        </button>
                    </form>
                </div>

                {/* Register link */}
                <div className="mt-6 text-center text-sm text-gray-500">
                    Chưa có tài khoản?{' '}
                    <Link to="/register" className="text-primary-600 font-semibold hover:text-primary-700">
                        Đăng ký ngay
                    </Link>
                </div>
            </div>
        </div>
    );
}
