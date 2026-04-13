import { useState, useEffect } from "react";
import { collection, addDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Loader2, AlertTriangle, Send } from "lucide-react";

export default function CreateTask() {
    const { currentUser, userProfile } = useAuth();
    const navigate = useNavigate();

    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");

    // Time Configuration
    const [timeType, setTimeType] = useState("fixed");
    const [dueDate, setDueDate] = useState("");
    const [dueTime, setDueTime] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");

    // Recurrence state
    const [recurrenceFreq, setRecurrenceFreq] = useState("weekly");
    const [selectedDays, setSelectedDays] = useState([]);
    const [dayOfMonth, setDayOfMonth] = useState(1);
    const [specificDate, setSpecificDate] = useState("");

    const [priority, setPriority] = useState("normal");
    const [assigneeUids, setAssigneeUids] = useState([]);
    const [supervisorId, setSupervisorId] = useState("");
    const [alertFlag, setAlertFlag] = useState(false);

    const [users, setUsers] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [managers, setManagers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetchingUsers, setFetchingUsers] = useState(true);

    useEffect(() => {
        if (!userProfile?.selectedDepartmentId) return;

        async function fetchDocs() {
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

                setAllUsers(userList);

                const myRole = userProfile?.role || 'staff';
                const myUid = currentUser.uid;
                let filteredUsers = userList;

                if (myRole === 'admin' || myRole === 'manager') {
                    // Can assign to all
                } else if (myRole === 'asigner') {
                    filteredUsers = userList.filter(u => u.role !== 'manager');
                } else {
                    filteredUsers = userList.filter(u => u.uid === myUid);
                    setAssigneeUids([myUid]);
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
        if (!title.trim()) { alert("Vui lòng nhập tên công việc"); return; }
        if (!userProfile?.selectedDepartmentId) { alert("Bạn chưa chọn khoa/phòng để giao việc."); return; }

        let finalAssignees = [...assigneeUids];
        if (userProfile?.role === 'staff') { finalAssignees = [currentUser.uid]; }
        if (finalAssignees.length === 0) { alert("Vui lòng chọn ít nhất 1 người thực hiện công việc."); return; }

        setLoading(true);
        try {
            const timeStr = dueTime || "23:59";
            const taskData = {
                title, content, priority, alertFlag, timeType,
                createdBy: currentUser.uid,
                createdAt: serverTimestamp(),
                status: 'open',
                departmentId: userProfile.selectedDepartmentId,
                supervisorId: supervisorId || null,
                isDeleted: false, isArchived: false, isRecurringTemplate: false
            };

            if (timeType === 'fixed') {
                taskData.dueAt = dueDate ? new Date(`${dueDate}T${timeStr}`) : null;
            } else if (timeType === 'range') {
                taskData.fromDate = fromDate ? new Date(`${fromDate}T00:00`) : null;
                taskData.toDate = toDate ? new Date(`${toDate}T${timeStr}`) : null;
            } else if (timeType === 'recurrence') {
                taskData.isRecurringTemplate = true;
                taskData.lastGeneratedDate = serverTimestamp();
                taskData.recurrence = {
                    frequency: recurrenceFreq,
                    daysOfWeek: recurrenceFreq === 'weekly' ? selectedDays : null,
                    dayOfMonth: recurrenceFreq === 'monthly' ? dayOfMonth : null,
                    specificDate: recurrenceFreq === 'yearly' ? specificDate : null
                };
                const initialDeadline = calculateNextDeadline(recurrenceFreq, recurrenceFreq === 'weekly' ? selectedDays : null, recurrenceFreq === 'monthly' ? dayOfMonth : null, recurrenceFreq === 'yearly' ? specificDate : null, timeStr);
                taskData.nextDeadline = initialDeadline;
            }

            const assigneesMap = {};
            let uidsToSave = assigneeUids;
            if (userProfile?.role === 'staff') { uidsToSave = [currentUser.uid]; }
            uidsToSave.forEach(uid => { assigneesMap[uid] = true; });
            taskData.assignees = assigneesMap;
            taskData.assigneeUids = uidsToSave;

            const docRef = await addDoc(collection(db, "tasks"), taskData);

            if (timeType === 'recurrence') {
                const firstInstance = {
                    ...taskData, isRecurringTemplate: false, parentTaskId: docRef.id,
                    dueAt: taskData.nextDeadline, nextDeadline: null, lastGeneratedDate: null, createdAt: serverTimestamp()
                };
                await addDoc(collection(db, "tasks"), firstInstance);
            }

            alert("Giao việc thành công!");
            navigate("/app");
        } catch (error) {
            console.error("Error creating task:", error);
            alert("Đã xảy ra lỗi: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleAssignee = (uid) => {
        setAssigneeUids(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);
    };

    const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    const PRIORITY_OPTIONS = [
        { value: 'high', label: 'Cao', color: 'text-red-600' },
        { value: 'normal', label: 'Trung bình', color: 'text-gray-700' },
        { value: 'low', label: 'Thấp', color: 'text-gray-400' },
    ];

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="font-heading text-2xl font-bold text-gray-900 mb-1">Giao việc mới</h1>
            <p className="text-sm text-gray-500 mb-6">Tạo công việc mới và giao cho nhân viên</p>

            <form onSubmit={handleSubmit} className="space-y-0">

                {/* Card: Basic Info */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5 mb-4">
                    <FormField label="Tên công việc" required>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            placeholder="Nhập tên công việc..."
                            className="form-input"
                        />
                    </FormField>

                    <FormField label="Nội dung chi tiết">
                        <textarea
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            rows="3"
                            placeholder="Mô tả chi tiết công việc..."
                            className="form-input resize-y"
                        />
                    </FormField>
                </div>

                {/* Card: Time */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5 mb-4">
                    <FormField label="Loại thời gian hoàn thành">
                        <select value={timeType} onChange={e => setTimeType(e.target.value)} className="form-input">
                            <option value="fixed">Ngày cố định</option>
                            <option value="range">Khoảng thời gian</option>
                            <option value="recurrence">Lặp lại (Định kỳ)</option>
                        </select>
                    </FormField>

                    {timeType === 'fixed' && (
                        <div className="grid grid-cols-2 gap-4">
                            <FormField label="Ngày hoàn thành">
                                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="form-input" />
                            </FormField>
                            <FormField label="Giờ">
                                <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} className="form-input" />
                            </FormField>
                        </div>
                    )}

                    {timeType === 'range' && (
                        <div className="grid grid-cols-3 gap-3">
                            <FormField label="Từ ngày">
                                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="form-input" />
                            </FormField>
                            <FormField label="Đến ngày">
                                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="form-input" />
                            </FormField>
                            <FormField label="Giờ xong">
                                <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} className="form-input" />
                            </FormField>
                        </div>
                    )}

                    {timeType === 'recurrence' && (
                        <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
                            {/* Frequency */}
                            <div>
                                <span className="text-sm font-semibold text-gray-700 mr-3">Tần suất:</span>
                                <div className="inline-flex gap-4 mt-1">
                                    {[{ v: 'weekly', l: 'Hàng tuần' }, { v: 'monthly', l: 'Hàng tháng' }, { v: 'yearly', l: 'Hàng năm' }].map(f => (
                                        <label key={f.v} className="inline-flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                                            <input type="radio" name="freq" value={f.v} checked={recurrenceFreq === f.v} onChange={e => setRecurrenceFreq(e.target.value)} className="w-4 h-4 text-primary-600 focus:ring-primary-500" />
                                            {f.l}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Weekly days */}
                            {recurrenceFreq === 'weekly' && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Chọn thứ trong tuần:</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {DAY_LABELS.map((day, idx) => (
                                            <button
                                                key={idx} type="button"
                                                onClick={() => setSelectedDays(prev => prev.includes(idx) ? prev.filter(d => d !== idx) : [...prev, idx])}
                                                className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors min-h-[36px] ${
                                                    selectedDays.includes(idx)
                                                        ? 'bg-primary-600 text-white border-primary-600'
                                                        : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400'
                                                }`}
                                            >
                                                {day}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Monthly */}
                            {recurrenceFreq === 'monthly' && (
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-semibold text-gray-700">Hoàn thành vào ngày:</label>
                                    <input type="number" min="1" max="31" value={dayOfMonth} onChange={e => setDayOfMonth(parseInt(e.target.value))} className="w-16 px-2 py-1.5 text-sm border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                                    <span className="text-sm text-gray-500">hàng tháng</span>
                                </div>
                            )}

                            {/* Yearly */}
                            {recurrenceFreq === 'yearly' && (
                                <FormField label="Chọn ngày cố định (Ngày/Tháng):">
                                    <input type="text" placeholder="DD/MM (VD: 31/12)" value={specificDate} onChange={e => setSpecificDate(e.target.value)} className="form-input w-40" />
                                </FormField>
                            )}

                            <FormField label="Giờ hoàn thành trong ngày">
                                <input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} className="form-input w-32" />
                            </FormField>
                        </div>
                    )}
                </div>

                {/* Card: Assignment */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5 mb-4">
                    {/* Priority */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Mức độ ưu tiên</label>
                        <div className="flex gap-5">
                            {PRIORITY_OPTIONS.map(opt => (
                                <label key={opt.value} className="inline-flex items-center gap-2 cursor-pointer text-sm">
                                    <input type="radio" name="priority" value={opt.value} checked={priority === opt.value} onChange={e => setPriority(e.target.value)} className="w-4 h-4 text-primary-600 focus:ring-primary-500" />
                                    <span className={opt.color}>{opt.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Supervisor */}
                    {userProfile?.role !== 'staff' && (
                        <FormField label="Người giám sát">
                            <select value={supervisorId} onChange={e => setSupervisorId(e.target.value)} className="form-input">
                                <option value="">-- Không có người giám sát --</option>
                                {allUsers
                                    .filter(u => {
                                        if (assigneeUids.includes(u.uid)) return false;
                                        const myRole = userProfile?.role || 'staff';
                                        if (myRole === 'admin' || myRole === 'manager') return true;
                                        if (myRole === 'asigner') { if (u.role === 'manager') return false; return true; }
                                        return true;
                                    })
                                    .map(u => (
                                        <option key={u.uid} value={u.uid}>
                                            {u.fullName || u.displayName || u.name} {u.role === 'manager' ? '(Trưởng khoa)' : ''}{u.uid === currentUser.uid ? ' (Tôi)' : ''}
                                        </option>
                                    ))}
                            </select>
                            <p className="text-xs text-gray-400 mt-1">* Người giám sát không thể là người được giao việc.</p>
                        </FormField>
                    )}

                    {/* Assignees */}
                    <FormField label="Giao cho nhân viên" required>
                        {userProfile?.role === 'staff' ? (
                            <div className="flex items-center gap-2 p-3 bg-primary-50 text-primary-700 border border-primary-200 rounded-lg text-sm font-medium">
                                ✓ Công việc sẽ được giao cho chính bạn ({userProfile.fullName || 'Tôi'}).
                            </div>
                        ) : (
                            fetchingUsers ? (
                                <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Đang tải danh sách...
                                </div>
                            ) : (
                                <div className="border border-gray-200 rounded-lg max-h-[160px] overflow-y-auto divide-y divide-gray-100">
                                    {users.length === 0 ? (
                                        <p className="px-3 py-4 text-sm text-gray-400 italic text-center">Không tìm thấy nhân viên nào.</p>
                                    ) : (
                                        users.map(u => (
                                            <label key={u.uid} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={assigneeUids.includes(u.uid)}
                                                    onChange={() => toggleAssignee(u.uid)}
                                                    className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
                                                />
                                                <span className="text-sm text-gray-700">{u.fullName || u.displayName || u.name || u.email || u.uid}</span>
                                            </label>
                                        ))
                                    )}
                                </div>
                            )
                        )}
                    </FormField>

                    {/* Alert flag */}
                    <label className="flex items-center gap-3 cursor-pointer p-3 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                        <input
                            type="checkbox"
                            checked={alertFlag}
                            onChange={e => setAlertFlag(e.target.checked)}
                            className="w-4 h-4 rounded text-red-600 focus:ring-red-500"
                        />
                        <span className="text-sm font-semibold text-red-600 flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4" /> Gắn cờ cảnh báo (Gấp)
                        </span>
                    </label>
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-semibold rounded-xl transition-colors min-h-[48px] flex items-center justify-center gap-2 shadow-sm"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    {loading ? "Đang xử lý..." : "Giao việc ngay"}
                </button>
            </form>
        </div>
    );
}

function FormField({ label, required, children }) {
    return (
        <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            {children}
        </div>
    );
}
