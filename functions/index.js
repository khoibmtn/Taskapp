const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

admin.initializeApp();

// Named database where all app data (users, tasks, notifications, etc.) lives
const taskDb = getFirestore(admin.app(), "taskapp");
const fcm = admin.messaging();

/**
 * Gửi thông báo đến 1 user (cả In-app và Push)
 */
async function sendNotificationToUser(uid, payload, taskId) {
    if (!uid) return;

    try {
        // 1. Lưu vào collection 'notifications' (In-app) — phải dùng taskDb
        await taskDb.collection("notifications").add({
            toUid: uid,
            fromUid: payload.fromUid || "system",
            fromName: payload.fromName || "Hệ thống",
            fromAvatar: payload.fromAvatar || "",
            taskId: taskId || "",
            type: payload.type || "system",
            title: payload.title,
            body: payload.body,
            isRead: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // 2. Lấy FCM Tokens của user — phải dùng taskDb
        const userDoc = await taskDb.collection("users").doc(uid).get();
        if (!userDoc.exists) return;

        const userData = userDoc.data();
        const tokens = userData.fcmTokens || [];

        if (tokens.length > 0) {
            const message = {
                notification: {
                    title: payload.title,
                    body: payload.body
                },
                tokens: tokens,
                webpush: {
                    headers: {
                        Urgency: "high",
                        TTL: "86400"
                    },
                    notification: {
                        icon: "/logo192.png",
                        badge: "/logo192.png",
                        vibrate: [200, 100, 200],
                        renotify: true,
                        tag: taskId || "general",
                        requireInteraction: true
                    },
                    fcm_options: {
                        link: taskId ? `/app/tasks/${taskId}` : "/app"
                    }
                }
            };

            const response = await fcm.sendEachForMulticast(message);
            console.log(`Sent ${response.successCount}/${tokens.length} messages to ${uid}`);

            // Clean up invalid tokens
            const invalidTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const code = resp.error?.code;
                    if (code === "messaging/invalid-registration-token" ||
                        code === "messaging/registration-token-not-registered") {
                        invalidTokens.push(tokens[idx]);
                    }
                }
            });

            if (invalidTokens.length > 0) {
                const { FieldValue } = require("firebase-admin/firestore");
                await taskDb.collection("users").doc(uid).update({
                    fcmTokens: FieldValue.arrayRemove(...invalidTokens)
                });
                console.log(`Removed ${invalidTokens.length} invalid tokens for ${uid}`);
            }
        }
    } catch (error) {
        console.error(`Error sending notification to ${uid}:`, error);
    }
}

/**
 * Trigger: Khi tạo Task mới (trong named database "taskapp")
 */
