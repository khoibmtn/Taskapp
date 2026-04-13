import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register PWA Service Worker (Workbox — handles app shell caching)
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Có phiên bản mới. Cập nhật ngay?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('App ready for offline use');
  },
})

// Register Firebase Messaging Service Worker (separate, for push notifications)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js')
      .then(reg => console.log('FCM Service Worker registered', reg))
      .catch(err => console.log('FCM Service Worker registration failed', err));
  });
}
