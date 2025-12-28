const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = getFirestore("taskapp");

async function migrateToTemplateModel() {
    console.log("🚀 Migrating existing tasks to Template-Instance model...");

    try {
        const tasksRef = db.collection("tasks");
        const snapshot = await tasksRef.get();

        let updateCount = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const updates = {};
            let needsUpdate = false;

            // 1. Mark existing tasks as NOT templates if missing
            if (data.isRecurringTemplate === undefined) {
                updates.isRecurringTemplate = false;
                needsUpdate = true;
            }

            if (needsUpdate) {
                await doc.ref.update(updates);
                updateCount++;
                console.log(`✅ Updated task: ${doc.id} ("${data.title}")`);
            }
        }

        console.log(`\n--- Migration Summary ---\nTotal: ${snapshot.size}\nUpdated: ${updateCount}\n-------------------------\n`);

    } catch (error) {
        console.error("❌ Migration failed:", error);
    }
}

migrateToTemplateModel();
