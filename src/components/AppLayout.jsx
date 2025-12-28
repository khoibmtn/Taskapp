import { useEffect, useState } from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { auth, db } from "../firebase";
import { doc, getDoc, getDocs, collection } from "firebase/firestore";

export default function AppLayout() {
    const { userProfile, switchDepartment } = useAuth();
    const navigate = useNavigate();
    const [myDepartments, setMyDepartments] = useState([]);

    useEffect(() => {
        async function fetchDeptNames() {
            try {
                if (userProfile?.role === "admin") {
                    // Admin can see all departments
                    const snap = await getDocs(collection(db, "departments"));
                    const allDepts = [];
                    snap.forEach(doc => allDepts.push({ id: doc.id, name: doc.data().name }));
                    setMyDepartments(allDepts);
                } else if (userProfile?.departmentIds) {
                    const depts = [];
                    for (const id of userProfile.departmentIds) {
                        const dSnap = await getDoc(doc(db, "departments", id));
                        if (dSnap.exists()) {
                            depts.push({ id, name: dSnap.data().name });
                        }
                    }
                    setMyDepartments(depts);
                }
            } catch (err) {
                console.error("Error fetching dept names:", err);
            }
        }
        fetchDeptNames();
    }, [userProfile?.departmentIds, userProfile?.role]);

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

                <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                    {myDepartments.length > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#e3f2fd', padding: '5px 12px', borderRadius: '20px', border: '1px solid #bbdefb' }}>
                            <span style={{ fontSize: '0.9em', color: '#1565c0', fontWeight: 'bold' }}>📍 Đang ở:</span>
                            <select
                                value={userProfile?.selectedDepartmentId}
                                onChange={(e) => switchDepartment(e.target.value)}
                                style={{ border: 'none', background: 'transparent', fontWeight: 'bold', color: '#0d47a1', cursor: 'pointer', outline: 'none' }}
                            >
                                {myDepartments.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    {myDepartments.length === 1 && (
                        <div style={{ fontSize: '0.9em', color: '#666' }}>
                            Khoa/Phòng: <strong>{myDepartments[0].name}</strong>
                        </div>
                    )}
                    <div style={{ borderLeft: '1px solid #ccc', height: '20px' }}></div>
                    <span>Xin chào, <strong>{userProfile?.fullName || 'User'}</strong></span>
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
                        {(userProfile?.role === 'manager' || userProfile?.role === 'admin' || userProfile?.role === 'asigner') && (
                            <li style={{ marginBottom: '10px' }}>
                                <Link to="/manager/dashboard" style={{ textDecoration: 'none', color: '#333' }}>Dashboard Quản lý</Link>
                            </li>
                        )}
                        <li style={{ marginBottom: '10px' }}>
                            <Link to="/app/create-task" style={{ textDecoration: 'none', color: '#1976d2', fontWeight: 'bold' }}>+ Giao việc mới</Link>
                        </li>
                        <li style={{ marginBottom: '10px' }}>
                            <Link to="/app/tasks" style={{ textDecoration: 'none', color: '#333' }}>Công việc</Link>
                        </li>
                        {userProfile?.role === 'admin' && (
                            <li style={{ marginBottom: '10px' }}>
                                <Link to="/admin/management" style={{ textDecoration: 'none', color: '#d32f2f', fontWeight: 'bold' }}>⚡ Quản lý khoa, phòng</Link>
                            </li>
                        )}
                        {userProfile?.role === 'manager' && (
                            <li style={{ marginBottom: '10px' }}>
                                <Link to="/manager/personnel" style={{ textDecoration: 'none', color: '#333' }}>Quản lý Nhân sự</Link>
                            </li>
                        )}
                        <li style={{ marginBottom: '10px' }}>
                            <Link to="/app/settings" style={{ textDecoration: 'none', color: '#333' }}>Cài đặt</Link>
                        </li>
                        <li style={{ marginBottom: '10px' }}>
                            <Link to="/app/notifications" style={{ textDecoration: 'none', color: '#333' }}>Thông báo</Link>
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