exports.onTaskCreated = onDocumentCreated(
    { document: "tasks/{taskId}", database: "taskapp" },
    async (event) => {
        const taskData = event.data.data();

        // Template gốc không cần thông báo (Instance sinh ra từ template sẽ làm nhiệm vụ này)
        if (taskData.isRecurringTemplate) return;

        const taskId = event.params.taskId;
        const taskTitle = taskData.title;
        const deptId = taskData.departmentId;

        const creatorDoc = await taskDb.collection("users").doc(taskData.createdBy).get();
        const creatorName = creatorDoc.exists ? (creatorDoc.data().fullName || "Ai đó") : "Ai đó";
        const creatorAvatar = creatorDoc.exists ? (creatorDoc.data().photoURL || "") : "";

        const payload = {
            type: "task_created",
            fromUid: taskData.parentTaskId ? "system" : taskData.createdBy,
            fromName: taskData.parentTaskId ? "Hệ thống tự động" : creatorName,
            fromAvatar: taskData.parentTaskId ? "" : creatorAvatar,
            title: taskData.parentTaskId ? "Lịch định kỳ" : "Có công việc mới",
            body: taskData.parentTaskId 
                ? `Đến lịch yêu cầu thực hiện công việc "${taskTitle}".`
                : `${creatorName} vừa giao việc "${taskTitle}" cho bạn.`
        };

        // 1. Tìm tất cả Admin
        const adminSnap = await taskDb.collection("users").where("role", "==", "admin").get();
        const adminUids = adminSnap.docs.map(doc => doc.id);

        // 2. Tìm Manager của khoa/phòng
        const managerSnap = await taskDb.collection("users")
            .where("departmentId", "==", deptId)
            .where("role", "==", "manager")
            .get();
        const managerUids = managerSnap.docs.map(doc => doc.id);

        // 3. Danh sách Assignees
        const assignees = taskData.assignees || {};
        const assigneeUids = Object.keys(assignees);

        // Gộp danh sách nhận (Loại trùng)
        const allRecipients = new Set([...adminUids, ...managerUids, ...assigneeUids]);

        // Nếu tạo THỦ CÔNG (không phải hệ thống sinh ra từ Cron định kỳ):
        // Loại bỏ người tạo khỏi danh sách, tránh việc tự nhắc mình khi chính mình vừa ấn giao việc.
        if (!taskData.parentTaskId && taskData.createdBy) {
            allRecipients.delete(taskData.createdBy);
        }

        const notificationPromises = [];
        allRecipients.forEach(uid => {
            notificationPromises.push(sendNotificationToUser(uid, payload, taskId));
        });

        return Promise.all(notificationPromises);
    }
);

/**
 * Trigger: Khi cập nhật Task (Duyệt / Từ chối / Đề nghị hoàn thành)
 */
exports.onTaskUpdated = onDocumentUpdated(
    { document: "tasks/{taskId}", database: "taskapp" },
    async (event) => {
        const beforeData = event.data.before.data();
        const afterData = event.data.after.data();
        const taskId = event.params.taskId;
        const taskTitle = afterData.title;

        const beforeApprovals = beforeData.approvals || {};
        const afterApprovals = afterData.approvals || {};

        const uids = Object.keys(afterApprovals);
        const notificationPromises = [];

        for (const uid of uids) {
            const oldStatus = beforeApprovals[uid];
            const newStatus = afterApprovals[uid];

            if (oldStatus !== newStatus) {
                // Case 1: Nhân viên đề nghị hoàn thành (status -> pending)
                if (newStatus === "pending") {
                    const userDoc = await taskDb.collection("users").doc(uid).get();
                    const userName = userDoc.exists ? (userDoc.data().fullName || uid) : uid;

                    const payload = {
                        type: "task_request_done",
                        fromUid: uid,
                        fromName: userName,
                        fromAvatar: userDoc.exists ? (userDoc.data().photoURL || "") : "",
                        title: "Đề nghị hoàn thành",
                        body: `${userName} vừa báo cáo đã hoàn thành công việc "${taskTitle}", bạn hãy xác nhận nhé.`
                    };

                    // Gửi cho Manager khoa phòng & Admin
                    const adminSnap = await taskDb.collection("users").where("role", "==", "admin").get();
                    const managerSnap = await taskDb.collection("users")
                        .where("departmentId", "==", afterData.departmentId)
                        .where("role", "==", "manager")
                        .get();

                    const recipients = new Set([...adminSnap.docs.map(d => d.id), ...managerSnap.docs.map(d => d.id)]);
                    
                    // Người yêu cầu hoàn thành không cần nhận thông báo báo cáo của chính mình
                    recipients.delete(uid);

                    recipients.forEach(rUid => {
                        notificationPromises.push(sendNotificationToUser(rUid, payload, taskId));
                    });
                }

                // Case 2: Manager Duyệt (pending -> approved)
                if (newStatus === "approved") {
                    const approvedUserDoc = await taskDb.collection("users").doc(uid).get();
                    const approvedUserName = approvedUserDoc.exists ? (approvedUserDoc.data().fullName || uid) : uid;

                    // Thông báo cho người thực hiện
                    notificationPromises.push(sendNotificationToUser(uid, {
                        type: "task_approved",
                        fromUid: "system",
                        fromName: "Quản lý",
                        title: "Công việc được DUYỆT",
                        body: `Chúc mừng! Công việc "${taskTitle}" của bạn đã được quản lý phê duyệt.`
                    }, taskId));

                    // Gửi cho Admin biết
                    const adminSnap = await taskDb.collection("users").where("role", "==", "admin").get();
                    const adminRecipients = new Set(adminSnap.docs.map(d => d.id));
                    
                    // Loại bỏ người được duyệt (nếu người đó kiêm Admin sẽ tự nhận ở hàm trên)
                    adminRecipients.delete(uid);

                    adminRecipients.forEach(rUid => {
                        notificationPromises.push(sendNotificationToUser(rUid, {
                            type: "task_approved",
                            title: "Công việc đã duyệt",
                            body: `Công việc "${taskTitle}" của ${approvedUserName} đã được duyệt.`
                        }, taskId));
                    });
                }

                // Case 3: Manager Từ chối (pending -> rejected)
                if (newStatus === "rejected") {
                    notificationPromises.push(sendNotificationToUser(uid, {
                        type: "task_rejected",
                        title: "Công việc bị TỪ CHỐI",
                        body: `Đề nghị hoàn thành công việc "${taskTitle}" của bạn bị từ chối.`
                    }, taskId));
                }
            }
        }

        // --- Sync Chat Participants if assignees/supervisor changed ---
        const beforeAssigneeKeys = Object.keys(beforeData.assignees || {}).sort().join(",");
        const afterAssigneeKeys = Object.keys(afterData.assignees || {}).sort().join(",");
        const assigneesChanged = beforeAssigneeKeys !== afterAssigneeKeys;
        const supervisorChanged = beforeData.supervisorId !== afterData.supervisorId;

        if (assigneesChanged || supervisorChanged) {
            notificationPromises.push(
                syncChatParticipantsForTask(taskId, afterData).catch(err => {
                    console.error(`Failed to sync chat participants for task ${taskId}:`, err);
                })
            );
        }

        return Promise.all(notificationPromises);
    }
);

