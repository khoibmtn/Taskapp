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

    // Time Configuration
    const [timeType, setTimeType] = useState("fixed"); // fixed, range, recurrence
    const [dueDate, setDueDate] = useState("");
    const [dueTime, setDueTime] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");

    // Recurrence state
    const [recurrenceFreq, setRecurrenceFreq] = useState("weekly");
    const [selectedDays, setSelectedDays] = useState([]); // [1, 2, 3...] for weekly
    const [dayOfMonth, setDayOfMonth] = useState(1);
    const [specificDate, setSpecificDate] = useState(""); // MM-DD

    const [priority, setPriority] = useState("normal");
    const [assigneeUids, setAssigneeUids] = useState([]);
    const [supervisorId, setSupervisorId] = useState("");
    const [alertFlag, setAlertFlag] = useState(false);

    const [users, setUsers] = useState([]);
    const [allUsers, setAllUsers] = useState([]); // Full list for Supervisor selection
    const [managers, setManagers] = useState([]);
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

                const [qNew, qOld] = await Promise.all([
                    getDocs(query(usersRef, where("departmentIds", "array-contains", deptId), where("status", "==", "active"))),
                    getDocs(query(usersRef, where("departmentId", "==", deptId), where("status", "==", "active")))
                ]);

                const userMap = {};
                const userList = [];
                const managerList = [];

                const processSnapshot = (snapshot) => {
                    snapshot.forEach(doc => {
                        if (!userMap[doc.id]) {
                            userMap[doc.id] = true;
                            const data = { ...doc.data(), uid: doc.id };
                            userList.push(data);
                            if (data.role === 'manager' || data.role === 'admin') {
                                managerList.push(data);
                            }
                        }
                    });
                };

                processSnapshot(qNew);
                processSnapshot(qOld);

                setAllUsers(userList); // Save full list before filtering

                // --- PERMISSION FILTERING ---
                const myRole = userProfile?.role || 'staff';
                const myUid = currentUser.uid;
                let filteredUsers = userList;

                if (myRole === 'admin' || myRole === 'manager') {
                    // Admin & Manager: Can assign to all (already filtered by dept & active)
                } else if (myRole === 'asigner') {
                    // Assigner: Can assign to all EXCEPT Managers
                    filteredUsers = userList.filter(u => u.role !== 'manager');
                } else {
                    // Staff: Can ONLY assign to themselves
                    filteredUsers = userList.filter(u => u.uid === myUid);
                    setAssigneeUids([myUid]); // Auto select self
                }

                setUsers(filteredUsers);
                setManagers(managerList);
            } catch (error) {
                console.error("Error fetching users:", error);
            } finally {
                setFetchingUsers(false);
            }
        }
        fetchDocs();
    }, [userProfile?.selectedDepartmentId, userProfile?.role, currentUser.uid]);

    // Helper: Calculate initial nextDeadline for recurring tasks
    const calculateNextDeadline = (frequency, daysOfWeek, dayOfMonth, specificDate, timeStr) => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let nextDate = new Date(today);

        if (frequency === 'weekly' && Array.isArray(daysOfWeek) && daysOfWeek.length > 0) {
            const currentDay = now.getDay();
            const sortedDays = [...daysOfWeek].map(Number).sort((a, b) => a - b);

            // Find earliest day in the week that is >= today
            // Note: If today is the day, but time passed? 
            // For simplicity in Create, we assume if creating for today, it counts as today (user can set time).
            let nextDay = sortedDays.find(d => d >= currentDay);

            let daysToAdd = 0;
            if (nextDay !== undefined) {
                daysToAdd = nextDay - currentDay;
            } else {
                // No day left this week, wrap to first day next week
                nextDay = sortedDays[0];
                daysToAdd = (7 - currentDay) + nextDay;
            }
            nextDate.setDate(today.getDate() + daysToAdd);

        } else if (frequency === 'monthly' && dayOfMonth) {
            nextDate.setDate(dayOfMonth);
            // If day passed in current month, move to next month
            // (Strictly: If today > dayOfMonth. If today == dayOfMonth, acceptable)
            if (today.getDate() > dayOfMonth) {
                nextDate.setMonth(nextDate.getMonth() + 1);
            }
        } else if (frequency === 'yearly' && specificDate) {
            try {
                let d, m;
                // Normalize formatting: "31/12" (DD/MM) or "12-31" (MM-DD)
                if (specificDate.includes('/')) {
                    [d, m] = specificDate.split('/').map(Number);
                } else {
                    [m, d] = specificDate.split('-').map(Number);
                }

                nextDate = new Date(today.getFullYear(), m - 1, d);
                // If date passed in current year
                if (nextDate < today) {
                    nextDate.setFullYear(today.getFullYear() + 1);
                }
            } catch (e) {
                console.error("Invalid date format", e);
            }
        }

        // Set Time
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

        if (!userProfile?.selectedDepartmentId) {
            alert("Bạn chưa chọn khoa/phòng để giao việc.");
            return;
        }

        // Validate Assignees
        // For Staff, it should be auto-filled, but good to check
        let finalAssignees = [...assigneeUids];
        if (userProfile?.role === 'staff') {
            finalAssignees = [currentUser.uid];
        }

        if (finalAssignees.length === 0) {
            alert("Vui lòng chọn ít nhất 1 người thực hiện công việc (Giao cho nhân viên).");
            return;
        }

        setLoading(true);

        try {
            const timeStr = dueTime || "23:59";

            const taskData = {
                title,
                content,
                priority,
                alertFlag,
                timeType,
                createdBy: currentUser.uid,
                createdAt: serverTimestamp(),
                status: 'open',
                departmentId: userProfile.selectedDepartmentId,
                supervisorId: supervisorId || null,
                isDeleted: false
            };

            // Process Time Data
            if (timeType === 'fixed') {
                taskData.dueAt = dueDate ? new Date(`${dueDate}T${timeStr}`) : null;
            } else if (timeType === 'range') {
                taskData.fromDate = fromDate ? new Date(`${fromDate}T00:00`) : null;
                taskData.toDate = toDate ? new Date(`${toDate}T${timeStr}`) : null;
            } else if (timeType === 'recurrence') {
                taskData.recurrence = {
                    frequency: recurrenceFreq,
                    daysOfWeek: recurrenceFreq === 'weekly' ? selectedDays : null,
                    dayOfMonth: recurrenceFreq === 'monthly' ? dayOfMonth : null,
                    specificDate: recurrenceFreq === 'yearly' ? specificDate : null
                };

                // Calculate persistent next deadline
                const initialDeadline = calculateNextDeadline(
                    recurrenceFreq,
                    recurrenceFreq === 'weekly' ? selectedDays : null,
                    recurrenceFreq === 'monthly' ? dayOfMonth : null,
                    recurrenceFreq === 'yearly' ? specificDate : null,
                    timeStr
                );
                taskData.nextDeadline = initialDeadline;
            }

            const assigneesMap = {};
            // Enforce logic again just in case state wasn't updated or manipulated
            let uidsToSave = assigneeUids;
            if (userProfile?.role === 'staff') {
                uidsToSave = [currentUser.uid];
            }

            uidsToSave.forEach(uid => {
                assigneesMap[uid] = true;
            });
            taskData.assignees = assigneesMap;

            await addDoc(collection(db, "tasks"), taskData);

            alert("Giao việc thành công!");
            // Redirect to Personal Dashboard as it is accessible by everyone
            navigate("/app");
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

                {/* Time Type Selection */}
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

                {/* Conditional Time Inputs */}
                {timeType === 'fixed' && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Ngày hoàn thành</label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={e => setDueDate(e.target.value)}
                                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Giờ</label>
                            <input
                                type="time"
                                value={dueTime}
                                onChange={e => setDueTime(e.target.value)}
                                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                        </div>
                    </div>
                )}

                {timeType === 'range' && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Từ ngày</label>
                            <input
                                type="date"
                                value={fromDate}
                                onChange={e => setFromDate(e.target.value)}
                                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Đến ngày</label>
                            <input
                                type="date"
                                value={toDate}
                                onChange={e => setToDate(e.target.value)}
                                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                        </div>
                        <div style={{ width: '100px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Giờ xong</label>
                            <input
                                type="time"
                                value={dueTime}
                                onChange={e => setDueTime(e.target.value)}
                                style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                        </div>
                    </div>
                )}

                {timeType === 'recurrence' && (
                    <div style={{ padding: '15px', background: '#f5f7fa', borderRadius: '8px', border: '1px solid #e0e4e8' }}>
                        <div style={{ marginBottom: '10px' }}>
                            <label style={{ marginRight: '15px', fontWeight: 'bold' }}>Tần suất:</label>
                            {['weekly', 'monthly', 'yearly'].map(f => (
                                <label key={f} style={{ marginRight: '15px', cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        name="freq"
                                        value={f}
                                        checked={recurrenceFreq === f}
                                        onChange={e => setRecurrenceFreq(e.target.value)}
                                    /> {f === 'weekly' ? 'Hàng tuần' : f === 'monthly' ? 'Hàng tháng' : 'Hàng năm'}
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
                                            onClick={() => {
                                                setSelectedDays(prev =>
                                                    prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx]
                                                );
                                            }}
                                            style={{
                                                padding: '5px 12px',
                                                borderRadius: '4px',
                                                border: '1px solid #ccc',
                                                background: selectedDays.includes(idx) ? '#1976d2' : '#fff',
                                                color: selectedDays.includes(idx) ? '#fff' : '#000',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {day}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {recurrenceFreq === 'monthly' && (
                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Hoàn thành vào ngày:</label>
                                <input
                                    type="number"
                                    min="1" max="31"
                                    value={dayOfMonth}
                                    onChange={e => setDayOfMonth(parseInt(e.target.value))}
                                    style={{ width: '60px', padding: '5px', border: '1px solid #ccc', borderRadius: '4px' }}
                                />
                                <span style={{ marginLeft: '5px' }}>hàng tháng</span>
                            </div>
                        )}

                        {recurrenceFreq === 'yearly' && (
                            <div style={{ marginBottom: '10px' }}>
                                <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Chọn ngày cố định (Ngày/Tháng):</label>
                                <input
                                    type="text"
                                    placeholder="DD/MM (VD: 31/12)"
                                    value={specificDate}
                                    onChange={e => setSpecificDate(e.target.value)}
                                    style={{ width: '150px', padding: '5px', border: '1px solid #ccc', borderRadius: '4px' }}
                                />
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Giờ hoàn thành trong ngày</label>
                            <input
                                type="time"
                                value={dueTime}
                                onChange={e => setDueTime(e.target.value)}
                                style={{ width: '120px', padding: '8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
                            />
                        </div>
                    </div>
                )}

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
                            /> Trung bình
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

                {/* Supervisor Selection - ONLY for Admin/Manager/Assigner */}
                {(userProfile?.role !== 'staff') && (
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Người giám sát</label>
                        <select
                            value={supervisorId}
                            onChange={e => setSupervisorId(e.target.value)}
                            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: '4px' }}
                        >
                            <option value="">-- Không có người giám sát --</option>
                            {allUsers
                                .filter(u => {
                                    // 1. EXCLUDE ASSIGNEES
                                    if (assigneeUids.includes(u.uid)) return false;

                                    // 2. Role-based constraints
                                    const myRole = userProfile?.role || 'staff';

                                    if (myRole === 'admin' || myRole === 'manager') {
                                        // Manager/Admin: Can pick ANYONE (except assignees)
                                        return true;
                                    }

                                    if (myRole === 'asigner') {
                                        // Assigner: Can pick anyone EXCEPT Managers
                                        if (u.role === 'manager') return false;
                                        return true;
                                    }

                                    return true;
                                })
                                .map(u => (
                                    <option key={u.uid} value={u.uid}>
                                        {u.fullName || u.displayName || u.name} {u.role === 'manager' ? '(Trưởng khoa)' : ''}
                                        {u.uid === currentUser.uid ? ' (Tôi)' : ''}
                                    </option>
                                ))}
                        </select>
                        <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                            * Người giám sát không thể là người được giao việc.
                        </small>
                    </div>
                )}

                {/* Assignees */}
                <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Giao cho nhân viên <span style={{ color: 'red' }}>*</span></label>

                    {userProfile?.role === 'staff' ? (
                        <div style={{ padding: '10px', background: '#e3f2fd', borderRadius: '4px', border: '1px solid #90caf9', color: '#0d47a1' }}>
                            ✓ Công việc sẽ được giao cho chính bạn ({userProfile.fullName || 'Tôi'}).
                        </div>
                    ) : (
                        loading || fetchingUsers ? <p>Đang tải danh sách nhân viên...</p> : (
                            <div style={{ border: '1px solid #ccc', padding: '10px', maxHeight: '150px', overflowY: 'auto', borderRadius: '4px' }}>
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
                        )
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
