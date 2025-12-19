import { useEffect, useState } from "react";
import { collection, query, where, orderBy, getDocs, updateDoc, doc, limit } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Notifications() {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) return;

        async function fetchNotifications() {
            try {
                const q = query(
                    collection(db, "notifications"),
                    where("toUid", "==", currentUser.uid),
                    orderBy("createdAt", "desc"),
                    limit(50)
                );

                const snap = await getDocs(q);
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setNotifications(list);
            } catch (err) {
                console.error("Error fetching notifications:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchNotifications();
    }, [currentUser]);

    const markAsRead = async (notifId) => {
        try {
            await updateDoc(doc(db, "notifications", notifId), { isRead: true });
            setNotifications(notifications.map(n => n.id === notifId ? { ...n, isRead: true } : n));
        } catch (err) {
            console.error(err);
        }
    };

    const handleNotifClick = (notif) => {
        markAsRead(notif.id);
        if (notif.taskId) {
            navigate(`/app/tasks/${notif.taskId}`);
        }
    };

    if (loading) return <div>Đang tải thông báo...</div>;

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
            <h2 style={{ marginBottom: '20px' }}>Thông báo của bạn</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {notifications.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#666', fontStyle: 'italic' }}>Không có thông báo nào.</p>
                ) : (
                    notifications.map(n => (
                        <div
                            key={n.id}
                            onClick={() => handleNotifClick(n)}
                            style={{
                                padding: '15px',
                                background: n.isRead ? '#f5f5f5' : '#e3f2fd',
                                borderLeft: n.isRead ? '4px solid #ccc' : '4px solid #1976d2',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                transition: 'background 0.2s'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                <strong style={{ color: n.isRead ? '#333' : '#0d47a1' }}>{n.title}</strong>
                                <small style={{ color: '#888' }}>
                                    {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString('vi-VN') : ""}
                                </small>
                            </div>
                            <div style={{ color: '#555', fontSize: '0.95em' }}>{n.body}</div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
