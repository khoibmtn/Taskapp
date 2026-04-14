import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyCo_PfvtnCLxqhD1IX3Aqs8l06UmMvzvAs",
    authDomain: "task-app-802df.firebaseapp.com",
    projectId: "task-app-802df",
    storageBucket: "task-app-802df.firebasestorage.app",
    messagingSenderId: "286761428646",
    appId: "1:286761428646:web:b5c79d61c4614a2af5b667",
    measurementId: "G-12JWTWD1BG"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Named database 'taskapp' — simple, reliable init
const db = getFirestore(app, "taskapp");
const storage = getStorage(app);

// Messaging — fully lazy loaded via dynamic import
// firebase/messaging module can crash on import in iOS Safari / unsupported browsers
let messaging = null;

async function initMessaging() {
    try {
        const mod = await import("firebase/messaging");
        const supported = await mod.isSupported();
        if (supported) {
            messaging = mod.getMessaging(app);
        }
    } catch (e) {
        // Silently fail — messaging is optional
    }
}

const messagingReady = initMessaging();

export { app, auth, db, storage, messaging, messagingReady };
