import { useState, useEffect, useCallback, useRef } from "react";
import { collection, query, orderBy, limit, startAfter, onSnapshot, updateDoc, doc, serverTimestamp, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

/**
 * Subscribe to a conversation's messages in realtime.
 * Auto-marks conversation as read on mount.
 */
export function useConversation(conversationId) {
    const { currentUser } = useAuth();
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);
    const lastDocRef = useRef(null);
    const PAGE_SIZE = 30;

    // Realtime listener for latest messages
    useEffect(() => {
        if (!conversationId || !currentUser) {
            setMessages([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const messagesRef = collection(db, "conversations", conversationId, "messages");
        const q = query(messagesRef, orderBy("createdAt", "desc"), limit(PAGE_SIZE));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(d => ({
                id: d.id,
                ...d.data(),
            }));

            // Sort ascending for display (oldest first)
            // Use createdAt (server) with clientCreatedAt fallback
            msgs.sort((a, b) => {
                const aTime = a.createdAt?.toMillis?.() || a.clientCreatedAt || 0;
                const bTime = b.createdAt?.toMillis?.() || b.clientCreatedAt || 0;
                return aTime - bTime;
            });

            setMessages(msgs);
            setHasMore(snapshot.docs.length >= PAGE_SIZE);
            if (snapshot.docs.length > 0) {
                lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
            }
            setLoading(false);
        }, (error) => {
            console.error("useConversation error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [conversationId, currentUser]);

    // Mark as read on mount
    useEffect(() => {
        if (!conversationId || !currentUser) return;

        const convRef = doc(db, "conversations", conversationId);
        updateDoc(convRef, {
            [`lastReadAt.${currentUser.uid}`]: serverTimestamp(),
            [`unreadCounts.${currentUser.uid}`]: 0,
        }).catch(() => {
            // Conversation may not exist yet — that's OK
        });
    }, [conversationId, currentUser]);

    // Load older messages (pagination)
    const loadMore = useCallback(async () => {
        if (!conversationId || !hasMore || !lastDocRef.current) return;

        const messagesRef = collection(db, "conversations", conversationId, "messages");
        const q = query(
            messagesRef,
            orderBy("createdAt", "desc"),
            startAfter(lastDocRef.current),
            limit(PAGE_SIZE)
        );

        // One-time fetch for older messages
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            setHasMore(false);
            return;
        }

        const olderMsgs = snapshot.docs.map(d => ({
            id: d.id,
            ...d.data(),
        }));

        olderMsgs.sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || a.clientCreatedAt || 0;
            const bTime = b.createdAt?.toMillis?.() || b.clientCreatedAt || 0;
            return aTime - bTime;
        });

        setMessages(prev => [...olderMsgs, ...prev]);
        setHasMore(snapshot.docs.length >= PAGE_SIZE);
        lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
    }, [conversationId, hasMore]);

    return { messages, loading, hasMore, loadMore };
}
