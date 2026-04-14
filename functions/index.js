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
        const taskId = event.params.taskId;
        const taskTitle = taskData.title;
        const deptId = taskData.departmentId;

        const creatorDoc = await taskDb.collection("users").doc(taskData.createdBy).get();
        const creatorName = creatorDoc.exists ? (creatorDoc.data().fullName || "Ai đó") : "Ai đó";
        const creatorAvatar = creatorDoc.exists ? (creatorDoc.data().photoURL || "") : "";

        const payload = {
            type: "task_created",
            fromUid: taskData.createdBy,
            fromName: creatorName,
            fromAvatar: creatorAvatar,
            title: "Có công việc mới",
            body: `${creatorName} vừa giao việc "${taskTitle}" cho bạn.`
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
                    recipients.forEach(rUid => {
                        notificationPromises.push(sendNotificationToUser(rUid, payload, taskId));
                    });
                }

                // Case 2: Manager Duyệt (pending -> approved)
                if (newStatus === "approved") {
                    notificationPromises.push(sendNotificationToUser(uid, {
                        type: "task_approved",
                        fromUid: "system",
                        fromName: "Quản lý",
                        title: "Công việc được DUYỆT",
                        body: `Chúc mừng! Công việc "${taskTitle}" của bạn đã được quản lý phê duyệt.`
                    }, taskId));

                    // Gửi cho Admin biết
                    const adminSnap = await taskDb.collection("users").where("role", "==", "admin").get();
                    adminSnap.docs.forEach(doc => {
                        if (doc.id !== uid) {
                            notificationPromises.push(sendNotificationToUser(doc.id, {
                                type: "task_approved",
                                title: "Công việc đã duyệt",
                                body: `Công việc "${taskTitle}" của UID ${uid} đã được duyệt.`
                            }, taskId));
                        }
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
