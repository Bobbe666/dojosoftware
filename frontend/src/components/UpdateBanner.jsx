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

        const v = data.v || data.version;
        if (!v) return;

        if (currentVersionRef.current === null) {
          currentVersionRef.current = v;
          return;
        }

        if (v !== currentVersionRef.current) {
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

  const handleUpdate = async () => {
    // Cache-Clearing: best effort — Navigation passiert IMMER, auch bei Fehler
    try {
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(n => caches.delete(n)));
      }
    } catch (_) {}
    // Cache-busting URL → zwingt Browser zu frischem HTTP-Request für index.html
    const url = new URL(window.location.href);
    url.searchParams.set('_v', Date.now());
    window.location.replace(url.toString());
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
