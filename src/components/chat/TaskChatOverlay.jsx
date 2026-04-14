import { X } from "lucide-react";
import ChatMessageList from "./ChatMessageList";
import ChatInput from "./ChatInput";
import { useConversation } from "../../hooks/useConversation";
import { usePresence } from "../../hooks/usePresence";
import { useSendMessage } from "../../hooks/useSendMessage";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";

/**
 * Full-screen chat overlay for mobile / Side panel for desktop.
 * Handles lazy conversation creation.
 */
export default function TaskChatOverlay({ taskId, taskTitle, participants, onClose, mode = "overlay" }) {
    const { currentUser, userProfile } = useAuth();
    const [conversationId, setConversationId] = useState(null);
    const [initializing, setInitializing] = useState(true);

    // Lazy create or find conversation
    useEffect(() => {
        if (!taskId || !currentUser) return;

        const convId = `task_${taskId}`;
        setConversationId(null);
        setInitializing(true);

        (async () => {
            try {
                const convRef = doc(db, "conversations", convId);

                // Try to read — will fail with PERMISSION_DENIED if doc doesn't exist
                // (because rules check resource.data.participants which is null for non-existent docs)
                let convExists = false;
                try {
                    const convSnap = await getDoc(convRef);
                    convExists = convSnap.exists();
                } catch {
                    // PERMISSION_DENIED → doc doesn't exist for this user, proceed to create
                    convExists = false;
                }

                if (!convExists) {
                    // Build participants list
                    const allParticipants = [...new Set(participants || [currentUser.uid])];
                    if (!allParticipants.includes(currentUser.uid)) {
                        allParticipants.push(currentUser.uid);
                    }

                    // Build participant names
                    const participantNames = {};
                    for (const uid of allParticipants) {
                        if (uid === currentUser.uid) {
                            participantNames[uid] = userProfile?.fullName || "User";
                        } else {
                            try {
                                const uDoc = await getDoc(doc(db, "users", uid));
                                participantNames[uid] = uDoc.exists() ? (uDoc.data().fullName || uid) : uid;
                            } catch {
                                participantNames[uid] = uid;
                            }
                        }
                    }

                    await setDoc(convRef, {
                        type: "task",
                        taskId: taskId,
                        participants: allParticipants,
                        participantNames,
                        lastMessage: null,
                        lastReadAt: Object.fromEntries(allParticipants.map(uid => [uid, serverTimestamp()])),
                        unreadCounts: Object.fromEntries(allParticipants.map(uid => [uid, 0])),
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                    });
                }

                setConversationId(convId);
            } catch (err) {
                console.error("TaskChatOverlay init error:", err);
            } finally {
                setInitializing(false);
            }
        })();
    }, [taskId, currentUser, userProfile]);

    // Hook subscriptions
    const { messages, loading, hasMore, loadMore } = useConversation(conversationId);
    const { sendText, sendFile, sending, uploadProgress } = useSendMessage(conversationId);
    usePresence(conversationId);

    const isOverlay = mode === "overlay";

    return (
        <div className={`
            ${isOverlay
                ? "fixed inset-0 z-50 bg-white flex flex-col"
                : "flex flex-col h-full border-l border-gray-200 bg-white"
            }
        `}>
            {/* Header */}
            <div className="flex items-center justify-between h-12 px-4 border-b border-gray-200 bg-white flex-shrink-0">
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 truncate">
                        Chat: {taskTitle || "Công việc"}
                    </h3>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Messages */}
            <ChatMessageList
                messages={messages}
                loading={loading || initializing}
                hasMore={hasMore}
                loadMore={loadMore}
            />

            {/* Input */}
            <ChatInput
                onSendText={sendText}
                onSendFile={sendFile}
                sending={sending}
                uploadProgress={uploadProgress}
            />
        </div>
    );
}