/**
 * Scheduled Cron: Kiểm tra task sắp đến hạn
 */
exports.checkDeadlines = onSchedule("every 1 hours", async (event) => {
    const now = admin.firestore.Timestamp.now();
    const in24Hours = admin.firestore.Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60 * 1000);

    const tasksSnap = await taskDb.collection("tasks")
        .where("status", "==", "open")
        .where("dueAt", ">", now)
        .where("dueAt", "<=", in24Hours)
        .get();

    const promises = [];

    tasksSnap.forEach(doc => {
        const task = doc.data();
        if (task.isDeadlineReminderSent) return;

        const taskId = doc.id;
        const payload = {
            type: "task_due_soon",
            title: "Sắp đến hạn hoàn thành",
            body: `Công việc "${task.title}" chỉ còn chưa đầy 24 giờ.`
        };

        const assignees = Object.keys(task.assignees || {});
        promises.push(...assignees.map(uid => sendNotificationToUser(uid, payload, taskId)));
        
        promises.push(taskDb.collection("tasks").doc(taskId).update({
            isDeadlineReminderSent: true
        }));
    });

    return Promise.all(promises);
});

/**
 * Scheduled Cron: Tự động tạo công việc từ Template định kỳ
 */
exports.generateRecurringTasks = onSchedule("every 1 hours", async (event) => {
    console.log("🚀 Starting recurring task generation...");
    const now = new Date();
    const templatesSnap = await taskDb.collection("tasks")
        .where("isRecurringTemplate", "==", true)
        .get();

    const promises = [];

    templatesSnap.forEach(doc => {
        const template = doc.data();
        const templateId = doc.id;

        let nextDue = template.nextDeadline ? (template.nextDeadline.toDate ? template.nextDeadline.toDate() : new Date(template.nextDeadline)) : null;

        if (nextDue && now >= nextDue) {
            console.log(`Creating instance for template: ${templateId} ("${template.title}")`);

            const instance = {
                ...template,
                isRecurringTemplate: false,
                isDeleted: false,
                isArchived: false,
                parentTaskId: templateId,
                dueAt: admin.firestore.Timestamp.fromDate(nextDue),
                nextDeadline: null,
                lastGeneratedDate: null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'open',
                approvals: {}
            };
            if (template.assignees) {
                instance.assigneeUids = Object.keys(template.assignees);
            }
            delete instance.id;

            promises.push(taskDb.collection("tasks").add(instance));

            const nextNextDue = calculateNextOccurrence(nextDue, template.recurrence);
            promises.push(taskDb.collection("tasks").doc(templateId).update({
                nextDeadline: admin.firestore.Timestamp.fromDate(nextNextDue),
                lastGeneratedDate: admin.firestore.FieldValue.serverTimestamp()
            }));
        }
    });

    return Promise.all(promises);
});

