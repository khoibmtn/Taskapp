import { useState, useRef, useEffect } from "react";
import { Loader2, AlertTriangle, RotateCcw, Trash2, CornerUpLeft } from "lucide-react";
import AttachmentPreview from "./AttachmentPreview";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase";

function formatTime(timestamp) {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export default function ChatBubble({ message, isOwn, conversationId, onRetry }) {
    const { text, senderName, type, attachments, isDeleted, createdAt, clientCreatedAt } = message;
    const [showMenu, setShowMenu] = useState(false);
    const [confirming, setConfirming] = useState(null); // "delete" | "recall" | null
    const menuRef = useRef(null);

    // Optimistic state detection: no createdAt (server) = still sending
    const isSending = !createdAt;
    const isFailed = message._failed;

    // Close menu on outside click
    useEffect(() => {
        const handleClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setShowMenu(false);
                setConfirming(null);
            }
        };
        if (showMenu) document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [showMenu]);

    // Can recall within 5 minutes of sending
    const canRecall = isOwn && createdAt && (() => {
        const sentTime = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
        return (Date.now() - sentTime.getTime()) < 5 * 60 * 1000;
    })();

    const handleRecall = async () => {
        if (!conversationId || !message.id) return;
        try {
            const msgRef = doc(db, "conversations", conversationId, "messages", message.id);
            await updateDoc(msgRef, { isDeleted: true, text: null, attachments: null });
        } catch (err) {
            console.error("Recall error:", err);
        }
        setShowMenu(false);
        setConfirming(null);
    };

    const handleDelete = async () => {
        if (!conversationId || !message.id) return;
        try {
            const msgRef = doc(db, "conversations", conversationId, "messages", message.id);
            await deleteDoc(msgRef);
        } catch (err) {
            console.error("Delete error:", err);
        }
        setShowMenu(false);
        setConfirming(null);
    };

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
        <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-2 group`}>
            <div className={`max-w-[75%] ${isOwn ? "order-2" : ""} relative`} ref={menuRef}>
                {/* Sender name (only for received messages) */}
                {!isOwn && (
                    <p className="text-xs text-gray-500 mb-0.5 ml-3">{senderName}</p>
                )}

                <div
                    className={`
                        px-3.5 py-2 rounded-2xl text-sm leading-relaxed cursor-pointer select-none
                        ${isOwn
                            ? "bg-primary-500 text-white rounded-br-md"
                            : "bg-gray-100 text-gray-900 rounded-bl-md"
                        }
                    `}
                    onContextMenu={(e) => {
                        if (isOwn && !isSending) {
                            e.preventDefault();
                            setShowMenu(true);
                        }
                    }}
                    onClick={() => {
                        if (isOwn && !isSending && !showMenu) {
                            setShowMenu(true);
                        }
                    }}
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

                {/* Context menu for own messages */}
                {showMenu && isOwn && (
                    <div className={`absolute ${isOwn ? 'right-0' : 'left-0'} bottom-full mb-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden min-w-[140px]`}>
                        {confirming ? (
                            <div className="p-2">
                                <p className="text-xs text-gray-500 mb-2 px-1">
                                    {confirming === "recall" ? "Thu hồi tin nhắn?" : "Xóa vĩnh viễn?"}
                                </p>
                                <div className="flex gap-1">
                                    <button
                                        onClick={confirming === "recall" ? handleRecall : handleDelete}
                                        className="flex-1 px-2 py-1.5 text-xs font-medium text-white bg-danger-500 rounded-lg hover:bg-danger-600"
                                    >
                                        Xác nhận
                                    </button>
                                    <button
                                        onClick={() => setConfirming(null)}
                                        className="flex-1 px-2 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
                                    >
                                        Hủy
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {canRecall && (
                                    <button
                                        onClick={() => setConfirming("recall")}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                        <CornerUpLeft className="w-4 h-4" />
                                        Thu hồi
                                    </button>
                                )}
                                <button
                                    onClick={() => setConfirming("delete")}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger-500 hover:bg-danger-50"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Xóa
                                </button>
                            </>
                        )}
                    </div>
                )}

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
