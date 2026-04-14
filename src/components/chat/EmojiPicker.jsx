import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";

const CATEGORIES = [
    {
        id: "recent",
        icon: "🕐",
        label: "Gần đây",
        emojis: [], // populated from localStorage
    },
    {
        id: "smileys",
        icon: "😊",
        label: "Mặt cười",
        emojis: [
            "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂",
            "🙂", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗",
            "😚", "😙", "🥲", "😋", "😛", "😜", "🤪", "😝",
            "🤑", "🤗", "🤭", "🫢", "🤫", "🤔", "🫡", "🤐",
            "🤨", "😐", "😑", "😶", "🫠", "😏", "😒", "🙄",
            "😬", "🤥", "🫨", "😌", "😔", "😪", "🤤", "😴",
            "😷", "🤒", "🤕", "🤢", "🤮", "🥵", "🥶", "🥴",
            "😵", "🤯", "🤠", "🥳", "🥸", "😎", "🤓", "🧐",
            "😕", "🫤", "😟", "🙁", "😮", "😯", "😲", "😳",
            "🥺", "🥹", "😦", "😧", "😨", "😰", "😥", "😢",
            "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫",
            "🥱", "😤", "😡", "😠", "🤬", "😈", "👿", "💀",
            "💩", "🤡", "👹", "👺", "👻", "👽", "🤖", "😺",
            "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾",
        ],
    },
    {
        id: "gestures",
        icon: "👋",
        label: "Cử chỉ",
        emojis: [
            "👋", "🤚", "🖐️", "✋", "🖖", "🫱", "🫲", "🫳",
            "🫴", "🫷", "🫸", "👌", "🤌", "🤏", "✌️", "🤞",
            "🫰", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕",
            "👇", "☝️", "🫵", "👍", "👎", "✊", "👊", "🤛",
            "🤜", "👏", "🙌", "🫶", "👐", "🤲", "🤝", "🙏",
            "✍️", "💅", "🤳", "💪", "🦾", "🦿", "🦵", "🦶",
            "👂", "🦻", "👃", "🧠", "🫀", "🫁", "🦷", "🦴",
            "👀", "👁️", "👅", "👄", "🫦", "👶", "🧒", "👦",
        ],
    },
    {
        id: "hearts",
        icon: "❤️",
        label: "Trái tim",
        emojis: [
            "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
            "🤎", "💔", "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓",
            "💗", "💖", "💘", "💝", "💟", "♥️", "🫶", "💑",
            "💏", "💐", "🌹", "🥀", "🌺", "🌷", "🌸", "💮",
        ],
    },
    {
        id: "objects",
        icon: "📌",
        label: "Đồ vật",
        emojis: [
            "📌", "📎", "📋", "📝", "📄", "📃", "📑", "📊",
            "📈", "📉", "🗂️", "📁", "📂", "🗓️", "📅", "📆",
            "🔔", "🔕", "📣", "📢", "🔊", "🔉", "🔈", "🔇",
            "💡", "🔦", "🏮", "🪔", "📱", "💻", "⌨️", "🖥️",
            "🖨️", "📷", "📹", "🎥", "📞", "☎️", "📟", "📠",
            "⏰", "⏱️", "⏲️", "🕐", "🕑", "🕒", "🕓", "🕔",
            "🔑", "🗝️", "🔒", "🔓", "🔏", "🔐", "🧰", "🔧",
            "📦", "📫", "📮", "✉️", "📧", "📨", "📩", "💰",
        ],
    },
    {
        id: "medical",
        icon: "🏥",
        label: "Y tế",
        emojis: [
            "🏥", "💊", "🩺", "🔬", "🧪", "🩻", "🩹", "🩸",
            "💉", "🦠", "🧬", "🩼", "🛏️", "🩰", "🧑‍⚕️", "👨‍⚕️",
            "👩‍⚕️", "♿", "🚑", "🚒", "⚕️", "🔴", "🟢", "🟡",
            "✅", "❌", "⚠️", "🚫", "⛔", "🆘", "📍", "🏁",
        ],
    },
    {
        id: "symbols",
        icon: "✅",
        label: "Ký hiệu",
        emojis: [
            "✅", "❌", "❓", "❗", "‼️", "⁉️", "💯", "🔥",
            "🎉", "🎊", "🎈", "🎁", "🏆", "🥇", "🥈", "🥉",
            "⭐", "🌟", "💫", "✨", "🌈", "☀️", "🌙", "⚡",
            "💥", "🔔", "📍", "🏁", "🚩", "📌", "📎", "🔗",
            "➡️", "⬅️", "⬆️", "⬇️", "↗️", "↘️", "↙️", "↖️",
            "🔄", "🔃", "🔀", "🔁", "🔂", "▶️", "⏸️", "⏹️",
            "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚫", "⚪",
            "🟤", "🔶", "🔷", "🔸", "🔹", "💠", "🔘", "🔲",
        ],
    },
];

