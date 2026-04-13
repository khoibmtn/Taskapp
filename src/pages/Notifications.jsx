import { useEffect, useState } from "react";
import { collection, query, where, orderBy, getDocs, updateDoc, doc, limit } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Bell, Loader2 } from "lucide-react";

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

    if (loading) return (
        <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            <span className="ml-2 text-gray-500">Đang tải thông báo...</span>
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto">
            <h2 className="font-heading text-xl font-bold text-gray-900 mb-4">Thông báo của bạn</h2>

            <div className="space-y-2">
                {notifications.length === 0 ? (
                    <div className="text-center py-16">
                        <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-400 text-sm">Không có thông báo nào.</p>
                    </div>
                ) : (
                    notifications.map(n => (
                        <button
                            key={n.id}
                            onClick={() => handleNotifClick(n)}
                            className={`w-full text-left p-4 rounded-xl border transition-colors ${
                                n.isRead
                                    ? 'bg-gray-50 border-gray-200'
                                    : 'bg-primary-50 border-l-4 border-primary-500 border-r border-t border-b border-r-primary-200 border-t-primary-200 border-b-primary-200'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-3 mb-1">
                                <strong className={`text-sm ${n.isRead ? 'text-gray-700' : 'text-primary-800'}`}>
                                    {n.title}
                                </strong>
                                <span className="text-[11px] text-gray-400 flex-shrink-0">
                                    {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString('vi-VN') : ""}
                                </span>
                            </div>
                            <p className={`text-sm leading-relaxed ${n.isRead ? 'text-gray-500' : 'text-gray-700'}`}>
                                {n.body}
                            </p>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
