import { useEffect, useState } from "react";
import { collection, query, where, getDocs, orderBy, getFirestore } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebase";

export default function PersonalDashboard() {
    const { currentUser } = useAuth();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function fetchTasks() {
            if (!currentUser) return;

            try {
                const tasksRef = collection(db, "tasks");
                // Query tasks where current user is in 'assignees' array
                // Note: Firestore requires an index for array-contains combined with other filters/orders usually,
                // but for now we'll just filter by assignee and do client-side sorting/filtering if needed 
                // or just simple query first.
                const q = query(
                    tasksRef,
                    where(`assignees.${currentUser.uid}`, "==", true)
                );

                const querySnapshot = await getDocs(q);
                const fetchedTasks = [];
                querySnapshot.forEach((doc) => {
                    fetchedTasks.push({ id: doc.id, ...doc.data() });
                });

                setTasks(fetchedTasks);
            } catch (err) {
                console.error("Error fetching tasks:", err);
                setError("Không thể tải danh sách công việc. Vui lòng thử lại sau.");
            } finally {
                setLoading(false);
            }
        }

        fetchTasks();
    }, [currentUser]);

    // Categorization Logic
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Calculate end of current week (Sunday)
    // getDay(): 0 is Sunday, 1 is Monday.
    // We assume week starts on Monday for "This Week"? Or generic?
    // Let's assume standard "End of Saturday" or "End of Sunday".
    // Let's go with: next Sunday 23:59:59.
    const dayOfWeek = now.getDay();
    const daysUntilSunday = (7 - dayOfWeek) % 7;
    const endOfWeek = new Date(startOfToday);
    endOfWeek.setDate(startOfToday.getDate() + daysUntilSunday);
    endOfWeek.setHours(23, 59, 59, 999);

    // 48 hours from now
    const next48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const needsAttention = [];
    const thisWeek = [];
    const otherTasks = [];

    tasks.forEach(task => {
        // Safety check for dueAt. Assume it's a Timestamp or ISO string.
        // Firestore Timestamps have toDate(). Strings need new Date().
        let dueDate = null;
        if (task.dueAt) {
            if (task.dueAt.toDate) {
                dueDate = task.dueAt.toDate();
            } else {
                dueDate = new Date(task.dueAt);
            }
        }

        if (!dueDate) {
            console.log("Task no due date:", task.title);
            otherTasks.push(task);
            return;
        }

        const isOverdue = dueDate < now;
        const isHighPriority = task.priority === 'high' || task.priority === 'urgent' || task.priority === 'cao';
        const isDueWithin48h = dueDate <= next48Hours && dueDate >= now;

        console.log(`Task: ${task.title}, Due: ${dueDate}, Overdue: ${isOverdue}, HighPrio: ${isHighPriority}, Within48h: ${isDueWithin48h}`);

        // Logic: Needs Attention
        if (
            isOverdue ||
            task.alertFlag === true ||
            (isHighPriority && isDueWithin48h)
        ) {
            needsAttention.push(task);
        }
        // Logic: This Week (exclusive of Needs Attention)
        else if (dueDate <= endOfWeek && dueDate >= now) {
            thisWeek.push(task);
        }
        // Logic: Other
        else {
            otherTasks.push(task);
        }
    });

    // Sort by date inside categories
    const sortByDate = (a, b) => {
        const dateA = a.dueAt?.toDate ? a.dueAt.toDate() : new Date(a.dueAt || 0);
        const dateB = b.dueAt?.toDate ? b.dueAt.toDate() : new Date(b.dueAt || 0);
        return dateA - dateB;
    };

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
                        const d = task.dueAt?.toDate ? task.dueAt.toDate() : new Date(task.dueAt);
                        const dateStr = d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                        return (
                            <li key={task.id} style={{
                                background: '#fff',
                                borderLeft: `4px solid ${color}`,
                                padding: '10px',
                                marginBottom: '10px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                            }}>
                                <div style={{ fontWeight: 'bold' }}>{task.title}</div>
                                <div style={{ fontSize: '0.9em', color: '#555' }}>
                                    Hạn: {dateStr}
                                    {task.priority && <span style={{ marginLeft: '10px', background: '#eee', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8em' }}>{task.priority}</span>}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );

    return (
        <div>
            <h2 style={{ marginBottom: '20px' }}>Dashboard Cá Nhân</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                <TaskList title="Cần Chú Ý" items={needsAttention} color="#d32f2f" />
                <TaskList title="Trong Tuần Này" items={thisWeek} color="#1976d2" />
                <TaskList title="Công Việc Khác" items={otherTasks} color="#388e3c" />
            </div>
        </div>
    );
}
