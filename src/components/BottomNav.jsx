import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, BarChart3, PlusCircle, Bell, Menu, MessageSquare } from "lucide-react";
import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { useChatList } from "../hooks/useChatList";

export default function BottomNav({ userRole }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { currentUser } = useAuth();
    const [unreadCount, setUnreadCount] = useState(0);
    const [menuOpen, setMenuOpen] = useState(false);
    const { totalUnread: chatUnread } = useChatList(currentUser?.uid);

    const isManagerRole = ["manager", "admin", "asigner"].includes(userRole);

    // Listen for unread notifications count
    useEffect(() => {
        if (!currentUser) return;
        const q = query(
            collection(db, "notifications"),
            where("toUid", "==", currentUser.uid),
            where("isRead", "==", false)
        );
        const unsubscribe = onSnapshot(q, (snap) => {
            setUnreadCount(snap.size);
        });
        return () => unsubscribe();
    }, [currentUser]);

    const isActive = (path) => {
        if (path === "/app") return location.pathname === "/app";
        return location.pathname.startsWith(path);
    };

    const tabs = [
        { id: "home", icon: LayoutDashboard, label: "Trang chủ", path: "/app" },
        ...(isManagerRole
            ? [{ id: "manage", icon: BarChart3, label: "Quản lý", path: "/manager/dashboard" }]
            : []
        ),
        { id: "create", icon: PlusCircle, label: "Tạo việc", path: "/app/create-task", fab: true },
        { id: "chat", icon: MessageSquare, label: "Tin nhắn", path: "/app/messages", badge: chatUnread },
        { id: "notif", icon: Bell, label: "Thông báo", path: "/app/notifications", badge: unreadCount },
        { id: "menu", icon: Menu, label: "Menu", action: "sidebar" },
    ];

    const handleTabClick = (tab) => {
        if (tab.action === "sidebar") {
            // Dispatch custom event to toggle sidebar
            window.dispatchEvent(new CustomEvent("toggle-sidebar"));
            return;
        }
        navigate(tab.path);
    };

    return (
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
            <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = tab.path ? isActive(tab.path) : false;

                    if (tab.fab) {
                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabClick(tab)}
                                className="relative -mt-5 flex items-center justify-center w-14 h-14 rounded-full bg-primary-500 text-white shadow-lg shadow-primary-500/30 active:scale-95 transition-transform"
                            >
                                <Icon className="w-6 h-6" />
                            </button>
                        );
                    }

                    return (
                        <button
                            key={tab.id}
                            onClick={() => handleTabClick(tab)}
                            className={`relative flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1.5 rounded-lg transition-colors ${
                                active ? 'text-primary-600' : 'text-gray-400'
                            }`}
                        >
                            <div className="relative">
                                <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : ''}`} />
                                {tab.badge > 0 && (
                                    <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] flex items-center justify-center bg-danger-500 text-white text-[10px] font-bold rounded-full px-1 border-2 border-white">
                                        {tab.badge > 9 ? '9+' : tab.badge}
                                    </span>
                                )}
                            </div>
                            <span className={`text-[10px] font-medium ${active ? 'text-primary-600' : 'text-gray-400'}`}>
                                {tab.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
