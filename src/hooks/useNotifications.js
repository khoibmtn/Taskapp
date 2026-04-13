import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, query, where, orderBy, limit, onSnapshot, updateDoc, doc, writeBatch } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";

/**
 * Shared hook for notification state.
 * Used by both NotificationDropdown and AppLayout sidebar badge.
 */
export function useNotifications() {
    const { currentUser } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!currentUser) return;

        const q = query(
            collection(db, "notifications"),
            where("toUid", "==", currentUser.uid),
            orderBy("createdAt", "desc"),
            limit(30)
        );

        const unsubscribe = onSnapshot(q, (snap) => {
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setNotifications(list);
            
            const newUnreadCount = list.filter(n => !n.isRead).length;
            setUnreadCount(newUnreadCount);
            
            // Sync with native OS App Icon Badge (PWA)
            if ('setAppBadge' in navigator) {
                if (newUnreadCount > 0) {
                    navigator.setAppBadge(newUnreadCount).catch(console.warn);
                } else {
                    navigator.clearAppBadge().catch(console.warn);
                }
            }
        }, (err) => {
            console.warn("Notifications listener error:", err);
        });

        return () => unsubscribe();
    }, [currentUser]);

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

    const markOneAsRead = async (notifId) => {
        await updateDoc(doc(db, "notifications", notifId), { isRead: true });
    };

    return { notifications, unreadCount, markAllAsRead, markOneAsRead };
}
