const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = getFirestore("taskapp");

async function convertLegacyRecurringTasks() {
    console.log("🚀 Converting legacy recurring tasks to the Template-Instance model...");

    try {
        const tasksRef = db.collection("tasks");
        // Find tasks that are intended to be recurring but aren't currently templates
        const snapshot = await tasksRef.where("timeType", "==", "recurrence").where("isRecurringTemplate", "==", false).get();

        console.log(`Found ${snapshot.size} legacy recurring tasks.`);
        let count = 0;

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const taskId = doc.id;

            console.log(`Processing: ${taskId} ("${data.title}")`);

            // 1. Convert this document into a Template
            await doc.ref.update({
                isRecurringTemplate: true,
                lastGeneratedDate: admin.firestore.FieldValue.serverTimestamp()
            });

            // 2. Spawn the current instance if it doesn't already have one (best effort)
            // For simplicity, we'll spawn one instance for the current nextDeadline
            const instance = {
                ...data,
                isRecurringTemplate: false,
                parentTaskId: taskId,
                dueAt: data.nextDeadline || admin.firestore.FieldValue.serverTimestamp(),
                nextDeadline: null,
                lastGeneratedDate: null,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'open',
                approvals: {}
            };
            delete instance.id;

            await tasksRef.add(instance);
            count++;
            console.log(`✅ Converted ${taskId} and spawned instance.`);
        }

        console.log(`\n--- Conversion Summary ---\nTotal converted: ${count}\n--------------------------\n`);

    } catch (error) {
        console.error("❌ Conversion failed:", error);
    }
}

convertLegacyRecurringTasks();
