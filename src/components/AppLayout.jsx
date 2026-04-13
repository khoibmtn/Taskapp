import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { auth, db } from "../firebase";
import { doc, getDoc, getDocs, collection, query, where, onSnapshot } from "firebase/firestore";
import NotificationDropdown from "./NotificationDropdown";
import BottomNav from "./BottomNav";
import {
    LayoutDashboard, BarChart3, PlusCircle, ClipboardList,
    Users, Shield, Settings, Menu, X, LogOut, ClipboardCheck
} from "lucide-react";
import FirebaseDropdown from "./FirebaseDropdown";

const SIDEBAR_ITEMS = [
    { to: "/app", icon: LayoutDashboard, label: "Dashboard", roles: null },
    { to: "/manager/dashboard", icon: BarChart3, label: "Dashboard Quản lý", roles: ["manager", "admin", "asigner"] },
    { to: "/app/create-task", icon: PlusCircle, label: "Giao việc mới", roles: null, highlight: true },
    { to: "/app/tasks", icon: ClipboardList, label: "Công việc", roles: null },
    { to: "/manager/personnel", icon: Users, label: "Quản lý Nhân sự", roles: ["manager"] },
    { to: "/admin/management", icon: Shield, label: "Quản lý hệ thống", roles: ["admin"], danger: true },
    { to: "/app/settings", icon: Settings, label: "Cài đặt", roles: null },
];

