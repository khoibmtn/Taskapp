import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";

export default function AdminManagement() {
    const { userProfile, currentUser } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("personnel"); // "personnel", "users", "departments"

    // --- Personnel Management State ---
    const [deptUsers, setDeptUsers] = useState([]);
    const [personnelLoading, setPersonnelLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userMap, setUserMap] = useState({});

    // --- User Approval State ---
    const [statusTab, setStatusTab] = useState("pending");
    const [allUsers, setAllUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [departmentMap, setDepartmentMap] = useState({});

    // --- Department State ---
    const [departments, setDepartments] = useState([]);
    const [deptsLoading, setDeptsLoading] = useState(true);

    const ROLE_LABELS = {
        admin: "Quản trị viên",
        manager: "Trưởng khoa/phòng",
        asigner: "Giao việc",
        staff: "Nhân viên"
    };

    const STATUS_LABELS = {
        active: "Đang hoạt động",
        pending: "Chờ duyệt",
        reject_request: "Chờ Admin từ chối",
        delete_request: "Chờ Admin xóa",
        rejected: "Bị từ chối",
        inactive: "Ngừng hoạt động"
    };

    const userTabs = [
        { id: 'pending', label: 'Chờ duyệt' },
        { id: 'reject_request', label: 'YC Từ chối' },
        { id: 'active', label: 'Hoạt động' },
        { id: 'delete_request', label: 'YC Xóa' },
        { id: 'rejected', label: 'Từ chối' },
        { id: 'inactive', label: 'Ngừng HĐ' }
    ];

    // --- Fetch Personnel (real-time) ---
    useEffect(() => {
        if (!userProfile?.selectedDepartmentId) {
            setPersonnelLoading(false);
            return;
        }
        const deptId = userProfile.selectedDepartmentId;
        const usersRef = collection(db, "users");
        setPersonnelLoading(true);

        const unsub = onSnapshot(query(usersRef, where("departmentIds", "array-contains", deptId)), (snap) => {
            const rawUsers = [];
            snap.forEach(d => rawUsers.push({ id: d.id, ...d.data() }));
            setDeptUsers(rawUsers.filter(u => u.status !== 'rejected' && u.status !== 'inactive'));
            setUserMap(prev => {
                const next = { ...prev };
                snap.forEach(d => { next[d.id] = d.data(); });
                return next;
            });
            setPersonnelLoading(false);
        });
        return () => unsub();
    }, [userProfile?.selectedDepartmentId]);

    // --- Fetch Departments (once for lookup & list) ---
    useEffect(() => {
        async function fetchDepts() {
            setDeptsLoading(true);
            try {
                const snap = await getDocs(collection(db, "departments"));
                const fetched = [];
                const deptMap = {};
                snap.forEach(d => {
                    fetched.push({ id: d.id, ...d.data() });
                    deptMap[d.id] = d.data().name;
                });
                fetched.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
                setDepartments(fetched);
                setDepartmentMap(deptMap);
            } catch (err) {
                console.error("Error fetching departments:", err);
            } finally {
                setDeptsLoading(false);
            }
        }
        fetchDepts();
    }, []);

    // --- Fetch Users by status ---
    useEffect(() => {
        async function fetchUsers() {
            setUsersLoading(true);
            try {
                const q = query(collection(db, "users"), where("status", "==", statusTab));
                const snapshot = await getDocs(q);
                const fetched = [];
                snapshot.forEach(d => fetched.push({ id: d.id, ...d.data() }));
                fetched.sort((a, b) => {
                    const tA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                    const tB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                    return tA - tB;
                });
                setAllUsers(fetched);
            } catch (err) {
                console.error("Error fetching users:", err);
            } finally {
                setUsersLoading(false);
            }
        }
        fetchUsers();
    }, [statusTab]);

    const handleUserStatusUpdate = async (targetUid, newStatus) => {
        try {
            const updates = { status: newStatus };
            if (newStatus === 'active') {
                updates.approvedAt = serverTimestamp();
                updates.approvedBy = currentUser.uid;
            }
            await updateDoc(doc(db, "users", targetUid), updates);
            alert("Cập nhật thành công!");
        } catch (err) {
            console.error(err);
            alert("Lỗi: " + err.message);
        }
    };

    const handleRoleUpdate = async (targetUid, newRole) => {
        try {
            await updateDoc(doc(db, "users", targetUid), { role: newRole });
            alert("Cập nhật quyền thành công!");
        } catch (err) {
            console.error(err);
            alert("Lỗi: " + err.message);
        }
    };

    const getUserName = (uid) => {
        const u = userMap[uid];
        if (!u) return uid?.substring?.(0, 8) || 'N/A';
        return u.fullName || (u.email && !u.email.endsWith('@task.app') ? u.email : null) || uid.substring(0, 8);
    };

    const getStatusLabel = (s) => {
        switch (s) {
            case 'pending': return <span style={{ color: 'orange' }}>Chờ duyệt</span>;
            case 'reject_request': return <span style={{ color: 'red', fontWeight: 'bold' }}>YC Từ chối</span>;
            case 'active': return <span style={{ color: 'green' }}>Hoạt động</span>;
            case 'delete_request': return <span style={{ color: 'red', fontWeight: 'bold' }}>YC Xóa</span>;
            case 'rejected': return <span style={{ color: 'red' }}>Từ chối</span>;
            case 'inactive': return <span style={{ color: '#757575' }}>Ngừng HĐ</span>;
            default: return s;
        }
    };

    const isManagerOrAdmin = userProfile?.role === 'manager' || userProfile?.role === 'admin';

    // --- Render Tab Content ---
    const renderPersonnelTab = () => {
        if (personnelLoading) return <p>Đang tải...</p>;
        if (!userProfile?.selectedDepartmentId) return <p>Vui lòng chọn khoa/phòng.</p>;

        return (
            <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f5f5f5', textAlign: 'left' }}>
                        <tr>
                            <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Họ tên</th>
                            <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Quyền</th>
                            <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Trạng thái</th>
                            <th style={{ padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'right' }}>Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {deptUsers.map(u => (
                            <tr key={u.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '12px' }}>
                                    <div style={{ fontWeight: 'bold' }}>{u.fullName}</div>
                                    <div style={{ fontSize: '0.8em', color: '#666' }}>{u.phone}</div>
                                </td>
                                <td style={{ padding: '12px' }}>
                                    {(u.status === 'active' && isManagerOrAdmin && u.role !== 'admin' && u.role !== 'manager') ? (
                                        <select value={u.role || 'staff'} onChange={(e) => handleRoleUpdate(u.id, e.target.value)} style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}>
                                            <option value="staff">Nhân viên</option>
                                            <option value="asigner">Giao việc</option>
                                        </select>
                                    ) : (
                                        <span style={{ fontSize: '0.9em' }}>{ROLE_LABELS[u.role] || u.role}</span>
                                    )}
                                </td>
                                <td style={{ padding: '12px' }}>
                                    <span style={{
                                        padding: '4px 8px', borderRadius: '12px', fontSize: '0.8em',
                                        background: u.status === 'active' ? '#e8f5e9' : (u.status === 'pending' || u.status === 'reject_request') ? '#fff3e0' : u.status === 'delete_request' ? '#ffebee' : '#f5f5f5',
                                        color: u.status === 'active' ? '#2e7d32' : (u.status === 'pending' || u.status === 'reject_request') ? '#ef6c00' : u.status === 'delete_request' ? '#d32f2f' : '#666'
                                    }}>
                                        {STATUS_LABELS[u.status] || u.status}
                                    </span>
                                </td>
                                <td style={{ padding: '12px', textAlign: 'right' }}>
                                    <button onClick={() => setSelectedUser(u)} style={{ padding: '5px 10px', background: '#f5f5f5', color: '#333', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', marginRight: '5px' }}>Xem</button>
                                    {u.status === 'pending' && (
                                        <>
                                            <button onClick={() => handleUserStatusUpdate(u.id, 'active')} style={{ padding: '5px 10px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '5px' }}>Duyệt</button>
                                            <button onClick={() => { if (window.confirm(`Yêu cầu từ chối nhân viên ${u.fullName}?`)) handleUserStatusUpdate(u.id, 'reject_request'); }} style={{ padding: '5px 10px', background: '#c62828', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '5px' }}>Từ chối</button>
                                        </>
                                    )}
                                    {u.status === 'reject_request' && (<button onClick={() => handleUserStatusUpdate(u.id, 'pending')} style={{ padding: '5px 10px', background: '#757575', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Hủy YC</button>)}
                                    {u.status === 'active' && u.id !== currentUser.uid && u.role !== 'admin' && (<button onClick={() => { if (window.confirm(`Gửi yêu cầu xóa ${u.fullName}?`)) handleUserStatusUpdate(u.id, 'delete_request'); }} style={{ padding: '5px 10px', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Xóa</button>)}
                                    {u.status === 'delete_request' && (<button onClick={() => handleUserStatusUpdate(u.id, 'active')} style={{ padding: '5px 10px', background: '#757575', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Hủy YC</button>)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderUsersTab = () => (
        <div>
            {/* Sub-Tabs - square style like original */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '0', borderBottom: '1px solid #ddd', overflowX: 'auto' }}>
                {userTabs.map(tab => (
                    <button key={tab.id} onClick={() => setStatusTab(tab.id)} style={{
                        padding: '10px 20px',
                        background: statusTab === tab.id ? '#1976d2' : 'transparent',
                        color: statusTab === tab.id ? '#fff' : '#333',
                        border: 'none',
                        borderRadius: '4px 4px 0 0',
                        cursor: 'pointer',
                        fontWeight: statusTab === tab.id ? 'bold' : 'normal',
                        whiteSpace: 'nowrap'
                    }}>{tab.label}</button>
                ))}
            </div>
            {usersLoading ? <p>Đang tải...</p> : (
                <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '4px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                                <th style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Họ tên</th>
                                <th style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Khoa/Phòng</th>
                                <th style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Vị trí</th>
                                <th style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>ĐT</th>
                                <th style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Trạng thái</th>
                                <th style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allUsers.length === 0 ? (
                                <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center', fontStyle: 'italic' }}>Không có.</td></tr>
                            ) : (
                                allUsers.map(user => (
                                    <tr key={user.id} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '12px' }}>{user.fullName || user.displayName}</td>
                                        <td style={{ padding: '12px', fontSize: '0.9em' }}>
                                            {user.departmentIds?.length > 0 ? user.departmentIds.map(id => departmentMap[id] || id).join(", ") : (departmentMap[user.departmentId] || user.departmentId || '-')}
                                        </td>
                                        <td style={{ padding: '12px' }}>{user.position}</td>
                                        <td style={{ padding: '12px' }}>{user.phone}</td>
                                        <td style={{ padding: '12px' }}>{getStatusLabel(user.status)}</td>
                                        <td style={{ padding: '12px' }}>
                                            <button onClick={() => navigate(`/admin/users/${user.id}`)} style={{ padding: '5px 10px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                                {statusTab === 'pending' || statusTab === 'delete_request' ? 'Xử lý' : 'Chi tiết'}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

    const renderDepartmentsTab = () => (
        <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '15px' }}>
                <Link to="/admin/departments/new" style={{ background: '#1976d2', color: 'white', padding: '8px 16px', textDecoration: 'none', borderRadius: '4px', fontWeight: 'bold' }}>+ Thêm Khoa/Phòng</Link>
            </div>
            {deptsLoading ? <p>Đang tải...</p> : (
                <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                                <th style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Tên đơn vị</th>
                                <th style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Loại</th>
                                <th style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Trạng thái</th>
                                <th style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {departments.length === 0 ? (
                                <tr><td colSpan="4" style={{ padding: '20px', textAlign: 'center' }}>Chưa có.</td></tr>
                            ) : (
                                departments.map(d => (
                                    <tr key={d.id} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{d.name}</td>
                                        <td style={{ padding: '12px' }}>{d.type === 'khoa' ? 'Khoa' : 'Phòng'}</td>
                                        <td style={{ padding: '12px' }}>
                                            {d.isActive ? <span style={{ color: 'green', background: '#e8f5e9', padding: '4px 8px', borderRadius: '4px', fontSize: '0.9em' }}>Hoạt động</span> : <span style={{ color: 'red', background: '#ffebee', padding: '4px 8px', borderRadius: '4px', fontSize: '0.9em' }}>Ngừng</span>}
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <button onClick={() => navigate(`/admin/departments/${d.id}`)} style={{ padding: '5px 10px', background: '#fff', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}>Sửa</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

    return (
        <div style={{ padding: '20px' }}>
            <h2 style={{ marginBottom: '20px' }}>Quản lý Khoa, Phòng</h2>

            {/* Main Tabs */}
            <div style={{ display: 'flex', gap: '5px', marginBottom: '25px', background: '#e0e0e0', borderRadius: '25px', padding: '4px', width: 'fit-content' }}>
                <button onClick={() => setActiveTab('personnel')} style={{
                    padding: '10px 20px', borderRadius: '20px', border: 'none',
                    background: activeTab === 'personnel' ? '#fff' : 'transparent',
                    color: activeTab === 'personnel' ? '#1976d2' : '#555',
                    fontWeight: activeTab === 'personnel' ? 'bold' : 'normal',
                    boxShadow: activeTab === 'personnel' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer'
                }}>Quản lý Nhân sự</button>
                <button onClick={() => setActiveTab('users')} style={{
                    padding: '10px 20px', borderRadius: '20px', border: 'none',
                    background: activeTab === 'users' ? '#fff' : 'transparent',
                    color: activeTab === 'users' ? '#1976d2' : '#555',
                    fontWeight: activeTab === 'users' ? 'bold' : 'normal',
                    boxShadow: activeTab === 'users' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer'
                }}>Duyệt người dùng</button>
                <button onClick={() => setActiveTab('departments')} style={{
                    padding: '10px 20px', borderRadius: '20px', border: 'none',
                    background: activeTab === 'departments' ? '#fff' : 'transparent',
                    color: activeTab === 'departments' ? '#1976d2' : '#555',
                    fontWeight: activeTab === 'departments' ? 'bold' : 'normal',
                    boxShadow: activeTab === 'departments' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                    cursor: 'pointer'
                }}>Quản lý khoa phòng</button>
            </div>

            {activeTab === 'personnel' && renderPersonnelTab()}
            {activeTab === 'users' && renderUsersTab()}
            {activeTab === 'departments' && renderDepartmentsTab()}

            {/* User Detail Modal */}
            {selectedUser && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#fff', padding: '30px', borderRadius: '8px', maxWidth: '500px', width: '90%', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                        <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Chi tiết nhân sự</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px', marginTop: '20px' }}>
                            <div style={{ fontWeight: 'bold' }}>Họ tên:</div><div>{selectedUser.fullName}</div>
                            <div style={{ fontWeight: 'bold' }}>SĐT:</div><div>{selectedUser.phone}</div>
                            <div style={{ fontWeight: 'bold' }}>Email:</div><div>{selectedUser.email || ''}</div>
                            <div style={{ fontWeight: 'bold' }}>Vị trí:</div><div>{selectedUser.position}</div>
                            <div style={{ fontWeight: 'bold' }}>Quyền:</div><div>{ROLE_LABELS[selectedUser.role] || selectedUser.role}</div>
                            <div style={{ fontWeight: 'bold' }}>Trạng thái:</div><div>{STATUS_LABELS[selectedUser.status] || selectedUser.status}</div>
                            <div style={{ fontWeight: 'bold' }}>Tham gia:</div><div>{selectedUser.createdAt?.toDate ? selectedUser.createdAt.toDate().toLocaleDateString('vi-VN') : 'N/A'}</div>
                            {selectedUser.status !== 'pending' && (<><div style={{ fontWeight: 'bold' }}>Duyệt bởi:</div><div>{getUserName(selectedUser.approvedBy) || 'N/A'}</div></>)}
                        </div>
                        <div style={{ marginTop: '30px', textAlign: 'right' }}>
                            <button onClick={() => setSelectedUser(null)} style={{ padding: '8px 20px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Đóng</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
