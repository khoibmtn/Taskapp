import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

export default function ManagementDashboard() {
    const { userProfile, currentUser } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    // Read activeTab from URL, default to "reports"
    const activeTab = searchParams.get("tab") || "reports";
    const setActiveTab = (tab) => {
        setSearchParams({ tab });
    };

    const [filterStatus, setFilterStatus] = useState('open'); // 'all', 'open', 'completed'

    // Filtered users for mapping UID -> Name
    const [userMap, setUserMap] = useState({});

    // Stats
    const [stats, setStats] = useState({
        total: 0,
        overdue: 0,
        highPriority: 0,
        completed: 0
    });

    const [needsAttention, setNeedsAttention] = useState([]);
    const [thisWeek, setThisWeek] = useState([]);
    const [otherTasks, setOtherTasks] = useState([]);
    const [assigneeGroups, setAssigneeGroups] = useState({});

    useEffect(() => {
        if (!userProfile?.selectedDepartmentId) {
            setLoading(false);
            return;
        }

        const deptId = userProfile.selectedDepartmentId;
        const usersRef = collection(db, "users");
        const tasksRef = collection(db, "tasks");

        setLoading(true);

        // 1. Listen for all users in the dept (for name resolution)
        const unsubUsers = onSnapshot(query(usersRef, where("departmentIds", "array-contains", deptId)), (snap) => {
            setUserMap(prev => {
                const next = { ...prev };
                snap.forEach(doc => { next[doc.id] = doc.data(); });
                return next;
            });
        });

        // 2. Listen for additional managers/admins (for supervisor name resolution)
        const unsubManagers = onSnapshot(query(usersRef, where("role", "in", ["admin", "manager"])), (snap) => {
            setUserMap(prev => {
                const next = { ...prev };
                snap.forEach(doc => { next[doc.id] = doc.data(); });
                return next;
            });
        });

        // 3. Listen for Tasks in department
        const unsubTasks = onSnapshot(query(tasksRef, where("departmentId", "==", deptId)), (snap) => {
            const fetchedTasks = [];
            snap.forEach(doc => fetchedTasks.push({ id: doc.id, ...doc.data() }));
            setTasks(fetchedTasks);
            setLoading(false);
        });

        return () => {
            unsubUsers();
            unsubManagers();
            unsubTasks();
        };
    }, [userProfile?.selectedDepartmentId]);

    // Reactive processing whenever tasks update
    useEffect(() => {
        // Filter: Tasks I created for others OR tasks I supervise
        const myTasks = tasks.filter(t => {
            if (t.isDeleted || t.isArchived) return false;
            const iCreatedIt = t.createdBy === currentUser.uid;
            const iSupervise = t.supervisors && t.supervisors[currentUser.uid];
            // Check if assigned to others (not only me)
            const assignees = t.assignees ? Object.keys(t.assignees) : [];
            const assignedToOthers = assignees.some(uid => uid !== currentUser.uid);
            return (iCreatedIt && assignedToOthers) || iSupervise;
        });
        processData(myTasks);
    }, [tasks, currentUser.uid]);

    const processData = (allTasks) => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dayOfWeek = now.getDay();
        const dist = (dayOfWeek === 0 ? 0 : 7 - dayOfWeek);
        const endOfWeek = new Date(startOfToday);
        endOfWeek.setDate(startOfToday.getDate() + dist);
        endOfWeek.setHours(23, 59, 59, 999);
        const next48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

        let total = 0;
        let overdueCount = 0;
        let highPrioCount = 0;
        let completedCount = 0;
        const attentionList = [];
        const weekList = [];
        const otherList = [];
        const groups = {};

        allTasks.forEach(task => {
            const isCompleted = task.status === 'completed';
            if (isCompleted) {
                completedCount++;
                // Don't count completed in main stats
            } else {
                total++;
            }

            let dueDate = getTaskDeadline(task);

            const isOverdue = dueDate && dueDate < now && !isCompleted;
            const isHighPrio = ['high', 'urgent', 'cao'].includes(task.priority);
            const isDueWithin48h = dueDate && dueDate <= next48Hours && dueDate >= now;

            if (!isCompleted) {
                if (isOverdue) overdueCount++;
                if (isHighPrio) highPrioCount++;
            }

            // Categorization for Task Management tab
            task._effectiveDeadline = dueDate || new Date(9999, 11, 31);

            if (!isCompleted && (isOverdue || task.alertFlag === true || (isHighPrio && isDueWithin48h))) {
                attentionList.push(task);
            } else if (dueDate && dueDate <= endOfWeek && dueDate >= now) {
                weekList.push(task);
            } else {
                otherList.push(task);
            }

            // Groups for Reports tab
            if (task.assignees) {
                Object.keys(task.assignees).forEach(uid => {
                    if (!groups[uid]) {
                        groups[uid] = { total: 0, overdue: 0 };
                    }
                    if (!isCompleted) groups[uid].total++;
                    if (isOverdue) groups[uid].overdue++;
                });
            }
        });

        const sortByDate = (a, b) => a._effectiveDeadline - b._effectiveDeadline;
        attentionList.sort(sortByDate);
        weekList.sort(sortByDate);
        otherList.sort(sortByDate);

        setStats({ total, overdue: overdueCount, highPriority: highPrioCount, completed: completedCount });
        setNeedsAttention(attentionList);
        setThisWeek(weekList);
        setOtherTasks(otherList);
        setAssigneeGroups(groups);
    };

    // --- Helper to calculate deadline ---
    const getTaskDeadline = (task) => {
        if (!task) return null;
        if (task.nextDeadline) {
            return task.nextDeadline?.toDate ? task.nextDeadline.toDate() : new Date(task.nextDeadline);
        }
        if (task.timeType === 'fixed' || (!task.timeType && task.dueAt)) {
            if (task.dueAt) {
                return task.dueAt?.toDate ? task.dueAt.toDate() : new Date(task.dueAt);
            }
        }
        if (task.timeType === 'range' && task.toDate) {
            return task.toDate?.toDate ? task.toDate.toDate() : new Date(task.toDate);
        }
        return null;
    };

    const getDeadlineDisplay = (task) => {
        const d = getTaskDeadline(task);
        if (!d) return "Chưa thiết lập";
        return d.toLocaleDateString('vi-VN');
    };

    if (loading) return <div>Đang tải dữ liệu quản lý...</div>;
    if (!userProfile?.selectedDepartmentId) return <div>Vui lòng chọn hoặc được gán vào 1 khoa/phòng để xem dashboard.</div>;

    const getUserName = (uid) => {
        const u = userMap[uid];
        if (!u) return uid?.substring(0, 8) || 'N/A';
        return u.fullName || (u.email && !u.email.endsWith('@task.app') ? u.email : null) || uid.substring(0, 8);
    };

    const TaskCard = ({ task, color }) => {
        const isCompleted = task.status === 'completed';
        // Priority
        let pColor = '#757575';
        let pLabel = 'Thấp';
        if (['high', 'urgent', 'cao'].includes(task.priority)) {
            pColor = '#b71c1c'; pLabel = 'Cao';
        } else if (['normal', 'trung bình'].includes(task.priority)) {
            pColor = '#1565c0'; pLabel = 'Trung bình';
        }
        // Status
        const sColor = isCompleted ? '#2e7d32' : '#ec407a';
        const sLabel = isCompleted ? 'Hoàn thành' : 'Đang làm';

        // Assignees
        const assigneeNames = task.assignees ? Object.keys(task.assignees).map(uid => getUserName(uid)).join(', ') : 'N/A';
        // Supervisors
        const supervisorNames = task.supervisors ? Object.keys(task.supervisors).map(uid => getUserName(uid)).join(', ') : null;

        return (
            <li style={{
                background: isCompleted ? '#e8f5e9' : '#fff',
                borderLeft: `4px solid ${color}`,
                padding: '10px',
                marginBottom: '10px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
                <Link to={`/app/tasks/${task.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '5px', fontSize: '1.05em' }}>{task.title}</div>
                    <div style={{ fontSize: '0.85em', color: '#555' }}>
                        <div style={{ marginBottom: '4px' }}>Hạn: {getDeadlineDisplay(task)}</div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                            {task.priority && (
                                <span style={{ background: pColor, color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75em', fontWeight: 'bold' }}>{pLabel}</span>
                            )}
                            <span style={{ background: sColor, color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75em', fontWeight: 'bold' }}>{sLabel}</span>
                        </div>
                        <div style={{ color: '#666', fontSize: '0.8em' }}>
                            <span style={{ marginRight: '10px' }}>👤 Giao cho: <strong>{assigneeNames}</strong></span>
                            {supervisorNames && <span>👁️ Giám sát: <strong>{supervisorNames}</strong></span>}
                        </div>
                    </div>
                </Link>
            </li>
        );
    };

    const TaskList = ({ title, items, color }) => (
        <div style={{ marginBottom: '30px' }}>
            <h3 style={{ borderBottom: `2px solid ${color}`, paddingBottom: '5px', display: 'inline-block' }}>
                {title} ({items.length})
            </h3>
            {items.length === 0 ? (
                <p style={{ fontStyle: 'italic', color: '#666' }}>Không có công việc nào.</p>
            ) : (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                    {items.map(task => <TaskCard key={task.id} task={task} color={color} />)}
                </ul>
            )}
        </div>
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>Dashboard Quản Lý</h2>
                <div style={{ display: 'flex', background: '#e0e0e0', borderRadius: '20px', padding: '2px' }}>
                    <button
                        onClick={() => setActiveTab('reports')}
                        style={{
                            padding: '8px 16px', borderRadius: '18px', border: 'none',
                            background: activeTab === 'reports' ? '#fff' : 'transparent',
                            color: activeTab === 'reports' ? '#1976d2' : '#555',
                            fontWeight: activeTab === 'reports' ? 'bold' : 'normal',
                            boxShadow: activeTab === 'reports' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            cursor: 'pointer', transition: 'all 0.2s'
                        }}
                    >
                        Báo cáo
                    </button>
                    <button
                        onClick={() => setActiveTab('manage')}
                        style={{
                            padding: '8px 16px', borderRadius: '18px', border: 'none',
                            background: activeTab === 'manage' ? '#fff' : 'transparent',
                            color: activeTab === 'manage' ? '#2e7d32' : '#555',
                            fontWeight: activeTab === 'manage' ? 'bold' : 'normal',
                            boxShadow: activeTab === 'manage' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            cursor: 'pointer', transition: 'all 0.2s'
                        }}
                    >
                        Quản lý Công việc
                    </button>
                </div>
            </div>

            {activeTab === 'reports' ? (
                <>
                    {/* Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '30px' }}>
                        <div style={{ background: '#e3f2fd', borderRadius: '8px', textAlign: 'center', padding: '15px' }}>
                            <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#1976d2' }}>{stats.total}</div>
                            <div>Đang thực hiện</div>
                        </div>
                        <div style={{ background: '#ffebee', borderRadius: '8px', textAlign: 'center', padding: '15px' }}>
                            <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#d32f2f' }}>{stats.overdue}</div>
                            <div>Quá hạn</div>
                        </div>
                        <div style={{ background: '#fff3e0', borderRadius: '8px', textAlign: 'center', padding: '15px' }}>
                            <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#f57c00' }}>{stats.highPriority}</div>
                            <div>Ưu tiên cao</div>
                        </div>
                        <div style={{ background: '#e8f5e9', borderRadius: '8px', textAlign: 'center', padding: '15px' }}>
                            <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#2e7d32' }}>{stats.completed}</div>
                            <div>Đã hoàn thành</div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '30px' }}>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ borderBottom: '2px solid #d32f2f', display: 'inline-block', marginBottom: '15px' }}>Cần chú ý ({needsAttention.length})</h3>
                            {needsAttention.length === 0 ? <p>Không có.</p> : (
                                <ul style={{ listStyle: 'none', padding: 0 }}>
                                    {needsAttention.slice(0, 5).map(task => (
                                        <li key={task.id} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', background: '#fff8f8' }}>
                                            <Link to={`/app/tasks/${task.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                                <div style={{ fontWeight: 'bold' }}>{task.alertFlag && <span style={{ color: 'red' }}>⚠️ </span>}{task.title}</div>
                                                <div style={{ fontSize: '0.85em', color: '#666', marginTop: '5px' }}>Hạn: {getDeadlineDisplay(task)}</div>
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
                <>
                    {/* Filter Tabs - square style aligned left */}
                    <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #ddd' }}>
                        <button
                            onClick={() => setFilterStatus('open')}
                            style={{
                                padding: '10px 20px',
                                border: 'none',
                                borderRadius: '4px 4px 0 0',
                                background: filterStatus === 'open' ? '#1976d2' : 'transparent',
                                color: filterStatus === 'open' ? '#fff' : '#333',
                                fontWeight: filterStatus === 'open' ? 'bold' : 'normal',
                                cursor: 'pointer',
                                fontSize: '1em'
                            }}
                        >Đang làm</button>
                        <button
                            onClick={() => setFilterStatus('completed')}
                            style={{
                                padding: '10px 20px',
                                border: 'none',
                                borderRadius: '4px 4px 0 0',
                                background: filterStatus === 'completed' ? '#2e7d32' : 'transparent',
                                color: filterStatus === 'completed' ? '#fff' : '#333',
                                fontWeight: filterStatus === 'completed' ? 'bold' : 'normal',
                                cursor: 'pointer',
                                fontSize: '1em'
                            }}
                        >Đã xong</button>
                        <button
                            onClick={() => setFilterStatus('all')}
                            style={{
                                padding: '10px 20px',
                                border: 'none',
                                borderRadius: '4px 4px 0 0',
                                background: filterStatus === 'all' ? '#555' : 'transparent',
                                color: filterStatus === 'all' ? '#fff' : '#333',
                                fontWeight: filterStatus === 'all' ? 'bold' : 'normal',
                                cursor: 'pointer',
                                fontSize: '1em'
                            }}
                        >Tất cả</button>
                    </div>

                    {/* Content area with border */}
                    <div style={{ border: '1px solid #ddd', borderTop: 'none', padding: '20px', background: '#fafafa' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                            <TaskList
                                title="Cần Chú Ý"
                                items={filterStatus === 'completed' ? [] : needsAttention.filter(t => filterStatus === 'all' || t.status !== 'completed')}
                                color="#d32f2f"
                            />
                            <TaskList
                                title="Trong Tuần Này"
                                items={thisWeek.filter(t => {
                                    if (filterStatus === 'all') return true;
                                    if (filterStatus === 'completed') return t.status === 'completed';
                                    return t.status !== 'completed';
                                })}
                                color="#1976d2"
                            />
                            <TaskList
                                title="Công Việc Khác"
                                items={otherTasks.filter(t => {
                                    if (filterStatus === 'all') return true;
                                    if (filterStatus === 'completed') return t.status === 'completed';
                                    return t.status !== 'completed';
                                })}
                                color="#388e3c"
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
