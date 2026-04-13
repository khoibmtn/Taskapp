import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, User } from 'lucide-react';

/**
 * Notification dropdown — receives data from useNotifications hook via props.
 */
export default function NotificationDropdown({ notifications, unreadCount, markAllAsRead, markOneAsRead }) {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('all');
    const dropdownRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Mark all as read when opening dropdown
    const handleToggle = () => {
        const willOpen = !isOpen;
        setIsOpen(willOpen);
        if (willOpen && unreadCount > 0) {
            markAllAsRead();
        }
    };

    const handleNotifClick = async (notif) => {
        if (!notif.isRead) {
            markOneAsRead(notif.id);
        }
        setIsOpen(false);
        if (notif.taskId) {
            navigate(`/app/tasks/${notif.taskId}`);
        }
    };

    const filteredNotifications = activeTab === 'unread'
        ? notifications.filter(n => !n.isRead)
        : notifications;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Bell Button */}
            <button
                onClick={handleToggle}
                className={`relative p-2 rounded-lg transition-colors ${
                    isOpen ? 'bg-primary-50 text-primary-600' : 'text-gray-500 hover:bg-gray-100'
                }`}
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-danger-500 text-white text-[10px] font-bold rounded-full px-1 border-2 border-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-[calc(100vw-2rem)] max-w-sm bg-white rounded-xl shadow-xl border border-gray-200 z-50 flex flex-col max-h-[80vh] lg:max-h-[500px] lg:w-96">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-100">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-heading font-bold text-lg text-gray-900">Thông báo</h3>
                            {notifications.filter(n => !n.isRead).length > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="flex items-center gap-1 text-sm text-primary-600 hover:bg-primary-50 px-2 py-1 rounded-lg transition-colors"
                                >
                                    <CheckCheck className="w-4 h-4" />
                                    <span className="hidden sm:inline">Đọc tất cả</span>
                                </button>
                            )}
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2">
                            {[
                                { key: 'all', label: 'Tất cả' },
                                { key: 'unread', label: 'Chưa đọc' }
                            ].map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                        activeTab === tab.key
                                            ? 'bg-primary-100 text-primary-700'
                                            : 'text-gray-500 hover:bg-gray-100'
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Notification list */}
                    <div className="flex-1 overflow-y-auto">
                        {filteredNotifications.length === 0 ? (
                            <div className="py-12 text-center text-gray-400 text-sm">
                                Không có thông báo nào.
                            </div>
                        ) : (
                            filteredNotifications.map(notif => (
                                <button
                                    key={notif.id}
                                    onClick={() => handleNotifClick(notif)}
                                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                                >
                                    {/* Avatar */}
                                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                        {notif.fromAvatar ? (
                                            <img src={notif.fromAvatar} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="w-5 h-5 text-primary-600" />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm leading-snug ${notif.isRead ? 'text-gray-600' : 'text-gray-900 font-medium'}`}>
                                            {notif.body}
                                        </p>
                                        <p className={`text-xs mt-1 ${notif.isRead ? 'text-gray-400' : 'text-primary-600 font-medium'}`}>
                                            {notif.createdAt?.toDate ? formatTimeAgo(notif.createdAt.toDate()) : 'Vừa xong'}
                                        </p>
                                    </div>

                                    {/* Unread dot */}
                                    {!notif.isRead && (
                                        <div className="w-2.5 h-2.5 rounded-full bg-primary-500 mt-2 flex-shrink-0" />
                                    )}
                                </button>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="border-t border-gray-100">
                        <button
                            onClick={() => { navigate('/app/notifications'); setIsOpen(false); }}
                            className="w-full py-3 text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors rounded-b-xl"
                        >
                            Xem tất cả thông báo
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function formatTimeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Vừa xong';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} phút trước`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} giờ trước`;
    if (diffInSeconds < 172800) return 'Hôm qua';
    return date.toLocaleDateString('vi-VN');
}
