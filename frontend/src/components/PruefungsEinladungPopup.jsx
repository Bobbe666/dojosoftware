import React, { useState, useMemo } from 'react';

// ============================================================================
// Prüfungseinladungs-Popup — ausgelagert aus MemberDashboard.jsx (Perf-Fix).
// Vorher: IIFE im Dashboard-Render → bei jedem Parent-Render neu erzeugt,
// jeder Termin-Klick re-renderte das GESAMTE Dashboard (3200 Zeilen).
// Jetzt: React.memo + eigener lokaler State für Nein-Flow & Terminauswahl.
// Props:
//   pruefung  — die Einladung (pruefung_id, stil_name, pruefungsdatum, …)
//   sending   — true während die Zusage gespeichert wird
//   onClose() — Popup schließen
//   onZusage(antwort, alternativeDaten[]) — 'kommt' | 'kommt_nicht'
// ============================================================================

const getAlternativeTerminOptions = (pruefungsdatum) => {
  if (!pruefungsdatum) return [];
  const base = new Date(pruefungsdatum);
  base.setHours(12, 0, 0, 0);
  const options = [];
  for (let i = -7; i <= 7; i++) {
    if (i === 0) continue;
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    options.push(d.toISOString().split('T')[0]);
  }
  return options;
};

const PruefungsEinladungPopup = React.memo(({ pruefung, sending, onClose, onZusage }) => {
  const [neinModus, setNeinModus] = useState(false);
  const [auswahl, setAuswahl] = useState(() => new Set());
  const optionen = useMemo(() => getAlternativeTerminOptions(pruefung.pruefungsdatum), [pruefung.pruefungsdatum]);

  const toggleTermin = (d) => {
    setAuswahl(prev => {
      const s = new Set(prev);
      s.has(d) ? s.delete(d) : s.add(d);
      return s;
    });
  };

  return (
    <div className="pnp-overlay" onClick={onClose}>
      <div className="pnp-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="pnp-header">
          <div className="pnp-header-left">
            <span style={{ fontSize: '20px' }}>🥋</span>
            <span className="pnp-header-title">Gürtelprüfung – Einladung</span>
          </div>
          <button className="pnp-close-btn" onClick={onClose} title="Schließen">✕</button>
        </div>
        <div className="pnp-body">
          <p style={{ marginBottom: '0.75rem', lineHeight: '1.5' }}>
            Du wurdest zur <strong>{pruefung.stil_name}</strong>-Prüfung eingeladen!
          </p>
          {pruefung.graduierung_nachher && (
            <p style={{ marginBottom: '0.5rem' }}>
              🎯 Prüfung zum: <strong>{pruefung.graduierung_nachher}</strong>
            </p>
          )}
          {pruefung.pruefungsdatum && (
            <p style={{ marginBottom: '0.5rem' }}>
              📅 Termin: <strong>{new Date(pruefung.pruefungsdatum).toLocaleDateString('de-DE', {
                weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
              })}</strong>
              {pruefung.pruefungszeit && ` um ${pruefung.pruefungszeit} Uhr`}
            </p>
          )}
          {pruefung.pruefungsort && (
            <p style={{ marginBottom: '0.75rem' }}>
              📍 Ort: <strong>{pruefung.pruefungsort}</strong>
            </p>
          )}

          {!neinModus ? (
            <>
              <p style={{ marginBottom: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Kannst du an diesem Termin teilnehmen?
              </p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '0.5rem' }}>
                <button
                  className="pnp-confirm-btn"
                  style={{ flex: 1, background: 'linear-gradient(135deg, #16a34a, #15803d)', opacity: sending ? 0.6 : 1 }}
                  disabled={sending}
                  onClick={() => onZusage('kommt')}
                >
                  ✅ Ja, ich kann kommen
                </button>
                <button
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(239,68,68,.4)',
                    background: 'rgba(239,68,68,.12)', color: '#f87171', fontWeight: 600, cursor: 'pointer',
                    fontSize: '14px', opacity: sending ? 0.6 : 1
                  }}
                  disabled={sending}
                  onClick={() => setNeinModus(true)}
                >
                  ❌ Nein, ich kann nicht
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Schade! An welchen Terminen könntest du?
              </p>
              <p style={{ marginBottom: '0.75rem', fontSize: '12px', color: 'var(--text-secondary)' }}>
                Wähle mögliche Alternativtermine aus (±7 Tage):
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '1rem', maxHeight: '180px', overflowY: 'auto' }}>
                {optionen.map(d => {
                  const selected = auswahl.has(d);
                  return (
                    <button
                      key={d}
                      onClick={() => toggleTermin(d)}
                      style={{
                        padding: '4px 10px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                        border: `1px solid ${selected ? 'rgba(99,102,241,.6)' : 'rgba(255,255,255,.15)'}`,
                        background: selected ? 'rgba(99,102,241,.25)' : 'rgba(255,255,255,.06)',
                        color: selected ? '#a5b4fc' : 'var(--text-secondary)',
                        fontWeight: selected ? 600 : 400,
                        transition: 'all 0.15s'
                      }}
                    >
                      {new Date(d + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.06)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px' }}
                  onClick={() => setNeinModus(false)}
                >
                  ← Zurück
                </button>
                <button
                  className="pnp-confirm-btn"
                  style={{ flex: 1, opacity: sending ? 0.6 : 1 }}
                  disabled={sending}
                  onClick={() => onZusage('kommt_nicht', [...auswahl])}
                >
                  {sending ? '⏳ Speichere…' : '✓ Bestätigen'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export default PruefungsEinladungPopup;
