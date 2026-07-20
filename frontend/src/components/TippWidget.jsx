// ============================================================================
// TippWidget — „Wusstest du schon…?"-Feature-Tipps im Admin-Dashboard.
//
// Nur im Admin-Bereich der Dojo-Software (Bedienung der Software), NICHT in der
// Mitglieder-App. Aktionen: Erledigt (nie wieder), Später lesen, Nächster Tipp,
// Keine Tipps mehr. Status wird serverseitig pro Mitarbeiter gespeichert.
// ============================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import './TippWidget.css';

export default function TippWidget() {
  const [aktiv, setAktiv] = useState(true);
  const [tipps, setTipps] = useState(null);       // null = laden, [] = geladen
  const [currentId, setCurrentId] = useState(null);
  const [busy, setBusy] = useState(false);

  // Laden
  useEffect(() => {
    let mounted = true;
    axios.get('/admin/tipps')
      .then(r => {
        if (!mounted) return;
        setAktiv(r.data?.aktiv !== false);
        setTipps(Array.isArray(r.data?.tipps) ? r.data.tipps : []);
      })
      .catch(() => { if (mounted) setTipps([]); });
    return () => { mounted = false; };
  }, []);

  // Kandidaten: nicht erledigt. Ungelesene zuerst, dann „später" — stabil nach id.
  const kandidaten = useMemo(() => {
    if (!tipps) return [];
    const offen = tipps.filter(t => t.status !== 'erledigt');
    const ungelesen = offen.filter(t => !t.status).sort((a, b) => a.id - b.id);
    const spaeter = offen.filter(t => t.status === 'spaeter').sort((a, b) => a.id - b.id);
    return [...ungelesen, ...spaeter];
  }, [tipps]);

  const gelesenCount = useMemo(
    () => (tipps ? tipps.filter(t => t.status === 'erledigt').length : 0),
    [tipps]
  );

  // Startauswahl: Tages-Rotation (jeden Tag ein anderer Tipp oben).
  useEffect(() => {
    if (currentId != null) return;
    if (kandidaten.length === 0) return;
    const tag = Math.floor(Date.now() / 86400000);
    setCurrentId(kandidaten[tag % kandidaten.length].id);
  }, [kandidaten, currentId]);

  const current = useMemo(() => {
    if (!kandidaten.length) return null;
    return kandidaten.find(t => t.id === currentId) || kandidaten[0];
  }, [kandidaten, currentId]);

  const nachbarId = useCallback(() => {
    if (kandidaten.length <= 1) return current?.id ?? null;
    const i = kandidaten.findIndex(t => t.id === current?.id);
    return kandidaten[(i + 1) % kandidaten.length].id;
  }, [kandidaten, current]);

  const setStatusLokal = (id, status) =>
    setTipps(prev => prev.map(t => (t.id === id ? { ...t, status } : t)));

  // ── Aktionen ──────────────────────────────────────────────────────────────
  const naechster = () => { if (current) setCurrentId(nachbarId()); };

  const spaeter = async () => {
    if (!current || busy) return;
    setBusy(true);
    const next = nachbarId();
    try { await axios.post('/admin/tipps/status', { tipp_id: current.id, status: 'spaeter' }); } catch (_) {}
    setStatusLokal(current.id, 'spaeter');
    setCurrentId(next);
    setBusy(false);
  };

  const erledigt = async () => {
    if (!current || busy) return;
    setBusy(true);
    const next = nachbarId();
    try { await axios.post('/admin/tipps/status', { tipp_id: current.id, status: 'erledigt' }); } catch (_) {}
    setStatusLokal(current.id, 'erledigt');
    setCurrentId(next === current.id ? null : next);
    setBusy(false);
  };

  const ausschalten = async () => {
    if (busy) return;
    setBusy(true);
    try { await axios.post('/admin/tipps/einstellung', { aktiv: false }); } catch (_) {}
    setAktiv(false);
    setBusy(false);
  };

  const wiederAnschalten = async () => {
    if (busy) return;
    setBusy(true);
    try { await axios.post('/admin/tipps/einstellung', { aktiv: true }); } catch (_) {}
    setAktiv(true);
    setCurrentId(null);
    setBusy(false);
  };

  const vonVorne = async () => {
    if (busy || !tipps) return;
    setBusy(true);
    const zuReset = tipps.filter(t => t.status);
    try {
      await Promise.all(zuReset.map(t =>
        axios.post('/admin/tipps/status', { tipp_id: t.id, status: null })
      ));
    } catch (_) {}
    setTipps(prev => prev.map(t => ({ ...t, status: null })));
    setCurrentId(null);
    setBusy(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────
  if (tipps === null) return null;   // still loading, kein Layout-Sprung

  // Ausgeschaltet: nur eine dezente Zeile zum Wiedereinschalten (sonst irreversibel)
  if (!aktiv) {
    return (
      <div className="tw-reenable">
        <span>💡 Tipps sind ausgeblendet.</span>
        <button className="tw-link" onClick={wiederAnschalten} disabled={busy}>
          Wieder anzeigen
        </button>
      </div>
    );
  }

  // Alle Tipps gelesen
  if (!current) {
    if (gelesenCount === 0) return null; // gar keine Tipps vorhanden
    return (
      <div className="tw-card tw-card--done">
        <div className="tw-done-emoji">🎉</div>
        <div className="tw-done-text">
          Stark – du hast alle {gelesenCount} Tipps durchgearbeitet.
        </div>
        <button className="tw-btn tw-btn--ghost" onClick={vonVorne} disabled={busy}>
          ↺ Von vorne
        </button>
      </div>
    );
  }

  return (
    <div className="tw-card">
      <div className="tw-head">
        <span className="tw-badge">💡 Wusstest du schon?</span>
        {current.kategorie && <span className="tw-kat">{current.kategorie}</span>}
        <span className="tw-count">{gelesenCount}/{tipps.length} gelesen</span>
      </div>

      <div className="tw-body">
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
  );
}
