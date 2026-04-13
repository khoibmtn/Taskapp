import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, getDocs, onSnapshot, limit, startAfter, writeBatch, doc as firestoreDoc } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebase";
import { getTasksQuery, getTaskCount } from "../utils/queryUtils";
import { AlertTriangle, Calendar, Clock, ChevronRight, Loader2, UserPen, Users2, Eye } from "lucide-react";

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

    // Mark open tasks as "seen" by this user when visiting Dashboard
    useEffect(() => {
        if (!currentUser?.uid) return;
        const markTasksAsSeen = async () => {
            try {
                const q = query(
                    collection(db, "tasks"),
                    where("assigneeUids", "array-contains", currentUser.uid),
                    where("status", "==", "open"),
                    where("isRecurringTemplate", "==", false)
                );
                const snap = await getDocs(q);
                const batch = writeBatch(db);
                let batchCount = 0;

                snap.forEach(docSnap => {
                    const data = docSnap.data();
                    const seenBy = data.seenBy || {};
                    if (!seenBy[currentUser.uid]) {
                        batch.update(firestoreDoc(db, "tasks", docSnap.id), {
                            [`seenBy.${currentUser.uid}`]: true
                        });
                        batchCount++;
                    }
                });

                if (batchCount > 0) {
                    await batch.commit();
                }
            } catch (err) {
                // Non-critical, silently fail
                console.warn("Mark seen error:", err);
            }
        };
        markTasksAsSeen();
    }, [currentUser?.uid]);

    // Fetch counts for tabs
    useEffect(() => {
        if (!currentUser) return;
        const fetchCounts = async () => {
            try {
                const safeCount = (params) => getTaskCount(params).catch(e => {
                    console.error("Count Error (Index needed?):", e);
                    return 0;
                });

                const [open, completed, all] = await Promise.all([
                    safeCount({ uid: currentUser.uid, role: 'related', status: 'open' }),
                    safeCount({ uid: currentUser.uid, role: 'related', status: 'completed' }),
                    safeCount({ uid: currentUser.uid, role: 'related', status: 'all' })
                ]);

                setCounts({ open, completed, all });
            } catch (err) {
                console.error("Fetch Counts Failed:", err);
            }
        };
        fetchCounts();
    }, [currentUser]);

    const fetchTasks = async (isLoadMore = false) => {
        if (!currentUser) return;
        if (isLoadMore) setLoadingMore(true);
        else setLoading(true);

        try {
            const q = getTasksQuery({
                uid: currentUser.uid,
                role: 'related',
                status: filterStatus,
                pageSize: PAGE_SIZE,
                lastDoc: isLoadMore ? lastDoc : null
            });

            const snap = await getDocs(q);
            const newFetchedTasks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            setTasksCache(prev => {
                const currentTasks = isLoadMore ? (prev[filterStatus] || []) : [];
                const merged = isLoadMore ? [...currentTasks, ...newFetchedTasks] : newFetchedTasks;
                return { ...prev, [filterStatus]: merged };
            });

            setHasMore(snap.docs.length === PAGE_SIZE);
            if (snap.docs.length > 0) {
                setLastDoc(snap.docs[snap.docs.length - 1]);
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

        const unsubDept = onSnapshot(query(usersRef, where("departmentIds", "array-contains", deptId)), (snap) => {
            setUserMap(prev => {
                const next = { ...prev };
                snap.forEach(doc => { next[doc.id] = doc.data(); });
                return next;
            });
        });

        const unsubAdmins = onSnapshot(usersRef, (snap) => {
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

    const getTaskDeadline = (task) => {
        if (!task) return null;
        if (task.timeType === 'fixed' || (!task.timeType && task.dueAt)) {
            if (task.dueAt) return task.dueAt?.toDate ? task.dueAt.toDate() : new Date(task.dueAt);
            return null;
        }
        if (task.timeType === 'range') {
            if (task.toDate) return task.toDate?.toDate ? task.toDate.toDate() : new Date(task.toDate);
            return null;
        }
        if (task.timeType === 'recurrence' && task.recurrence) {
            if (task.nextDeadline) return task.nextDeadline?.toDate ? task.nextDeadline.toDate() : new Date(task.nextDeadline);
            const { frequency, daysOfWeek, dayOfMonth, specificDate } = task.recurrence;
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            if (frequency === 'weekly' && Array.isArray(daysOfWeek) && daysOfWeek.length > 0) {
                const currentDay = now.getDay();
                const sortedDays = [...daysOfWeek].map(Number).sort((a, b) => a - b);
                let nextDay = sortedDays.find(d => d >= currentDay);
                let daysToAdd = 0;
                if (nextDay !== undefined) { daysToAdd = nextDay - currentDay; }
                else { nextDay = sortedDays[0]; daysToAdd = (7 - currentDay) + nextDay; }
                const nextDate = new Date(today);
                nextDate.setDate(today.getDate() + daysToAdd);
                nextDate.setHours(23, 59, 59);
                return nextDate;
            }
            if (frequency === 'monthly' && dayOfMonth) {
                let nextDate = new Date(today);
                nextDate.setDate(dayOfMonth);
                if (nextDate < today) nextDate.setMonth(nextDate.getMonth() + 1);
                return nextDate;
            }
            if (frequency === 'yearly' && specificDate) {
                try {
                    let d, m;
                    if (specificDate.includes('/')) { [d, m] = specificDate.split('/').map(Number); }
                    else { [m, d] = specificDate.split('-').map(Number); }
                    let nextDate = new Date(today.getFullYear(), m - 1, d);
                    if (nextDate < today) nextDate.setFullYear(today.getFullYear() + 1);
                    return nextDate;
                } catch (e) { return null; }
            }
        }
        return null;
    };

    const getDeadlineDisplay = (task) => {
        if (task.timeType === 'range') {
            const d1 = task.fromDate?.toDate ? task.fromDate.toDate() : new Date(task.fromDate || 0);
            const d2 = task.toDate?.toDate ? task.toDate.toDate() : new Date(task.toDate || 0);
            return `${d1.toLocaleDateString('vi-VN')} - ${d2.toLocaleDateString('vi-VN')}`;
        }
        if (task.timeType === 'recurrence') {
            const { frequency, daysOfWeek, dayOfMonth, specificDate } = task.recurrence || {};
            if (frequency === 'weekly') {
                const days = (daysOfWeek || []).map(d => d === 0 ? "CN" : `T${d + 1}`).join(", ");
                return `Hàng tuần (${days})`;
            }
            if (frequency === 'monthly') return `Ngày ${dayOfMonth} hàng tháng`;
            if (frequency === 'yearly') {
                let dateDisplay = specificDate;
                if (dateDisplay && dateDisplay.includes('-')) dateDisplay = dateDisplay.split('-').reverse().join('/');
                return `Ngày ${dateDisplay} hàng năm`;
            }
            return "Định kỳ";
        }
        const d = getTaskDeadline(task);
        if (!d) return "Chưa thiết lập";
        return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    };

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
            otherTasks.push({ ...task, _effectiveDeadline: new Date(9999, 11, 31) });
            return;
        }
        task._effectiveDeadline = deadline;
        const isOverdue = deadline < now;
        const isHighPriority = ['high', 'urgent', 'cao'].includes(task.priority);
        const isDueWithin48h = deadline <= next48Hours && deadline >= now;
        const isCompleted = task.status === 'completed';

        if (!isCompleted && (isOverdue || task.alertFlag === true || (isHighPriority && isDueWithin48h))) {
            needsAttention.push(task);
        } else if (deadline <= endOfWeek && deadline >= now) {
            thisWeek.push(task);
        } else {
            otherTasks.push(task);
        }
    });

    const sortByDate = (a, b) => a._effectiveDeadline - b._effectiveDeadline;
    needsAttention.sort(sortByDate);
    thisWeek.sort(sortByDate);
    otherTasks.sort(sortByDate);

    // ----------- UI -----------

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-gray-500">Đang tải công việc...</span>
        </div>
    );

    if (error) return (
        <div className="bg-danger-50 text-danger-600 p-4 rounded-xl text-sm">{error}</div>
    );

    const TABS = [
        { key: 'open', label: 'Đang làm', count: counts.open, activeClass: 'bg-primary-600 text-white' },
        { key: 'completed', label: 'Đã xong', count: counts.completed, activeClass: 'bg-success-500 text-white' },
        { key: 'all', label: 'Tất cả', count: counts.all, activeClass: 'bg-gray-700 text-white' },
    ];

    const getPriorityBadge = (priority) => {
        if (['high', 'urgent', 'cao'].includes(priority)) return { cls: 'bg-danger-50 text-danger-600', label: 'Cao' };
        if (['normal', 'trung bình'].includes(priority)) return { cls: 'bg-primary-50 text-primary-700', label: 'TB' };
        return { cls: 'bg-gray-100 text-gray-500', label: 'Thấp' };
    };

    const TaskCard = ({ task }) => {
        const isCompleted = task.status === 'completed';
        const pb = getPriorityBadge(task.priority);
        const creatorName = task.createdBy && task.createdBy !== currentUser.uid ? getUserName(task.createdBy) : null;
        const allAssignees = task.assignees ? Object.keys(task.assignees) : [];
        const coAssignees = allAssignees.filter(uid => uid !== currentUser.uid);
        const coAssigneeNames = coAssignees.length > 0 ? coAssignees.map(uid => getUserName(uid)).join(', ') : null;
        const supervisorName = task.supervisorId ? getUserName(task.supervisorId) : null;

        return (
            <Link to={`/app/tasks/${task.id}`} className="block">
                <div className={`p-3.5 rounded-xl border transition-colors ${
                    isCompleted ? 'bg-success-50 border-success-200' : 'bg-white border-gray-200 hover:border-primary-300'
                }`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className={`font-medium text-sm leading-snug flex-1 ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                            {task.title}
                        </h4>
                        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
                    </div>

                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{getDeadlineDisplay(task)}</span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                        {task.priority && (
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${pb.cls}`}>{pb.label}</span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            isCompleted ? 'bg-success-100 text-success-600' : 'bg-warning-100 text-warning-600'
                        }`}>
                            {isCompleted ? 'Hoàn thành' : 'Đang làm'}
                        </span>
                    </div>

                    {(creatorName || coAssigneeNames || supervisorName) && (
                        <div className="mt-2 pt-2 border-t border-gray-100 space-y-0.5 text-xs text-gray-400">
                            {creatorName && (
                                <div className="flex items-center gap-1">
                                    <UserPen className="w-3 h-3" />
                                    <span>Giao bởi: <strong className="text-gray-500">{creatorName}</strong></span>
                                </div>
                            )}
                            {coAssigneeNames && (
                                <div className="flex items-center gap-1">
                                    <Users2 className="w-3 h-3" />
                                    <span>Làm cùng: <strong className="text-gray-500">{coAssigneeNames}</strong></span>
                                </div>
                            )}
                            {supervisorName && (
                                <div className="flex items-center gap-1">
                                    <Eye className="w-3 h-3" />
                                    <span>Giám sát: <strong className="text-gray-500">{supervisorName}</strong></span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </Link>
        );
    };

    const TaskSection = ({ title, items, icon: Icon, iconColor }) => (
        <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
                <Icon className={`w-4.5 h-4.5 ${iconColor}`} />
                <h3 className="font-heading font-semibold text-sm text-gray-700">{title}</h3>
                <span className="text-xs text-gray-400">({items.length})</span>
            </div>
            {items.length === 0 ? (
                <p className="text-sm text-gray-400 italic pl-6">Không có công việc nào.</p>
            ) : (
                <div className="space-y-2">
                    {items.map(task => <TaskCard key={task.id} task={task} />)}
                </div>
            )}
        </div>
    );

    return (
        <div>
            <h2 className="font-heading text-xl font-bold text-gray-900 mb-4">Dashboard Cá Nhân</h2>

            {/* Filter Tabs — horizontal scroll on mobile */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-4 -mx-1 px-1">
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setFilterStatus(tab.key)}
                        className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors min-h-[40px] ${
                            filterStatus === tab.key ? tab.activeClass : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                    >
                        {tab.label} ({tab.count})
                    </button>
                ))}
            </div>

            {/* Task Sections */}
            <div className="space-y-2 lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
                <TaskSection title="Cần Chú Ý" items={needsAttention} icon={AlertTriangle} iconColor="text-danger-500" />
                <TaskSection title="Trong Tuần Này" items={thisWeek} icon={Calendar} iconColor="text-primary-500" />
                <TaskSection title="Công Việc Khác" items={otherTasks} icon={Clock} iconColor="text-success-500" />
            </div>

            {/* Load More */}
            {hasMore && (
                <div className="text-center mt-6">
                    <button
                        onClick={() => fetchTasks(true)}
                        disabled={loadingMore}
                        className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white text-sm font-semibold rounded-full transition-colors min-h-[44px]"
                    >
                        {loadingMore ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Đang tải...</>
                        ) : (
                            'Xem thêm công việc'
                        )}
                    </button>
                </div>
            )}
        </div>
    );
}
