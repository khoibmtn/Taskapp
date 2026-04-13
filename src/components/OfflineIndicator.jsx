import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineIndicator() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            // Keep banner visible briefly to confirm reconnection
            setTimeout(() => setShowBanner(false), 2000);
        };
        const handleOffline = () => {
            setIsOnline(false);
            setShowBanner(true);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Show banner immediately if already offline
        if (!navigator.onLine) {
            setShowBanner(true);
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (!showBanner) return null;

    return (
        <div className={`fixed top-0 left-0 right-0 z-[100] transition-transform duration-300 ${
            showBanner ? 'translate-y-0' : '-translate-y-full'
        }`}
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
            <div className={`flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium ${
                isOnline
                    ? 'bg-success-500 text-white'
                    : 'bg-warning-500 text-white'
            }`}>
                {isOnline ? (
                    <span>✓ Đã kết nối lại</span>
                ) : (
                    <>
                        <WifiOff className="w-4 h-4" />
                        <span>Đang offline — Dữ liệu có thể chưa cập nhật</span>
                    </>
                )}
            </div>
        </div>
    );
}
