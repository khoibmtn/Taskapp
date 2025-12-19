import { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function CreateTask() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [dueTime, setDueTime] = useState("");
    const [priority, setPriority] = useState("normal"); // Default: update to Vietnamese UI value later if needed, stick to internal value for now
    const [assigneeUids, setAssigneeUids] = useState([]); // Array of UIDs
    const [alertFlag, setAlertFlag] = useState(false);

    const [users, setUsers] = useState([]); // List of users for dropdown
    const [loading, setLoading] = useState(false);
    const [fetchingUsers, setFetchingUsers] = useState(true);

    // Fetch users for dropdown
    useEffect(() => {
        async function fetchUsers() {
            try {
                const querySnapshot = await getDocs(collection(db, "users"));
                const userList = [];
                querySnapshot.forEach((doc) => {
                    userList.push({ ...doc.data(), uid: doc.id });
                });
                setUsers(userList);
            } catch (error) {
                console.error("Error fetching users:", error);
            } finally {
                setFetchingUsers(false);
            }
        }
        fetchUsers();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) {
            alert("Vui lòng nhập tên công việc");
            return;
        }

        setLoading(true);

        try {
            // Combine Date and Time
            let combinedDate = null;
            if (dueDate) {
                // If time is provided, use it, else default to end of day? 
                // Let's assume user picks both or we just use date with 00:00 or current time.
                // Simple approach: string concatenation
                const timeStr = dueTime || "23:59";
                combinedDate = new Date(`${dueDate}T${timeStr}`);
            }

            // Prepare assignees Map
            const assigneesMap = {};
            assigneeUids.forEach(uid => {
                assigneesMap[uid] = true;
            });

            await addDoc(collection(db, "tasks"), {
                title,
                content,
                dueAt: combinedDate,
                priority, // 'normal', 'high', 'low'
                alertFlag,
                assignees: assigneesMap,
                createdBy: currentUser.uid,
                createdAt: serverTimestamp(),
                status: 'open'
            });

            alert("Giao việc thành công!");
            navigate("/app/management");
        } catch (error) {
            console.error("Error creating task:", error);
            alert("Đã xảy ra lỗi: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleAssignee = (uid) => {
        setAssigneeUids(prev => {
            if (prev.includes(uid)) {
                return prev.filter(id => id !== uid);
            } else {
                return [...prev, uid];
            }
        });
    };

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '20px' }}>Giao Việc Mới</h2>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

                {/* Title */}
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Tên công việc <span style={{ color: 'red' }}>*</span></label>
                    <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                        placeholder="Nhập tên công việc..."
                    />
                </div>

                {/* Content */}
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nội dung chi tiết</label>
                    <textarea
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        rows="4"
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                    ></textarea>
                </div>

                {/* Due Date & Time */}
                <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Ngày hoàn thành</label>
                        <input
                            type="date"
                            value={dueDate}
                            onChange={e => setDueDate(e.target.value)}
                            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Giờ</label>
                        <input
                            type="time"
                            value={dueTime}
                            onChange={e => setDueTime(e.target.value)}
                            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                        />
                    </div>
                </div>

                {/* Priority */}
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Mức độ ưu tiên</label>
                    <div style={{ display: 'flex', gap: '20px' }}>
                        <label>
                            <input
                                type="radio"
                                name="priority"
                                value="high"
                                checked={priority === 'high'}
                                onChange={e => setPriority(e.target.value)}
                            /> Cao
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="priority"
                                value="normal"
                                checked={priority === 'normal'}
                                onChange={e => setPriority(e.target.value)}
                            /> Bình thường
                        </label>
                        <label>
                            <input
                                type="radio"
                                name="priority"
                                value="low"
                                checked={priority === 'low'}
                                onChange={e => setPriority(e.target.value)}
                            /> Thấp
                        </label>
                    </div>
                </div>

                {/* Assignees */}
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Giao cho nhân viên</label>
                    {fetchingUsers ? <p>Đang tải danh sách nhân viên...</p> : (
                        <div style={{ border: '1px solid #ccc', padding: '10px', maxHeight: '150px', overflowY: 'auto' }}>
                            {users.map(u => (
                                <div key={u.uid} style={{ marginBottom: '5px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={assigneeUids.includes(u.uid)}
                                            onChange={() => toggleAssignee(u.uid)}
                                            style={{ marginRight: '10px' }}
                                        />
                                        {u.displayName || u.name || u.email || u.uid}
                                    </label>
                                </div>
                            ))}
                            {users.length === 0 && <p style={{ fontStyle: 'italic' }}>Không tìm thấy nhân viên nào.</p>}
                        </div>
                    )}
                </div>

                {/* Alert Flag */}
                <div>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 'bold' }}>
                        <input
                            type="checkbox"
                            checked={alertFlag}
                            onChange={e => setAlertFlag(e.target.checked)}
                            style={{ marginRight: '10px' }}
                        />
                        <span style={{ color: 'red' }}>Gắn cờ cảnh báo (Gấp)</span>
                    </label>
                </div>

                {/* Submit */}
                <div style={{ marginTop: '20px' }}>
                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            padding: '10px 20px',
                            background: '#1976d2',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '1em'
                        }}
                    >
                        {loading ? "Đang xử lý..." : "Giao việc ngay"}
                    </button>
                </div>

            </form>
        </div>
    );
}
