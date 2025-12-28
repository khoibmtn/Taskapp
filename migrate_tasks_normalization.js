const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrate() {
    console.log('Starting task normalization migration...');
    const tasksSnap = await db.collection('tasks').get();
    let updatedCount = 0;

    const batch = db.batch();

    tasksSnap.forEach(doc => {
        const data = doc.data();
        const updates = {};
        let needsUpdate = false;

        // 1. assigneeUids Array
        if (data.assignees && !data.assigneeUids) {
            updates.assigneeUids = Object.keys(data.assignees);
            needsUpdate = true;
        }

        // 2. Default flags
        if (data.isArchived === undefined) {
            updates.isArchived = false;
            needsUpdate = true;
        }
        if (data.isDeleted === undefined) {
            updates.isDeleted = false;
            needsUpdate = true;
        }
        if (data.isRecurringTemplate === undefined) {
            updates.isRecurringTemplate = false;
            needsUpdate = true;
        }

        if (needsUpdate) {
            batch.update(doc.ref, updates);
            updatedCount++;
        }
    });

    if (updatedCount > 0) {
        await batch.commit();
    }

    console.log(`Migration complete. Updated ${updatedCount} tasks.`);
}

migrate().catch(console.error);
