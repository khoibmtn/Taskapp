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

// Firebase SDK background handler
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Firebase background message:', payload);
    // Firebase SDK auto-shows notification from payload.notification
    // Only need manual show if using data-only messages
});

// Direct push event handler — critical for iOS PWA
// iOS Safari may not trigger onBackgroundMessage but does fire 'push' event
self.addEventListener('push', (event) => {
    if (!event.data) return;

    let data;
    try {
        data = event.data.json();
    } catch (e) {
        data = { notification: { title: 'TaskApp', body: event.data.text() } };
    }

    // Skip if Firebase SDK already handled it (check if notification is auto-shown)
    const notif = data.notification || {};
    const title = notif.title || 'TaskApp';
    const options = {
        body: notif.body || 'Bạn có thông báo mới',
        icon: '/logo192.png',
        badge: '/logo192.png',
        tag: data.data?.taskId || 'taskapp-general',
        renotify: true,
        vibrate: [200, 100, 200],
        requireInteraction: true,
        data: {
            url: data.fcmOptions?.link || data.data?.url || '/app'
        }
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Handle notification click — open/focus the app
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const url = event.notification.data?.url || '/app';
    const fullUrl = new URL(url, self.location.origin).href;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Focus existing window if found
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(fullUrl);
                    return client.focus();
                }
            }
            // Open new window
            return clients.openWindow(fullUrl);
        })
    );
});
