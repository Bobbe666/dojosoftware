// UpdateBanner — zeigt "Neue Version verfügbar" Hinweis unten
import React, { useState, useEffect } from 'react';
import './UpdateBanner.css';

export default function UpdateBanner() {
  const [showUpdate, setShowUpdate] = useState(false);
  const currentVersionRef = React.useRef(null);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: 'no-cache',
          headers: { 'Cache-Control': 'no-cache' }
        });
        if (!res.ok) return;
        const data = await res.json();

        if (currentVersionRef.current === null) {
          currentVersionRef.current = data.version;
          return;
        }

        if (data.version !== currentVersionRef.current) {
          setShowUpdate(true);
        }
      } catch (e) {
        // Stille Fehler — kein Netz oder kein version.json
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, 60000); // alle 60 Sekunden
    return () => clearInterval(interval);
  }, []);

  const handleUpdate = () => {
    if ('caches' in window) {
      caches.keys().then(names => names.forEach(n => caches.delete(n)));
    }
    window.location.reload(true);
  };

  if (!showUpdate) return null;

  return (
    <div className="update-banner-wrap">
      <div className="update-banner">
        <span className="update-banner-icon">🔄</span>
        <span className="update-banner-text">Neue Version verfügbar</span>
        <button className="update-banner-btn" onClick={handleUpdate}>
          Jetzt aktualisieren
        </button>
        <button className="update-banner-close" onClick={() => setShowUpdate(false)}>✕</button>
      </div>
    </div>
  );
}
