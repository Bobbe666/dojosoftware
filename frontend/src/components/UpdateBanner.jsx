// UpdateBanner — zeigt "Neue Version verfügbar" Hinweis unten
// Version wird in localStorage gespeichert → Banner erscheint auch nach App-Neustart
import React, { useState, useEffect } from 'react';
import './UpdateBanner.css';

const STORAGE_KEY = 'dojo_app_version';

export default function UpdateBanner() {
  const [showUpdate, setShowUpdate] = useState(false);

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

        const stored = localStorage.getItem(STORAGE_KEY);

        if (!stored) {
          // Erste Nutzung — Version speichern, kein Banner
          localStorage.setItem(STORAGE_KEY, v);
          return;
        }

        if (v !== stored) {
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
    // Neue Version in localStorage speichern
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        const v = data.v || data.version;
        if (v) localStorage.setItem(STORAGE_KEY, v);
      }
    } catch (_) {}

    // Cache leeren
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
