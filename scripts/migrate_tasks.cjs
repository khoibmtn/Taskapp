const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// Access the named database 'taskapp'
const db = getFirestore("taskapp");

async function migrateTasks() {
    console.log("🚀 Starting task migration and cleanup (targeting 'taskapp' database)...");

    try {
        const tasksRef = db.collection("tasks");
        const snapshot = await tasksRef.get();

        console.log(`Found ${snapshot.size} tasks to review.`);

        let updateCount = 0;
        let skipCount = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const updates = {};
            let needsUpdate = false;

            // 1. Basic Metadata Defaults
            if (data.isDeleted === undefined) {
                updates.isDeleted = false;
                needsUpdate = true;
            }
            if (data.isArchived === undefined) {
                updates.isArchived = false;
                needsUpdate = true;
            }
            if (!data.status) {
                updates.status = 'open';
                needsUpdate = true;
            }
            if (!data.priority) {
                updates.priority = 'normal';
                needsUpdate = true;
            }
            if (!data.timeType) {
                updates.timeType = 'fixed';
                needsUpdate = true;
            }

            // 2. Supervisor Normalization
            // If supervisorId is missing but supervisors (plural map) exists, migrate it
            if (!data.supervisorId && data.supervisors) {
                const uids = Object.keys(data.supervisors);
                if (uids.length > 0) {
                    updates.supervisorId = uids[0]; // Take the first one as primary
                    needsUpdate = true;
                }
            } else if (data.supervisorId === undefined) {
                updates.supervisorId = null;
                needsUpdate = true;
            }

            // 3. Department Consistency
            // If departmentId is missing, it's a problem for Manager Dashboard.
            if (!data.departmentId) {
                console.warn(`⚠️  Task ${doc.id} ("${data.title}") is missing departmentId!`);
            }

            // 4. Assignees Map
            if (!data.assignees || Object.keys(data.assignees).length === 0) {
                console.warn(`⚠️  Task ${doc.id} ("${data.title}") has no assignees!`);
            }

            if (needsUpdate) {
                await doc.ref.update(updates);
                updateCount++;
                console.log(`✅ Updated task: ${doc.id} ("${data.title}")`);
            } else {
                skipCount++;
            }
        }

        console.log("\n--- Migration Summary ---");
        console.log(`Total records: ${snapshot.size}`);
        console.log(`Records updated: ${updateCount}`);
        console.log(`Records skipped: ${skipCount}`);
        console.log("-------------------------\n");

    } catch (error) {
        console.error("❌ Migration failed:", error);
    }
}

migrateTasks();
