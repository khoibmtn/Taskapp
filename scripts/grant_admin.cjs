const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

// --- CONFIGURATION ---
const TARGET_UID = "A6aInz5YEFQVvWjPPYBxEBGRqGg2";

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function grantAdmin() {
    console.log(`🚀 Granting ADMIN role to UID: ${TARGET_UID}...`);

    try {
        const userRef = db.collection("users").doc(TARGET_UID);
        const doc = await userRef.get();

        if (!doc.exists) {
            console.log("❌ User not found!");
            return;
        }

        await userRef.update({
            role: "admin",
            status: "active",
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log("✅ Successfully updated user role to 'admin'.");

    } catch (error) {
        console.error("❌ Error updating user:", error);
    }
}

grantAdmin();
