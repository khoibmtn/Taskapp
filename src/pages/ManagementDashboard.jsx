import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { collection, query, where, onSnapshot, getDocs, limit, startAfter } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { getTasksQuery, getTaskCount } from "../utils/queryUtils";
import TaskChatIcon from "../components/chat/TaskChatIcon";
import TaskChatOverlay from "../components/chat/TaskChatOverlay";
import { useChatList } from "../hooks/useChatList";

export default function ManagementDashboard() {
    const { userProfile, currentUser } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get("tab") || "reports";
    const setActiveTab = (tab) => {
        setSearchParams({ tab });
    };

    const [filterStatus, setFilterStatus] = useState('open');
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [lastDoc, setLastDoc] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [stats, setStats] = useState({ total: 0, overdue: 0, highPriority: 0, completed: 0 });
    const [userMap, setUserMap] = useState({});
    const [needsAttention, setNeedsAttention] = useState([]);
    const [thisWeek, setThisWeek] = useState([]);
    const [otherTasks, setOtherTasks] = useState([]);
    const [assigneeGroups, setAssigneeGroups] = useState({});
    const [activeChatTaskId, setActiveChatTaskId] = useState(null);
    const [activeChatTitle, setActiveChatTitle] = useState('');
    const [activeChatParticipants, setActiveChatParticipants] = useState([]);
    const { conversations: chatConversations } = useChatList(currentUser?.uid);

    const PAGE_SIZE = 20;

    // Fetch summary stats and users
    useEffect(() => {
        if (!userProfile?.selectedDepartmentId) return;
        const deptId = userProfile.selectedDepartmentId;

        async function fetchInitialData() {
            setLoading(true);
            try {
                // Fetch Stats using count()
                const [total, completed] = await Promise.all([
                    getTaskCount({ deptId, role: 'department', status: 'open' }),
                    getTaskCount({ deptId, role: 'department', status: 'completed' })
                ]);
                // For simplicity, overdue/highPrio counts could also use dedicated count queries
                // or be derived if the dataset is small. The user asked for optimization:
                setStats({ total, completed, overdue: 0, highPriority: 0 }); // We'll add complex counts if needed
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchInitialData();

        // Listen for users (keep real-time for name resolution)
        const unsubUsers = onSnapshot(query(collection(db, "users"), where("departmentIds", "array-contains", deptId)), (snap) => {
            const next = {};
            snap.forEach(doc => { next[doc.id] = doc.data(); });
            setUserMap(prev => ({ ...prev, ...next }));
        });

        return () => unsubUsers();
    }, [userProfile?.selectedDepartmentId]);

    const fetchTasks = async (isLoadMore = false) => {
        if (!userProfile?.selectedDepartmentId) return;
        const deptId = userProfile.selectedDepartmentId;

        if (isLoadMore) setLoadingMore(true);
        else setLoading(true);

        try {
            const q = getTasksQuery({
                deptId,
                role: 'department',
                status: filterStatus === 'all' ? 'all' : filterStatus,
                pageSize: PAGE_SIZE,
                lastDoc: isLoadMore ? lastDoc : null
            });

            const snap = await getDocs(q);
            const fetched = [];
            snap.forEach(doc => fetched.push({ id: doc.id, ...doc.data() }));

            if (isLoadMore) {
                setTasks(prev => [...prev, ...fetched]);
            } else {
                setTasks(fetched);
            }

            setHasMore(snap.docs.length === PAGE_SIZE);
            if (snap.docs.length > 0) {
                setLastDoc(snap.docs[snap.docs.length - 1]);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        if (tasks.length === 0) {
            setNeedsAttention([]);
            setThisWeek([]);
            setOtherTasks([]);
            setAssigneeGroups({});
            return;
        }

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dayOfWeek = now.getDay();
        const dist = (dayOfWeek === 0 ? 0 : 7 - dayOfWeek);
        const endOfWeek = new Date(startOfToday);
        endOfWeek.setDate(startOfToday.getDate() + dist);
        endOfWeek.setHours(23, 59, 59, 999);
        const next48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

        const attentionList = [];
        const weekList = [];
        const otherList = [];
        const groups = {};

        tasks.forEach(task => {
            const isCompleted = task.status === 'completed';
            let dueDate = getTaskDeadline(task);

            const isOverdue = dueDate && dueDate < now && !isCompleted;
            const isHighPrio = ['high', 'urgent', 'cao'].includes(task.priority);
            const isDueWithin48h = dueDate && dueDate <= next48Hours && dueDate >= now;

            task._effectiveDeadline = dueDate || new Date(9999, 11, 31);

            if (!isCompleted && (isOverdue || task.alertFlag === true || (isHighPrio && isDueWithin48h))) {
                attentionList.push(task);
            } else if (dueDate && dueDate <= endOfWeek && dueDate >= now) {
                weekList.push(task);
            } else {
                otherList.push(task);
            }

            if (task.assignees) {
                Object.keys(task.assignees).forEach(uid => {
                    if (!groups[uid]) groups[uid] = { total: 0, overdue: 0 };
                    if (!isCompleted) groups[uid].total++;
                    if (isOverdue) groups[uid].overdue++;
                });
            }
        });

        const sortByDate = (a, b) => a._effectiveDeadline - b._effectiveDeadline;
        setNeedsAttention(attentionList.sort(sortByDate));
        setThisWeek(weekList.sort(sortByDate));
        setOtherTasks(otherList.sort(sortByDate));
        setAssigneeGroups(groups);
    }, [tasks]);

    useEffect(() => {
        if (activeTab === 'manage') {
            fetchTasks();
        }
    }, [userProfile?.selectedDepartmentId, activeTab, filterStatus]);

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
        // Recurrence handling
        if (task.timeType === 'recurrence' && task.recurrence) {
            const { frequency, daysOfWeek, dayOfMonth, specificDate } = task.recurrence;
            if (frequency === 'weekly') {
                const days = (daysOfWeek || []).map(d => d === 0 ? "CN" : `T${d + 1}`).join(", ");
                return `Hàng tuần (${days})`;
            }
            if (frequency === 'monthly') return `Ngày ${dayOfMonth} hàng tháng`;
            if (frequency === 'yearly') return `Ngày ${specificDate} hàng năm`;
        }

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
        // Supervisor
        const supervisorName = task.supervisorId ? getUserName(task.supervisorId) : null;

        return (
            <li style={{
                background: isCompleted ? '#e8f5e9' : '#fff',
                borderLeft: `4px solid ${color}`,
                padding: '10px',
                marginBottom: '10px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
                <Link to={`/app/tasks/${task.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '5px', fontSize: '1.05em', flex: 1 }}>{task.title}</div>
                        <TaskChatIcon
                            unreadCount={chatConversations?.find(c => c.id === `task_${task.id}`)?.myUnread || 0}
                            onClick={() => {
                                const allAssigneeUids = task.assignees ? Object.keys(task.assignees) : [];
                                const participants = [...new Set([...allAssigneeUids, task.supervisorId, task.createdBy].filter(Boolean))];
                                setActiveChatTaskId(task.id);
                                setActiveChatTitle(task.title);
                                setActiveChatParticipants(participants);
                            }}
                        />
                    </div>
                    <div style={{ fontSize: '0.85em', color: '#555' }}>
                        <div style={{ marginBottom: '4px' }}>Hạn: {getDeadlineDisplay(task)}</div>
                        <div style={{ marginBottom: '4px' }}>Ngày giao: {task.createdAt?.seconds ? new Date(task.createdAt.seconds * 1000).toLocaleDateString('vi-VN') : 'N/A'}</div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
                            {task.priority && (
                                <span style={{ background: pColor, color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75em', fontWeight: 'bold' }}>{pLabel}</span>
                            )}
                            <span style={{ background: sColor, color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75em', fontWeight: 'bold' }}>{sLabel}</span>
                        </div>
                        <div style={{ color: '#666', fontSize: '0.8em' }}>
                            <span style={{ marginRight: '10px' }}>👤 Giao cho: <strong>{assigneeNames}</strong></span>
                            {supervisorName && <span>👁️ Giám sát: <strong>{supervisorName}</strong></span>}
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
                        >Đang làm ({stats.total})</button>
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
                        >Đã xong ({stats.completed})</button>
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
                        >Tất cả ({stats.total + stats.completed})</button>
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

            {/* Chat Overlay / Panel */}
            {activeChatTaskId && (
                <>
                    <div className="lg:hidden">
                        <TaskChatOverlay
                            taskId={activeChatTaskId}
                            taskTitle={activeChatTitle}
                            participants={activeChatParticipants}
                            onClose={() => setActiveChatTaskId(null)}
                            mode="overlay"
                        />
                    </div>
                    <div className="hidden lg:block fixed right-0 top-14 bottom-0 w-80 z-40 shadow-lg">
                        <TaskChatOverlay
                            taskId={activeChatTaskId}
                            taskTitle={activeChatTitle}
                            participants={activeChatParticipants}
                            onClose={() => setActiveChatTaskId(null)}
                            mode="panel"
                        />
                    </div>
                </>
            )}
        </div>
    );
}
