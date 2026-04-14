import { useState, useEffect } from "react";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Subscribe to the user's conversation list in realtime.
 * Returns conversations sorted by updatedAt desc + total unread count.
 * Gracefully handles index-not-ready and permission errors.
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

        let unsubscribe;
        try {
            const q = query(
                collection(db, "conversations"),
                where("participants", "array-contains", uid),
                orderBy("updatedAt", "desc"),
                limit(50)
            );

            unsubscribe = onSnapshot(q, (snapshot) => {
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
                // Graceful fallback — index not ready, permission denied, etc.
                console.warn("useChatList: query failed (index may be building):", error.code || error.message);
                setConversations([]);
                setTotalUnread(0);
                setLoading(false);
            });
        } catch (error) {
            // Synchronous error during query construction
            console.warn("useChatList: setup failed:", error);
            setConversations([]);
            setTotalUnread(0);
            setLoading(false);
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [uid]);

    return { conversations, totalUnread, loading };
}
