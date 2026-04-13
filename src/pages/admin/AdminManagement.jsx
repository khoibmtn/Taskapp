import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp, onSnapshot, writeBatch, getCountFromServer } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";
import { Search, Plus, Loader2, X, KeyRound, Eye, Check, XCircle, Ban, RotateCcw } from "lucide-react";

export default function AdminManagement() {
    const { userProfile, currentUser } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("personnel");
    const [resettingUid, setResettingUid] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");

    // --- Personnel Management State ---
    const [deptUsers, setDeptUsers] = useState([]);
    const [personnelLoading, setPersonnelLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userMap, setUserMap] = useState({});

    // --- User Approval State ---
    const [statusTab, setStatusTab] = useState("active");
    const [allUsers, setAllUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [departmentMap, setDepartmentMap] = useState({});

    // --- Department State ---
    const [departments, setDepartments] = useState([]);
    const [deptsLoading, setDeptsLoading] = useState(true);

    const [statusCounts, setStatusCounts] = useState({});

    const ROLE_LABELS = {
        admin: "Quản trị viên",
        manager: "Trưởng khoa/phòng",
        asigner: "Giao việc",
        staff: "Nhân viên"
    };

    const STATUS_LABELS = {
        active: "Đang hoạt động",
        pending: "Chờ duyệt",
        reject_request: "Chờ Admin từ chối",
        delete_request: "Chờ Admin xóa",
        rejected: "Bị từ chối",
        inactive: "Ngừng hoạt động"
    };

    const userTabs = [
        { id: 'pending', label: 'Chờ duyệt' },
        { id: 'reject_request', label: 'YC Từ chối' },
        { id: 'active', label: 'Hoạt động' },
        { id: 'delete_request', label: 'YC Xóa' },
        { id: 'rejected', label: 'Từ chối' },
        { id: 'inactive', label: 'Ngừng HĐ' }
    ];

    const mainTabs = [
        { id: 'personnel', label: 'Nhân sự', count: deptUsers.length },
        { id: 'users', label: 'Người dùng', count: Object.values(statusCounts).reduce((a, b) => a + b, 0) },
        { id: 'departments', label: 'Khoa phòng', count: departments.length },
    ];

    // --- Fetch Personnel (real-time) ---
    useEffect(() => {
        if (!userProfile?.selectedDepartmentId) {
            setPersonnelLoading(false);
            return;
        }
        const deptId = userProfile.selectedDepartmentId;
        const usersRef = collection(db, "users");
        setPersonnelLoading(true);

        const unsub = onSnapshot(query(usersRef, where("departmentIds", "array-contains", deptId)), (snap) => {
            const rawUsers = [];
            snap.forEach(d => rawUsers.push({ id: d.id, ...d.data() }));
            setDeptUsers(rawUsers.filter(u => u.status !== 'rejected' && u.status !== 'inactive'));
            setUserMap(prev => {
                const next = { ...prev };
                snap.forEach(d => { next[d.id] = d.data(); });
                return next;
            });
            setPersonnelLoading(false);
        });
        return () => unsub();
    }, [userProfile?.selectedDepartmentId]);

    // --- Fetch Departments (once for lookup & list) ---
    useEffect(() => {
        async function fetchDepts() {
            setDeptsLoading(true);
            try {
                const snap = await getDocs(collection(db, "departments"));
                const fetched = [];
                const deptMap = {};
                snap.forEach(d => {
                    fetched.push({ id: d.id, ...d.data() });
                    deptMap[d.id] = d.data().name;
                });
                fetched.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
                setDepartments(fetched);
                setDepartmentMap(deptMap);
            } catch (err) {
                console.error("Error fetching departments:", err);
            } finally {
                setDeptsLoading(false);
            }
        }
        fetchDepts();
    }, []);

    // --- Fetch Users by status ---
    useEffect(() => {
        async function fetchUsers() {
            setUsersLoading(true);
            try {
                const q = query(collection(db, "users"), where("status", "==", statusTab));
                const snapshot = await getDocs(q);
                const fetched = [];
                snapshot.forEach(d => fetched.push({ id: d.id, ...d.data() }));
                fetched.sort((a, b) => {
                    const tA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                    const tB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                    return tA - tB;
                });
                setAllUsers(fetched);
            } catch (err) {
                console.error("Error fetching users:", err);
            } finally {
                setUsersLoading(false);
            }
        }
        fetchUsers();
    }, [statusTab]);

    const handleUserStatusUpdate = async (targetUid, newStatus) => {
        try {
            const updates = { status: newStatus };
            if (newStatus === 'active') {
                updates.approvedAt = serverTimestamp();
                updates.approvedBy = currentUser.uid;
            }
            await updateDoc(doc(db, "users", targetUid), updates);
            alert("Cập nhật thành công!");
        } catch (err) {
            console.error(err);
            alert("Lỗi: " + err.message);
        }
    };

    // --- Fetch for status counts ---
    const fetchStatusCounts = async () => {
        try {
            const results = await Promise.all(userTabs.map(async tab => {
                const q = query(collection(db, "users"), where("status", "==", tab.id));
                const snap = await getCountFromServer(q);
                return { id: tab.id, count: snap.data().count };
            }));
            const nextCounts = {};
            results.forEach(r => nextCounts[r.id] = r.count);
            setStatusCounts(nextCounts);
        } catch (err) {
            console.error("Error fetching status counts:", err);
        }
    };

    useEffect(() => {
        fetchStatusCounts();
    }, []);

    const handleRoleUpdate = async (targetUid, newRole) => {
        try {
            await updateDoc(doc(db, "users", targetUid), { role: newRole });
            alert("Cập nhật quyền thành công!");
        } catch (err) {
            console.error(err);
            alert("Lỗi: " + err.message);
        }
    };

    const runTaskNormalization = async () => {
        if (!window.confirm("Bạn có chắc chắn muốn chuẩn hóa dữ liệu toàn bộ công việc? Việc này sẽ thêm các trường cần thiết cho việc tối ưu hóa hiệu năng.")) return;
        setUsersLoading(true);
        try {
            const snap = await getDocs(collection(db, "tasks"));
            const batch = writeBatch(db);
            let count = 0;
            snap.forEach(d => {
                const data = d.data();
                const updates = {};
                let needsUpdate = false;
                if (data.assignees && !data.assigneeUids) {
                    updates.assigneeUids = Object.keys(data.assignees);
                    needsUpdate = true;
                }
                if (data.isArchived === undefined) { updates.isArchived = false; needsUpdate = true; }
                if (data.isDeleted === undefined) { updates.isDeleted = false; needsUpdate = true; }
                if (data.isRecurringTemplate === undefined) { updates.isRecurringTemplate = false; needsUpdate = true; }

                if (needsUpdate) {
                    batch.update(d.ref, updates);
                    count++;
                }
            });
            if (count > 0) await batch.commit();
            alert(`Đã chuẩn hóa thành công ${count} công việc.`);
        } catch (err) {
            console.error(err);
            alert("Lỗi chuẩn hóa: " + err.message);
        } finally {
            setUsersLoading(false);
        }
    };

    const getUserName = (uid) => {
        const u = userMap[uid];
        if (!u) return uid?.substring?.(0, 8) || 'N/A';
        return u.fullName || (u.email && !u.email.endsWith('@task.app') ? u.email : null) || uid.substring(0, 8);
    };

    const isManagerOrAdmin = userProfile?.role === 'manager' || userProfile?.role === 'admin';

    const handleResetPassword = async (targetUid, userName) => {
        if (!window.confirm(`Bạn có chắc chắn muốn reset mật khẩu của "${userName}" về mặc định (123456)?`)) return;
        setResettingUid(targetUid);
        try {
            const functions = getFunctions(undefined, "asia-southeast1");
            const resetFn = httpsCallable(functions, "resetUserPassword");
            const result = await resetFn({ targetUid });
            alert(result.data.message);
        } catch (err) {
            console.error("Reset password error:", err);
            alert("Lỗi: " + (err.message || "Không thể reset mật khẩu."));
        } finally {
            setResettingUid(null);
        }
    };

    // --- Search filter ---
    const filterBySearch = (list) => {
        if (!searchQuery.trim()) return list;
        const q = searchQuery.toLowerCase();
        return list.filter(u =>
            (u.fullName || '').toLowerCase().includes(q) ||
            (u.phone || '').includes(q) ||
            (u.email || '').toLowerCase().includes(q) ||
            (u.id || '').toLowerCase().includes(q)
        );
    };

    // --- Status badge ---
    const StatusBadge = ({ status }) => {
        const map = {
            active: 'bg-emerald-50 text-emerald-700',
            pending: 'bg-amber-50 text-amber-700',
            reject_request: 'bg-red-50 text-red-700 font-semibold',
            delete_request: 'bg-red-50 text-red-700 font-semibold',
            rejected: 'bg-red-50 text-red-600',
            inactive: 'bg-gray-100 text-gray-500',
        };
        return (
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs ${map[status] || 'bg-gray-100 text-gray-500'}`}>
                {STATUS_LABELS[status] || status}
            </span>
        );
    };

    // --- Render Tab Content ---

    const renderPersonnelTab = () => {
        if (personnelLoading) return <LoadingState />;
        if (!userProfile?.selectedDepartmentId) return <EmptyState text="Vui lòng chọn khoa/phòng." />;
        const filtered = filterBySearch(deptUsers);

        return (
            <div className="bg-white rounded-lg border border-gray-200">
                <SearchBar placeholder="Tìm theo tên, SĐT..." />
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                                <th className="px-4 py-3 font-medium border-b border-gray-200">Họ tên</th>
                                <th className="px-4 py-3 font-medium border-b border-gray-200">Quyền</th>
                                <th className="px-4 py-3 font-medium border-b border-gray-200">Trạng thái</th>
                                <th className="px-4 py-3 font-medium border-b border-gray-200 text-right">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.map(u => (
                                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="text-sm font-medium text-gray-900">{u.fullName}</div>
                                        <div className="text-xs text-gray-400">{u.phone}</div>
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        {(u.status === 'active' && isManagerOrAdmin && u.role !== 'admin' && u.role !== 'manager') ? (
                                            <select
                                                value={u.role || 'staff'}
                                                onChange={(e) => handleRoleUpdate(u.id, e.target.value)}
                                                className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                            >
                                                <option value="staff">Nhân viên</option>
                                                <option value="asigner">Giao việc</option>
                                            </select>
                                        ) : (
                                            <span className="text-gray-600">{ROLE_LABELS[u.role] || u.role}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap">
                                        <ActionGroup>
                                            <ActionBtn icon={Eye} label="Xem" onClick={() => setSelectedUser(u)} />
                                            {u.status === 'pending' && (
                                                <>
                                                    <ActionBtn icon={Check} label="Duyệt" variant="success" onClick={() => handleUserStatusUpdate(u.id, 'active')} />
                                                    <ActionBtn icon={XCircle} label="Từ chối" variant="danger" onClick={() => { if (window.confirm(`Yêu cầu từ chối nhân viên ${u.fullName}?`)) handleUserStatusUpdate(u.id, 'reject_request'); }} />
                                                </>
                                            )}
                                            {u.status === 'reject_request' && (
                                                <ActionBtn icon={RotateCcw} label="Hủy YC" variant="muted" onClick={() => handleUserStatusUpdate(u.id, 'pending')} />
                                            )}
                                            {u.status === 'active' && u.id !== currentUser.uid && u.role !== 'admin' && (
                                                <ActionBtn icon={Ban} label="Xóa" variant="danger" onClick={() => { if (window.confirm(`Gửi yêu cầu xóa ${u.fullName}?`)) handleUserStatusUpdate(u.id, 'delete_request'); }} />
                                            )}
                                            {u.status === 'delete_request' && (
                                                <ActionBtn icon={RotateCcw} label="Hủy YC" variant="muted" onClick={() => handleUserStatusUpdate(u.id, 'active')} />
                                            )}
                                        </ActionGroup>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <TableFooter count={filtered.length} total={deptUsers.length} />
            </div>
        );
    };

    const renderUsersTab = () => {
        const filtered = filterBySearch(allUsers);

        return (
            <div>
                {/* Sub-tabs — Firebase Console underline style */}
                <div className="flex gap-0 border-b border-gray-200 overflow-x-auto no-scrollbar mb-0">
                    {userTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setStatusTab(tab.id)}
                            className={`relative px-4 py-2.5 text-sm whitespace-nowrap transition-colors min-h-[44px] ${
                                statusTab === tab.id
                                    ? 'text-primary-600 font-semibold'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {tab.label} ({statusCounts[tab.id] || 0})
                            {statusTab === tab.id && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-t" />
                            )}
                        </button>
                    ))}
                </div>

                <div className="bg-white rounded-b-lg border border-t-0 border-gray-200">
                    <SearchBar placeholder="Tìm theo tên, SĐT, email hoặc UID..." />

                    {usersLoading ? <LoadingState /> : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                                        <th className="px-4 py-3 font-medium border-b border-gray-200">Họ tên</th>
                                        <th className="px-4 py-3 font-medium border-b border-gray-200 hidden lg:table-cell">Khoa/Phòng</th>
                                        <th className="px-4 py-3 font-medium border-b border-gray-200 hidden md:table-cell">Vị trí</th>
                                        <th className="px-4 py-3 font-medium border-b border-gray-200">ĐT</th>
                                        <th className="px-4 py-3 font-medium border-b border-gray-200 hidden sm:table-cell">Trạng thái</th>
                                        <th className="px-4 py-3 font-medium border-b border-gray-200 text-right">Hành động</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filtered.length === 0 ? (
                                        <tr><td colSpan="6" className="px-4 py-10 text-center text-sm text-gray-400 italic">Không có người dùng nào.</td></tr>
                                    ) : (
                                        filtered.map(user => (
                                            <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="text-sm text-gray-900">{user.fullName || user.displayName || '—'}</div>
                                                    <div className="text-xs text-gray-400 lg:hidden">
                                                        {user.departmentIds?.length > 0 ? user.departmentIds.map(id => departmentMap[id] || id).join(", ") : (departmentMap[user.departmentId] || '-')}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">
                                                    {user.departmentIds?.length > 0 ? user.departmentIds.map(id => departmentMap[id] || id).join(", ") : (departmentMap[user.departmentId] || user.departmentId || '-')}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">{user.position || '—'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600">{user.phone}</td>
                                                <td className="px-4 py-3 hidden sm:table-cell"><StatusBadge status={user.status} /></td>
                                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                                    <ActionGroup>
                                                        <ActionBtn
                                                            icon={Eye}
                                                            label={statusTab === 'pending' || statusTab === 'delete_request' ? 'Xử lý' : 'Chi tiết'}
                                                            onClick={() => navigate(`/admin/users/${user.id}`)}
                                                        />
                                                        {user.status === 'active' && (
                                                            <ActionBtn
                                                                icon={KeyRound}
                                                                label={resettingUid === user.id ? '...' : 'Reset MK'}
                                                                variant="warning"
                                                                disabled={resettingUid === user.id}
                                                                onClick={() => handleResetPassword(user.id, user.fullName || user.phone)}
                                                            />
                                                        )}
                                                    </ActionGroup>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <TableFooter count={filtered.length} total={allUsers.length} />
                </div>
            </div>
        );
    };

    const renderDepartmentsTab = () => (
        <div className="bg-white rounded-lg border border-gray-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <span className="text-sm text-gray-500">{departments.length} đơn vị</span>
                <Link
                    to="/admin/departments/new"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-full transition-colors min-h-[40px]"
                >
                    <Plus className="w-4 h-4" /> Thêm Khoa/Phòng
                </Link>
            </div>

            {deptsLoading ? <LoadingState /> : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                                <th className="px-4 py-3 font-medium border-b border-gray-200">Tên đơn vị</th>
                                <th className="px-4 py-3 font-medium border-b border-gray-200">Loại</th>
                                <th className="px-4 py-3 font-medium border-b border-gray-200">Trạng thái</th>
                                <th className="px-4 py-3 font-medium border-b border-gray-200 text-right">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {departments.length === 0 ? (
                                <tr><td colSpan="4" className="px-4 py-10 text-center text-sm text-gray-400">Chưa có đơn vị nào.</td></tr>
                            ) : (
                                departments.map(d => (
                                    <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{d.name}</td>
                                        <td className="px-4 py-3 text-sm text-gray-600">{d.type === 'khoa' ? 'Khoa' : 'Phòng'}</td>
                                        <td className="px-4 py-3">
                                            {d.isActive
                                                ? <span className="inline-block px-2.5 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700">Hoạt động</span>
                                                : <span className="inline-block px-2.5 py-0.5 rounded-full text-xs bg-red-50 text-red-600">Ngừng</span>
                                            }
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => navigate(`/admin/departments/${d.id}`)}
                                                className="text-sm text-primary-600 hover:text-primary-800 font-medium"
                                            >
                                                Sửa
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

    // --- Shared UI components ---

    const SearchBar = ({ placeholder }) => (
        <div className="px-4 py-3 border-b border-gray-200">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    placeholder={placeholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white transition-colors placeholder:text-gray-400"
                />
                {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                        <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                    </button>
                )}
            </div>
        </div>
    );

    const LoadingState = () => (
        <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
            <span className="ml-2 text-sm text-gray-400">Đang tải...</span>
        </div>
    );

    const EmptyState = ({ text }) => (
        <div className="text-center py-16 text-sm text-gray-400">{text}</div>
    );

    const TableFooter = ({ count, total }) => (
        <div className="flex items-center justify-end px-4 py-3 border-t border-gray-200 text-xs text-gray-500">
            <span>{count === total ? `${total} mục` : `${count} / ${total} mục`}</span>
        </div>
    );

    const ActionGroup = ({ children }) => (
        <div className="inline-flex items-center gap-1">{children}</div>
    );

    const ActionBtn = ({ icon: Icon, label, variant = 'default', onClick, disabled }) => {
        const variants = {
            default: 'text-gray-600 hover:bg-gray-100',
            success: 'text-emerald-600 hover:bg-emerald-50',
            danger: 'text-red-600 hover:bg-red-50',
            warning: 'text-amber-600 hover:bg-amber-50',
            muted: 'text-gray-500 hover:bg-gray-100',
        };
        return (
            <button
                onClick={onClick}
                disabled={disabled}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors min-h-[32px] disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]}`}
                title={label}
            >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{label}</span>
            </button>
        );
    };

    // --- Main render ---

    return (
        <div>
            {/* Page Title */}
            <h1 className="font-heading text-2xl font-bold text-gray-900 mb-1">Quản lý hệ thống</h1>
            <p className="text-sm text-gray-500 mb-6">Quản lý nhân sự, người dùng và khoa phòng</p>

            {/* Main Tabs — Firebase Console underline style */}
            <div className="flex gap-0 border-b border-gray-200 mb-6 overflow-x-auto no-scrollbar">
                {mainTabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setSearchQuery(""); }}
                        className={`relative px-5 py-3 text-sm whitespace-nowrap transition-colors min-h-[48px] ${
                            activeTab === tab.id
                                ? 'text-primary-600 font-semibold'
                                : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        {tab.label}
                        {tab.count > 0 && <span className="ml-1.5 text-xs text-gray-400">({tab.count})</span>}
                        {activeTab === tab.id && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-t" />
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'personnel' && renderPersonnelTab()}
            {activeTab === 'users' && renderUsersTab()}
            {activeTab === 'departments' && renderDepartmentsTab()}

            {/* User Detail Modal */}
            {selectedUser && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelectedUser(null)}>
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="font-heading font-bold text-lg text-gray-900">Chi tiết nhân sự</h3>
                            <button onClick={() => setSelectedUser(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            {[
                                ['Họ tên', selectedUser.fullName],
                                ['SĐT', selectedUser.phone],
                                ['Email', selectedUser.email || '—'],
                                ['Vị trí', selectedUser.position],
                                ['Quyền', ROLE_LABELS[selectedUser.role] || selectedUser.role],
                                ['Trạng thái', STATUS_LABELS[selectedUser.status] || selectedUser.status],
                                ['Tham gia', selectedUser.createdAt?.toDate ? selectedUser.createdAt.toDate().toLocaleDateString('vi-VN') : 'N/A'],
                                ...(selectedUser.status !== 'pending' ? [['Duyệt bởi', getUserName(selectedUser.approvedBy) || 'N/A']] : []),
                            ].map(([label, value]) => (
                                <div key={label} className="flex items-baseline gap-3">
                                    <span className="text-xs text-gray-400 w-20 flex-shrink-0 text-right">{label}</span>
                                    <span className="text-sm text-gray-900">{value}</span>
                                </div>
                            ))}
                        </div>

                        <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
                            <button
                                onClick={() => setSelectedUser(null)}
                                className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors min-h-[40px]"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
