import { useEffect, useRef, useCallback } from "react";
import { doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

/**
 * Manages chat presence — tracks which conversation the user is actively viewing.
 * - Adds/removes conversationId from presence/{uid}.activeConversationIds
 * - Heartbeat every 15s (only when tab is visible)
 * - Pauses heartbeat when tab is hidden
 */
export function usePresence(conversationId) {
    const { currentUser } = useAuth();
    const heartbeatRef = useRef(null);
    const isVisibleRef = useRef(true);

    const presenceDocRef = currentUser ? doc(db, "presence", currentUser.uid) : null;

    // Ensure presence doc exists, then add conversationId
    const activate = useCallback(async () => {
        if (!presenceDocRef || !conversationId) return;

        try {
            const snap = await getDoc(presenceDocRef);
            if (!snap.exists()) {
                await setDoc(presenceDocRef, {
                    activeConversationIds: [conversationId],
                    lastActiveAt: serverTimestamp(),
                });
            } else {
                await updateDoc(presenceDocRef, {
                    activeConversationIds: arrayUnion(conversationId),
                    lastActiveAt: serverTimestamp(),
                });
            }
        } catch (err) {
            console.error("Presence activate error:", err);
        }
    }, [presenceDocRef, conversationId]);

    // Remove conversationId and update timestamp
    const deactivate = useCallback(async () => {
        if (!presenceDocRef || !conversationId) return;

        try {
            await updateDoc(presenceDocRef, {
                activeConversationIds: arrayRemove(conversationId),
                lastActiveAt: serverTimestamp(),
            });
        } catch (err) {
            // Ignore errors on cleanup
        }
    }, [presenceDocRef, conversationId]);

    // Heartbeat: update lastActiveAt
    const sendHeartbeat = useCallback(async () => {
        if (!presenceDocRef || !isVisibleRef.current) return;

        try {
            await updateDoc(presenceDocRef, {
                lastActiveAt: serverTimestamp(),
            });
        } catch (err) {
            // Silent fail
        }
    }, [presenceDocRef]);

    useEffect(() => {
        if (!currentUser || !conversationId) return;

        // Activate on mount
        activate();

        // Start heartbeat (15s interval, only when visible)
        heartbeatRef.current = setInterval(() => {
            if (isVisibleRef.current) {
                sendHeartbeat();
            }
        }, 15_000);

        // Visibility change handler
        const onVisibilityChange = () => {
            isVisibleRef.current = document.visibilityState === "visible";
            if (isVisibleRef.current) {
                // Resume: send heartbeat immediately
                sendHeartbeat();
            }
        };
        document.addEventListener("visibilitychange", onVisibilityChange);

        // Cleanup on unmount
        return () => {
            clearInterval(heartbeatRef.current);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            deactivate();
        };
    }, [currentUser, conversationId, activate, deactivate, sendHeartbeat]);
}
