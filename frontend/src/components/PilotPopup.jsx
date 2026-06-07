import React, { useState, useEffect, useCallback } from 'react';
import '../styles/PilotPopup.css';

// ============================================================================
// Pilot-Partner-Programm Popup — öffentliche Seiten auf dojo.tda-intl.org
// (Homepage /home, Demo-Buchung /demo-buchen — NICHT auf dem Login)
// CTA führt zur Bewerbungsseite auf der TDA-Systems-Landing.
// ============================================================================

const SHOW_DELAY = 8000;               // erscheint nach 8 Sekunden
const STORAGE_KEY = 'tda_pilot_popup_dismissed';
const SUPPRESS_DAYS = 14;              // nach Schließen 14 Tage Pause
const CTA_URL = 'https://www.tda-intl.org/pilot-partner.html';

export default function PilotPopup() {
  const [visible, setVisible] = useState(false);
  const [show, setShow] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    try {
      const dismissedAt = Number(localStorage.getItem(STORAGE_KEY) || 0);
      if (dismissedAt && Date.now() - dismissedAt < SUPPRESS_DAYS * 24 * 60 * 60 * 1000) return;
    } catch { /* localStorage gesperrt → trotzdem zeigen */ }

    const t = setTimeout(() => {
      setVisible(true);
      setTimeout(() => setShow(true), 80);
    }, SHOW_DELAY);
    return () => clearTimeout(t);
  }, []);

  const handleClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch { /* egal */ }
    setTimeout(() => setVisible(false), 500);
  }, [closing]);

  if (!visible) return null;

  return (
    <div
      className={`pilot-popup-overlay${show ? ' in' : ''}${closing ? ' out' : ''}`}
      onClick={handleClose}
    >
      <div
        className={`pilot-popup-card${show ? ' in' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pilot-popup-title"
        onClick={e => e.stopPropagation()}
      >
        <button className="pilot-popup-close" onClick={handleClose} aria-label="Schließen">✕</button>

        <span className="pilot-popup-trophy">🏆</span>
        <span className="pilot-popup-badge">Pilot-Partner-Programm</span>
        <h2 id="pilot-popup-title">Deine Schule.<br />12 Monate kostenlos.</h2>
        <p>
          Jeden Monat wird eine Kampfsportschule Pilot-Partner und nutzt die DojoSoftware
          12 Monate kostenlos — inkl. persönlicher Einrichtung &amp; Datenübernahme.
        </p>

        <a href={CTA_URL} className="pilot-popup-cta" onClick={handleClose}>
          Jetzt bewerben →
        </a>
      </div>
    </div>
  );
}
