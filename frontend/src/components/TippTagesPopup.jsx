// ============================================================================
// TippTagesPopup — täglicher „Tipp des Tages"-Dialog im Admin-Bereich.
//
// Poppt EINMAL pro Tag auf (localStorage-Datum), zusätzlich zum Dashboard-Widget
// (TippWidget). Zeigt denselben Tages-Tipp. Respektiert das Opt-out
// („Keine Tipps mehr"). Nur Admin-Software, nichts in der Mitglieder-App.
// ============================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import './TippWidget.css';

const STORAGE_KEY = 'dojo_tipp_popup_shown'; // Wert = YYYY-MM-DD des letzten Popups

function heuteISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export default function TippTagesPopup() {
  const [open, setOpen] = useState(false);
  const [tipps, setTipps] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [busy, setBusy] = useState(false);

  // Beim Laden: nur wenn heute noch nicht gezeigt → Tipps holen und ggf. öffnen.
  useEffect(() => {
    let mounted = true;
    let heute;
    try {
      heute = heuteISO();
      if (localStorage.getItem(STORAGE_KEY) === heute) return; // heute schon gezeigt
    } catch (_) { return; }

    axios.get('/admin/tipps')
      .then(r => {
        if (!mounted) return;
        if (r.data?.aktiv === false) return; // Nutzer hat Tipps aus → kein Popup
        const alle = Array.isArray(r.data?.tipps) ? r.data.tipps : [];
        const offen = alle.filter(t => t.status !== 'erledigt');
        const ungelesen = offen.filter(t => !t.status).sort((a, b) => a.id - b.id);
        const spaeter = offen.filter(t => t.status === 'spaeter').sort((a, b) => a.id - b.id);
        const kandidaten = [...ungelesen, ...spaeter];
        if (!kandidaten.length) return; // nichts zu zeigen

        const tag = Math.floor(Date.now() / 86400000);
        setTipps(alle);
        setCurrentId(kandidaten[tag % kandidaten.length].id);
        setOpen(true);
        try { localStorage.setItem(STORAGE_KEY, heute); } catch (_) {}
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const kandidaten = useMemo(() => {
    const offen = tipps.filter(t => t.status !== 'erledigt');
    const ungelesen = offen.filter(t => !t.status).sort((a, b) => a.id - b.id);
    const spaeter = offen.filter(t => t.status === 'spaeter').sort((a, b) => a.id - b.id);
    return [...ungelesen, ...spaeter];
  }, [tipps]);

  const current = useMemo(
    () => kandidaten.find(t => t.id === currentId) || kandidaten[0] || null,
    [kandidaten, currentId]
  );

  const nachbarId = useCallback(() => {
    if (kandidaten.length <= 1) return current?.id ?? null;
    const i = kandidaten.findIndex(t => t.id === current?.id);
    return kandidaten[(i + 1) % kandidaten.length].id;
  }, [kandidaten, current]);

  const setStatusLokal = (id, status) =>
    setTipps(prev => prev.map(t => (t.id === id ? { ...t, status } : t)));

  const schliessen = () => setOpen(false);

  const naechster = () => { if (current) setCurrentId(nachbarId()); };

  const spaeter = async () => {
    if (!current || busy) return;
    setBusy(true);
    try { await axios.post('/admin/tipps/status', { tipp_id: current.id, status: 'spaeter' }); } catch (_) {}
    setStatusLokal(current.id, 'spaeter');
    setBusy(false);
    setOpen(false);
  };

  const erledigt = async () => {
    if (!current || busy) return;
    setBusy(true);
    try { await axios.post('/admin/tipps/status', { tipp_id: current.id, status: 'erledigt' }); } catch (_) {}
    setStatusLokal(current.id, 'erledigt');
    setBusy(false);
    setOpen(false);
  };

  const ausschalten = async () => {
    if (busy) return;
    setBusy(true);
    try { await axios.post('/admin/tipps/einstellung', { aktiv: false }); } catch (_) {}
    setBusy(false);
    setOpen(false);
  };

  if (!open || !current) return null;

  return createPortal(
    <div className="tw-modal-overlay" onClick={schliessen}>
      <div className="tw-modal" onClick={e => e.stopPropagation()}>
        <div className="tw-modal-head">
          <span className="tw-badge">💡 Tipp des Tages</span>
          <button className="tw-modal-x" onClick={schliessen} title="Schließen" aria-label="Schließen">✕</button>
        </div>

        <div className="tw-body tw-modal-body">
          <div className="tw-icon" aria-hidden="true">{current.icon || '💡'}</div>
          <div className="tw-textwrap">
            <div className="tw-titel">{current.titel}</div>
            <div className="tw-text">{current.text}</div>
          </div>
        </div>

        <div className="tw-actions">
          <button className="tw-btn tw-btn--primary" onClick={erledigt} disabled={busy} title="Verstanden – diesen Tipp nicht mehr zeigen">
            ✓ Erledigt
          </button>
          <button className="tw-btn" onClick={spaeter} disabled={busy} title="Später noch einmal zeigen">
            🕐 Später lesen
          </button>
          <button className="tw-btn" onClick={naechster} disabled={busy || kandidaten.length <= 1} title="Nächsten Tipp zeigen">
            → Nächster
          </button>
          <button className="tw-btn tw-btn--mute" onClick={ausschalten} disabled={busy} title="Keine Tipps mehr anzeigen">
            ✕ Keine Tipps mehr
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
