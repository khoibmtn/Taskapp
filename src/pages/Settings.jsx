import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { doc, updateDoc, runTransaction, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { CheckCircle2, User, Phone as PhoneIcon, AtSign, Loader2, Save } from "lucide-react";
import { CHAT_BG_MAP, CHAT_BG_LABELS, AVATAR_ICONS } from "../utils/themeConstants";

export default function Settings() {
    const { currentUser, userProfile } = useAuth();
    const [activeTab, setActiveTab] = useState("CHAT");
    
    // UI State
    const [isLoading, setIsLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    // Form State (Chat)
    const [taskBg, setTaskBg] = useState("default");
    const [dmBg, setDmBg] = useState("default");

    // Form State (Personal)
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [nickname, setNickname] = useState("");
    const [avatarId, setAvatarId] = useState("default_user");

    useEffect(() => {
        if (userProfile) {
            setFullName(userProfile.fullName || userProfile.displayName || "");
            setPhone(userProfile.phone || "");
            setNickname(userProfile.nickname || "");
            setAvatarId(userProfile.avatarId || "default_user");
            
            if (userProfile.chatSettings) {
                setTaskBg(userProfile.chatSettings.taskBg || "default");
                setDmBg(userProfile.chatSettings.dmBg || "default");
            }
        }
    }, [userProfile]);

    const handleSaveChatSettings = async () => {
        if (!currentUser) return;
        setIsLoading(true);
        setErrorMsg("");
        setSuccessMsg("");
        try {
            await updateDoc(doc(db, "users", currentUser.uid), {
                chatSettings: {
                    taskBg,
                    dmBg
                },
                updatedAt: serverTimestamp()
            });
            setSuccessMsg("Lưu cài đặt Chat thành công!");
            setTimeout(() => setSuccessMsg(""), 3000);
        } catch (error) {
            console.error("Error saving chat settings:", error);
            setErrorMsg("Lỗi: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const normalizePhone = (p) => {
        let cleaned = p.replace(/\s+/g, '');
        if (cleaned.startsWith('0')) {
            cleaned = '+84' + cleaned.substring(1);
        } else if (cleaned.startsWith('84')) {
            cleaned = '+' + cleaned;
        }
        return cleaned;
    };

    const handleSavePersonal = async () => {
        if (!currentUser) return;
        setIsLoading(true);
        setErrorMsg("");
        setSuccessMsg("");
        
        let finalNickname = nickname.trim().toLowerCase();
        if (finalNickname.startsWith('@')) {
            finalNickname = finalNickname.substring(1);
        }
        let finalPhone = phone.trim() ? normalizePhone(phone) : "";

        if (finalNickname) {
             if (!/^[a-z0-9_]{3,20}$/.test(finalNickname)) {
                 setErrorMsg("Nickname ít nhất 3 ký tự, chỉ gồm chữ thường, số, dấu gạch dưới.");
                 setIsLoading(false);
                 return;
             }
        } else {
             setErrorMsg("Vui lòng nhập nickname (tối thiểu 3 kí tự).");
             setIsLoading(false);
             return;
        }

        try {
            // Check absolute phone uniqueness outside transaction (safe enough for phones)
            if (finalPhone) {
                const phoneQuery = query(collection(db, "users"), where("phone", "==", finalPhone));
                const phoneDocs = await getDocs(phoneQuery);
                const isDuplicate = phoneDocs.docs.some(d => d.id !== currentUser.uid);
                if (isDuplicate) {
                    setErrorMsg("Số điện thoại này đã được tài khoản khác sử dụng.");
                    setIsLoading(false);
                    return;
                }
            }

            const currentNickname = userProfile?.nickname || "";
            
            // If nickname changed, we must run a transaction
            if (finalNickname !== currentNickname) {
                await runTransaction(db, async (transaction) => {
                    const newNicknameRef = doc(db, "nicknames", finalNickname);
                    const newNickDoc = await transaction.get(newNicknameRef);
                    if (newNickDoc.exists()) {
                        throw new Error("Nickname này đã có người sử dụng. Vui lòng chọn tên khác!");
                    }
                    
                    const userRef = doc(db, "users", currentUser.uid);
                    
                    // Claim new nickname
                    transaction.set(newNicknameRef, { uid: currentUser.uid, createdAt: serverTimestamp() });
                    
                    // Release old nickname if exists
                    if (currentNickname) {
                        const oldNicknameRef = doc(db, "nicknames", currentNickname);
                        transaction.delete(oldNicknameRef);
                    }
                    
                    // Update user
                    transaction.update(userRef, {
                        fullName: fullName.trim(),
                        displayName: fullName.trim(),
                        phone: finalPhone,
                        nickname: finalNickname,
                        avatarId: avatarId,
                        updatedAt: serverTimestamp()
                    });
                });
            } else {
                // Just update normal fields
                await updateDoc(doc(db, "users", currentUser.uid), {
                    fullName: fullName.trim(),
                    displayName: fullName.trim(),
                    phone: finalPhone,
                    avatarId: avatarId,
                    updatedAt: serverTimestamp()
                });
            }

            setSuccessMsg("Cập nhật thông tin thành công!");
            setTimeout(() => setSuccessMsg(""), 3000);

        } catch (error) {
            console.error("Error saving personal settings:", error);
            setErrorMsg(error.message || "Lỗi lưu dữ liệu.");
        } finally {
            setIsLoading(false);
        }
    };

    const renderChatPreview = (bgKey, type) => {
        const bgClass = CHAT_BG_MAP[bgKey] || CHAT_BG_MAP.default;
        return (
            <div className={`mt-3 p-4 rounded-xl border border-gray-100 ${bgClass} transition-colors min-h-[160px] flex flex-col justify-end gap-3 pointer-events-none`}>
                <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-gray-200"></div>
                    <div className="bg-white px-3 py-2 rounded-2xl rounded-tl-sm text-sm border border-gray-100 shadow-sm max-w-[80%]">
                        Chào bác sĩ, {type === 'task' ? 'mã HS 12847' : 'tài liệu hôm qua'} thế nào rồi ạ?
                    </div>
                </div>
                <div className="flex justify-end pr-2">
                    <div className="bg-primary-500 text-white px-3 py-2 rounded-2xl rounded-tr-sm text-sm shadow-sm">
                        Đã xác nhận nhé.
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col bg-gray-50/50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
                <h1 className="text-xl font-bold text-gray-800">Cài đặt</h1>
                <p className="text-sm text-gray-500 mt-1">Cấu hình sở thích và thông tin cá nhân của bạn</p>
                
                {/* Tabs */}
                <div className="flex gap-6 mt-6 border-b border-gray-100">
                    <button
                        onClick={() => setActiveTab("CHAT")}
                        className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                            activeTab === "CHAT" ? "border-primary-500 text-primary-600" : "border-transparent text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        Trò chuyện
                    </button>
                    <button
                        onClick={() => setActiveTab("PERSONAL")}
                        className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                            activeTab === "PERSONAL" ? "border-primary-500 text-primary-600" : "border-transparent text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        Cá nhân
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-3xl mx-auto space-y-6">
                    
                    {errorMsg && (
                        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm font-medium border border-red-100">
                            {errorMsg}
                        </div>
                    )}
                    {successMsg && (
                        <div className="bg-emerald-50 text-emerald-700 px-4 py-3 rounded-lg text-sm font-medium border border-emerald-100 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            {successMsg}
                        </div>
                    )}

                    {/* --- TAB CHAT --- */}
                    {activeTab === "CHAT" && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/30">
                                <h3 className="text-base font-bold text-gray-800">Giao diện tin nhắn</h3>
                                <p className="text-sm text-gray-500">Tùy biến màu nền riêng tư cho các khung hội thoại.</p>
                            </div>
                            
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Task Bg */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-3">Màu nền luồng Công Việc</label>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {Object.keys(CHAT_BG_MAP).map(key => (
                                            <button
                                                key={key}
                                                onClick={() => setTaskBg(key)}
                                                className={`w-8 h-8 rounded-full border-2 transition-all ${CHAT_BG_MAP[key]} ${
                                                    taskBg === key ? 'border-primary-500 ring-2 ring-primary-500/20 scale-110 shadow-sm' : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                                title={CHAT_BG_LABELS[key]}
                                            />
                                        ))}
                                    </div>
                                    <div className="text-xs text-gray-400 mb-2">Xem Trước:</div>
                                    {renderChatPreview(taskBg, 'task')}
                                </div>

                                {/* DM Bg */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-3">Màu nền Tin nhắn cá nhân</label>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {Object.keys(CHAT_BG_MAP).map(key => (
                                            <button
                                                key={key}
                                                onClick={() => setDmBg(key)}
                                                className={`w-8 h-8 rounded-full border-2 transition-all ${CHAT_BG_MAP[key]} ${
                                                    dmBg === key ? 'border-primary-500 ring-2 ring-primary-500/20 scale-110 shadow-sm' : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                                title={CHAT_BG_LABELS[key]}
                                            />
                                        ))}
                                    </div>
                                    <div className="text-xs text-gray-400 mb-2">Xem Trước:</div>
                                    {renderChatPreview(dmBg, 'dm')}
                                </div>
                            </div>

                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                                <button
                                    onClick={handleSaveChatSettings}
                                    disabled={isLoading}
                                    className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 focus:ring-4 focus:ring-primary-500/20 transition-all disabled:opacity-50"
                                >
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Lưu thay đổi
                                </button>
                            </div>
                        </div>
                    )}

                    {/* --- TAB PERSONAL --- */}
                    {activeTab === "PERSONAL" && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/30">
                                <h3 className="text-base font-bold text-gray-800">Thông tin cá nhân</h3>
                                <p className="text-sm text-gray-500">Quản lý cách hiển thị của bạn đối với mọi người.</p>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Avatar Picker */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-3">Biểu tượng ảnh đại diện (Avatar)</label>
                                    <div className="grid grid-cols-5 md:grid-cols-10 gap-3">
                                        {AVATAR_ICONS.map(item => {
                                            const Icon = item.icon;
                                            const isSelected = avatarId === item.id;
                                            return (
                                                <button
                                                    key={item.id}
                                                    onClick={() => setAvatarId(item.id)}
                                                    title={item.label}
                                                    className={`
                                                        aspect-square rounded-xl flex items-center justify-center transition-all border-2
                                                        ${isSelected ? `border-primary-500 ring-2 ring-primary-500/20 bg-primary-50 shadow-sm ${item.color}` : `border-gray-100 hover:border-gray-200 ${item.bg} ${item.color} opacity-70 hover:opacity-100`}
                                                    `}
                                                >
                                                    <Icon className="w-6 h-6" />
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                <hr className="border-gray-100" />

                                {/* Form Inputs */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                                            Họ và tên
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <User className="h-4 w-4 text-gray-400" />
                                            </div>
                                            <input
                                                type="text"
                                                value={fullName}
                                                onChange={(e) => setFullName(e.target.value)}
                                                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 bg-gray-50 focus:bg-white transition-colors"
                                                placeholder="Nguyễn Văn A"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                                            Số điện thoại
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <PhoneIcon className="h-4 w-4 text-gray-400" />
                                            </div>
                                            <input
                                                type="text"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 bg-gray-50 focus:bg-white transition-colors"
                                                placeholder="09..."
                                            />
                                        </div>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                                            Nickname / Username (Định danh duy nhất)
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <AtSign className="h-4 w-4 text-gray-400" />
                                            </div>
                                            <input
                                                type="text"
                                                value={nickname}
                                                onChange={(e) => setNickname(e.target.value)}
                                                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 bg-gray-50 focus:bg-white transition-colors font-medium text-gray-900 lowercase"
                                                placeholder="nickname"
                                            />
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1.5 ml-1">
                                            Dài từ 3-20 kí tự, gồm chữ thường, số, không có dấu cách hoặc kí tự đặc biệt. Dùng để đăng nhập hoặc tag tên. Nếu không có nickname thì hệ thống sẽ tag (@) bằng chính họ tên của bạn.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                                <button
                                    onClick={handleSavePersonal}
                                    disabled={isLoading}
                                    className="flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 focus:ring-4 focus:ring-primary-500/20 transition-all disabled:opacity-50"
                                >
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Cập nhật thông tin
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
