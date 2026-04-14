import { useState, useCallback } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ALLOWED_FILE_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function generateId() {
    return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Hook for sending text messages and file/image attachments.
 * Implements upload-first flow with auto-retry (max 2 attempts).
 */
export function useSendMessage(conversationId) {
    const { currentUser, userProfile } = useAuth();
    const [sending, setSending] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const messagesRef = conversationId
        ? collection(db, "conversations", conversationId, "messages")
        : null;

    // Send a text message
    const sendText = useCallback(async (text) => {
        if (!messagesRef || !text.trim() || !currentUser) return;

        setSending(true);
        try {
            await addDoc(messagesRef, {
                clientMessageId: generateId(),
                text: text.trim(),
                senderUid: currentUser.uid,
                senderName: userProfile?.fullName || "User",
                type: "text",
                attachments: [],
                createdAt: serverTimestamp(),
                clientCreatedAt: Date.now(),
                isDeleted: false,
                deletedAt: null,
            });
        } catch (err) {
            console.error("sendText error:", err);
            throw err;
        } finally {
            setSending(false);
        }
    }, [messagesRef, currentUser, userProfile]);

    // Upload a file to Storage, then create message doc
    const sendFile = useCallback(async (file) => {
        if (!messagesRef || !file || !currentUser) return;

        // Validate
        const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
        const isFile = ALLOWED_FILE_TYPES.includes(file.type);
        if (!isImage && !isFile) {
            throw new Error(`Loại file không được hỗ trợ: ${file.type}`);
        }
        if (file.size > MAX_FILE_SIZE) {
            throw new Error(`File quá lớn (tối đa ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
        }

        setSending(true);
        setUploadProgress(0);

        const clientMessageId = generateId();
        const storagePath = `chat-attachments/${conversationId}/${clientMessageId}/${file.name}`;
        const storageRef = ref(storage, storagePath);

        // Upload with retry (max 2 attempts)
        let downloadURL;
        let lastError;

        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                downloadURL = await new Promise((resolve, reject) => {
                    const uploadTask = uploadBytesResumable(storageRef, file);

                    uploadTask.on("state_changed",
                        (snapshot) => {
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            setUploadProgress(Math.round(progress));
                        },
                        (error) => reject(error),
                        async () => {
                            try {
                                const url = await getDownloadURL(uploadTask.snapshot.ref);
                                resolve(url);
                            } catch (err) {
                                reject(err);
                            }
                        }
                    );
                });
                break; // Success — exit retry loop
            } catch (err) {
                lastError = err;
                console.warn(`Upload attempt ${attempt + 1} failed:`, err);
                if (attempt === 1) throw lastError;
            }
        }

        // Upload succeeded — create message document (atomic guarantee)
        try {
            await addDoc(messagesRef, {
                clientMessageId,
                text: "",
                senderUid: currentUser.uid,
                senderName: userProfile?.fullName || "User",
                type: isImage ? "image" : "file",
                attachments: [{
                    name: file.name,
                    url: downloadURL,
                    size: file.size,
                    contentType: file.type,
                }],
                createdAt: serverTimestamp(),
                clientCreatedAt: Date.now(),
                isDeleted: false,
                deletedAt: null,
            });
        } catch (err) {
            console.error("sendFile message creation error:", err);
            throw err;
        } finally {
            setSending(false);
            setUploadProgress(0);
        }
    }, [messagesRef, conversationId, currentUser, userProfile]);

    return { sendText, sendFile, sending, uploadProgress };
}
