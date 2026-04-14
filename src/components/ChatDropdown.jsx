import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, ClipboardList } from "lucide-react";

function formatRelativeTime(timestamp) {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    if (diff < 60_000) return "Vừa xong";
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}p`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h`;
    return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

/**
 * Chat dropdown for header — shows recent conversations.
 * DM click → /app/messages/:id
 * Task click → /app?openChat=taskId (Dashboard opens panel)
 */
export default function ChatDropdown({ conversations, totalUnread, currentUid }) {
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close on outside click
    useEffect(() => {
        const handle = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handle);
        return () => document.removeEventListener("mousedown", handle);
    }, []);

    const handleToggle = () => setIsOpen(!isOpen);

    const getDisplayName = (conv) => {
        if (conv.type === "task") {
            return conv.taskTitle || `Task #${conv.taskId?.slice(0, 6) || ""}`;
        }
        if (!conv.participantNames || !currentUid) return "Chat";
        const other = Object.entries(conv.participantNames).find(([uid]) => uid !== currentUid);
        return other?.[1] || "Chat";
    };

    const handleConvClick = (conv) => {
        setIsOpen(false);

        if (conv.type === "task" && conv.taskId) {
            // Navigate to Dashboard with openChat param → Dashboard opens chat panel
            navigate(`/app?openChat=${conv.taskId}`);
        } else {
            // DM → open messages page with this conversation
            navigate(`/app/messages/${conv.id}`);
        }
    };

    // Show max 8 recent conversations
    const displayConvs = conversations.slice(0, 8);

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Chat icon button */}
            <button
                onClick={handleToggle}
                className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            >
                <MessageSquare className="w-5 h-5" />
                {totalUnread > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center bg-primary-500 text-white text-[10px] font-bold rounded-full">
                        {totalUnread > 9 ? "9+" : totalUnread}
                    </span>
                )}
            </button>

            {/* Dropdown panel */}
            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <h3 className="font-semibold text-gray-900 text-sm">Tin nhắn</h3>
                        {totalUnread > 0 && (
                            <span className="px-2 py-0.5 bg-primary-50 text-primary-600 text-xs font-bold rounded-full">
                                {totalUnread} mới
                            </span>
                        )}
                    </div>

                    {/* Conversation list */}
                    <div className="max-h-80 overflow-y-auto">
                        {displayConvs.length === 0 ? (
                            <div className="py-8 text-center text-sm text-gray-400">
                                Chưa có tin nhắn nào
                            </div>
                        ) : (
                            displayConvs.map((conv) => {
                                const name = getDisplayName(conv);
                                const isTask = conv.type === "task";
                                const hasUnread = conv.myUnread > 0;

                                return (
                                    <button
                                        key={conv.id}
                                        onClick={() => handleConvClick(conv)}
                                        className={`
                                            w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                                            ${hasUnread ? "bg-primary-50/60 hover:bg-primary-50" : "hover:bg-gray-50"}
                                        `}
                                    >
                                        {/* Avatar / Icon */}
                                        <div className={`
                                            w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0
                                            ${isTask
                                                ? "bg-teal-100"
                                                : hasUnread ? "bg-primary-100" : "bg-gray-100"
                                            }
                                        `}>
                                            {isTask ? (
                                                <ClipboardList className="w-4 h-4 text-teal-600" />
                                            ) : (
                                                <span className={`font-semibold text-xs ${hasUnread ? "text-primary-700" : "text-gray-500"}`}>
                                                    {name.charAt(0).toUpperCase()}
                                                </span>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className={`text-sm truncate ${hasUnread ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>
                                                    {name}
                                                </p>
                                                <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
                                                    {formatRelativeTime(conv.lastMessage?.createdAt || conv.updatedAt)}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between mt-0.5">
                                                <p className={`text-xs truncate max-w-[180px] ${hasUnread ? "text-gray-700 font-medium" : "text-gray-400"}`}>
                                                    {conv.lastMessage?.text || (isTask ? "Chat công việc" : "Chưa có tin nhắn")}
                                                </p>
                                                {hasUnread && (
                                                    <span className="min-w-[18px] h-[18px] flex items-center justify-center bg-primary-500 text-white text-[10px] font-bold rounded-full px-1 flex-shrink-0 ml-1">
                                                        {conv.myUnread > 9 ? "9+" : conv.myUnread}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Footer — view all */}
                    <div className="border-t border-gray-100">
                        <button
                            onClick={() => { setIsOpen(false); navigate("/app/messages"); }}
                            className="w-full py-2.5 text-center text-sm text-primary-500 hover:bg-primary-50 font-medium transition-colors"
                        >
                            Xem tất cả tin nhắn
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
