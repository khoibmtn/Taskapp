import { useState, useRef, useEffect, useMemo } from "react";
import { Send, Paperclip, X, Loader2, Image as ImageIcon, FileText, Smile } from "lucide-react";
import EmojiPicker from "./EmojiPicker";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase";

const ALLOWED_TYPES = [
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
];
const MAX_SIZE = 5 * 1024 * 1024;

function ChatInput({ onSendText, onSendFile, sending, uploadProgress }) {
    const [text, setText] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [error, setError] = useState("");
    const [allUsers, setAllUsers] = useState([]);
    const [mentionState, setMentionState] = useState(null); // { query: string, startIdx: number }
    const [mentionIndex, setMentionIndex] = useState(0);
    const fileInputRef = useRef(null);
    const textareaRef = useRef(null);
    const listRef = useRef(null);

    // Fetch users for mentions on mount
    useEffect(() => {
        getDocs(collection(db, "users")).then(snap => {
            setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }).catch(err => console.error("Failed to load users for mentions", err));
    }, []);

    // Focus textarea on mount
    useEffect(() => {
        textareaRef.current?.focus();
    }, []);

    // Filter users based on query
    const filteredMentions = useMemo(() => {
        if (!mentionState) return [];
        const q = mentionState.query.trim().toLowerCase();
        return allUsers.filter(u => {
            const fn = (u.fullName || "").toLowerCase();
            const nn = (u.nickname || "").toLowerCase();
            return fn.includes(q) || nn.includes(q);
        }).slice(0, 10);
    }, [mentionState, allUsers]);

    // Keep highlighted index in bounds
    useEffect(() => {
        if (mentionIndex >= filteredMentions.length) {
            setMentionIndex(Math.max(0, filteredMentions.length - 1));
        }
    }, [filteredMentions.length, mentionIndex]);

    // Auto scroll list
    useEffect(() => {
        if (listRef.current) {
            const activeEl = listRef.current.children[mentionIndex];
            if (activeEl) {
                activeEl.scrollIntoView({ block: "nearest" });
            }
        }
    }, [mentionIndex]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (selectedFile) {
            try {
                await onSendFile(selectedFile);
                setSelectedFile(null);
                setFilePreview(null);
            } catch (err) {
                setError(err.message || "Gửi file thất bại");
            }
            setTimeout(() => textareaRef.current?.focus(), 50);
            return;
        }

        if (text.trim()) {
            try {
                // Extract mentions
                const activeMentions = [];
                if (text.includes('@')) {
                    allUsers.forEach(u => {
                        const tag = `@${u.nickname || (u.fullName || 'User').replace(/\s+/g, '')}`;
                        if (text.includes(tag)) {
                            activeMentions.push({
                                uid: u.id,
                                nickname: u.nickname || null,
                                fullName: u.fullName || 'User'
                            });
                        }
                    });
                }

                await onSendText(text, activeMentions);
                setText("");
            } catch (err) {
                setError(err.message || "Gửi tin nhắn thất bại");
            }
            setTimeout(() => textareaRef.current?.focus(), 50);
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setError("");

        if (!ALLOWED_TYPES.includes(file.type)) {
            setError("Loại file không hỗ trợ");
            return;
        }
        if (file.size > MAX_SIZE) {
            setError("File quá lớn (tối đa 5MB)");
            return;
        }

        setSelectedFile(file);
        if (file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = (e) => setFilePreview(e.target.result);
            reader.readAsDataURL(file);
        } else {
            setFilePreview(null);
        }
        e.target.value = "";
    };

    const clearFile = () => {
        setSelectedFile(null);
        setFilePreview(null);
        setError("");
    };

    const selectMention = (user) => {
        if (!mentionState) return;
        const tag = user.nickname ? user.nickname : (user.fullName || "User").replace(/\s+/g, "");
        const before = text.slice(0, mentionState.startIdx - 1); // remove '@'
        const insert = `@${tag} `;
        
        // Find where the query ends by finding cursor position or just replacing up to current text end
        const cursor = textareaRef.current?.selectionStart || text.length;
        const after = text.slice(cursor);

        const newText = before + insert + after;
        setText(newText);
        setMentionState(null);
        setMentionIndex(0);
        
        setTimeout(() => {
            textareaRef.current?.focus();
            const newPos = before.length + insert.length;
            textareaRef.current?.setSelectionRange(newPos, newPos);
        }, 50);
    };

    const handleKeyDown = (e) => {
        if (mentionState && filteredMentions.length > 0) {
            if (e.key === "ArrowUp") {
                e.preventDefault();
                setMentionIndex(prev => (prev > 0 ? prev - 1 : filteredMentions.length - 1));
                return;
            }
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setMentionIndex(prev => (prev < filteredMentions.length - 1 ? prev + 1 : 0));
                return;
            }
            if (e.key === "Enter") {
                e.preventDefault();
                selectMention(filteredMentions[mentionIndex]);
                return;
            }
            if (e.key === "Escape") {
                e.preventDefault();
                setMentionState(null);
                return;
            }
        }

        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const handleChange = (e) => {
        const val = e.target.value;
        setText(val);
        
        const cursorPos = e.target.selectionStart;
        const textBeforeCursor = val.slice(0, cursorPos);
        const match = textBeforeCursor.match(/(?:^|\s)@([^@\s]*)$/);

        if (match) {
            setMentionState({ query: match[1], startIdx: cursorPos - match[1].length });
            setShowEmoji(false);
        } else {
            setMentionState(null);
            setMentionIndex(0);
        }
    };

    const handleEmojiSelect = (emoji) => {
        setText(prev => prev + emoji);
        textareaRef.current?.focus();
    };

    const isImage = selectedFile?.type?.startsWith("image/");

    return (
        <div className="border-t border-gray-200 bg-white relative">
            {/* File preview */}
            {selectedFile && (
                <div className="px-3 pt-2">
                    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                        {filePreview ? (
                            <img src={filePreview} alt="" className="w-12 h-12 rounded object-cover" />
                        ) : (
                            <div className="w-12 h-12 rounded bg-primary-50 flex items-center justify-center">
                                {isImage
                                    ? <ImageIcon className="w-5 h-5 text-primary-500" />
                                    : <FileText className="w-5 h-5 text-primary-500" />
                                }
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700 truncate">{selectedFile.name}</p>
                            <p className="text-xs text-gray-500">
                                {(selectedFile.size / 1024).toFixed(0)} KB
                            </p>
                        </div>
                        <button onClick={clearFile} className="p-1 text-gray-400 hover:text-gray-600">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Upload progress */}
            {sending && uploadProgress > 0 && (
                <div className="px-3 pt-1">
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary-500 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Error message */}
            {error && (
                <div className="px-3 pt-1">
                    <p className="text-xs text-danger-500">{error}</p>
                </div>
            )}

            {/* Emoji picker (positioned above input) */}
            {showEmoji && (
                <EmojiPicker
                    onSelect={handleEmojiSelect}
                    onClose={() => setShowEmoji(false)}
                />
            )}

            {/* Mention Suggestions Popup */}
            {mentionState && filteredMentions.length > 0 && (
                <div className="absolute bottom-full left-0 w-full md:w-80 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-t-xl shadow-lg z-50 mb-1" ref={listRef}>
                    {filteredMentions.map((u, i) => (
                        <div
                            key={u.id}
                            className={`flex items-center gap-3 p-2.5 cursor-pointer ${i === mentionIndex ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                            onMouseEnter={() => setMentionIndex(i)}
                            onClick={() => selectMention(u)}
                        >
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center flex-shrink-0 text-primary-700 font-medium text-xs">
                                {u.fullName?.charAt(0)?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate">{u.fullName}</p>
                                <p className="text-xs text-gray-500 truncate">
                                    @{u.nickname || (u.fullName || '').replace(/\s+/g, '')}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Input area */}
            <form onSubmit={handleSubmit} className="flex items-end gap-1.5 p-2">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={ALLOWED_TYPES.join(",")}
                    className="hidden"
                    onChange={handleFileSelect}
                />

                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending}
                    className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors disabled:opacity-50"
                >
                    <Paperclip className="w-5 h-5" />
                </button>

                <button
                    type="button"
                    onClick={() => setShowEmoji(!showEmoji)}
                    disabled={sending}
                    className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                        showEmoji ? 'text-primary-500 bg-primary-50' : 'text-gray-400 hover:text-primary-500 hover:bg-primary-50'
                    }`}
                >
                    <Smile className="w-5 h-5" />
                </button>

                <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder={selectedFile ? "Thêm mô tả (tùy chọn)..." : "Nhập tin nhắn..."}
                    disabled={sending}
                    rows={1}
                    className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm
                        focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400
                        disabled:opacity-50 max-h-24 min-h-[40px]"
                    style={{ height: "40px" }}
                    onInput={(e) => {
                        e.target.style.height = "40px";
                        e.target.style.height = Math.min(e.target.scrollHeight, 96) + "px";
                    }}
                />

                <button
                    type="submit"
                    disabled={sending || (!text.trim() && !selectedFile)}
                    className="p-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600
                        disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-w-[40px] min-h-[40px]
                        flex items-center justify-center"
                >
                    {sending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <Send className="w-5 h-5" />
                    )}
                </button>
            </form>
        </div>
    );
}

import React from "react";
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <div className="text-red-500 bg-red-100 p-2 text-xs break-words">ChatInput Error: {this.state.error.message}</div>;
    }
    return this.props.children;
  }
}

export default function ChatInputWithErrorBoundary(props) {
  return <ErrorBoundary><ChatInput {...props} /></ErrorBoundary>;
}
