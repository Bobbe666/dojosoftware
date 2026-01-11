import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import useNetworkStatus from '../hooks/useNetworkStatus.js';

const OfflineBanner = () => {
  const isOnline = useNetworkStatus();
  const [showBanner, setShowBanner] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [bannerType, setBannerType] = useState('offline'); // 'offline' or 'online'

  useEffect(() => {
    if (!isOnline) {
      // User went offline
      setWasOffline(true);
      setBannerType('offline');
      setShowBanner(true);
    } else if (wasOffline && isOnline) {
      // User came back online
      setBannerType('online');
      setShowBanner(true);

      // Auto-hide the "back online" banner after 3 seconds
      const timer = setTimeout(() => {
        setShowBanner(false);
        setWasOffline(false);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (!showBanner) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        padding: '1rem',
        background: bannerType === 'offline'
          ? 'linear-gradient(135deg, #dc2626, #991b1b)'
          : 'linear-gradient(135deg, #16a34a, #15803d)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        animation: 'slideDown 0.3s ease-out',
        fontSize: '0.95rem',
        fontWeight: '500',
        textAlign: 'center'
      }}
    >
      {bannerType === 'offline' ? (
        <>
          <WifiOff size={20} />
          <span>Keine Internetverbindung - Offline-Modus aktiv</span>
        </>
      ) : (
        <>
          <Wifi size={20} />
          <span>Verbindung wiederhergestellt</span>
        </>
      )}
    </div>
  );
};

// Inline animation keyframes (since we're not using a separate CSS file)
const style = document.createElement('style');
style.textContent = `
  @keyframes slideDown {
    from {
      transform: translateY(-100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
`;
if (typeof document !== 'undefined') {
  document.head.appendChild(style);
}

export default OfflineBanner;