function calculateNextOccurrence(baseDate, recurrence) {
    const { frequency, daysOfWeek, dayOfMonth, specificDate } = recurrence;
    let nextDate = new Date(baseDate);

    if (frequency === 'weekly' && Array.isArray(daysOfWeek)) {
        const sortedDays = [...daysOfWeek].map(Number).sort((a, b) => a - b);
        const currentDay = baseDate.getDay();
        let nextDay = sortedDays.find(d => d > currentDay);
        let daysToAdd = 0;
        if (nextDay !== undefined) {
            daysToAdd = nextDay - currentDay;
        } else {
            nextDay = sortedDays[0];
            daysToAdd = (7 - currentDay) + nextDay;
        }
        nextDate.setDate(baseDate.getDate() + daysToAdd);
    } else if (frequency === 'monthly' && dayOfMonth) {
        nextDate.setMonth(baseDate.getMonth() + 1);
        nextDate.setDate(dayOfMonth);
    } else if (frequency === 'yearly' && specificDate) {
        nextDate.setFullYear(baseDate.getFullYear() + 1);
    }
    return nextDate;
}

/**
 * Callable: Reset mật khẩu user về mặc định (Admin only)
 */
exports.resetUserPassword = onCall({ region: "asia-southeast1" }, async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Bạn phải đăng nhập.");
    }

    const callerUid = request.auth.uid;
    const { targetUid } = request.data;

    if (!targetUid) {
        throw new HttpsError("invalid-argument", "Thiếu targetUid.");
    }

    const callerDoc = await taskDb.collection("users").doc(callerUid).get();
    if (!callerDoc.exists || callerDoc.data().role !== "admin") {
        throw new HttpsError("permission-denied", "Chỉ Admin mới có quyền reset mật khẩu.");
    }

    const defaultPassword = "123456";
    const paddedPassword = defaultPassword.padStart(6, "0");

    try {
        await admin.auth().updateUser(targetUid, { password: paddedPassword });

        const targetDoc = await taskDb.collection("users").doc(targetUid).get();
        const targetName = targetDoc.exists ? targetDoc.data().fullName : targetUid;
        console.log(`Admin ${callerUid} reset password for ${targetName} (${targetUid})`);

        return { success: true, message: `Đã reset mật khẩu cho ${targetName} về mặc định.` };
    } catch (error) {
        console.error("Reset password error:", error);
        throw new HttpsError("internal", "Lỗi khi reset mật khẩu: " + error.message);
    }
});

// ═══════════════════════════════════════════════════════════════════
// CHAT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Send FCM push for chat messages (without writing to notifications collection).
 * Reuses token cleanup logic from sendNotificationToUser.
 */
