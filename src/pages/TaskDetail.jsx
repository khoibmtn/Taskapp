import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, getDocs, query, where, documentId } from "firebase/firestore";
import { db } from "../firebase";

export default function TaskDetail() {
    const { taskId } = useParams();
    const navigate = useNavigate();

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
                        setCreatorName(u.displayName || u.name || u.email || t.createdBy);
                    }
                }

                // 3. Fetch Assignees Details
                // t.assignees is Map { uid: true/false? or just presence }
                // Based on previous code, it's a map { uid: true }
                if (t.assignees) {
                    const aids = Object.keys(t.assignees);
                    if (aids.length > 0) {
                        // Fetch all users in one go? Or individually?
                        // "IN" query is limited to 10. For safe scalability, let's just fetch individually for now 
                        // or fetch all users and filter (cached in context ideally, but here local is fine).
                        // Let's do individual fetches parallelized for simplicity and standard Firestore usage.

                        const details = [];
                        await Promise.all(aids.map(async (uid) => {
                            const uRef = doc(db, "users", uid);
                            const uSnap = await getDoc(uRef);
                            let name = uid;
                            if (uSnap.exists()) {
                                const u = uSnap.data();
                                name = u.displayName || u.name || u.email || uid;
                            }
                            details.push({
                                uid: uid,
                                name: name,
                                status: "Đang thực hiện" // Hardcoded as per requirements for now, or derive from task status
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

    if (loading) return <div>Đang tải chi tiết công việc...</div>;
    if (error) return <div style={{ color: 'red' }}>{error}</div>;
    if (!task) return <div>Không tìm thấy dữ liệu.</div>;

    // Format helpers
    const formatDate = (dateValue) => {
        if (!dateValue) return "Chưa thiết lập";
        const d = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
        return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    };

    const getPriorityLabel = (p) => {
        if (p === 'high' || p === 'cao') return <span style={{ color: 'red', fontWeight: 'bold' }}>Cao</span>;
        if (p === 'low' || p === 'thap') return <span style={{ color: 'green' }}>Thấp</span>;
        return <span style={{ color: 'orange' }}>Bình thường</span>;
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', background: '#fff', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
            <button onClick={() => navigate(-1)} style={{ marginBottom: '20px', padding: '5px 10px', cursor: 'pointer' }}>
                &larr; Quay lại
            </button>

            <div style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, color: '#1976d2' }}>{task.title}</h2>
                <div style={{ marginTop: '10px', fontSize: '0.9em', color: '#666' }}>
                    Người giao: <strong>{creatorName}</strong> &bull; Tạo lúc: {formatDate(task.createdAt)}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                    <strong>Hạn hoàn thành:</strong>
                    <div style={{ marginTop: '5px' }}>{formatDate(task.dueAt)}</div>
                </div>
                <div>
                    <strong>Mức độ ưu tiên:</strong>
                    <div style={{ marginTop: '5px' }}>{getPriorityLabel(task.priority)}</div>
                </div>
                <div>
                    <strong>Trạng thái chung:</strong>
                    <div style={{ marginTop: '5px', fontWeight: 'bold', color: '#1976d2' }}>
                        {task.status === 'open' ? "Đang thực hiện" : task.status}
                    </div>
                </div>
                {task.alertFlag && (
                    <div>
                        <strong>Cảnh báo:</strong>
                        <div style={{ marginTop: '5px', color: 'red', fontWeight: 'bold' }}>&#9888; Cần chú ý (Gấp)</div>
                    </div>
                )}
            </div>

            <div style={{ marginBottom: '20px' }}>
                <strong>Nội dung chi tiết:</strong>
                <div style={{ marginTop: '10px', whiteSpace: 'pre-wrap', background: '#f9f9f9', padding: '15px', borderRadius: '4px', border: '1px solid #eee' }}>
                    {task.content || "Không có nội dung chi tiết."}
                </div>
            </div>

            <div>
                <h3 style={{ borderBottom: '2px solid #ddd', paddingBottom: '5px', marginBottom: '15px' }}>
                    Người được giao & Trạng thái
                </h3>
                {assigneeDetails.length === 0 ? (
                    <p>Chưa giao cho ai.</p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Nhân viên</th>
                                <th style={{ padding: '8px', borderBottom: '1px solid #ddd' }}>Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody>
                            {assigneeDetails.map((detail) => (
                                <tr key={detail.uid}>
                                    <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{detail.name}</td>
                                    <td style={{ padding: '10px', borderBottom: '1px solid #eee' }}>{detail.status}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
