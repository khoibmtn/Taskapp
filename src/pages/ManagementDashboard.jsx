import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, doc, query, where, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

export default function ManagementDashboard() {
    const { userProfile, currentUser } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("tasks"); // "tasks" or "users"
    const [deptUsers, setDeptUsers] = useState([]);

    // Filtered users for mapping UID -> Name
    const [userMap, setUserMap] = useState({});

    // Stats
    const [stats, setStats] = useState({
        total: 0,
        overdue: 0,
        highPriority: 0
    });

    const [needsAttention, setNeedsAttention] = useState([]);
    const [assigneeGroups, setAssigneeGroups] = useState({});
    const [selectedUser, setSelectedUser] = useState(null);

    useEffect(() => {
        if (userProfile?.selectedDepartmentId) {
            fetchData();
        } else {
            setLoading(false);
        }
    }, [userProfile?.selectedDepartmentId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const deptId = userProfile.selectedDepartmentId;

            // 1. Fetch Users in this Dept
            const usersRef = collection(db, "users");

            // We fetch both schemas to support unmigrated users
            // Using a simple merge strategy for maximum compatibility
            const [qNew, qOld] = await Promise.all([
                getDocs(query(usersRef, where("departmentIds", "array-contains", deptId))),
                getDocs(query(usersRef, where("departmentId", "==", deptId)))
            ]);

            const uMap = {};
            const dUsers = [];

            const processSnapshot = (snapshot) => {
                snapshot.forEach(doc => {
                    if (!uMap[doc.id]) {
                        const data = doc.data();
                        uMap[doc.id] = data;
                        dUsers.push({ id: doc.id, ...data });
                    }
                });
            };

            processSnapshot(qNew);
            processSnapshot(qOld);

            const snapManagers = await getDocs(query(usersRef, where("role", "in", ["admin", "manager"])));
            snapManagers.forEach(doc => {
                if (!uMap[doc.id]) {
                    uMap[doc.id] = doc.data();
                }
            });

            setUserMap(uMap);
            setDeptUsers(dUsers);

            // 2. Fetch Tasks (Filtered by selectedDepartmentId)
            const tasksRef = collection(db, "tasks");
            const q = query(tasksRef, where("departmentId", "==", deptId));
            const snapshot = await getDocs(q);

            const fetchedTasks = [];
            snapshot.forEach(doc => {
                fetchedTasks.push({ id: doc.id, ...doc.data() });
            });

            setTasks(fetchedTasks);
            processData(fetchedTasks);
        } catch (error) {
            console.error("Error fetching data for management:", error);
        } finally {
            setLoading(false);
        }
    };

    const processData = (allTasks) => {
        const now = new Date();
        const next48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

        let total = 0;
        let overdueCount = 0;
        let highPrioCount = 0;
        const attentionList = [];
        const groups = {};

        allTasks.forEach(task => {
            total++;
            let dueDate = null;
            if (task.dueAt) {
                dueDate = task.dueAt.toDate ? task.dueAt.toDate() : new Date(task.dueAt);
            }

            const isOverdue = dueDate && dueDate < now;
            const isHighPrio = task.priority === 'high' || task.priority === 'urgent' || task.priority === 'cao';
            const isDueWithin48h = dueDate && dueDate <= next48Hours && dueDate >= now;

            if (isOverdue) overdueCount++;
            if (isHighPrio) highPrioCount++;

            if (isOverdue || task.alertFlag === true || (isHighPrio && isDueWithin48h)) {
                attentionList.push(task);
            }

            if (task.assignees) {
                Object.keys(task.assignees).forEach(uid => {
                    if (!groups[uid]) {
                        groups[uid] = { total: 0, overdue: 0 };
                    }
                    groups[uid].total++;
                    if (isOverdue) groups[uid].overdue++;
                });
            }
        });

        setStats({ total, overdue: overdueCount, highPriority: highPrioCount });
        setNeedsAttention(attentionList);
        setAssigneeGroups(groups);
    };

    const handleUserStatusUpdate = async (targetUid, newStatus) => {
        try {
            const updates = { status: newStatus };
            if (newStatus === 'active') {
                updates.approvedAt = serverTimestamp();
                updates.approvedBy = currentUser.uid;
            }
            await updateDoc(doc(db, "users", targetUid), updates);
            alert("Cập nhật thành công!");
            fetchData();
        } catch (err) {
            console.error(err);
            alert("Lỗi: " + err.message);
        }
    };

    const handleRoleUpdate = async (targetUid, newRole) => {
        try {
            await updateDoc(doc(db, "users", targetUid), { role: newRole });
            alert("Cập nhật quyền thành công!");
            fetchData();
        } catch (err) {
            console.error(err);
            alert("Lỗi: " + err.message);
        }
    };

    if (loading) return <div>Đang tải dữ liệu quản lý...</div>;
    if (!userProfile?.selectedDepartmentId) return <div>Vui lòng chọn hoặc được gán vào 1 khoa/phòng để xem dashboard.</div>;

    const getUserName = (uid) => {
        const u = userMap[uid];
        if (!u) return uid;
        return u.fullName || u.email || uid;
    };

    const isManagerOrAdmin = userProfile.role === 'manager' || userProfile.role === 'admin';

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>Dashboard Quản Lý</h2>
                {isManagerOrAdmin && (
                    <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: '8px', padding: '4px' }}>
                        <button
                            onClick={() => setActiveTab('tasks')}
                            style={{
                                padding: '8px 16px', border: 'none', borderRadius: '6px',
                                background: activeTab === 'tasks' ? '#fff' : 'transparent',
                                boxShadow: activeTab === 'tasks' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                                cursor: 'pointer', fontWeight: activeTab === 'tasks' ? 'bold' : 'normal'
                            }}
                        >
                            Công việc
                        </button>
                        <button
                            onClick={() => setActiveTab('users')}
                            style={{
                                padding: '8px 16px', border: 'none', borderRadius: '6px',
                                background: activeTab === 'users' ? '#fff' : 'transparent',
                                boxShadow: activeTab === 'users' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                                cursor: 'pointer', fontWeight: activeTab === 'users' ? 'bold' : 'normal'
                            }}
                        >
                            Quản lý Nhân sự
                        </button>
                    </div>
                )}
            </div>

            {activeTab === 'tasks' ? (
                <>
                    {/* Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '30px' }}>
                        <div style={{ background: '#e3f2fd', borderRadius: '8px', textAlign: 'center', padding: '15px' }}>
                            <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#1976d2' }}>{stats.total}</div>
                            <div>Công việc đang mở</div>
                        </div>
                        <div style={{ background: '#ffebee', borderRadius: '8px', textAlign: 'center', padding: '15px' }}>
                            <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#d32f2f' }}>{stats.overdue}</div>
                            <div>Quá hạn</div>
                        </div>
                        <div style={{ background: '#fff3e0', borderRadius: '8px', textAlign: 'center', padding: '15px' }}>
                            <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#f57c00' }}>{stats.highPriority}</div>
                            <div>Ưu tiên cao</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '30px' }}>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ borderBottom: '2px solid #d32f2f', display: 'inline-block', marginBottom: '15px' }}>Cần chú ý ({needsAttention.length})</h3>
                            {needsAttention.length === 0 ? <p>Không có.</p> : (
                                <ul style={{ listStyle: 'none', padding: 0 }}>
                                    {needsAttention.map(task => (
                                        <li key={task.id} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
                                            <Link to={`/app/tasks/${task.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                                <div style={{ fontWeight: 'bold' }}>{task.title}</div>
                                                <div style={{ fontSize: '0.85em', color: '#666' }}>
                                                    {task.priority && <span style={{ color: 'red', marginRight: '5px' }}>[{task.priority}]</span>}
                                                    {task.dueAt && (task.dueAt.toDate ? task.dueAt.toDate().toLocaleDateString('vi-VN') : new Date(task.dueAt).toLocaleDateString('vi-VN'))}
                                                </div>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ borderBottom: '2px solid #1976d2', display: 'inline-block', marginBottom: '15px' }}>Theo dõi theo nhân viên</h3>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ background: '#f5f5f5', textAlign: 'left' }}>
                                    <tr>
                                        <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Nhân viên</th>
                                        <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Tổng</th>
                                        <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Quá hạn</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.keys(assigneeGroups).map(uid => (
                                        <tr key={uid} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '8px' }}>{getUserName(uid)}</td>
                                            <td style={{ padding: '8px' }}>{assigneeGroups[uid].total}</td>
                                            <td style={{ padding: '8px', color: assigneeGroups[uid].overdue > 0 ? 'red' : 'inherit' }}>{assigneeGroups[uid].overdue}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
                    <h3>Nhân sự khoa/phòng</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
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
                                            <select
                                                value={u.role || 'staff'}
                                                onChange={(e) => handleRoleUpdate(u.id, e.target.value)}
                                                style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
                                            >
                                                <option value="staff">Nhân viên</option>
                                                <option value="asigner">Giao việc</option>
                                            </select>
                                        ) : (
                                            <span style={{ fontSize: '0.9em' }}>
                                                {u.role === 'admin' ? 'Admin' : u.role === 'manager' ? 'Trưởng khoa/phòng' : u.role === 'asigner' ? 'Giao việc' : 'Nhân viên'}
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <span style={{
                                            padding: '4px 8px', borderRadius: '12px', fontSize: '0.8em',
                                            background: u.status === 'active' ? '#e8f5e9' : u.status === 'pending' ? '#fff3e0' : '#f5f5f5',
                                            color: u.status === 'active' ? '#2e7d32' : u.status === 'pending' ? '#ef6c00' : '#666'
                                        }}>
                                            {u.status === 'active' ? 'Đang hoạt động' : u.status === 'pending' ? 'Chờ duyệt' : u.status === 'delete_request' ? 'Chờ Admin xóa' : u.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px', textAlign: 'right' }}>
                                        <button
                                            onClick={() => setSelectedUser(u)}
                                            style={{ padding: '5px 10px', background: '#f5f5f5', color: '#333', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', marginRight: '5px' }}
                                        >
                                            Xem
                                        </button>

                                        {u.status === 'pending' && (
                                            <button onClick={() => handleUserStatusUpdate(u.id, 'active')} style={{ padding: '5px 10px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '5px' }}>Duyệt</button>
                                        )}

                                        {u.status === 'active' && u.id !== currentUser.uid && u.role !== 'admin' && (
                                            <button
                                                onClick={() => {
                                                    if (window.confirm(`Gửi yêu cầu xóa nhân viên ${u.fullName}?`)) {
                                                        handleUserStatusUpdate(u.id, 'delete_request');
                                                    }
                                                }}
                                                style={{ padding: '5px 10px', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                            >
                                                Xóa
                                            </button>
                                        )}
                                        {u.status === 'delete_request' && (
                                            <button onClick={() => handleUserStatusUpdate(u.id, 'active')} style={{ padding: '5px 10px', background: '#757575', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Hủy YC Xóa</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* User Detail Modal */}
            {selectedUser && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#fff', padding: '30px', borderRadius: '8px', maxWidth: '500px', width: '90%', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                        <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Chi tiết nhân sự</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px', marginTop: '20px' }}>
                            <div style={{ fontWeight: 'bold' }}>Họ tên:</div>
                            <div>{selectedUser.fullName}</div>

                            <div style={{ fontWeight: 'bold' }}>Số điện thoại:</div>
                            <div>{selectedUser.phone}</div>

                            <div style={{ fontWeight: 'bold' }}>Email:</div>
                            <div>{selectedUser.email || 'N/A'}</div>

                            <div style={{ fontWeight: 'bold' }}>Vị trí:</div>
                            <div>{selectedUser.position}</div>

                            <div style={{ fontWeight: 'bold' }}>Quyền hạn:</div>
                            <div>{selectedUser.role === 'admin' ? 'Admin' : selectedUser.role === 'manager' ? 'Trưởng khoa/phòng' : selectedUser.role === 'asigner' ? 'Giao việc' : 'Nhân viên'}</div>

                            <div style={{ fontWeight: 'bold' }}>Trạng thái:</div>
                            <div>{selectedUser.status}</div>

                            <div style={{ fontWeight: 'bold' }}>Ngày tham gia:</div>
                            <div>{selectedUser.createdAt?.toDate ? selectedUser.createdAt.toDate().toLocaleDateString('vi-VN') : 'N/A'}</div>

                            <div style={{ fontWeight: 'bold' }}>Duyệt bởi:</div>
                            <div>{getUserName(selectedUser.approvedBy) || 'N/A'}</div>
                        </div>
                        <div style={{ marginTop: '30px', textAlign: 'right' }}>
                            <button
                                onClick={() => setSelectedUser(null)}
                                style={{ padding: '8px 20px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
