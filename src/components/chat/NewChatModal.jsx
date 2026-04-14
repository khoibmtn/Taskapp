import { useState, useEffect } from "react";
import { X, Search, Loader2 } from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../contexts/AuthContext";

export default function NewChatModal({ onClose, onCreated }) {
    const { currentUser, userProfile } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [creating, setCreating] = useState(false);

    // Fetch all users (exclude self)
    useEffect(() => {
        (async () => {
            try {
                const snap = await getDocs(collection(db, "users"));
                const allUsers = snap.docs
                    .filter(d => d.id !== currentUser?.uid && d.data().status !== "pending")
                    .map(d => ({
                        uid: d.id,
                        fullName: d.data().fullName || d.id,
                        role: d.data().role || "",
                        departmentId: d.data().departmentId || "",
                    }));
                setUsers(allUsers);
            } catch (err) {
                console.error("Fetch users error:", err);
            } finally {
                setLoading(false);
            }
        })();
    }, [currentUser]);

    const filteredUsers = searchQuery.trim()
        ? users.filter(u => u.fullName.toLowerCase().includes(searchQuery.toLowerCase()))
        : users;

    const handleSelectUser = async (targetUser) => {
        if (creating || !currentUser) return;
        setCreating(true);

        try {
            // Deterministic DM conversation ID
            const uids = [currentUser.uid, targetUser.uid].sort();
            const convId = `dm_${uids[0]}_${uids[1]}`;

            const convRef = doc(db, "conversations", convId);
            const convSnap = await getDoc(convRef);

            if (!convSnap.exists()) {
                // Create new DM conversation
                await setDoc(convRef, {
                    type: "dm",
                    taskId: null,
                    participants: uids,
                    participantNames: {
                        [currentUser.uid]: userProfile?.fullName || "User",
                        [targetUser.uid]: targetUser.fullName,
                    },
                    lastMessage: null,
                    lastReadAt: {
                        [currentUser.uid]: serverTimestamp(),
                        [targetUser.uid]: serverTimestamp(),
                    },
                    unreadCounts: {
                        [currentUser.uid]: 0,
                        [targetUser.uid]: 0,
                    },
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
            }

            onCreated(convId);
        } catch (err) {
            console.error("Create DM error:", err);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
            <div
                className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 max-h-[70vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">Tạo cuộc trò chuyện mới</h3>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search */}
                <div className="px-4 py-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Tìm theo tên..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg
                                focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
                        />
                    </div>
                </div>

                {/* User list */}
                <div className="flex-1 overflow-y-auto px-2 pb-2">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-5 h-5 text-primary-400 animate-spin" />
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="py-8 text-center text-sm text-gray-400">
                            Không tìm thấy người dùng
                        </div>
                    ) : (
                        filteredUsers.map((user) => (
                            <button
                                key={user.uid}
                                onClick={() => handleSelectUser(user)}
                                disabled={creating}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                <div className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                                    <span className="text-primary-700 font-semibold text-sm">
                                        {user.fullName.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div className="text-left">
                                    <p className="text-sm font-medium text-gray-900">{user.fullName}</p>
                                    <p className="text-xs text-gray-400 capitalize">{user.role}</p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
