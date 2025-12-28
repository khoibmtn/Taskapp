import { useState } from "react";
import { collection, getDocs, writeBatch, doc } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";

export default function DataNormalization() {
    const { userProfile } = useAuth();
    const [status, setStatus] = useState("");
    const [loading, setLoading] = useState(false);

    const normalizeData = async () => {
        if (userProfile?.role !== 'admin') {
            alert("Chỉ Admin mới có quyền thực hiện chức năng này!");
            return;
        }

        if (!window.confirm("Bạn có chắc chắn muốn chuẩn hóa dữ liệu? Thao tác này sẽ cập nhật tất cả các task.")) {
            return;
        }

        setLoading(true);
        setStatus("🚀 Đang tải dữ liệu tasks...");

        try {
            const tasksRef = collection(db, "tasks");
            const snapshot = await getDocs(tasksRef);

            setStatus(`📊 Tìm thấy ${snapshot.size} tasks. Đang xử lý...`);

            let batch = writeBatch(db);
            let count = 0;
            let batchCount = 0;
            let totalProcessed = 0;

            for (const taskDoc of snapshot.docs) {
                const data = taskDoc.data();
                const updates = {};

                if (data.isArchived === undefined) updates.isArchived = false;
                if (data.isDeleted === undefined) updates.isDeleted = false;
                if (data.isRecurringTemplate === undefined) updates.isRecurringTemplate = false;

                if (!data.assigneeUids && data.assignees) {
                    updates.assigneeUids = Object.keys(data.assignees);
                }

                if (Object.keys(updates).length > 0) {
                    batch.update(doc(db, "tasks", taskDoc.id), updates);
                    count++;
                    batchCount++;

                    if (batchCount >= 500) {
                        await batch.commit();
                        totalProcessed += batchCount;
                        setStatus(`✅ Đã lưu ${totalProcessed} tasks...`);
                        batch = writeBatch(db);
                        batchCount = 0;
                    }
                }
            }

            if (batchCount > 0) {
                await batch.commit();
                totalProcessed += batchCount;
            }

            setStatus(`✨ Hoàn thành! Đã cập nhật ${count} tasks. Hãy tải lại trang để thấy kết quả.`);
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        } catch (error) {
            console.error(error);
            setStatus(`❌ Lỗi: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
            <h2>🛠️ Chuẩn hóa dữ liệu Task</h2>
            <p style={{ color: '#666', marginBottom: '30px' }}>
                Công cụ này sẽ thêm các trường cần thiết (<code>isArchived</code>, <code>isDeleted</code>, <code>isRecurringTemplate</code>, <code>assigneeUids</code>)
                vào tất cả các task hiện có trong hệ thống.
            </p>

            {status && (
                <div style={{
                    padding: '20px',
                    background: '#e3f2fd',
                    border: '1px solid #2196f3',
                    borderRadius: '4px',
                    marginBottom: '20px',
                    whiteSpace: 'pre-wrap'
                }}>
                    {status}
                </div>
            )}

            <button
                onClick={normalizeData}
                disabled={loading}
                style={{
                    padding: '15px 30px',
                    background: loading ? '#ccc' : '#d32f2f',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold'
                }}
            >
                {loading ? '⏳ Đang xử lý...' : '▶️ Bắt đầu chuẩn hóa'}
            </button>

            <div style={{ marginTop: '30px', padding: '15px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px' }}>
                <strong>⚠️ Lưu ý:</strong>
                <ul>
                    <li>Chỉ chạy công cụ này <strong>MỘT LẦN</strong></li>
                    <li>Đảm bảo bạn đã đăng nhập với quyền <strong>Admin</strong></li>
                    <li>Không đóng trang cho đến khi quá trình hoàn tất</li>
                </ul>
            </div>
        </div>
    );
}
