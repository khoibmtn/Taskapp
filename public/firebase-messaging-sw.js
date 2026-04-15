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
// Firebase SDK auto-shows notification when payload has `notification` key
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Firebase background message:', payload);
    // No manual showNotification needed — SDK handles it
});

// Fallback push handler — ONLY for data-only messages or when Firebase SDK
// doesn't catch the event (e.g., iOS Safari PWA edge case).
// Messages with `notification` key are already auto-shown by Firebase SDK above.
self.addEventListener('push', (event) => {
    if (!event.data) return;

    let data;
    try {
        data = event.data.json();
    } catch (e) {
        // Unparseable payload — show generic notification
        event.waitUntil(
            self.registration.showNotification('TaskApp', {
                body: event.data.text() || 'Bạn có thông báo mới',
                icon: '/logo192.png',
                badge: '/logo192.png'
            })
        );
        return;
    }

    // If message has `notification` key, Firebase SDK will auto-show it.
    // Skip manual show to prevent duplicate notifications.
    if (data.notification) return;

    // Data-only message — manually show notification
    const title = data.data?.title || 'TaskApp';
    const body = data.data?.body || 'Bạn có thông báo mới';
    const options = {
        body,
        icon: '/logo192.png',
        badge: '/logo192.png',
        tag: data.data?.tag || 'taskapp-general',
        renotify: true,
        vibrate: [200, 100, 200],
        data: {
            url: data.data?.url || '/app'
        }
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Handle notification click — focus existing window and navigate client-side
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const url = event.notification.data?.url || '/app';
    const fullUrl = new URL(url, self.location.origin).href;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Try to focus an existing window and navigate via postMessage
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus().then((focusedClient) => {
                        // Tell the React app to navigate client-side (no full reload)
                        if (focusedClient) {
                            focusedClient.postMessage({
                                type: 'NOTIFICATION_CLICK',
                                url: url
                            });
                        }
                        return focusedClient;
                    });
                }
            }
            // No existing window — open a new one
            return clients.openWindow(fullUrl);
        })
    );
});
