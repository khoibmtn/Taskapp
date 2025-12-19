import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
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
    const [assigneeDetails, setAssigneeDetails] = useState([]); // Array of { uid, name, status }

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
                updates.status = "completed";
            }

            await updateDoc(taskRef, updates);
            alert(status === 'approved' ? "Đã duyệt!" : "Đã từ chối!");
            window.location.reload();
        } catch (err) {
            console.error(err);
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

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', background: '#fff', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
            <button onClick={() => navigate(-1)} style={{ marginBottom: '20px', padding: '5px 10px', cursor: 'pointer' }}>&larr; Quay lại</button>

            <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, color: '#1976d2' }}>{task.title}</h2>
                <div style={{ marginTop: '10px', fontSize: '0.9em', color: '#666' }}>
                    Người giao: <strong>{creatorName}</strong> &bull; {formatDate(task.createdAt)}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div><strong>Hạn dùng:</strong> {formatDate(task.dueAt)}</div>
                <div><strong>Ưu tiên:</strong> {task.priority}</div>
                <div><strong>Trạng thái:</strong> <span style={{ fontWeight: 'bold' }}>{task.status === 'completed' ? "ĐÃ HOÀN THÀNH" : "Đang thực hiện"}</span></div>
            </div>

            <div style={{ marginBottom: '30px' }}>
                <strong>Nội dung:</strong>
                <div style={{ marginTop: '10px', padding: '15px', background: '#f9f9f9', borderRadius: '4px', border: '1px solid #eee' }}>{task.content}</div>
            </div>

            {canRequestDone && task.status !== 'completed' && (
                <div style={{ marginBottom: '30px', textAlign: 'center' }}>
                    <button onClick={handleRequestDone} style={{ padding: '10px 20px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1.1em' }}>
                        TÔI ĐÃ HOÀN THÀNH VIỆC NÀY
                    </button>
                </div>
            )}

            <div>
                <h3>Người thực hiện & Phê duyệt</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                    <thead>
                        <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                            <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Nhân viên</th>
                            <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Trạng thái</th>
                            <th style={{ padding: '10px', borderBottom: '1px solid #ddd' }}>Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {assigneeDetails.map((detail) => (
                            <tr key={detail.uid}>
                                <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{detail.name}</td>
                                <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{getStatusLabel(detail.status)}</td>
                                <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                                    {isManagerOrAdmin && detail.status === 'pending' && (
                                        <div style={{ display: 'flex', gap: '5px' }}>
                                            <button onClick={() => handleApproval(detail.uid, 'approved')} style={{ background: 'green', color: '#fff', border: 'none', padding: '5px', borderRadius: '4px', cursor: 'pointer' }}>Duyệt</button>
                                            <button onClick={() => handleApproval(detail.uid, 'rejected')} style={{ background: 'red', color: '#fff', border: 'none', padding: '5px', borderRadius: '4px', cursor: 'pointer' }}>Từ chối</button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
