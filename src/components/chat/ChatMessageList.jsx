import { useRef, useEffect, useCallback } from "react";
import ChatBubble from "./ChatBubble";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

export default function ChatMessageList({ messages, loading, hasMore, loadMore, conversationId }) {
    const { currentUser } = useAuth();
    const bottomRef = useRef(null);
    const containerRef = useRef(null);
    const prevLengthRef = useRef(0);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (messages.length > prevLengthRef.current) {
            bottomRef.current?.scrollIntoView({ behavior: messages.length - prevLengthRef.current === 1 ? "smooth" : "auto" });
        }
        prevLengthRef.current = messages.length;
    }, [messages.length]);

    // Scroll to bottom on initial load
    useEffect(() => {
        if (!loading && messages.length > 0) {
            bottomRef.current?.scrollIntoView({ behavior: "auto" });
        }
    }, [loading]);

    // Infinite scroll up — load older messages
    const handleScroll = useCallback(() => {
        const container = containerRef.current;
        if (!container || !hasMore) return;
        if (container.scrollTop < 60) {
            loadMore();
        }
    }, [hasMore, loadMore]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
            </div>
        );
    }

    if (messages.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                Chưa có tin nhắn nào. Hãy bắt đầu cuộc trò chuyện!
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5"
        >
            {hasMore && (
                <div className="text-center py-2">
                    <button
                        onClick={loadMore}
                        className="text-xs text-primary-500 hover:text-primary-600 font-medium"
                    >
                        Tải tin nhắn cũ hơn
                    </button>
                </div>
            )}

            {messages.map((msg) => (
                <ChatBubble
                    key={msg.id || msg.clientMessageId}
                    message={msg}
                    isOwn={msg.senderUid === currentUser?.uid}
                    conversationId={conversationId}
                />
            ))}

            <div ref={bottomRef} />
        </div>
    );
}
