import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, serverTimestamp, addDoc, collection } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

export default function TaskDetail() {
    const { taskId } = useParams();
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();

    const [task, setTask] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // User maps for display
    const [creatorName, setCreatorName] = useState("Unknown");
    const [supervisorName, setSupervisorName] = useState("");
    const [assigneeDetails, setAssigneeDetails] = useState([]); // Array of { uid, name, status }
    const [availableUsers, setAvailableUsers] = useState([]); // For editing

    useEffect(() => {
        async function fetchTaskAndDetails() {
            try {
                // 1. Fetch Task
                const taskRef = doc(db, "tasks", taskId);
                const taskSnap = await getDoc(taskRef);

                if (!taskSnap.exists()) {
                    setError("Công việc không tồn tại.");
                    setLoading(false);
                    return;
                }

                const taskData = taskSnap.data();
                const t = { id: taskSnap.id, ...taskData };
                setTask(t);

                // 2. Fetch Creator Name
                if (t.createdBy) {
                    const userRef = doc(db, "users", t.createdBy);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        const u = userSnap.data();
                        setCreatorName(u.fullName || u.displayName || u.name || t.createdBy);
                    }
                }

                // 3. Fetch Assignees Details
                if (t.assignees) {
                    const aids = Object.keys(t.assignees);
                    const approvals = t.approvals || {};

                    if (aids.length > 0) {
                        const details = [];
                        await Promise.all(aids.map(async (uid) => {
                            const uRef = doc(db, "users", uid);
                            const uSnap = await getDoc(uRef);
                            let name = uid;
                            if (uSnap.exists()) {
                                const u = uSnap.data();
                                name = u.fullName || u.displayName || uid;
                            }
                            details.push({
                                uid: uid,
                                name: name,
                                status: approvals[uid] || "open" // open, pending, approved, rejected
                            });
                        }));
                        setAssigneeDetails(details);
                    }
                }

                // 4. Fetch Supervisor Name
                if (t.supervisorId) {
                    const sRef = doc(db, "users", t.supervisorId);
                    const sSnap = await getDoc(sRef);
                    if (sSnap.exists()) {
                        setSupervisorName(sSnap.data().fullName || sSnap.data().displayName || t.supervisorId);
                    }
                }

                // 5. Fetch Available Users for Edit (if creator)
                if (t.createdBy === currentUser.uid || userProfile?.role === 'admin') {
                    const { collection, getDocs, query, where } = await import("firebase/firestore");
                    const usersRef = collection(db, "users");
                    const qActive = query(usersRef, where("departmentId", "==", t.departmentId), where("status", "==", "active"));
                    const uSnap = await getDocs(qActive);
                    const uList = [];
                    uSnap.forEach(doc => uList.push({ uid: doc.id, ...doc.data() }));
                    setAvailableUsers(uList);
                }

            } catch (err) {
                console.error("Error fetching task details:", err);
                setError("Lỗi khi tải thông tin công việc.");
            } finally {
                setLoading(false);
            }
        }

        fetchTaskAndDetails();
    }, [taskId]);

    // Action: Staff requests completion
    const handleRequestDone = async () => {
        if (!currentUser) return;
        try {
            const taskRef = doc(db, "tasks", taskId);
            const newApprovals = { ...(task.approvals || {}), [currentUser.uid]: "pending" };
            await updateDoc(taskRef, {
                approvals: newApprovals,
                updatedAt: serverTimestamp()
            });
            alert("Đã gửi đề nghị hoàn thành!");
            window.location.reload();
        } catch (err) {
            console.error(err);
            alert("Lỗi: " + err.message);
        }
    };

    // Helper: Calculate next deadline for rotation
    const calculateNextDeadline = (frequency, daysOfWeek, dayOfMonth, specificDate, currentDeadlineDate) => {
        const now = new Date();
        // Start calculation from the CURRENT deadline (to avoid skipping if we complete early? 
        // Or start from Today? User wants "Next week".
        // If I complete "Monday" task on "Tuesday", next one is "Wednesday".
        // If I complete "Monday" task on "Sunday" (early), next one is "Monday"? No, wait.
        // Recurrence usually means "After this one is done, when is the next one?"
        // Ideally: Find next occurrence AFTER the current deadline.

        // Let's stick to "From Today" logic as base, but ensure it's > currentDeadline?
        // Actually, simpler: "Find nearest future occurrence relative to TODAY". 
        // If today is Monday and I finish Monday task -> Next is Wednesday.

        // Re-use logic from CreateTask but ensuring we move forward.
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let nextDate = new Date(today);

        if (frequency === 'weekly' && Array.isArray(daysOfWeek) && daysOfWeek.length > 0) {
            const currentDay = now.getDay();
            const sortedDays = [...daysOfWeek].map(Number).sort((a, b) => a - b);

            // Find day strictly > currentDay? Or >=?
            // If I finish on Monday (1), and days are [1, 3]. Next is 3.
            // If I finish on Monday (1) evening, and days are [1]. Next is 1 (next week).
            // Logic: Find first day > currentDay. If none, wrap.
            // Wait, what if I'm late? Today is Tuesday. Deadline was Monday.
            // I finish. Next should be Wednesday (3).
            // So: Find first day >= today.
            // IF day == today, check if we already finished "today's" instance?
            // Yes, because we are clicking "Approve/Done" NOW.
            // So we need strictly > today? 
            // OR: We base it on the *Old Deadline*.
            // If Old Deadline was Monday. Next is Wednesday.

            // Let's use "Strictly Greater Than Today" to be safe for rotation. 
            // Meaning if I finish it today, the next one is in the future.

            let nextDay = sortedDays.find(d => d > currentDay); // Strictly future in this week

            let daysToAdd = 0;
            if (nextDay !== undefined) {
                daysToAdd = nextDay - currentDay;
            } else {
                // Wrap to first day next week
                nextDay = sortedDays[0];
                daysToAdd = (7 - currentDay) + nextDay;
            }
            nextDate.setDate(today.getDate() + daysToAdd);
        } else if (frequency === 'monthly' && dayOfMonth) {
            nextDate.setDate(dayOfMonth);
            if (nextDate <= today) {
                nextDate.setMonth(nextDate.getMonth() + 1);
            }
        } else if (frequency === 'yearly' && specificDate) {
            try {
                let d, m;
                if (specificDate.includes('/')) {
                    [d, m] = specificDate.split('/').map(Number);
                } else {
                    [m, d] = specificDate.split('-').map(Number);
                }
                nextDate = new Date(today.getFullYear(), m - 1, d);
                if (nextDate <= today) {
                    nextDate.setFullYear(today.getFullYear() + 1);
                }
            } catch (e) { }
        }

        // Preserve Time from old deadline or set default
        if (currentDeadlineDate) {
            nextDate.setHours(currentDeadlineDate.getHours(), currentDeadlineDate.getMinutes());
        } else {
            nextDate.setHours(23, 59, 59);
        }
        return nextDate;
    };

    // Action: Manager approves/rejects
    const handleApproval = async (targetUid, status) => {
        try {
            const taskRef = doc(db, "tasks", taskId);
            const newApprovals = { ...(task.approvals || {}), [targetUid]: status };

            // Check if ALL are approved
            let allApproved = true;
            const aids = Object.keys(task.assignees || {});
            aids.forEach(uid => {
                if (newApprovals[uid] !== "approved") allApproved = false;
            });

            const updates = {
                approvals: newApprovals,
                updatedAt: serverTimestamp()
            };

            if (allApproved) {
                // CHECK RECURRENCE ROTATION
                if (task.timeType === 'recurrence') {
                    // 1. Calculate New Deadline
                    // Use Saved Deadline or calc from scratch
                    const currentDeadline = task.nextDeadline ? (task.nextDeadline.toDate ? task.nextDeadline.toDate() : new Date(task.nextDeadline)) : null;
                    const { frequency, daysOfWeek, dayOfMonth, specificDate } = task.recurrence || {};

                    const newNextDeadline = calculateNextDeadline(frequency, daysOfWeek, dayOfMonth, specificDate, currentDeadline);

                    // 2. Archive Current "Instance"
                    await addDoc(collection(db, "tasks"), {
                        ...task,
                        id: null, // Let firestore gen new ID
                        originalTaskId: taskId,
                        isArchived: true,
                        status: 'completed',
                        approvals: newApprovals,
                        completedAt: serverTimestamp(),
                        archivedAt: serverTimestamp(),
                        title: `${task.title} (Hoàn thành: ${new Date().toLocaleDateString('vi-VN')})`
                    });

                    // 3. Reset Main Task
                    updates.status = 'open';
                    updates.approvals = {}; // Reset approvals
                    updates.nextDeadline = newNextDeadline; // Update deadline
                    alert(`Đã duyệt! Công việc định kỳ đã được gia hạn tới ${newNextDeadline.toLocaleDateString('vi-VN')}.`);

                } else {
                    // Normal Task Completion
                    updates.status = "completed";
                    updates.completedAt = serverTimestamp();
                    alert(status === 'approved' ? "Đã duyệt!" : "Đã từ chối!");
                }
            } else {
                alert(status === 'approved' ? "Đã duyệt!" : "Đã từ chối!");
            }

            await updateDoc(taskRef, updates);
            window.location.reload();
        } catch (err) {
            console.error(err);
            alert("Lỗi: " + err.message);
        }
    };

    const handleSoftDelete = async () => {
        if (!window.confirm("Bạn có chắc muốn xóa công việc này? Nó sẽ được đưa vào danh sách theo dõi đã xóa.")) return;
        try {
            await updateDoc(doc(db, "tasks", taskId), {
                isDeleted: true,
                deletedAt: serverTimestamp(),
                deletedBy: currentUser.uid
            });
            alert("Đã xóa công việc.");
            navigate("/app/management");
        } catch (err) {
            alert("Lỗi: " + err.message);
        }
    };

    if (loading) return <div>Đang tải chi tiết công việc...</div>;
    if (error) return <div style={{ color: 'red' }}>{error}</div>;
    if (!task) return <div>Không tìm thấy dữ liệu.</div>;

    const formatDate = (dateValue) => {
        if (!dateValue) return "Chưa thiết lập";
        const d = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
        return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    };

    const getStatusLabel = (s) => {
        switch (s) {
            case 'open': return <span style={{ color: '#666' }}>Đang thực hiện</span>;
            case 'pending': return <span style={{ color: 'orange', fontWeight: 'bold' }}>Chờ duyệt</span>;
            case 'approved': return <span style={{ color: 'green', fontWeight: 'bold' }}>Hoàn thành</span>;
            case 'rejected': return <span style={{ color: 'red' }}>Cần làm lại</span>;
            default: return s;
        }
    };

    const isAssignee = task.assignees && task.assignees[currentUser?.uid];
    const canRequestDone = isAssignee && (!task.approvals || (task.approvals[currentUser.uid] !== 'pending' && task.approvals[currentUser.uid] !== 'approved'));
    const isManagerOrAdmin = userProfile?.role === 'manager' || userProfile?.role === 'admin';
    const isCreator = task.createdBy === currentUser?.uid;
    const canEdit = (isCreator || userProfile?.role === 'admin') && task.status !== 'completed';

    const renderTime = () => {
        if (task.timeType === 'range') {
            return (
                <div>
                    <strong>Từ:</strong> {formatDate(task.fromDate)} <br />
                    <strong>Đến:</strong> {formatDate(task.toDate)}
                </div>
            );
        }
        if (task.timeType === 'recurrence' && task.recurrence) {
            const { frequency, daysOfWeek, dayOfMonth, specificDate } = task.recurrence;
            let label = "";
            if (frequency === 'weekly') {
                const days = (daysOfWeek || []).map(d => d === 0 ? "CN" : `T${d + 1}`).join(", ");
                label = `Hàng tuần (${days})`;
            } else if (frequency === 'monthly') {
                label = `Ngày ${dayOfMonth} hàng tháng`;
            } else if (frequency === 'yearly') {
                let dateDisplay = specificDate;
                // Normalize "MM-DD" to "DD/MM"
                if (dateDisplay && dateDisplay.includes('-')) {
                    dateDisplay = dateDisplay.split('-').reverse().join('/');
                }
                label = `Ngày ${dateDisplay} hàng năm`;
            }
            return <div><strong>Định kỳ:</strong> {label}</div>;
        }
        return <div><strong>Hạn dùng:</strong> {formatDate(task.dueAt)}</div>;
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', background: '#fff', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <button onClick={() => window.history.back()} style={{ padding: '5px 15px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ddd' }}>&larr; Quay lại</button>
                <div style={{ display: 'flex', gap: '10px' }}>
                    {canEdit && (
                        <>
                            <button onClick={() => navigate(`/app/tasks/${taskId}/edit`)} style={{ padding: '5px 15px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                Sửa công việc
                            </button>
                            <button onClick={handleSoftDelete} style={{ padding: '5px 15px', background: '#fff', color: '#f44336', border: '1px solid #f44336', borderRadius: '4px', cursor: 'pointer' }}>
                                Xóa
                            </button>
                        </>
                    )}
                </div>
            </div>

            <>
                <div style={{ borderBottom: '1px solid #eee', paddingBottom: '15px', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, color: '#1976d2' }}>{task.title}</h2>
                    <div style={{ marginTop: '10px', fontSize: '0.9em', color: '#666', display: 'flex', gap: '20px' }}>
                        <span>Người giao: <strong>{creatorName}</strong></span>
                        <span>Ngày tạo: <strong>{formatDate(task.createdAt)}</strong></span>
                        {supervisorName && <span>Giám sát: <strong>{supervisorName}</strong></span>}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '6px' }}>
                    {renderTime()}
                    <div><strong>Ưu tiên:</strong> <span style={{ color: task.priority === 'high' ? 'red' : 'inherit' }}>
                        {task.priority === 'high' ? 'CAO' : task.priority === 'low' ? 'THẤP' : 'TRUNG BÌNH'}
                    </span></div>
                    <div><strong>Trạng thái:</strong> <span style={{ fontWeight: 'bold', color: task.status === 'completed' ? 'green' : 'orange' }}>{task.status === 'completed' ? "ĐÃ HOÀN THÀNH" : "ĐANG THỰC HIỆN"}</span></div>
                </div>

                <div style={{ marginBottom: '30px' }}>
                    <strong style={{ fontSize: '1.1em' }}>Nội dung chi tiết:</strong>
                    <div style={{ marginTop: '10px', padding: '20px', background: '#fff', borderRadius: '4px', border: '1px solid #eee', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{task.content}</div>
                </div>

                {canRequestDone && task.status !== 'completed' && (
                    <div style={{ marginBottom: '30px', textAlign: 'center' }}>
                        <button onClick={handleRequestDone} style={{ padding: '12px 30px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '1.1em', fontWeight: 'bold', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>
                            TÔI ĐÃ HOÀN THÀNH VIỆC NÀY
                        </button>
                    </div>
                )}

                <div>
                    <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px' }}>Nhân viên thực hiện & Tiến độ</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                        <thead>
                            <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                                <th style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Họ tên</th>
                                <th style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Tình trạng</th>
                                <th style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {assigneeDetails.map((detail) => (
                                <tr key={detail.uid} style={{ borderBottom: '1px solid #f9f9f9' }}>
                                    <td style={{ padding: '12px' }}>{detail.name}</td>
                                    <td style={{ padding: '12px' }}>{getStatusLabel(detail.status)}</td>
                                    <td style={{ padding: '12px' }}>
                                        {isManagerOrAdmin && detail.status === 'pending' && (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button onClick={() => handleApproval(detail.uid, 'approved')} style={{ background: '#2e7d32', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9em' }}>Duyệt</button>
                                                <button onClick={() => handleApproval(detail.uid, 'rejected')} style={{ background: '#d32f2f', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9em' }}>Từ chối</button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {assigneeDetails.length === 0 && (
                                <tr>
                                    <td colSpan="3" style={{ padding: '20px', textAlign: 'center', color: '#999', fontStyle: 'italic' }}>Chưa có nhân viên được giao.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </>
        </div>
    );
}
