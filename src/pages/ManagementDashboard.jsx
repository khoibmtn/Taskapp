import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, getFirestore } from "firebase/firestore";
import { db } from "../firebase";

export default function ManagementDashboard() {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

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

    useEffect(() => {
        async function fetchData() {
            try {
                // 1. Fetch Users to build Map
                const usersRef = collection(db, "users");
                const userSnapshot = await getDocs(usersRef);
                const uMap = {};
                userSnapshot.forEach(doc => {
                    const data = doc.data();
                    uMap[doc.id] = data;
                });
                setUserMap(uMap);

                // 2. Fetch Tasks
                const tasksRef = collection(db, "tasks");
                const snapshot = await getDocs(tasksRef);

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
        }

        fetchData();
    }, []);

    const processData = (allTasks) => {
        const now = new Date();
        const next48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

        let total = 0;
        let overdueCount = 0;
        let highPrioCount = 0;
        const attentionList = [];
        const groups = {}; // { uid: { total: 0, overdue: 0 } }

        allTasks.forEach(task => {
            total++;

            // Parse date
            let dueDate = null;
            if (task.dueAt) {
                dueDate = task.dueAt.toDate ? task.dueAt.toDate() : new Date(task.dueAt);
            }

            const isOverdue = dueDate && dueDate < now;
            const isHighPrio = task.priority === 'high' || task.priority === 'urgent' || task.priority === 'cao';
            const isDueWithin48h = dueDate && dueDate <= next48Hours && dueDate >= now;

            if (isOverdue) overdueCount++;
            if (isHighPrio) highPrioCount++;

            // Needs Attention Logic
            if (isOverdue || task.alertFlag === true || (isHighPrio && isDueWithin48h)) {
                attentionList.push(task);
            }

            // Assignee Grouping
            // task.assignees is Map { uid: true, ... }
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

    if (loading) return <div>Đang tải dữ liệu quản lý...</div>;

    // Helper to get name
    const getUserName = (uid) => {
        const u = userMap[uid];
        if (!u) return uid;
        return u.displayName || u.name || u.email || uid;
    };

    return (
        <div>
            <h2 style={{ marginBottom: '20px' }}>Dashboard Quản Lý</h2>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '30px' }}>
                <div style={{ background: '#e3f2fd', p: '20px', borderRadius: '8px', textAlign: 'center', padding: '15px' }}>
                    <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#1976d2' }}>{stats.total}</div>
                    <div>Tổng công việc đang mở</div>
                </div>
                <div style={{ background: '#ffebee', p: '20px', borderRadius: '8px', textAlign: 'center', padding: '15px' }}>
                    <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#d32f2f' }}>{stats.overdue}</div>
                    <div>Quá hạn</div>
                </div>
                <div style={{ background: '#fff3e0', p: '20px', borderRadius: '8px', textAlign: 'center', padding: '15px' }}>
                    <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#f57c00' }}>{stats.highPriority}</div>
                    <div>Ưu tiên cao</div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '30px' }}>
                {/* Left Column: Needs Attention */}
                <div style={{ flex: 1 }}>
                    <h3 style={{ borderBottom: '2px solid #d32f2f', display: 'inline-block', marginBottom: '15px' }}>
                        Công việc cần chú ý ({needsAttention.length})
                    </h3>
                    {needsAttention.length === 0 ? <p>Không có.</p> : (
                        <ul style={{ listStyle: 'none', padding: 0 }}>
                            {needsAttention.map(task => (
                                <li key={task.id} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #ddd', borderRadius: '4px' }}>
                                    <Link to={`/app/tasks/${task.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                                        <div style={{ fontWeight: 'bold' }}>{task.title}</div>
                                        <div style={{ fontSize: '0.85em', color: '#666' }}>
                                            {task.priority && <span style={{ marginRight: '10px', color: 'red' }}>[{task.priority}]</span>}
                                            {task.dueAt && (task.dueAt.toDate ? task.dueAt.toDate().toLocaleDateString('vi-VN') : new Date(task.dueAt).toLocaleDateString('vi-VN'))}
                                        </div>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* Right Column: Assignee Stats */}
                <div style={{ flex: 1 }}>
                    <h3 style={{ borderBottom: '2px solid #1976d2', display: 'inline-block', marginBottom: '15px' }}>
                        Theo dõi theo nhân viên
                    </h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Nhân viên</th>
                                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Tổng</th>
                                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Quá hạn</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.keys(assigneeGroups).length === 0 ? (
                                <tr><td colSpan="3" style={{ padding: '10px' }}>Chưa có dữ liệu.</td></tr>
                            ) : (
                                Object.keys(assigneeGroups).map(uid => (
                                    <tr key={uid} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '8px' }}>{getUserName(uid)}</td>
                                        <td style={{ padding: '8px' }}>{assigneeGroups[uid].total}</td>
                                        <td style={{ padding: '8px', color: assigneeGroups[uid].overdue > 0 ? 'red' : 'inherit' }}>
                                            {assigneeGroups[uid].overdue}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
