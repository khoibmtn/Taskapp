import { useState, useRef } from "react";
import { Send, Paperclip, X, Loader2, Image as ImageIcon, FileText } from "lucide-react";

const ALLOWED_TYPES = [
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
];
const MAX_SIZE = 5 * 1024 * 1024;

export default function ChatInput({ onSendText, onSendFile, sending, uploadProgress }) {
    const [text, setText] = useState("");
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [error, setError] = useState("");
    const fileInputRef = useRef(null);

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
            return;
        }

        if (text.trim()) {
            try {
                await onSendText(text);
                setText("");
            } catch (err) {
                setError(err.message || "Gửi tin nhắn thất bại");
            }
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

        // Create preview for images
        if (file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = (e) => setFilePreview(e.target.result);
            reader.readAsDataURL(file);
        } else {
            setFilePreview(null);
        }

        // Clear input
        e.target.value = "";
    };

    const clearFile = () => {
        setSelectedFile(null);
        setFilePreview(null);
        setError("");
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const isImage = selectedFile?.type?.startsWith("image/");

    return (
        <div className="border-t border-gray-200 bg-white">
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

                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
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
