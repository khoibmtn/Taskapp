/**
 * Script: Reset mật khẩu admin về "123456"
 * Chạy: node scripts/reset_admin_password.cjs
 */
const admin = require("../functions/node_modules/firebase-admin");

// Initialize with default credentials (uses GOOGLE_APPLICATION_CREDENTIALS or gcloud auth)
admin.initializeApp({ projectId: "task-app-802df" });

const DEFAULT_PASSWORD = "123456".padStart(6, "0"); // "123456"

async function resetPassword() {
    const db = admin.firestore();
    db.settings({ databaseId: "taskapp" });

    // Find user by email
    const snap = await db.collection("users")
        .where("email", "==", "khoibm.tn@gmail.com")
        .limit(1)
        .get();

    if (snap.empty) {
        console.error("❌ Không tìm thấy user với email khoibm.tn@gmail.com");
        process.exit(1);
    }

    const userDoc = snap.docs[0];
    const userData = userDoc.data();
    const uid = userDoc.id;

    console.log(`Found: ${userData.fullName} (${userData.email}), UID: ${uid}`);
    console.log(`Auth email: ${userData.authEmail}`);

    // Reset via Firebase Auth
    try {
        await admin.auth().updateUser(uid, { password: DEFAULT_PASSWORD });
        console.log(`✅ Đã reset mật khẩu cho "${userData.fullName}" về "${DEFAULT_PASSWORD}"`);
    } catch (err) {
        console.error("❌ Lỗi reset:", err.message);
    }

    process.exit(0);
}

resetPassword();
