import { useState, useEffect } from "react";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Subscribe to the user's conversation list in realtime.
 * Returns conversations sorted by updatedAt desc + total unread count.
 */
export function useChatList(uid) {
    const [conversations, setConversations] = useState([]);
    const [totalUnread, setTotalUnread] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!uid) {
            setConversations([]);
            setTotalUnread(0);
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, "conversations"),
            where("participants", "array-contains", uid),
            orderBy("updatedAt", "desc"),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            let unread = 0;
            const convs = snapshot.docs.map(d => {
                const data = d.data();
                const myUnread = data.unreadCounts?.[uid] || 0;
                unread += myUnread;
                return {
                    id: d.id,
                    ...data,
                    myUnread,
                };
            });

            setConversations(convs);
            setTotalUnread(unread);
            setLoading(false);
        }, (error) => {
            console.error("useChatList error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [uid]);

    return { conversations, totalUnread, loading };
}
