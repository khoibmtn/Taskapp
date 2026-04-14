import { MessageSquare } from "lucide-react";

export default function TaskChatIcon({ unreadCount = 0, onClick }) {
    return (
        <button
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClick?.();
            }}
            className={`
                relative p-1.5 rounded-lg transition-colors
                ${unreadCount > 0
                    ? "text-primary-600 hover:bg-primary-50"
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                }
            `}
            title="Mở chat"
        >
            <MessageSquare className="w-4 h-4" />
            {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center bg-danger-500 text-white text-[10px] font-bold rounded-full">
                    {unreadCount > 9 ? "9+" : unreadCount}
                </span>
            )}
        </button>
    );
}
