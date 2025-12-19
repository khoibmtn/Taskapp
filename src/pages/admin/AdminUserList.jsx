import { useEffect, useState } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import { useNavigate } from "react-router-dom";

export default function AdminUserList() {
    const navigate = useNavigate();
    const [statusTab, setStatusTab] = useState("pending"); // pending | active | rejected
    const [users, setUsers] = useState([]);
    const [departments, setDepartments] = useState({});
    const [loading, setLoading] = useState(false);

    // Fetch Departments once for lookup
    useEffect(() => {
        async function fetchDepts() {
            try {
                const snap = await getDocs(collection(db, "departments"));
                const deptMap = {};
                snap.forEach(doc => {
                    deptMap[doc.id] = doc.data().name;
                });
                setDepartments(deptMap);
            } catch (err) {
                console.error("Error fetching departments:", err);
            }
        }
        fetchDepts();
    }, []);

    // Fetch Users when tab changes
    useEffect(() => {
        async function fetchUsers() {
            setLoading(true);
            try {
                const usersRef = collection(db, "users");
                // Note: Firestore requires index for compound queries (status + createdAt).
                // If index missing, it will throw an error with a link to create it.
                // For safety/simplicity in dev without auto-index creation, we might drop orderBy if it fails, 
                // but let's try standard req first.
                const q = query(
                    usersRef,
                    where("status", "==", statusTab)
                );

                const snapshot = await getDocs(q);
                const fetched = [];
                snapshot.forEach(doc => {
                    fetched.push({ id: doc.id, ...doc.data() });
                });

                // Client-side sort by createdAt
                fetched.sort((a, b) => {
                    const tA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                    const tB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                    return tA - tB;
                });

                setUsers(fetched);
            } catch (err) {
                console.error("Error fetching users:", err);
                if (err.code === 'failed-precondition') {
                    alert("Lỗi: Cần tạo Index trên Firestore (status + createdAt). Vui lòng kiểm tra Console.");
                }
            } finally {
                setLoading(false);
            }
        }
        fetchUsers();
    }, [statusTab]);

    const tabs = [
        { id: 'pending', label: 'Chờ duyệt' },
        { id: 'active', label: 'Đang hoạt động' },
        { id: 'delete_request', label: 'Yêu cầu Xóa' },
        { id: 'rejected', label: 'Bị từ chối' }
    ];

    const getStatusLabel = (s) => {
        switch (s) {
            case 'pending': return <span style={{ color: 'orange' }}>Chờ duyệt</span>;
            case 'active': return <span style={{ color: 'green' }}>Hoạt động</span>;
            case 'delete_request': return <span style={{ color: 'red', fontWeight: 'bold' }}>YC Xóa</span>;
            case 'rejected': return <span style={{ color: 'red' }}>Từ chối</span>;
            default: return s;
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <h2 style={{ marginBottom: '20px' }}>Quản lý người dùng</h2>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #ddd', overflowX: 'auto' }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setStatusTab(tab.id)}
                        style={{
                            padding: '10px 20px',
                            background: statusTab === tab.id ? '#1976d2' : 'transparent',
                            color: statusTab === tab.id ? '#fff' : '#333',
                            border: 'none',
                            borderRadius: '4px 4px 0 0',
                            cursor: 'pointer',
                            fontWeight: statusTab === tab.id ? 'bold' : 'normal',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Table */}
            {loading ? <p>Đang tải dữ liệu...</p> : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                        <thead>
                            <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                                <th style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Họ tên</th>
                                <th style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Khoa/Phòng</th>
                                <th style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Vị trí</th>
                                <th style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Điện thoại</th>
                                <th style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Trạng thái</th>
                                <th style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ padding: '20px', textAlign: 'center', fontStyle: 'italic' }}>Không có người dùng nào.</td>
                                </tr>
                            ) : (
                                users.map(user => (
                                    <tr key={user.id} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '12px' }}>{user.fullName || user.displayName}</td>
                                        <td style={{ padding: '12px', fontSize: '0.9em' }}>
                                            {user.departmentIds && user.departmentIds.length > 0
                                                ? user.departmentIds.map(id => departments[id] || id).join(", ")
                                                : (departments[user.departmentId] || user.departmentId || '-')}
                                        </td>
                                        <td style={{ padding: '12px' }}>{user.position}</td>
                                        <td style={{ padding: '12px' }}>{user.phone}</td>
                                        <td style={{ padding: '12px' }}>{getStatusLabel(user.status)}</td>
                                        <td style={{ padding: '12px' }}>
                                            <button
                                                onClick={() => navigate(`/admin/users/${user.id}`)}
                                                style={{
                                                    padding: '5px 10px',
                                                    background: '#1976d2',
                                                    color: '#fff',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer'
                                                }}
                                            >
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
}
