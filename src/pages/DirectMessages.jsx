import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Search, MessageSquare } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useChatList } from "../hooks/useChatList";
import { useConversation } from "../hooks/useConversation";
import { usePresence } from "../hooks/usePresence";
import { useSendMessage } from "../hooks/useSendMessage";
import ChatMessageList from "../components/chat/ChatMessageList";
import ChatInput from "../components/chat/ChatInput";
import NewChatModal from "../components/chat/NewChatModal";

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

export default function DirectMessages() {
    const { currentUser, userProfile } = useAuth();
    const { conversationId: paramConvId } = useParams();
    const navigate = useNavigate();
    const [activeConvId, setActiveConvId] = useState(paramConvId || null);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("dm"); // 'dm' or 'task'
    const [showNewChat, setShowNewChat] = useState(false);
    const [isMobileChat, setIsMobileChat] = useState(false);

    const { conversations, loading: listLoading } = useChatList(currentUser?.uid);

    // Filter conversations based on search query AND active tab
    const filteredConversations = useMemo(() => {
        let result = conversations;
        
        // Filter by tab
        if (activeTab === "task") {
            result = result.filter(c => c.type === "task");
        } else {
            result = result.filter(c => !c.type || c.type !== "task");
        }

        // Filter by search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(c => {
                if (c.type === "task") {
                    const title = c.taskTitle || `Task #${c.taskId?.slice(0, 6) || ''}`;
                    return title.toLowerCase().includes(q);
                } else {
                    const names = Object.values(c.participantNames || {});
                    return names.some(n => n.toLowerCase().includes(q));
                }
            });
        }
        
        return result;
    }, [conversations, searchQuery, activeTab]);

    // Active conversation data
    const activeConv = conversations.find(c => c.id === activeConvId);
    const { messages, loading: msgLoading, hasMore, loadMore } = useConversation(activeConvId);
    const { sendText, sendFile, sending, uploadProgress } = useSendMessage(activeConvId);
    usePresence(activeConvId);

    // Sync URL param
    useEffect(() => {
        if (paramConvId && paramConvId !== activeConvId) {
            setActiveConvId(paramConvId);
            setIsMobileChat(true);
        }
    }, [paramConvId]);

    const handleSelectConversation = (convId) => {
        setActiveConvId(convId);
        setIsMobileChat(true);
        navigate(`/app/messages/${convId}`, { replace: true });
    };

    const handleBackToList = () => {
        setIsMobileChat(false);
        setActiveConvId(null);
        navigate("/app/messages", { replace: true });
    };

    const handleNewChatCreated = (convId) => {
        setShowNewChat(false);
        handleSelectConversation(convId);
    };

    // Get display name for conversation
    const getConversationName = (conv) => {
        if (!conv || !currentUser) return "Chat";
        // Task conversations: show task title
        if (conv.type === "task") {
            return conv.taskTitle || `Task #${conv.taskId?.slice(0, 6) || ''}`;
        }
        // DM: show other person's name
        if (!conv.participantNames) return "Chat";
        const names = Object.entries(conv.participantNames);
        const other = names.find(([uid]) => uid !== currentUser.uid);
        return other?.[1] || "Chat";
    };

    // Get active chat header info
    const activeChatName = activeConv ? getConversationName(activeConv) : "";

    return (
        <div className="h-[calc(100dvh-3.5rem-4rem-2rem)] lg:h-[calc(100dvh-3.5rem-3rem)] flex bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* ═══ Conversation List ═══ */}
            <div className={`
                w-full lg:w-80 lg:border-r border-gray-200 flex flex-col flex-shrink-0
                ${isMobileChat ? "hidden lg:flex" : "flex"}
            `}>
                {/* Header: Search + Tabs */}
                <div className="border-b border-gray-100 flex flex-col pt-3">
                    <div className="flex items-center gap-2 px-3 mb-3">
                         <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Tìm kiếm..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50
                                    focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 focus:bg-white transition-colors"
                            />
                        </div>
                        <button
                            onClick={() => setShowNewChat(true)}
                            className="p-2 rounded-lg bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors flex-shrink-0"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex px-3 gap-4">
                        <button
                            onClick={() => setActiveTab("dm")}
                            className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
                                activeTab === "dm" 
                                    ? "border-primary-500 text-primary-600" 
                                    : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                        >
                            Tin nhắn
                        </button>
                        <button
                            onClick={() => setActiveTab("task")}
                            className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
                                activeTab === "task" 
                                    ? "border-primary-500 text-primary-600" 
                                    : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                        >
                            Công việc
                        </button>
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto">
                    {listLoading ? (
                        <div className="p-4 text-center text-gray-400 text-sm">Đang tải...</div>
                    ) : filteredConversations.length === 0 ? (
                        <div className="p-8 text-center">
                            <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-400">Chưa có cuộc trò chuyện nào</p>
                            <button
                                onClick={() => setShowNewChat(true)}
                                className="mt-2 text-sm text-primary-500 hover:text-primary-600 font-medium"
                            >
                                Tạo cuộc trò chuyện mới
                            </button>
                        </div>
                    ) : (
                        filteredConversations.map((conv) => {
                            const displayName = getConversationName(conv);
                            const isActive = conv.id === activeConvId;
                            const initial = conv.type === 'task' ? 'T' : displayName.charAt(0).toUpperCase();

                            return (
                                <button
                                    key={conv.id}
                                    onClick={() => handleSelectConversation(conv.id)}
                                    className={`
                                        w-full flex items-center gap-3 px-3 py-3 text-left transition-colors
                                        ${isActive ? "bg-primary-50" : "hover:bg-gray-50"}
                                    `}
                                >
                                    <div className={`
                                        w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
                                        ${conv.type === 'task' ? 'bg-teal-100' : conv.myUnread > 0 ? 'bg-primary-100' : 'bg-gray-100'}
                                    `}>
                                        <span className={`font-semibold text-sm ${conv.type === 'task' ? 'text-teal-700' : conv.myUnread > 0 ? 'text-primary-700' : 'text-gray-500'}`}>
                                            {initial}
                                        </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <p className={`text-sm truncate ${conv.myUnread > 0 ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>
                                                {displayName}
                                            </p>
                                            <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
                                                {formatRelativeTime(conv.lastMessage?.createdAt)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between mt-0.5">
                                            <p className={`text-xs truncate ${conv.myUnread > 0 ? "text-gray-700 font-medium" : "text-gray-400"}`}>
                                                {conv.lastMessage?.text || "Chưa có tin nhắn"}
                                            </p>
                                            {conv.myUnread > 0 && (
                                                <span className="min-w-[18px] h-[18px] flex items-center justify-center bg-primary-500 text-white text-[10px] font-bold rounded-full px-1 flex-shrink-0 ml-2">
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
            </div>

            {/* ═══ Chat Area ═══ */}
            <div className={`
                flex-1 flex flex-col min-w-0
                ${!isMobileChat && !activeConvId ? "hidden lg:flex" : "flex"}
                ${isMobileChat ? "w-full" : ""}
            `}>
                {activeConvId ? (
                    <>
                        {/* Chat header */}
                        <div className="flex items-center gap-3 h-12 px-4 border-b border-gray-200 bg-white flex-shrink-0">
                            <button
                                onClick={handleBackToList}
                                className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-primary-700 font-semibold text-xs">
                                    {activeChatName.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{activeChatName}</p>
                            </div>
                        </div>

                        {/* Messages */}
                        <ChatMessageList
                            messages={messages}
                            loading={msgLoading}
                            hasMore={hasMore}
                            loadMore={loadMore}
                            conversationId={activeConvId}
                        />

                        {/* Input */}
                        <ChatInput
                            onSendText={sendText}
                            onSendFile={sendFile}
                            sending={sending}
                            uploadProgress={uploadProgress}
                        />
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-400">
                        <div className="text-center">
                            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p className="text-sm">Chọn cuộc trò chuyện để bắt đầu</p>
                        </div>
                    </div>
                )}
            </div>

            {/* New Chat Modal */}
            {showNewChat && (
                <NewChatModal
                    onClose={() => setShowNewChat(false)}
                    onCreated={handleNewChatCreated}
                />
            )}
        </div>
    );
}
