import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, serverTimestamp, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

export default function EditTask() {
    const { taskId } = useParams();
    const navigate = useNavigate();
    const { currentUser, userProfile } = useAuth();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    // Form State
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [timeType, setTimeType] = useState("fixed");
    const [dueDate, setDueDate] = useState("");
    const [dueTime, setDueTime] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [recurrenceFreq, setRecurrenceFreq] = useState("weekly");
    const [selectedDays, setSelectedDays] = useState([]);
    const [dayOfMonth, setDayOfMonth] = useState(1);
    const [specificDate, setSpecificDate] = useState("");
    const [priority, setPriority] = useState("normal");
    const [assigneeUids, setAssigneeUids] = useState([]);
    const [supervisorId, setSupervisorId] = useState("");
    const [alertFlag, setAlertFlag] = useState(false);

    // Users for selection
    const [users, setUsers] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [fetchingUsers, setFetchingUsers] = useState(true);

    // Format date for input
    const formatDateForInput = (dateValue) => {
        if (!dateValue) return "";
        const d = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
        return d.toISOString().split('T')[0];
    };

    const formatTimeForInput = (dateValue) => {
        if (!dateValue) return "";
        const d = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
        return d.toTimeString().slice(0, 5);
    };

    // Fetch task data
    useEffect(() => {
        async function fetchTask() {
            try {
                const taskRef = doc(db, "tasks", taskId);
                const taskSnap = await getDoc(taskRef);

                if (!taskSnap.exists()) {
                    setError("Công việc không tồn tại.");
                    setLoading(false);
                    return;
                }

                const task = taskSnap.data();

                // Populate form fields
                setTitle(task.title || "");
                setContent(task.content || "");
                setTimeType(task.timeType || "fixed");
                setPriority(task.priority || "normal");
                setSupervisorId(task.supervisorId || "");
                setAlertFlag(task.alertFlag || false);

                // Time fields
                if (task.timeType === 'fixed' && task.dueAt) {
                    setDueDate(formatDateForInput(task.dueAt));
                    setDueTime(formatTimeForInput(task.dueAt));
                } else if (task.timeType === 'range') {
                    setFromDate(formatDateForInput(task.fromDate));
                    setToDate(formatDateForInput(task.toDate));
                    if (task.toDate) setDueTime(formatTimeForInput(task.toDate));
                } else if (task.timeType === 'recurrence' && task.recurrence) {
                    setRecurrenceFreq(task.recurrence.frequency || 'weekly');
                    setSelectedDays(task.recurrence.daysOfWeek || []);
                    setDayOfMonth(task.recurrence.dayOfMonth || 1);
                    setSpecificDate(task.recurrence.specificDate || "");
                }

                // Assignees
                if (task.assignees) {
                    setAssigneeUids(Object.keys(task.assignees));
                }

                setLoading(false);
            } catch (err) {
                console.error("Error fetching task:", err);
                setError("Lỗi tải dữ liệu: " + err.message);
                setLoading(false);
            }
        }
        fetchTask();
    }, [taskId]);

    // Fetch users for dropdowns
    useEffect(() => {
        if (!userProfile?.selectedDepartmentId) return;

        async function fetchUsers() {
            setFetchingUsers(true);
            try {
                const usersRef = collection(db, "users");
                const deptId = userProfile.selectedDepartmentId;

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

                setAllUsers(userList);

                // Permission filtering
                const myRole = userProfile?.role || 'staff';
                let filteredUsers = userList;

                if (myRole === 'asigner') {
                    filteredUsers = userList.filter(u => u.role !== 'manager');
                } else if (myRole === 'staff') {
                    filteredUsers = userList.filter(u => u.uid === currentUser.uid);
                }

                setUsers(filteredUsers);
            } catch (err) {
                console.error("Error fetching users:", err);
            } finally {
                setFetchingUsers(false);
            }
        }
        fetchUsers();
    }, [userProfile?.selectedDepartmentId, userProfile?.role, currentUser.uid]);

    const toggleAssignee = (uid) => {
        setAssigneeUids(prev =>
            prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
        );
    };

    const calculateNextDeadline = (frequency, daysOfWeek, dayOfMonth, specificDate, timeStr) => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let nextDate = new Date(today);

        if (frequency === 'weekly' && Array.isArray(daysOfWeek) && daysOfWeek.length > 0) {
            const currentDay = now.getDay();
            const sortedDays = [...daysOfWeek].map(Number).sort((a, b) => a - b);
            let nextDay = sortedDays.find(d => d >= currentDay);
            let daysToAdd = 0;
            if (nextDay !== undefined) {
                daysToAdd = nextDay - currentDay;
            } else {
                nextDay = sortedDays[0];
                daysToAdd = (7 - currentDay) + nextDay;
            }
            nextDate.setDate(today.getDate() + daysToAdd);
        } else if (frequency === 'monthly' && dayOfMonth) {
            nextDate.setDate(dayOfMonth);
            if (today.getDate() > dayOfMonth) {
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
                if (nextDate < today) {
                    nextDate.setFullYear(today.getFullYear() + 1);
                }
            } catch (e) {
                console.error("Invalid date format", e);
            }
        }

        if (timeStr) {
            const [h, m] = timeStr.split(':').map(Number);
            nextDate.setHours(h, m, 0, 0);
        } else {
            nextDate.setHours(23, 59, 59, 999);
        }

        return nextDate;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!title.trim()) {
            alert("Vui lòng nhập tên công việc");
            return;
        }

        if (assigneeUids.length === 0) {
            alert("Vui lòng chọn ít nhất 1 người thực hiện.");
            return;
        }

        setSaving(true);

        try {
            const timeStr = dueTime || "23:59";

            const updates = {
                title,
                content,
                priority,
                alertFlag,
                timeType,
                supervisorId: supervisorId || null,
                updatedAt: serverTimestamp()
            };

            // Time data
            if (timeType === 'fixed') {
                updates.dueAt = dueDate ? new Date(`${dueDate}T${timeStr}`) : null;
                updates.fromDate = null;
                updates.toDate = null;
                updates.recurrence = null;
                updates.nextDeadline = null;
            } else if (timeType === 'range') {
                updates.fromDate = fromDate ? new Date(`${fromDate}T00:00`) : null;
                updates.toDate = toDate ? new Date(`${toDate}T${timeStr}`) : null;
                updates.dueAt = null;
                updates.recurrence = null;
                updates.nextDeadline = null;
            } else if (timeType === 'recurrence') {
                updates.recurrence = {
                    frequency: recurrenceFreq,
                    daysOfWeek: recurrenceFreq === 'weekly' ? selectedDays : null,
                    dayOfMonth: recurrenceFreq === 'monthly' ? dayOfMonth : null,
                    specificDate: recurrenceFreq === 'yearly' ? specificDate : null
                };
                updates.dueAt = null;
                updates.fromDate = null;
                updates.toDate = null;

                const deadline = calculateNextDeadline(
                    recurrenceFreq,
                    recurrenceFreq === 'weekly' ? selectedDays : null,
                    recurrenceFreq === 'monthly' ? dayOfMonth : null,
                    recurrenceFreq === 'yearly' ? specificDate : null,
                    timeStr
                );
                updates.nextDeadline = deadline;
            }

            // Assignees
            const assigneesMap = {};
            assigneeUids.forEach(uid => { assigneesMap[uid] = true; });
            updates.assignees = assigneesMap;

            await updateDoc(doc(db, "tasks", taskId), updates);
            alert("Đã cập nhật công việc!");
            navigate(`/app/tasks/${taskId}`);
        } catch (err) {
            console.error("Error updating task:", err);
            alert("Lỗi: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div>Đang tải dữ liệu công việc...</div>;
    if (error) return <div style={{ color: 'red' }}>{error}</div>;

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ color: '#1976d2', margin: 0 }}>Chỉnh sửa Công việc</h2>
                <button
                    onClick={() => navigate(`/app/tasks/${taskId}`)}
                    style={{ padding: '8px 16px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >Hủy</button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {/* Title */}
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Tên công việc <span style={{ color: 'red' }}>*</span></label>
                    <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                </div>

                {/* Content */}
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nội dung chi tiết</label>
                    <textarea
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        rows="4"
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
                    ></textarea>
                </div>

                {/* Time Type */}
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Loại thời gian hoàn thành</label>
                    <select
                        value={timeType}
                        onChange={e => setTimeType(e.target.value)}
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
                    >
                        <option value="fixed">Ngày cố định</option>
                        <option value="range">Khoảng thời gian</option>
                        <option value="recurrence">Lặp lại (Định kỳ)</option>
                    </select>
                </div>

                {/* Fixed Time */}
                {timeType === 'fixed' && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Ngày hoàn thành</label>
                            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Giờ</label>
                            <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }} />
                        </div>
                    </div>
                )}

                {/* Range Time */}
                {timeType === 'range' && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Từ ngày</label>
                            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Đến ngày</label>
                            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }} />
                        </div>
                        <div style={{ width: '100px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Giờ</label>
                            <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }} />
                        </div>
                    </div>
                )}

                {/* Recurrence */}
                {timeType === 'recurrence' && (
                    <div style={{ padding: '15px', background: '#f5f7fa', borderRadius: '8px', border: '1px solid #e0e4e8' }}>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ marginRight: '15px', fontWeight: 'bold' }}>Tần suất:</label>
                            {['weekly', 'monthly', 'yearly'].map(f => (
                                <label key={f} style={{ marginRight: '15px', cursor: 'pointer' }}>
                                    <input type="radio" name="freq" value={f} checked={recurrenceFreq === f} onChange={e => setRecurrenceFreq(e.target.value)} />
                                    {f === 'weekly' ? ' Hàng tuần' : f === 'monthly' ? ' Hàng tháng' : ' Hàng năm'}
                                </label>
                            ))}
                        </div>

                        {recurrenceFreq === 'weekly' && (
                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Chọn thứ trong tuần:</label>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setSelectedDays(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx])}
                                            style={{
                                                padding: '5px 12px', borderRadius: '4px', border: '1px solid #ccc',
                                                background: selectedDays.includes(idx) ? '#1976d2' : '#fff',
                                                color: selectedDays.includes(idx) ? '#fff' : '#000', cursor: 'pointer'
                                            }}
                                        >{day}</button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {recurrenceFreq === 'monthly' && (
                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Vào ngày:</label>
                                <input type="number" min="1" max="31" value={dayOfMonth} onChange={e => setDayOfMonth(parseInt(e.target.value))} style={{ width: '60px', padding: '5px', border: '1px solid #ccc', borderRadius: '4px' }} />
                                <span style={{ marginLeft: '5px' }}>hàng tháng</span>
                            </div>
                        )}

                        {recurrenceFreq === 'yearly' && (
                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Ngày cố định (DD/MM):</label>
                                <input type="text" placeholder="VD: 31/12" value={specificDate} onChange={e => setSpecificDate(e.target.value)} style={{ width: '100px', padding: '5px', border: '1px solid #ccc', borderRadius: '4px' }} />
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Giờ hoàn thành</label>
                            <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} style={{ width: '120px', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }} />
                        </div>
                    </div>
                )}

                {/* Priority */}
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Mức độ ưu tiên</label>
                    <div style={{ display: 'flex', gap: '20px' }}>
                        {[['high', 'Cao'], ['normal', 'Trung bình'], ['low', 'Thấp']].map(([val, label]) => (
                            <label key={val}>
                                <input type="radio" name="priority" value={val} checked={priority === val} onChange={e => setPriority(e.target.value)} /> {label}
                            </label>
                        ))}
                    </div>
                </div>

                {/* Supervisor */}
                {userProfile?.role !== 'staff' && (
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Người giám sát</label>
                        <select
                            value={supervisorId}
                            onChange={e => setSupervisorId(e.target.value)}
                            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
                        >
                            <option value="">-- Không có --</option>
                            {allUsers.filter(u => !assigneeUids.includes(u.uid)).map(u => (
                                <option key={u.uid} value={u.uid}>
                                    {u.fullName || u.displayName || u.name} {u.role === 'manager' ? '(Trưởng khoa)' : ''} {u.uid === currentUser.uid ? '(Tôi)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Assignees */}
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Giao cho nhân viên <span style={{ color: 'red' }}>*</span></label>
                    {userProfile?.role === 'staff' ? (
                        <div style={{ padding: '10px', background: '#e3f2fd', borderRadius: '4px', border: '1px solid #90caf9', color: '#0d47a1' }}>
                            ✓ Công việc được giao cho bạn ({userProfile.fullName || 'Tôi'}).
                        </div>
                    ) : (
                        fetchingUsers ? <p>Đang tải...</p> : (
                            <div style={{ border: '1px solid #ccc', padding: '10px', maxHeight: '150px', overflowY: 'auto', borderRadius: '4px' }}>
                                {users.map(u => (
                                    <div key={u.uid} style={{ marginBottom: '5px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                            <input type="checkbox" checked={assigneeUids.includes(u.uid)} onChange={() => toggleAssignee(u.uid)} style={{ marginRight: '10px' }} />
                                            {u.fullName || u.displayName || u.name || u.email || u.uid}
                                        </label>
                                    </div>
                                ))}
                                {users.length === 0 && <p style={{ fontStyle: 'italic' }}>Không tìm thấy nhân viên.</p>}
                            </div>
                        )
                    )}
                </div>

                {/* Alert Flag */}
                <div>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 'bold' }}>
                        <input type="checkbox" checked={alertFlag} onChange={e => setAlertFlag(e.target.checked)} style={{ marginRight: '10px' }} />
                        <span style={{ color: 'red' }}>Gắn cờ cảnh báo (Gấp)</span>
                    </label>
                </div>

                {/* Submit */}
                <div style={{ marginTop: '20px' }}>
                    <button
                        type="submit"
                        disabled={saving}
                        style={{ padding: '10px 20px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1em' }}
                    >
                        {saving ? "Đang lưu..." : "Lưu thay đổi"}
                    </button>
                </div>
            </form>
        </div>
    );
}
