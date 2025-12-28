import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, orderBy, limit, onSnapshot, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export default function NotificationDropdown() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [activeTab, setActiveTab] = useState('all'); // 'all' or 'unread'
    const dropdownRef = useRef(null);

    useEffect(() => {
        if (!currentUser) return;

        const q = query(
            collection(db, "notifications"),
            where("toUid", "==", currentUser.uid),
            orderBy("createdAt", "desc"),
            limit(10)
        );

        const unsubscribe = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setNotifications(list);
            const unread = list.filter(n => !n.isRead).length;
            setUnreadCount(unread);
        });

        return () => unsubscribe();
    }, [currentUser]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleNotifClick = async (notif) => {
        if (!notif.isRead) {
            await updateDoc(doc(db, "notifications", notif.id), { isRead: true });
        }
        setIsOpen(false);
        if (notif.taskId) {
            navigate(`/app/tasks/${notif.taskId}`);
        }
    };

    const markAllAsRead = async () => {
        if (!currentUser) return;
        const unreadItems = notifications.filter(n => !n.isRead);
        if (unreadItems.length === 0) return;

        const batch = writeBatch(db);
        unreadItems.forEach(n => {
            batch.update(doc(db, "notifications", n.id), { isRead: true });
        });
        await batch.commit();
    };

    const filteredNotifications = activeTab === 'unread'
        ? notifications.filter(n => !n.isRead)
        : notifications;

    return (
        <div style={{ position: 'relative' }} ref={dropdownRef}>
            {/* Bell Icon & Badge */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    cursor: 'pointer',
                    position: 'relative',
                    padding: '8px',
                    borderRadius: '50%',
                    background: isOpen ? '#e3f2fd' : 'transparent',
                    transition: 'background 0.2s'
                }}
            >
                <span style={{ fontSize: '1.4em' }}>🔔</span>
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '0',
                        right: '0',
                        background: '#d32f2f',
                        color: '#fff',
                        borderRadius: '50%',
                        width: '18px',
                        height: '18px',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        border: '2px solid #fff'
                    }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: '0',
                    width: '360px',
                    background: '#fff',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    borderRadius: '8px',
                    marginTop: '10px',
                    zIndex: 1000,
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '500px'
                }}>
                    <div style={{ padding: '15px', borderBottom: '1px solid #eee' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.2em' }}>Thông báo</h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#1877f2',
                                        fontSize: '0.9em',
                                        cursor: 'pointer',
                                        padding: '4px 8px',
                                        borderRadius: '4px'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#f2f2f2'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    Đánh dấu tất cả là đã đọc
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setActiveTab('all')}
                                style={{
                                    padding: '6px 15px',
                                    borderRadius: '20px',
                                    border: 'none',
                                    background: activeTab === 'all' ? '#e7f3ff' : 'transparent',
                                    color: activeTab === 'all' ? '#1877f2' : '#65676b',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                Tất cả
                            </button>
                            <button
                                onClick={() => setActiveTab('unread')}
                                style={{
                                    padding: '6px 15px',
                                    borderRadius: '20px',
                                    border: 'none',
                                    background: activeTab === 'unread' ? '#e7f3ff' : 'transparent',
                                    color: activeTab === 'unread' ? '#1877f2' : '#65676b',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                Chưa đọc
                            </button>
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {filteredNotifications.length === 0 ? (
                            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#65676b' }}>
                                Không có thông báo nào.
                            </div>
                        ) : (
                            filteredNotifications.map(notif => (
                                <div
                                    key={notif.id}
                                    onClick={() => handleNotifClick(notif)}
                                    style={{
                                        padding: '12px 15px',
                                        display: 'flex',
                                        gap: '12px',
                                        cursor: 'pointer',
                                        transition: 'background 0.2s',
                                        background: '#fff',
                                        position: 'relative',
                                        alignItems: 'start'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#f2f2f2'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
                                >
                                    {/* Avatar Placeholder / Icon */}
                                    <div style={{
                                        width: '56px',
                                        height: '56px',
                                        borderRadius: '50%',
                                        background: '#1976d2',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#fff',
                                        fontSize: '1.5em',
                                        flexShrink: 0,
                                        overflow: 'hidden'
                                    }}>
                                        {notif.fromAvatar ? (
                                            <img src={notif.fromAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <span>👤</span>
                                        )}
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            fontSize: '0.95em',
                                            lineHeight: '1.4',
                                            color: '#050505',
                                            fontWeight: notif.isRead ? 'normal' : 'bold'
                                        }}>
                                            {notif.body}
                                        </div>
                                        <div style={{
                                            fontSize: '0.8em',
                                            color: notif.isRead ? '#65676b' : '#1877f2',
                                            marginTop: '4px',
                                            fontWeight: notif.isRead ? 'normal' : 'bold'
                                        }}>
                                            {notif.createdAt?.toDate ? formatTimeAgo(notif.createdAt.toDate()) : 'Vừa xong'}
                                        </div>
                                    </div>

                                    {!notif.isRead && (
                                        <div style={{
                                            width: '12px',
                                            height: '12px',
                                            background: '#1877f2',
                                            borderRadius: '50%',
                                            alignSelf: 'center'
                                        }} />
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    <div style={{ padding: '10px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'center' }}>
                        <button
                            onClick={() => { navigate('/app/notifications'); setIsOpen(false); }}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#1877f2',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                width: '100%',
                                padding: '8px'
                            }}
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
