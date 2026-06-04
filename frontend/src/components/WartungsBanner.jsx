// =============================================================================
// WartungsBanner — Hinweis für Mitglieder auf laufende Wartungsarbeiten.
// Zeigt sich automatisch nur bis zum Ablaufzeitpunkt, danach unsichtbar.
// Schließbar (pro Browser, via localStorage).
// =============================================================================
import React, { useState } from 'react';

// Ende der Wartung: Sonntag, 08.06.2026 00:00 (= Sonntag Mitternacht)
const ENDE = new Date('2026-06-08T00:00:00');
const DISMISS_KEY = 'wartung_2026_06_08_dismissed';

export default function WartungsBanner() {
  const [closed, setClosed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  if (closed || new Date() >= ENDE) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch {}
    setClosed(true);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      background: 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(217,119,6,0.16))',
      border: '1px solid rgba(245,158,11,0.45)',
      borderRadius: 12, padding: '0.8rem 1rem', margin: '0 0 1rem',
      color: 'var(--text-primary, #f1f5f9)', fontSize: '0.88rem', lineHeight: 1.45,
    }}>
      <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>🔧</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ color: '#fbbf24' }}>Wartungsarbeiten bis Sonntag Mitternacht</strong>
        <div style={{ marginTop: 2, color: 'var(--text-secondary, #cbd5e1)' }}>
          An der Software finden umfangreiche Verbesserungen &amp; Wartungsarbeiten statt.
          Es kann deshalb zeitweise zu eingeschränktem oder keinem Zugriff kommen.
          Vielen Dank für euer Verständnis! 🙏
        </div>
      </div>
      <button onClick={dismiss} aria-label="Hinweis schließen" style={{
        background: 'none', border: 'none', color: 'var(--text-muted, #94a3b8)',
        cursor: 'pointer', fontSize: '1.15rem', flexShrink: 0, padding: '0 0.25rem',
      }}>✕</button>
    </div>
  );
}