async function sendChatPush(uid, senderName, messagePreview, conversationId, conversationType) {
    if (!uid) return;

    try {
        const userDoc = await taskDb.collection("users").doc(uid).get();
        if (!userDoc.exists) return;

        const tokens = userDoc.data().fcmTokens || [];
        if (tokens.length === 0) return;

        const message = {
            notification: {
                title: senderName,
                body: messagePreview
            },
            tokens: tokens,
            webpush: {
                headers: { Urgency: "high", TTL: "86400" },
                notification: {
                    icon: "/logo192.png",
                    badge: "/logo192.png",
                    vibrate: [200, 100, 200],
                    renotify: true,
                    tag: `chat_${conversationId}`,
                    requireInteraction: false
                },
                fcm_options: {
                    link: `/app/messages/${conversationId}`
                }
            },
            data: {
                type: "chat_message",
                conversationId: conversationId,
                conversationType: conversationType || "dm"
            }
        };

        const response = await fcm.sendEachForMulticast(message);
        console.log(`Chat push: ${response.successCount}/${tokens.length} to ${uid}`);

        // Clean up invalid tokens
        const invalidTokens = [];
        response.responses.forEach((resp, idx) => {
            if (!resp.success) {
                const code = resp.error?.code;
                if (code === "messaging/invalid-registration-token" ||
                    code === "messaging/registration-token-not-registered") {
                    invalidTokens.push(tokens[idx]);
                }
            }
        });

        if (invalidTokens.length > 0) {
            const { FieldValue } = require("firebase-admin/firestore");
            await taskDb.collection("users").doc(uid).update({
                fcmTokens: FieldValue.arrayRemove(...invalidTokens)
            });
        }
    } catch (error) {
        console.error(`Chat push error for ${uid}:`, error);
    }
}

/**
 * Trigger: Khi có tin nhắn chat mới
 * - Dedup guard (clientMessageId)
 * - Check presence → skip push nếu user đang active
 * - Increment unreadCounts cho inactive users
 * - Gửi FCM push
 * - Lazy cleanup presence stale
 */
exports.onChatMessage = onDocumentCreated(
    { document: "conversations/{conversationId}/messages/{messageId}", database: "taskapp" },
    async (event) => {
        const messageData = event.data.data();
        const conversationId = event.params.conversationId;
        const senderUid = messageData.senderUid;

        // Step 0: Dedup guard — check clientMessageId
        const clientMsgId = messageData.clientMessageId;
        if (clientMsgId) {
            const messagesRef = taskDb
                .collection("conversations").doc(conversationId)
                .collection("messages");
            const existing = await messagesRef
                .where("clientMessageId", "==", clientMsgId)
                .limit(2)
                .get();

            if (existing.size > 1) {
                console.log(`Duplicate message detected: ${clientMsgId}, deleting`);
                await event.data.ref.delete();
                return;
            }
        }

        // Step 1: Read conversation
        const convRef = taskDb.collection("conversations").doc(conversationId);
        const convSnap = await convRef.get();
        if (!convSnap.exists) {
            console.error(`Conversation ${conversationId} not found`);
            return;
        }

        const convData = convSnap.data();
        const participants = convData.participants || [];
        const now = Date.now();

        // Build message preview for push notification
        let messagePreview = messageData.text || "";
        if (messageData.type === "image") messagePreview = "[Ảnh]";
        else if (messageData.type === "file") {
            const fileName = messageData.attachments?.[0]?.name || "file";
            messagePreview = `[File: ${fileName}]`;
        }
        if (messagePreview.length > 100) messagePreview = messagePreview.substring(0, 100) + "...";

        // Step 2-3: Check presence + send push + increment unread
        const updates = {};
        const pushPromises = [];

        for (const uid of participants) {
            if (uid === senderUid) continue;

            // Read presence
            const presenceSnap = await taskDb.collection("presence").doc(uid).get();
            const presence = presenceSnap.exists ? presenceSnap.data() : null;

            const isActive = presence
                && Array.isArray(presence.activeConversationIds)
                && presence.activeConversationIds.includes(conversationId)
                && presence.lastActiveAt?.toMillis() > (now - 30_000);

            if (isActive) {
                // User đang chat → skip push, skip increment
                continue;
            }

            // Lazy cleanup: if lastActiveAt is stale but activeConversationIds not empty
            if (presence
                && Array.isArray(presence.activeConversationIds)
                && presence.activeConversationIds.length > 0
                && presence.lastActiveAt?.toMillis() <= (now - 30_000)) {
                // Cleanup stale presence (fire and forget)
                taskDb.collection("presence").doc(uid).update({
                    activeConversationIds: [],
                }).catch(() => {});
            }

            // Increment unread (fast path)
            updates[`unreadCounts.${uid}`] = admin.firestore.FieldValue.increment(1);

            // Send push
            pushPromises.push(
                sendChatPush(uid, messageData.senderName || "Ai đó", messagePreview, conversationId, convData.type)
            );
        }

        // Step 4: Update lastMessage
        updates.lastMessage = {
            text: messagePreview,
            senderUid: senderUid,
            senderName: messageData.senderName || "",
            createdAt: messageData.createdAt || admin.firestore.FieldValue.serverTimestamp()
        };
        updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

        // Step 5: Batch write
        await convRef.update(updates);
        await Promise.all(pushPromises);

        console.log(`Chat message processed: ${conversationId}/${event.params.messageId}`);
    }
);

