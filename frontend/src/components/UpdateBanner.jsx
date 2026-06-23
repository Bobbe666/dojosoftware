// UpdateBanner — zeigt "Neue Version verfügbar" Hinweis unten
// Version wird in localStorage gespeichert → Banner erscheint auch nach App-Neustart
import React, { useState, useEffect } from 'react';
import './UpdateBanner.css';

const STORAGE_KEY = 'dojo_app_version';
// Ins Bundle gebackene Build-ID (vom Deploy via VITE_BUILD_ID gesetzt). So „weiß" die laufende
// App, mit welcher Version sie gebaut wurde – auch wenn sie aus einem alten PWA-Cache startet.
const BUILD_ID = import.meta.env.VITE_BUILD_ID || null;

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

        // 1) Primär: gebackene Build-ID gegen Server vergleichen → erkennt auch veralteten
        //    PWA-Start sofort (nicht erst bei Versionswechsel während der Sitzung)
        if (BUILD_ID) {
          if (v !== BUILD_ID) setShowUpdate(true);
          return;
        }

        // 2) Fallback (ältere Bundles ohne Build-ID): localStorage-Vergleich
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          localStorage.setItem(STORAGE_KEY, v);
          return;
        }
        if (v !== stored) setShowUpdate(true);
      } catch (e) {
        // Stille Fehler — kein Netz oder kein version.json
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, 60000); // alle 60 Sekunden
    // Beim Zurückkehren in die App (PWA wieder geöffnet / Tab-Fokus) erneut prüfen
    const onVisible = () => { if (document.visibilityState === 'visible') checkVersion(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
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

    // Service-Worker zum Update zwingen (für hartnäckige Home-Screen-PWAs)
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.update().catch(() => {})));
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
