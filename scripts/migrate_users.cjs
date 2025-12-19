const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

// --- CONFIGURATION ---
// 1. Download serviceAccountKey.json from Firebase Console > Project Settings > Service Accounts
// 2. Place it in the same directory as this script
// 3. Run: npm install firebase-admin
// 4. Run: node migrate_users.js

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateUsers() {
    console.log("🚀 Starting User Schema Migration...");

    try {
        const usersRef = db.collection("users");
        const snapshot = await usersRef.get();

        if (snapshot.empty) {
            console.log("No users found.");
            return;
        }

        console.log(`Found ${snapshot.size} users. Processing...`);

        let batch = db.batch();
        let operationCounter = 0;
        let batchCounter = 0;
        let updatedCount = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const updates = {};

            // --- SCHEMA DEFINITION & CHECKS ---

            // 1. fullName
            if (!Object.prototype.hasOwnProperty.call(data, "fullName")) {
                updates.fullName = data.fullName || data.displayName || data.name || "";
            }

            // 2. phone
            if (!Object.prototype.hasOwnProperty.call(data, "phone")) {
                updates.phone = data.phone || "";
            }

            // 3. email
            if (!Object.prototype.hasOwnProperty.call(data, "email")) {
                updates.email = null;
            }

            // 4. authEmail
            if (!Object.prototype.hasOwnProperty.call(data, "authEmail")) {
                updates.authEmail = "";
            }

            // 5. departmentId
            if (!Object.prototype.hasOwnProperty.call(data, "departmentId")) {
                updates.departmentId = "";
            }

            // 6. position
            if (!Object.prototype.hasOwnProperty.call(data, "position")) {
                updates.position = "";
            }

            // 7. role (Default: staff)
            if (!Object.prototype.hasOwnProperty.call(data, "role")) {
                updates.role = "staff";
            }

            // 8. status (Default: pending)
            if (!Object.prototype.hasOwnProperty.call(data, "status")) {
                updates.status = "pending";
            }

            // 9. createdAt
            if (!data.createdAt) {
                updates.createdAt = admin.firestore.FieldValue.serverTimestamp();
            }

            // 10. approvedAt
            if (!Object.prototype.hasOwnProperty.call(data, "approvedAt")) {
                updates.approvedAt = null;
            }

            // 11. approvedBy
            if (!Object.prototype.hasOwnProperty.call(data, "approvedBy")) {
                updates.approvedBy = null;
            }

            // --- BATCH LOGIC ---
            if (Object.keys(updates).length > 0) {
                batch.update(doc.ref, updates);
                operationCounter++;
                updatedCount++;
            }

            // Commit batch if limit reached (500)
            if (operationCounter === 400) {
                await batch.commit();
                console.log(`Saved batch ${++batchCounter} (400 ops)`);
                batch = db.batch(); // Reset
                operationCounter = 0;
            }
        }

        // Commit remaining
        if (operationCounter > 0) {
            await batch.commit();
            console.log(`Saved final batch ${++batchCounter} (${operationCounter} ops)`);
        }

        console.log("-----------------------------------------");
        console.log(`✅ Migration Complete.`);
        console.log(`Total Scanned: ${snapshot.size}`);
        console.log(`Total Updated: ${updatedCount}`);

    } catch (error) {
        console.error("❌ Error running migration:", error);
    }
}

migrateUsers();
