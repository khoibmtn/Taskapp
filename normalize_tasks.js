// Run this script ONCE to normalize existing tasks
// Usage: node normalize_tasks.js

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyCo_PfvtnCLxqhD1IX3Aqs8l06UmMvzvAs",
    authDomain: "task-app-802df.firebaseapp.com",
    projectId: "task-app-802df",
    storageBucket: "task-app-802df.firebasestorage.app",
    messagingSenderId: "286761428646",
    appId: "1:286761428646:web:b5c79d61c4614a2af5b667"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "taskapp");

async function normalizeTasksData() {
    console.log("🚀 Starting task data normalization...");

    try {
        const tasksRef = collection(db, "tasks");
        const snapshot = await getDocs(tasksRef);

        console.log(`📊 Found ${snapshot.size} tasks to process`);

        let processedCount = 0;
        let batchCount = 0;
        let batch = writeBatch(db);

        for (const taskDoc of snapshot.docs) {
            const data = taskDoc.data();
            const updates = {};

            // Add missing fields
            if (data.isArchived === undefined) updates.isArchived = false;
            if (data.isDeleted === undefined) updates.isDeleted = false;
            if (data.isRecurringTemplate === undefined) updates.isRecurringTemplate = false;

            // Create assigneeUids array from assignees map
            if (!data.assigneeUids && data.assignees) {
                const uids = Object.keys(data.assignees);
                updates.assigneeUids = uids;
            }

            // Only update if there are changes
            if (Object.keys(updates).length > 0) {
                batch.update(doc(db, "tasks", taskDoc.id), updates);
                processedCount++;
                batchCount++;

                // Firestore batch limit is 500
                if (batchCount >= 500) {
                    await batch.commit();
                    console.log(`✅ Committed batch of ${batchCount} tasks`);
                    batch = writeBatch(db);
                    batchCount = 0;
                }
            }
        }

        // Commit remaining batc

        h
        if (batchCount > 0) {
            await batch.commit();
            console.log(`✅ Committed final batch of ${batchCount} tasks`);
        }

        console.log(`\n✨ Normalization complete! Updated ${processedCount} tasks.`);
        process.exit(0);
    } catch (error) {
        console.error("❌ Error:", error);
        process.exit(1);
    }
}

normalizeTasksData();
