importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyCo_PfvtnCLxqhD1IX3Aqs8l06UmMvzvAs",
    authDomain: "task-app-802df.firebaseapp.com",
    projectId: "task-app-802df",
    storageBucket: "task-app-802df.firebasestorage.app",
    messagingSenderId: "286761428646",
    appId: "1:286761428646:web:b5c79d61c4614a2af5b667"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    const notificationTitle = payload.notification?.title || 'TaskApp';
    const notificationOptions = {
        body: payload.notification?.body || 'Bạn có thông báo mới',
        icon: '/logo192.png',
        badge: '/logo192.png',
        tag: 'taskapp-notification',
        renotify: true,
        vibrate: [200, 100, 200],
        data: {
            url: payload.data?.url || '/app',
            taskId: payload.data?.taskId || ''
        },
        actions: [
            { action: 'open', title: 'Mở ứng dụng' }
        ]
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click — open the app
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const url = event.notification.data?.url || '/app';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // If app is already open, focus it
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            // Otherwise open a new window
            return clients.openWindow(url);
        })
    );
});
