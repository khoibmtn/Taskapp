const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

admin.initializeApp();

const db = admin.firestore();
// Named database where all app data (users, tasks, etc.) lives
const taskDb = getFirestore(admin.app(), "taskapp");
const fcm = admin.messaging();

/**
 * Gửi thông báo đến 1 user (cả In-app và Push)
 */
async function sendNotificationToUser(uid, payload, taskId) {
    if (!uid) return;

    try {
        // 1. Lưu vào collection 'notifications' (In-app)
        await db.collection("notifications").add({
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

        // 2. Lấy FCM Tokens của user
        const userDoc = await db.collection("users").doc(uid).get();
        if (!userDoc.exists) return;

        const userData = userDoc.data();
        const tokens = userData.fcmTokens || [];

        if (tokens.length > 0) {
            const message = {
                notification: {
                    title: payload.title,
                    body: payload.body
                },
                tokens: tokens, // Array of tokens
                webpush: {
                    notification: {
                        icon: "/logo192.png", // Thay bằng icon thực tế nếu có
                        click_action: `/app/tasks/${taskId}`
                    }
                }
            };

            const response = await fcm.sendEachForMulticast(message);
            console.log(`Successfully sent ${response.successCount} messages to ${uid}`);
        }
    } catch (error) {
        console.error(`Error sending notification to ${uid}:`, error);
    }
}

/**
 * Trigger: Khi tạo Task mới
 */
exports.onTaskCreated = onDocumentCreated("tasks/{taskId}", async (event) => {
    const taskData = event.data.data();
    const taskId = event.params.taskId;
    const taskTitle = taskData.title;
    const deptId = taskData.departmentId;

    const creatorDoc = await db.collection("users").doc(taskData.createdBy).get();
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
    const adminSnap = await db.collection("users").where("role", "==", "admin").get();
    const adminUids = adminSnap.docs.map(doc => doc.id);

    // 2. Tìm Manager của khoa/phòng
    const managerSnap = await db.collection("users")
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
});

/**
 * Trigger: Khi cập nhật Task (Duyệt / Từ chối / Đề nghị hoàn thành)
 */
exports.onTaskUpdated = onDocumentUpdated("tasks/{taskId}", async (event) => {
    const beforeData = event.data.before.data();
    const afterData = event.data.after.data();
    const taskId = event.params.taskId;
    const taskTitle = afterData.title;

    const beforeApprovals = beforeData.approvals || {};
    const afterApprovals = afterData.approvals || {};

    // Kiểm tra từng assignee xem có thay đổi trạng thái không
    const uids = Object.keys(afterApprovals);
    const notificationPromises = [];

    for (const uid of uids) {
        const oldStatus = beforeApprovals[uid];
        const newStatus = afterApprovals[uid];

        if (oldStatus !== newStatus) {
            // Case 1: Nhân viên đề nghị hoàn thành (status -> pending)
            if (newStatus === "pending") {
                const userDoc = await db.collection("users").doc(uid).get();
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
                const adminSnap = await db.collection("users").where("role", "==", "admin").get();
                const managerSnap = await db.collection("users")
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
                const approverUid = afterData.approvedBy || afterData.updatedBy || ""; // Ideally we track who updated it
                // We'll use a generic "Quản lý" if we don't have the specific approver UID easily
                notificationPromises.push(sendNotificationToUser(uid, {
                    type: "task_approved",
                    fromUid: "system",
                    fromName: "Quản lý",
                    title: "Công việc được DUYỆT",
                    body: `Chúc mừng! Công việc "${taskTitle}" của bạn đã được quản lý phê duyệt.`
                }, taskId));

                // Gửi cho Admin biết
                const adminSnap = await db.collection("users").where("role", "==", "admin").get();
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
});

/**
 * Scheduled Cron: Kiểm tra task sắp đến hạn
 * Chạy mỗi giờ (tùy chỉnh tần suất nếu cần)
 */
exports.checkDeadlines = onSchedule("every 1 hours", async (event) => {
    const now = admin.firestore.Timestamp.now();
    const in24Hours = admin.firestore.Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60 * 1000);

    // Tìm task chưa xong, có hạn trong 24h tới
    // Phải là open hoặc có ai đó chưa approved
    const tasksSnap = await db.collection("tasks")
        .where("status", "==", "open")
        .where("dueAt", ">", now)
        .where("dueAt", "<=", in24Hours)
        .get();

    const promises = [];

    tasksSnap.forEach(doc => {
        const task = doc.data();
        const taskId = doc.id;
        const payload = {
            type: "task_due_soon",
            title: "Sắp đến hạn hoàn thành",
            body: `Công việc "${task.title}" chỉ còn chưa đầy 24 giờ.`
        };

        // Gửi cho Assignees, Manager và Admin
        const assignees = Object.keys(task.assignees || {});

        // Thêm loop gửi cho bộ phận quản lý (có thể tối ưu bằng cách gom nhóm)
        promises.push(...assignees.map(uid => sendNotificationToUser(uid, payload, taskId)));

        // Gửi cho Admins
        // Note: Trong môi trường thực tế nên cache danh sách admin/manager hoặc query theo batch
    });

    return Promise.all(promises);
});
/**
 * Scheduled Cron: Tự động tạo công việc từ Template định kỳ
 * Chạy mỗi giờ
 */
exports.generateRecurringTasks = onSchedule("every 1 hours", async (event) => {
    console.log("🚀 Starting recurring task generation...");
    const now = new Date();
    const templatesSnap = await db.collection("tasks")
        .where("isRecurringTemplate", "==", true)
        .get();

    const promises = [];

    templatesSnap.forEach(doc => {
        const template = doc.data();
        const templateId = doc.id;

        // Use nextDeadline as the "marker" for when the next instance is due
        let nextDue = template.nextDeadline ? (template.nextDeadline.toDate ? template.nextDeadline.toDate() : new Date(template.nextDeadline)) : null;

        if (nextDue && now >= nextDue) {
            console.log(`Creating instance for template: ${templateId} ("${template.title}")`);

            // 1. Create Instance
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
            delete instance.id; // Ensure no ID conflict if it was in template data

            promises.push(db.collection("tasks").add(instance));

            // 2. Update Template with the NEXT deadline
            const nextNextDue = calculateNextOccurrence(nextDue, template.recurrence);
            promises.push(db.collection("tasks").doc(templateId).update({
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

    // Reset to start of day for cleaner calculation, or keep time? 
    // Usually keep the time established in baseDate.

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
 * Input: { targetUid: string }
 * Mật khẩu mặc định: "123456" → padStart(6, '0') → "123456"
 */
exports.resetUserPassword = onCall({ region: "asia-southeast1" }, async (request) => {
    // 1. Auth check
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Bạn phải đăng nhập.");
    }

    const callerUid = request.auth.uid;
    const { targetUid } = request.data;

    if (!targetUid) {
        throw new HttpsError("invalid-argument", "Thiếu targetUid.");
    }

    // 2. Verify caller is admin (read from 'taskapp' named database)
    const callerDoc = await taskDb.collection("users").doc(callerUid).get();
    if (!callerDoc.exists || callerDoc.data().role !== "admin") {
        throw new HttpsError("permission-denied", "Chỉ Admin mới có quyền reset mật khẩu.");
    }

    // 3. Reset password — apply same padPassword logic as client
    const defaultPassword = "123456";
    const paddedPassword = defaultPassword.padStart(6, "0"); // "123456" (no change for 6-char input)

    try {
        await admin.auth().updateUser(targetUid, { password: paddedPassword });

        // 4. Log the action
        const targetDoc = await taskDb.collection("users").doc(targetUid).get();
        const targetName = targetDoc.exists ? targetDoc.data().fullName : targetUid;
        console.log(`Admin ${callerUid} reset password for ${targetName} (${targetUid})`);

        return { success: true, message: `Đã reset mật khẩu cho ${targetName} về mặc định.` };
    } catch (error) {
        console.error("Reset password error:", error);
        throw new HttpsError("internal", "Lỗi khi reset mật khẩu: " + error.message);
    }
});