export default function AppLayout() {
    const { currentUser, userProfile, switchDepartment } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [myDepartments, setMyDepartments] = useState([]);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [newTaskCount, setNewTaskCount] = useState(0);

    // Listen for new tasks assigned to current user (open, not seen)
    useEffect(() => {
        if (!currentUser?.uid) return;

        const q = query(
            collection(db, "tasks"),
            where("assigneeUids", "array-contains", currentUser.uid),
            where("status", "==", "open"),
            where("isRecurringTemplate", "==", false)
        );

        const unsub = onSnapshot(q, (snap) => {
            // Count tasks not yet seen by this user
            let count = 0;
            snap.forEach(doc => {
                const data = doc.data();
                const seenBy = data.seenBy || {};
                if (!seenBy[currentUser.uid]) {
                    count++;
                }
            });
            setNewTaskCount(count);
        });

        return () => unsub();
    }, [currentUser?.uid]);

    // Listen for toggle-sidebar event from BottomNav
    useEffect(() => {
        const handler = () => setSidebarOpen(prev => !prev);
        window.addEventListener('toggle-sidebar', handler);
        return () => window.removeEventListener('toggle-sidebar', handler);
    }, []);

    useEffect(() => {
        async function fetchDeptNames() {
            try {
                if (userProfile?.role === "admin") {
                    const snap = await getDocs(collection(db, "departments"));
                    const allDepts = [];
                    snap.forEach(doc => allDepts.push({ id: doc.id, name: doc.data().name }));
                    setMyDepartments(allDepts);
                } else if (userProfile?.departmentIds) {
                    const depts = [];
                    for (const id of userProfile.departmentIds) {
                        const dSnap = await getDoc(doc(db, "departments", id));
                        if (dSnap.exists()) {
                            depts.push({ id, name: dSnap.data().name });
                        }
                    }
                    setMyDepartments(depts);
                }
            } catch (err) {
                console.error("Error fetching dept names:", err);
            }
        }
        fetchDeptNames();
    }, [userProfile?.departmentIds, userProfile?.role]);

    const handleLogout = async () => {
        try {
            await auth.signOut();
            navigate("/login");
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };

    const isActive = (to) => {
        if (to === "/app") return location.pathname === "/app";
        return location.pathname.startsWith(to);
    };

    const handleNavClick = (to) => {
        setSidebarOpen(false);
        navigate(to);
    };

    const visibleItems = SIDEBAR_ITEMS.filter(item =>
        !item.roles || item.roles.includes(userProfile?.role)
    );

    return (
        <div className="min-h-dvh flex bg-gray-50">
            {/* Mobile overlay backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/30 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* ═══ Sidebar ═══ */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200
                transform transition-transform duration-200 ease-out
                lg:translate-x-0 lg:static lg:z-auto
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {/* Sidebar header */}
                <div className="flex items-center justify-between h-16 px-5 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                        <ClipboardCheck className="w-6 h-6 text-primary-600" />
                        <h1 className="font-heading font-bold text-lg text-gray-900">TaskApp</h1>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Department switcher */}
                {myDepartments.length > 0 && (
                    <div className="px-4 py-3 border-b border-gray-100">
                        {myDepartments.length > 1 ? (
                            <FirebaseDropdown
                                value={userProfile?.selectedDepartmentId}
                                options={myDepartments.map(d => ({ value: d.id, label: d.name }))}
                                onChange={(val) => switchDepartment(val)}
                                className="w-full"
                            />
                        ) : (
                            <div className="text-sm text-gray-500">
                                <span className="text-xs text-gray-400">Khoa/Phòng</span>
                                <p className="font-medium text-gray-700 truncate">{myDepartments[0]?.name}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Navigation items */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                    {visibleItems.map(({ to, icon: Icon, label, highlight, danger }) => (
                        <button
                            key={to}
                            onClick={() => handleNavClick(to)}
                            className={`
                                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                                transition-colors duration-150 min-h-[44px]
                                ${isActive(to)
                                    ? 'bg-primary-50 text-primary-700'
                                    : danger
                                        ? 'text-danger-600 hover:bg-danger-50'
                                        : highlight
                                            ? 'text-primary-600 hover:bg-primary-50'
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }
                            `}
                        >
                            <Icon className="w-5 h-5 flex-shrink-0" />
                            <span className="flex-1 text-left">{label}</span>
                            {to === '/app' && newTaskCount > 0 && (
                                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center animate-pulse">
                                    {newTaskCount > 99 ? '99+' : newTaskCount}
                                </span>
                            )}
                        </button>
                    ))}
                </nav>

                {/* User section */}
                <div className="p-3 border-t border-gray-100">
                    <div className="flex items-center gap-3 px-3 py-2">
                        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-primary-700 font-medium text-xs">
                                {userProfile?.fullName?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                                {userProfile?.fullName || 'User'}
                            </p>
                            <p className="text-xs text-gray-500 truncate capitalize">{userProfile?.role}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-danger-500 hover:bg-danger-50 transition-colors"
                            title="Đăng xuất"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* ═══ Main Content ═══ */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Mobile header */}
                <header className="lg:hidden flex items-center justify-between h-14 px-4 bg-white border-b border-gray-200 sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-2 -ml-2 rounded-lg hover:bg-gray-100"
                        >
                            <Menu className="w-5 h-5 text-gray-600" />
                        </button>
                        <div className="flex items-center gap-2">
                            <ClipboardCheck className="w-5 h-5 text-primary-600" />
                            <span className="font-heading font-bold text-gray-900">TaskApp</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <NotificationDropdown />
                    </div>
                </header>

                {/* Desktop header */}
                <header className="hidden lg:flex items-center justify-between h-14 px-6 bg-white border-b border-gray-200">
                    <div className="text-sm text-gray-500">
                        {myDepartments.length === 1 && (
                            <span>Khoa/Phòng: <strong className="text-gray-700">{myDepartments[0]?.name}</strong></span>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        <NotificationDropdown />
                        <div className="h-5 w-px bg-gray-200" />
                        <span className="text-sm text-gray-600">
                            Xin chào, <strong className="text-gray-900">{userProfile?.fullName || 'User'}</strong>
                        </span>
                    </div>
                </header>

                <main className="flex-1 p-4 lg:p-6 overflow-auto pb-safe lg:pb-6">
                    <Outlet />
                </main>
            </div>

            {/* ═══ Bottom Navigation (mobile only) ═══ */}
            <BottomNav userRole={userProfile?.role} />
        </div>
    );
}