/**
 * Sync chat participants khi task thay đổi assignees/supervisorId.
 * Logic thêm vào cuối onTaskUpdated — xem exports.onTaskUpdated ở trên.
 * Hàm riêng để tái sử dụng.
 */
async function syncChatParticipantsForTask(taskId, afterData) {
    const convId = `task_${taskId}`;
    const convRef = taskDb.collection("conversations").doc(convId);
    const convSnap = await convRef.get();

    // Nếu conversation chưa tồn tại (chưa ai mở chat) → skip
    if (!convSnap.exists) return;

    // Rebuild participants list from task data
    const newParticipants = new Set();

    // Creator
    if (afterData.createdBy) newParticipants.add(afterData.createdBy);

    // Assignees
    const assignees = afterData.assignees || {};
    Object.keys(assignees).forEach(uid => newParticipants.add(uid));

    // Supervisor
    if (afterData.supervisorId) newParticipants.add(afterData.supervisorId);

    // Managers of department
    if (afterData.departmentId) {
        const managerSnap = await taskDb.collection("users")
            .where("departmentId", "==", afterData.departmentId)
            .where("role", "==", "manager")
            .get();
        managerSnap.docs.forEach(d => newParticipants.add(d.id));
    }

    // Admins
    const adminSnap = await taskDb.collection("users").where("role", "==", "admin").get();
    adminSnap.docs.forEach(d => newParticipants.add(d.id));

    const newParticipantsArray = Array.from(newParticipants);
    const oldParticipants = convSnap.data().participants || [];

    // Build participantNames for new participants
    const participantNames = convSnap.data().participantNames || {};
    for (const uid of newParticipantsArray) {
        if (!participantNames[uid]) {
            const userDoc = await taskDb.collection("users").doc(uid).get();
            if (userDoc.exists) {
                participantNames[uid] = userDoc.data().fullName || uid;
            }
        }
    }

    // Remove names of removed participants
    const removedUids = oldParticipants.filter(uid => !newParticipants.has(uid));
    for (const uid of removedUids) {
        delete participantNames[uid];
    }

    const updateData = {
        participants: newParticipantsArray,
        participantNames: participantNames,
    };

    // Clean up removed users' unread data
    for (const uid of removedUids) {
        updateData[`lastReadAt.${uid}`] = admin.firestore.FieldValue.delete();
        updateData[`unreadCounts.${uid}`] = admin.firestore.FieldValue.delete();
    }

    // Initialize new users
    const addedUids = newParticipantsArray.filter(uid => !oldParticipants.includes(uid));
    for (const uid of addedUids) {
        updateData[`lastReadAt.${uid}`] = admin.firestore.FieldValue.serverTimestamp();
        updateData[`unreadCounts.${uid}`] = 0;
    }

    await convRef.update(updateData);
    console.log(`Synced chat participants for task ${taskId}: +${addedUids.length} -${removedUids.length}`);
}