const RECENT_KEY = "chat_recent_emojis";
const MAX_RECENT = 24;

function getRecentEmojis() {
    try {
        return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    } catch {
        return [];
    }
}

function addRecentEmoji(emoji) {
    const recent = getRecentEmojis().filter(e => e !== emoji);
    recent.unshift(emoji);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

export default function EmojiPicker({ onSelect, onClose }) {
    const [activeTab, setActiveTab] = useState("smileys");
    const [recentEmojis, setRecentEmojis] = useState([]);
    const containerRef = useRef(null);

    useEffect(() => {
        setRecentEmojis(getRecentEmojis());
    }, []);

    // Close on outside click
    useEffect(() => {
        const handle = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handle);
        return () => document.removeEventListener("mousedown", handle);
    }, [onClose]);

    const handleSelect = (emoji) => {
        addRecentEmoji(emoji);
        setRecentEmojis(getRecentEmojis());
        onSelect(emoji);
    };

    const activeCategory = CATEGORIES.find(c => c.id === activeTab);
    const displayEmojis = activeTab === "recent" ? recentEmojis : (activeCategory?.emojis || []);

    return (
        <div
            ref={containerRef}
            className="absolute bottom-14 left-0 right-0 mx-1 bg-white border border-gray-200 rounded-2xl shadow-xl z-30 overflow-hidden flex flex-col"
            style={{ maxHeight: "320px" }}
        >
            {/* Header with close */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-500">
                    {activeCategory?.label || "Gần đây"}
                </span>
                <button
                    onClick={onClose}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Category tabs */}
            <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-gray-100 overflow-x-auto scrollbar-hide">
                {CATEGORIES.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => setActiveTab(cat.id)}
                        className={`
                            min-w-[36px] h-8 flex items-center justify-center rounded-lg text-base
                            transition-colors flex-shrink-0
                            ${activeTab === cat.id
                                ? "bg-primary-50 ring-1 ring-primary-200"
                                : "hover:bg-gray-100"
                            }
                        `}
                        title={cat.label}
                    >
                        {cat.icon}
                    </button>
                ))}
            </div>

            {/* Emoji grid */}
            <div className="flex-1 overflow-y-auto p-1.5" style={{ maxHeight: "240px" }}>
                {displayEmojis.length === 0 ? (
                    <div className="flex items-center justify-center h-20 text-sm text-gray-400">
                        {activeTab === "recent" ? "Chưa có emoji gần đây" : "Không có emoji"}
                    </div>
                ) : (
                    <div className="grid grid-cols-8 gap-0.5">
                        {displayEmojis.map((emoji, i) => (
                            <button
                                key={`${emoji}-${i}`}
                                onClick={() => handleSelect(emoji)}
                                className="w-full aspect-square flex items-center justify-center text-xl
                                    hover:bg-gray-100 rounded-lg transition-colors active:scale-90"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
