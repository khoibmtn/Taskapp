import { Loader2, AlertTriangle, RotateCcw } from "lucide-react";
import AttachmentPreview from "./AttachmentPreview";

function formatTime(timestamp) {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export default function ChatBubble({ message, isOwn, onRetry }) {
    const { text, senderName, type, attachments, isDeleted, createdAt, clientCreatedAt } = message;

    // Optimistic state detection: no createdAt (server) = still sending
    const isSending = !createdAt;
    const isFailed = message._failed;

    if (isDeleted) {
        return (
            <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-2`}>
                <div className="max-w-[75%] px-3 py-2 rounded-2xl bg-gray-100 text-gray-400 italic text-sm">
                    Tin nhắn đã bị thu hồi
                </div>
            </div>
        );
    }

    const time = formatTime(createdAt || clientCreatedAt);

    return (
        <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-2`}>
            <div className={`max-w-[75%] ${isOwn ? "order-2" : ""}`}>
                {/* Sender name (only for received messages) */}
                {!isOwn && (
                    <p className="text-xs text-gray-500 mb-0.5 ml-3">{senderName}</p>
                )}

                <div
                    className={`
                        px-3.5 py-2 rounded-2xl text-sm leading-relaxed
                        ${isOwn
                            ? "bg-primary-500 text-white rounded-br-md"
                            : "bg-gray-100 text-gray-900 rounded-bl-md"
                        }
                    `}
                >
                    {/* Attachments */}
                    {attachments?.length > 0 && (
                        <div className="space-y-2 mb-1">
                            {attachments.map((att, i) => (
                                <AttachmentPreview
                                    key={i}
                                    attachment={att}
                                    isImage={type === "image"}
                                />
                            ))}
                        </div>
                    )}

                    {/* Text content */}
                    {text && <p className="whitespace-pre-wrap break-words">{text}</p>}
                </div>

                {/* Footer: time + status */}
                <div className={`flex items-center gap-1.5 mt-0.5 ${isOwn ? "justify-end mr-1" : "ml-3"}`}>
                    <span className="text-[10px] text-gray-400">{time}</span>

                    {isOwn && isSending && !isFailed && (
                        <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
                    )}

                    {isOwn && isFailed && (
                        <button
                            onClick={() => onRetry?.(message)}
                            className="flex items-center gap-0.5 text-danger-500 hover:text-danger-600"
                        >
                            <AlertTriangle className="w-3 h-3" />
                            <RotateCcw className="w-3 h-3" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
