import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
    apiKey: "AIzaSyCo_PfvtnCLxqhD1IX3Aqs8l06UmMvzvAs",
    authDomain: "task-app-802df.firebaseapp.com",
    projectId: "task-app-802df",
    storageBucket: "task-app-802df.firebasestorage.app",
    messagingSenderId: "286761428646",
    appId: "1:286761428646:web:b5c79d61c4614a2af5b667",
    measurementId: "G-12JWTWD1BG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
const auth = getAuth(app);

// Use standard WebSockets for speed, but connect to 'taskapp' database
const db = getFirestore(app, "taskapp");

// Enable offline persistence for Firestore
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
        console.warn('Offline persistence: Multiple tabs open, persistence enabled in first tab only.');
    } else if (err.code === 'unimplemented') {
        console.warn('Offline persistence: Browser does not support IndexedDB.');
    }
});

// Messaging — lazy init, null on unsupported browsers (iOS Safari, etc.)
let messaging = null;

async function initMessaging() {
    try {
        const supported = await isSupported();
        if (supported) {
            messaging = getMessaging(app);
        }
    } catch (e) {
        console.warn("FCM not supported on this browser:", e);
    }
}

// Start init but don't block app load
const messagingReady = initMessaging();

export { auth, db, messaging, messagingReady };
