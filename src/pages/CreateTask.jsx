import { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function CreateTask() {
    const { currentUser, userProfile } = useAuth();
    const navigate = useNavigate();

    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [dueTime, setDueTime] = useState("");
    const [priority, setPriority] = useState("normal");
    const [assigneeUids, setAssigneeUids] = useState([]);
    const [alertFlag, setAlertFlag] = useState(false);

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetchingUsers, setFetchingUsers] = useState(true);

    // Fetch users for dropdown
    useEffect(() => {
        if (!userProfile?.selectedDepartmentId) return;

        async function fetchDocs() {
            setFetchingUsers(true);
            try {
                // Fetch only users who belong to the selected department and are 'active'
                const usersRef = collection(db, "users");
                const deptId = userProfile.selectedDepartmentId;

                // Query legacy and new schemas to ensure all active members are found
                const [qNew, qOld] = await Promise.all([
                    getDocs(query(usersRef, where("departmentIds", "array-contains", deptId), where("status", "==", "active"))),
                    getDocs(query(usersRef, where("departmentId", "==", deptId), where("status", "==", "active")))
                ]);

                const userMap = {};
                const userList = [];

                const processSnapshot = (snapshot) => {
                    snapshot.forEach(doc => {
                        if (!userMap[doc.id]) {
                            userMap[doc.id] = true;
                            userList.push({ ...doc.data(), uid: doc.id });
                        }
                    });
                };

                processSnapshot(qNew);
                processSnapshot(qOld);

                setUsers(userList);
            } catch (error) {
                console.error("Error fetching users:", error);
            } finally {
                setFetchingUsers(false);
            }
        }
        fetchDocs();
    }, [userProfile?.selectedDepartmentId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) {
            alert("Vui lòng nhập tên công việc");
            return;
        }

        if (!userProfile?.selectedDepartmentId) {
            alert("Bạn chưa chọn khoa/phòng để giao việc.");
            return;
        }

        setLoading(true);

        try {
            const timeStr = dueTime || "23:59";
            const combinedDate = dueDate ? new Date(`${dueDate}T${timeStr}`) : null;

            const assigneesMap = {};
            assigneeUids.forEach(uid => {
                assigneesMap[uid] = true;
            });

            await addDoc(collection(db, "tasks"), {
                title,
                content,
                dueAt: combinedDate,
                priority,
                alertFlag,
                assignees: assigneesMap,
                createdBy: currentUser.uid,
                createdAt: serverTimestamp(),
                status: 'open',
                departmentId: userProfile.selectedDepartmentId
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
                                        {u.fullName || u.displayName || u.name || u.email || u.uid}
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
