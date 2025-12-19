import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { auth } from "../firebase";

export default function AppLayout() {
    const { userProfile } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await auth.signOut();
            navigate("/login");
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            {/* Header */}
            <header style={{
                padding: '10px 20px',
                borderBottom: '1px solid #ddd',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8f9fa'
            }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.2em' }}>Ứng dụng giao việc</div>

                <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <span>Xin chào, <strong>{userProfile?.name || userProfile?.email || 'User'}</strong></span>
                    <button
                        onClick={handleLogout}
                        style={{
                            padding: '5px 10px',
                            cursor: 'pointer',
                            background: '#fff',
                            border: '1px solid #ccc',
                            borderRadius: '4px'
                        }}
                    >
                        Đăng xuất
                    </button>
                </div>
            </header>

            <div style={{ display: 'flex', flex: 1 }}>
                {/* Sidebar / Navigation */}
                <nav style={{
                    width: '200px',
                    borderRight: '1px solid #ddd',
                    padding: '20px',
                    background: '#fff'
                }}>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        <li style={{ marginBottom: '10px' }}>
                            <Link to="/app" style={{ textDecoration: 'none', color: '#333' }}>Dashboard</Link>
                        </li>
                        <li style={{ marginBottom: '10px' }}>
                            <Link to="/app/tasks" style={{ textDecoration: 'none', color: '#333' }}>Công việc</Link>
                        </li>
                        <li style={{ marginBottom: '10px' }}>
                            <Link to="/app/settings" style={{ textDecoration: 'none', color: '#333' }}>Cài đặt</Link>
                        </li>
                    </ul>
                </nav>

                {/* Main Content Area */}
                <main style={{ flex: 1, padding: '20px' }}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
