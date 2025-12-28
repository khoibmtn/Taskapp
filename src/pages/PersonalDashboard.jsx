import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, getDocs, onSnapshot, limit, startAfter } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebase";
import { getTasksQuery, getTaskCount } from "../utils/queryUtils";

export default function PersonalDashboard() {
    const { currentUser, userProfile } = useAuth();
    const [tasksCache, setTasksCache] = useState({ open: [], completed: [], all: [] });
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [userMap, setUserMap] = useState({});
    const [counts, setCounts] = useState({ open: 0, completed: 0, all: 0 });
    const [lastDoc, setLastDoc] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [filterStatus, setFilterStatus] = useState('open');

    const PAGE_SIZE = 20;

    // Fetch counts for tabs
    useEffect(() => {
        if (!currentUser) return;
        const fetchCounts = async () => {
            const [open, completed, all] = await Promise.all([
                getTaskCount({ uid: currentUser.uid, role: 'assignee', status: 'open' }),
                getTaskCount({ uid: currentUser.uid, role: 'assignee', status: 'completed' }),
                getTaskCount({ uid: currentUser.uid, role: 'assignee', status: 'all' })
            ]);
            // Also need to consider supervised? The current dashboard shows both.
            // For simplicity in UI counts, we'll keep them role-agnostic if possible or just combine them.
            // But simple count() doesn't support OR easily.
            // We'll just use the assignee counts for the tabs for now as a baseline.
            setCounts({ open, completed, all });
        };
        fetchCounts();
    }, [currentUser]);

    const fetchTasks = async (isLoadMore = false) => {
        if (!currentUser) return;
        if (isLoadMore) setLoadingMore(true);
        else setLoading(true);

        try {
            // Because we can't easily do OR in Firestore with composite indexes across fields,
            // we fetch Assigned and Supervised separately.
            const queryParams = {
                uid: currentUser.uid,
                status: filterStatus,
                pageSize: PAGE_SIZE,
                lastDoc: isLoadMore ? lastDoc : null
            };

            const [assignedSnap, supervisedSnap] = await Promise.all([
                getDocs(getTasksQuery({ ...queryParams, role: 'assignee' })),
                getDocs(getTasksQuery({ ...queryParams, role: 'supervisor' }))
            ]);

            const newTasks = [];
            const taskMap = isLoadMore ? { ...tasks.reduce((acc, t) => ({ ...acc, [t.id]: t }), {}) } : {};

            const processSnap = (snap) => {
                snap.forEach(doc => {
                    taskMap[doc.id] = { id: doc.id, ...doc.data() };
                });
            };

            processSnap(assignedSnap);
            processSnap(supervisedSnap);

            const combined = Object.values(taskMap);
            setTasksCache(prev => ({ ...prev, [filterStatus]: combined }));

            // For hasMore/lastDoc - we'll need to store these per tab too if we want robust pagination in cache
            // But for now, simple cache for the first page is already a huge win.
            setHasMore(assignedSnap.docs.length === PAGE_SIZE || supervisedSnap.docs.length === PAGE_SIZE);

            // For lastDoc, we'd ideally merge sort them, but simple approach: use the last from assignedSnap if it exists
            if (assignedSnap.docs.length > 0) {
                setLastDoc(assignedSnap.docs[assignedSnap.docs.length - 1]);
            } else if (supervisedSnap.docs.length > 0) {
                setLastDoc(supervisedSnap.docs[supervisedSnap.docs.length - 1]);
            }

        } catch (err) {
            console.error("Error fetching tasks:", err);
            setError(`Lỗi: ${err.message || "Không thể tải danh sách công việc"}. ${err.code === 'failed-precondition' ? 'Có thể thiếu Index Firestore.' : ''}`);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        setLastDoc(null);
        setHasMore(true);
    }, [currentUser, filterStatus]);

    useEffect(() => {
        if (tasksCache[filterStatus]?.length > 0 && !lastDoc) {
            return;
        }
        fetchTasks();
    }, [currentUser, filterStatus, lastDoc === null]);

    const tasks = tasksCache[filterStatus] || [];

    // Fetch users for name resolution
    useEffect(() => {
        if (!userProfile?.selectedDepartmentId) return;
        const deptId = userProfile.selectedDepartmentId;
        const usersRef = collection(db, "users");

        // Fetch dept users
        const unsubDept = onSnapshot(query(usersRef, where("departmentIds", "array-contains", deptId)), (snap) => {
            setUserMap(prev => {
                const next = { ...prev };
                snap.forEach(doc => { next[doc.id] = doc.data(); });
                return next;
            });
        });

        // Also fetch admins/managers who might be task creators
        const unsubAdmins = onSnapshot(query(usersRef, where("role", "in", ["admin", "manager", "asigner"])), (snap) => {
            setUserMap(prev => {
                const next = { ...prev };
                snap.forEach(doc => { next[doc.id] = doc.data(); });
                return next;
            });
        });

        return () => {
            unsubDept();
            unsubAdmins();
        };
    }, [userProfile?.selectedDepartmentId]);

    const getUserName = (uid) => {
        if (!uid) return 'N/A';
        const u = userMap[uid];
        if (!u) return uid?.substring?.(0, 8) || 'N/A';
        return u.fullName || (u.email && !u.email.endsWith('@task.app') ? u.email : null) || uid.substring(0, 8);
    };

    // --- Helper to calculate ONE specific deadline for sorting/filtering ---
    // Returns a Date object or null
    const getTaskDeadline = (task) => {
        if (!task) return null;

        // 1. Fixed
        if (task.timeType === 'fixed' || (!task.timeType && task.dueAt)) {
            if (task.dueAt) {
                return task.dueAt?.toDate ? task.dueAt.toDate() : new Date(task.dueAt);
            }
            return null;
        }

        // 2. Range
        if (task.timeType === 'range') {
            if (task.toDate) {
                return task.toDate?.toDate ? task.toDate.toDate() : new Date(task.toDate);
            }
            return null;
        }

        // 3. Recurrence (Calculate NEXT occurrence or use Saved Deadline)
        if (task.timeType === 'recurrence' && task.recurrence) {
            // New Logic: Use saved nextDeadline if available
            if (task.nextDeadline) {
                return task.nextDeadline?.toDate ? task.nextDeadline.toDate() : new Date(task.nextDeadline);
            }

            // Fallback for old tasks (dynamic calc)
            const { frequency, daysOfWeek, dayOfMonth, specificDate } = task.recurrence;
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            if (frequency === 'weekly' && Array.isArray(daysOfWeek) && daysOfWeek.length > 0) {
                // Find nearest future day
                // daysOfWeek: [0 (CN), 1 (T2), ...]
                // current day: now.getDay()
                const currentDay = now.getDay();

                // Sort days to be sure, and ensure they are numbers
                const sortedDays = [...daysOfWeek].map(Number).sort((a, b) => a - b);

                // Try to find a day later this week
                let nextDay = sortedDays.find(d => d >= currentDay);

                // If not found (e.g. today is Fri(5), days are [1,3]), need to wrap around to next week
                let daysToAdd = 0;
                if (nextDay !== undefined) {
                    daysToAdd = nextDay - currentDay;
                } else {
                    nextDay = sortedDays[0];
                    daysToAdd = (7 - currentDay) + nextDay;
                }

                const nextDate = new Date(today);
                nextDate.setDate(today.getDate() + daysToAdd);

                // Use the time from dueAt/recurrence time if available? 
                // CreateTask saves time in dueTime, likely not merged into this logic yet or maybe just needs handling. 
                // For now, end of day.
                nextDate.setHours(23, 59, 59);
                return nextDate;
            }

            if (frequency === 'monthly' && dayOfMonth) {
                let nextDate = new Date(today);
                nextDate.setDate(dayOfMonth);
                if (nextDate < today) {
                    // If day passed, move to next month
                    nextDate.setMonth(nextDate.getMonth() + 1);
                }
                return nextDate;
            }

            if (frequency === 'yearly' && specificDate) {
                // specificDate format "DD/MM" e.g "31/12" (New) or "MM-DD" (Old/Fallback)
                try {
                    let d, m;
                    if (specificDate.includes('/')) {
                        [d, m] = specificDate.split('/').map(Number);
                    } else {
                        // Fallback for legacy "MM-DD"
                        [m, d] = specificDate.split('-').map(Number);
                    }

                    let nextDate = new Date(today.getFullYear(), m - 1, d);
                    if (nextDate < today) {
                        nextDate.setFullYear(today.getFullYear() + 1);
                    }
                    return nextDate;
                } catch (e) { return null; }
            }
        }

        return null;
    };

    // --- Helper to display deadline text ---
    const getDeadlineDisplay = (task) => {
        if (task.timeType === 'range') {
            const d1 = task.fromDate?.toDate ? task.fromDate.toDate() : new Date(task.fromDate || 0);
            const d2 = task.toDate?.toDate ? task.toDate.toDate() : new Date(task.toDate || 0);
            return `${d1.toLocaleDateString('vi-VN')} - ${d2.toLocaleDateString('vi-VN')}`;
        }

        if (task.timeType === 'recurrence') {
            const { frequency, daysOfWeek, dayOfMonth, specificDate } = task.recurrence || {};
            if (frequency === 'weekly') {
                const dayMap = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
                const days = daysOfWeek?.map(d => dayMap[d]).join(', ');
                return `Hàng tuần: ${days}`;
            }
            if (frequency === 'monthly') return `Vào ngày ${dayOfMonth} hàng tháng`;
            if (frequency === 'yearly') {
                let dateDisplay = specificDate;
                // Normalize "MM-DD" to "DD/MM"
                if (dateDisplay && dateDisplay.includes('-')) {
                    dateDisplay = dateDisplay.split('-').reverse().join('/');
                }
                return `Vào ngày ${dateDisplay} hàng năm`;
            }
            return "Định kỳ";
        }

        // Fixed / Default
        const d = getTaskDeadline(task);
        if (!d) return "Chưa thiết lập";
        return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    };

    // Filtered tasks are already server-side filtered by status
    const filteredTasks = tasks;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = now.getDay();
    const dist = (dayOfWeek === 0 ? 0 : 7 - dayOfWeek);
    const endOfWeek = new Date(startOfToday);
    endOfWeek.setDate(startOfToday.getDate() + dist);
    endOfWeek.setHours(23, 59, 59, 999);
    const next48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const needsAttention = [];
    const thisWeek = [];
    const otherTasks = [];

    filteredTasks.forEach(task => {
        const deadline = getTaskDeadline(task);

        if (!deadline) {
            otherTasks.push({ ...task, _effectiveDeadline: new Date(9999, 11, 31) }); // Push to end
            return;
        }

        // Store effective deadline for sorting
        task._effectiveDeadline = deadline;

        const isOverdue = deadline < now;
        const isHighPriority = ['high', 'urgent', 'cao'].includes(task.priority);
        const isDueWithin48h = deadline <= next48Hours && deadline >= now;
        const isCompleted = task.status === 'completed';

        // Logic for columns
        // 1. Needs Attention: Overdue OR (High Priority & Due Soon) AND NOT Completed
        if (!isCompleted && (isOverdue || task.alertFlag === true || (isHighPriority && isDueWithin48h))) {
            needsAttention.push(task);
        } else if (deadline <= endOfWeek && deadline >= now) {
            thisWeek.push(task);
        } else {
            otherTasks.push(task);
        }
    });

    // Sort by effective date
    const sortByDate = (a, b) => a._effectiveDeadline - b._effectiveDeadline;

    needsAttention.sort(sortByDate);
    thisWeek.sort(sortByDate);
    otherTasks.sort(sortByDate);

    if (loading) return <div>Đang tải công việc...</div>;
    if (error) return <div style={{ color: 'red' }}>{error}</div>;

    const TaskList = ({ title, items, color }) => (
        <div style={{ marginBottom: '30px' }}>
            <h3 style={{ borderBottom: `2px solid ${color}`, paddingBottom: '5px', display: 'inline-block' }}>
                {title} ({items.length})
            </h3>
            {items.length === 0 ? (
                <p style={{ fontStyle: 'italic', color: '#666' }}>Không có công việc nào.</p>
            ) : (
                <ul style={{ listStyle: 'none', padding: 0 }}>
                    {items.map(task => {
                        const isCompleted = task.status === 'completed';

                        // Priority Colors & Label
                        let pColor = '#757575'; // Low (Gray)
                        let pLabel = 'Thấp';
                        if (task.priority === 'high' || task.priority === 'urgent' || task.priority === 'cao') {
                            pColor = '#b71c1c'; // Dark Red
                            pLabel = 'Cao';
                        } else if (task.priority === 'normal' || task.priority === 'trung bình') {
                            pColor = '#1565c0'; // Blue
                            pLabel = 'Trung bình';
                        }

                        // Status Badge
                        const sColor = isCompleted ? '#2e7d32' : '#ec407a'; // Green vs Pink
                        const sLabel = isCompleted ? 'Hoàn thành' : 'Đang làm';

                        // Creator (show if not self)
                        const creatorName = task.createdBy && task.createdBy !== currentUser.uid ? getUserName(task.createdBy) : null;

                        // Co-Assignees (other assignees excluding me)
                        const allAssignees = task.assignees ? Object.keys(task.assignees) : [];
                        const coAssignees = allAssignees.filter(uid => uid !== currentUser.uid);
                        const coAssigneeNames = coAssignees.length > 0 ? coAssignees.map(uid => getUserName(uid)).join(', ') : null;

                        // Supervisor
                        const supervisorName = task.supervisorId ? getUserName(task.supervisorId) : null;

                        return (
                            <li key={task.id} style={{
                                background: isCompleted ? '#e8f5e9' : '#fff',
                                borderLeft: `4px solid ${color}`,
                                padding: '10px',
                                marginBottom: '10px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                            }}>
                                <Link to={`/app/tasks/${task.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                                    <div style={{ fontWeight: 'bold', marginBottom: '5px', fontSize: '1.05em' }}>
                                        {task.title}
                                    </div>
                                    <div style={{ fontSize: '0.9em', color: '#555' }}>
                                        <div style={{ marginBottom: '5px' }}>Hạn: {getDeadlineDisplay(task)}</div>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                                            {/* Priority Badge */}
                                            {task.priority && (
                                                <span style={{
                                                    background: pColor,
                                                    color: '#fff',
                                                    padding: '2px 8px',
                                                    borderRadius: '12px',
                                                    fontSize: '0.75em',
                                                    fontWeight: 'bold'
                                                }}>
                                                    {pLabel}
                                                </span>
                                            )}
                                            {/* Status Badge */}
                                            <span style={{
                                                background: sColor,
                                                color: '#fff',
                                                padding: '2px 8px',
                                                borderRadius: '12px',
                                                fontSize: '0.75em',
                                                fontWeight: 'bold'
                                            }}>
                                                {sLabel}
                                            </span>
                                        </div>
                                        {/* Metadata: Creator, Co-Assignees, Supervisor */}
                                        <div style={{ color: '#666', fontSize: '0.8em' }}>
                                            {creatorName && <div>📝 Giao bởi: <strong>{creatorName}</strong></div>}
                                            {coAssigneeNames && <div>👥 Làm cùng: <strong>{coAssigneeNames}</strong></div>}
                                            {supervisorName && <div>👁️ Giám sát: <strong>{supervisorName}</strong></div>}
                                        </div>
                                    </div>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0' }}>
                <h2 style={{ margin: 0 }}>Dashboard Cá Nhân</h2>
            </div>

            {/* Filter Tabs - square style aligned left */}
            <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid #ddd', marginTop: '20px' }}>
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
                >Đang làm ({counts.open})</button>
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
                >Đã xong ({counts.completed})</button>
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
                >Tất cả ({counts.all})</button>
            </div>

            {/* Content area with border */}
            <div style={{ border: '1px solid #ddd', borderTop: 'none', padding: '20px', background: '#fafafa' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                    <TaskList title="Cần Chú Ý" items={needsAttention} color="#d32f2f" />
                    <TaskList title="Trong Tuần Này" items={thisWeek} color="#1976d2" />
                    <TaskList title="Công Việc Khác" items={otherTasks} color="#388e3c" />
                </div>

                {hasMore && (
                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                        <button
                            onClick={() => fetchTasks(true)}
                            disabled={loadingMore}
                            style={{
                                padding: '10px 25px',
                                background: '#1976d2',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '25px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                            }}
                        >
                            {loadingMore ? 'Đang tải...' : 'Xem thêm công việc'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
