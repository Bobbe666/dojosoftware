// =============================================================================
// MemberContractStatus — Vertragsstatus + Ruhepause/Kündigung/Tarifanpassung
// (aus MemberDashboard extrahiert). Eigener State + eigene Loader + inline
// Submit-Handler. Tippen in den Formularen rendert nur noch diese Komponente,
// nicht mehr den 3700-Zeilen-Monolithen. React.memo.
// =============================================================================
import React, { useState, useEffect } from 'react';

function MemberContractStatus({ mitgliedId }) {

  // Vertrag-Anpassungen (Mitglied-Sicht)
  const [meineAnpassungen, setMeineAnpassungen] = useState([]);
  const [showAnpassungForm, setShowAnpassungForm] = useState(false);
  const [anpassungForm, setAnpassungForm] = useState({ typ: 'student', gueltig_von: '', gueltig_bis: '', grund: '' });
  const [anpassungLoading, setAnpassungLoading] = useState(false);
  const [anpassungError, setAnpassungError] = useState('');
  const [anpassungSuccess, setAnpassungSuccess] = useState('');
  // Ruhepause
  const [showRuhepauseForm, setShowRuhepauseForm] = useState(false);
  const [ruhepauseForm, setRuhepauseForm] = useState({ gueltig_von: '', gueltig_bis: '', grund: '' });
  const [ruhepauseLoading, setRuhepauseLoading] = useState(false);
  const [ruhepauseError, setRuhepauseError] = useState('');
  const [ruhepauseSuccess, setRuhepauseSuccess] = useState('');
  const [ruhepauseInfo, setRuhepauseInfo] = useState(null);
  const [ruhepauseMaxMonate, setRuhepauseMaxMonate] = useState(3);
  // Kündigung
  const [showKuendigungForm, setShowKuendigungForm] = useState(false);
  const [kuendigungGrund, setKuendigungGrund] = useState('');
  const [kuendigungBestaetigt, setKuendigungBestaetigt] = useState(false);
  const [kuendigungLoading, setKuendigungLoading] = useState(false);
  const [kuendigungError, setKuendigungError] = useState('');
  const [kuendigungSuccess, setKuendigungSuccess] = useState('');
  const [kuendigungInfo, setKuendigungInfo] = useState(null);

  // Meine Vertrag-Anpassungen + Ruhepause + Kündigungsinfo laden
  useEffect(() => {
    if (!mitgliedId) return;
    const token = localStorage.getItem('memberToken') || localStorage.getItem('token');
    const headers = { 'Authorization': `Bearer ${token}` };
    const loadAnpassungen = async () => {
      try { const resp = await fetch('/api/vertrag-anpassungen/meine', { headers }); if (resp.ok) { const data = await resp.json(); setMeineAnpassungen(data.anpassungen || []); } } catch (_) {}
    };
    const loadRuhepause = async () => {
      try { const resp = await fetch('/api/vertrag-anpassungen/aktive-ruhepause', { headers }); if (resp.ok) { const data = await resp.json(); if (data.success) setRuhepauseInfo(data); } } catch (_) {}
    };
    const loadRuhepauseMax = async () => {
      try { const resp = await fetch('/api/vertrag-anpassungen/ruhepause-einstellungen', { headers }); if (resp.ok) { const data = await resp.json(); if (data.success) setRuhepauseMaxMonate(data.max_monate || 3); } } catch (_) {}
    };
    const loadKuendigungInfo = async () => {
      try { const resp = await fetch('/api/vertrag-anpassungen/kuendigung-info', { headers }); if (resp.ok) { const data = await resp.json(); if (data.success) setKuendigungInfo(data); } } catch (_) {}
    };
    loadAnpassungen(); loadRuhepause(); loadRuhepauseMax(); loadKuendigungInfo();
  }, [mitgliedId]);

  return (
      <div className="md-anpassung-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>📋 Mein Vertragsstatus</h3>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => { setShowRuhepauseForm(f => !f); setShowAnpassungForm(false); setRuhepauseError(''); setRuhepauseSuccess(''); }}
              style={{ background: showRuhepauseForm ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${showRuhepauseForm ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.12)'}`, borderRadius: 8, padding: '0.35rem 0.75rem', color: showRuhepauseForm ? '#60a5fa' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.82rem' }}
            >
              {showRuhepauseForm ? '↑ Schließen' : '⏸ Ruhepause beantragen'}
            </button>
            <button
              onClick={() => { setShowAnpassungForm(f => !f); setShowRuhepauseForm(false); setAnpassungError(''); setAnpassungSuccess(''); }}
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '0.35rem 0.75rem', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.82rem' }}
            >
              {showAnpassungForm ? '↑ Schließen' : '+ Anpassung beantragen'}
            </button>
            {!kuendigungInfo?.bereits_gekuendigt && !kuendigungInfo?.keinVertrag && (
              <button
                onClick={() => { setShowKuendigungForm(f => !f); setShowRuhepauseForm(false); setShowAnpassungForm(false); setKuendigungError(''); setKuendigungSuccess(''); setKuendigungBestaetigt(false); }}
                style={{ background: showKuendigungForm ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${showKuendigungForm ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.12)'}`, borderRadius: 8, padding: '0.35rem 0.75rem', color: showKuendigungForm ? '#f87171' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.82rem' }}
              >
                {showKuendigungForm ? '↑ Schließen' : '✕ Kündigung beantragen'}
              </button>
            )}
          </div>
        </div>

        {/* Aktive Anpassung anzeigen */}
        {meineAnpassungen.filter(a => a.status === 'genehmigt').length > 0 && (
          <div style={{ background: 'rgba(76,175,80,0.08)', border: '1px solid rgba(76,175,80,0.3)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '0.75rem' }}>
            {meineAnpassungen.filter(a => a.status === 'genehmigt').map(a => {
              const typLabels = { schueler: 'Schüler', student: 'Student', azubi: 'Azubi', rentner: 'Rentner', sonstiges: 'Sonstiges' };
              return (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ color: '#4caf50', fontWeight: 600 }}>✓ {typLabels[a.typ] || a.typ}-Tarif aktiv</span>
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{parseFloat(a.neuer_betrag).toFixed(2).replace('.', ',')} €/Monat</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>bis {new Date(a.gueltig_bis).toLocaleDateString('de-DE')}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Offene Anträge */}
        {meineAnpassungen.filter(a => a.status === 'beantragt').length > 0 && (
          <div style={{ background: 'rgba(255,152,0,0.08)', border: '1px solid rgba(255,152,0,0.3)', borderRadius: 10, padding: '0.65rem 1rem', marginBottom: '0.75rem', fontSize: '0.85rem', color: '#ff9800' }}>
            ⏳ Dein Antrag wartet auf Genehmigung durch den Administrator.
          </div>
        )}

        {/* Aktive / geplante Ruhepause */}
        {ruhepauseInfo?.aktiv && ruhepauseInfo.ruhepause && (
          <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
              <span style={{ color: '#60a5fa', fontWeight: 600 }}>⏸ Ruhepause aktiv</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                {new Date(ruhepauseInfo.ruhepause.von + 'T00:00').toLocaleDateString('de-DE')} – {new Date(ruhepauseInfo.ruhepause.bis + 'T00:00').toLocaleDateString('de-DE')}
                {ruhepauseInfo.ruhepause.dauer_monate && ` · ${ruhepauseInfo.ruhepause.dauer_monate} Monat${ruhepauseInfo.ruhepause.dauer_monate !== 1 ? 'e' : ''}`}
              </span>
            </div>
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Während der Ruhepause werden keine Beiträge eingezogen. Dein Vertrag läuft danach automatisch weiter.
            </p>
          </div>
        )}
        {ruhepauseInfo?.geplant && !ruhepauseInfo?.aktiv && ruhepauseInfo.ruhepause && (
          <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 10, padding: '0.65rem 1rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
            <span style={{ color: '#93c5fd' }}>
              📅 Ruhepause geplant: {new Date(ruhepauseInfo.ruhepause.von + 'T00:00').toLocaleDateString('de-DE')} – {new Date(ruhepauseInfo.ruhepause.bis + 'T00:00').toLocaleDateString('de-DE')}
            </span>
          </div>
        )}
        {ruhepauseInfo?.pending && !ruhepauseInfo?.aktiv && !ruhepauseInfo?.geplant && (
          <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, padding: '0.65rem 1rem', marginBottom: '0.75rem', fontSize: '0.85rem', color: '#a5b4fc' }}>
            ⏳ Dein Ruhepause-Antrag ({new Date(ruhepauseInfo.pending.gueltig_von + 'T00:00').toLocaleDateString('de-DE')} – {new Date(ruhepauseInfo.pending.gueltig_bis + 'T00:00').toLocaleDateString('de-DE')}) wartet auf Genehmigung.
          </div>
        )}

        {/* Ruhepause-Formular */}
        {showRuhepauseForm && (
          <div style={{ background: 'rgba(59,130,246,0.05)', borderRadius: 10, padding: '1rem', border: '1px solid rgba(59,130,246,0.2)', marginBottom: '0.75rem' }}>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Eine Ruhepause unterbricht deinen Vertrag für einen bestimmten Zeitraum – keine Beiträge, volle Reaktivierung danach. Max. {ruhepauseMaxMonate} Monat{ruhepauseMaxMonate !== 1 ? 'e' : ''} möglich.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.65rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 3 }}>Ruhepause ab</label>
                <input type="date" value={ruhepauseForm.gueltig_von}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={e => setRuhepauseForm(f => ({ ...f, gueltig_von: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 3 }}>Ruhepause bis</label>
                <input type="date" value={ruhepauseForm.gueltig_bis}
                  min={ruhepauseForm.gueltig_von || new Date().toISOString().slice(0, 10)}
                  onChange={e => setRuhepauseForm(f => ({ ...f, gueltig_bis: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 3 }}>Grund (optional)</label>
                <input type="text" placeholder="z.B. Verletzung, Urlaub, berufliche Auszeit…"
                  value={ruhepauseForm.grund}
                  onChange={e => setRuhepauseForm(f => ({ ...f, grund: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
            </div>
            {ruhepauseError && <div style={{ color: '#f87171', fontSize: '0.82rem', marginBottom: '0.5rem' }}>⚠️ {ruhepauseError}</div>}
            {ruhepauseSuccess && <div style={{ color: '#60a5fa', fontSize: '0.82rem', marginBottom: '0.5rem' }}>✓ {ruhepauseSuccess}</div>}
            <button
              disabled={ruhepauseLoading}
              onClick={async () => {
                const { gueltig_von, gueltig_bis, grund } = ruhepauseForm;
                if (!gueltig_von || !gueltig_bis) { setRuhepauseError('Bitte Beginn und Ende ausfüllen.'); return; }
                if (gueltig_bis < gueltig_von) { setRuhepauseError('Enddatum muss nach Startdatum liegen.'); return; }
                const von = new Date(gueltig_von), bis = new Date(gueltig_bis);
                const diffMonate = (bis.getFullYear() - von.getFullYear()) * 12 + (bis.getMonth() - von.getMonth()) + (bis.getDate() >= von.getDate() ? 0 : -1) + 1;
                if (diffMonate > ruhepauseMaxMonate) { setRuhepauseError(`Ruhepause darf maximal ${ruhepauseMaxMonate} Monat${ruhepauseMaxMonate !== 1 ? 'e' : ''} dauern.`); return; }
                setRuhepauseLoading(true); setRuhepauseError('');
                try {
                  const token = localStorage.getItem('memberToken') || localStorage.getItem('token');
                  const resp = await fetch('/api/vertrag-anpassungen/beantragen', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ typ: 'ruhepause', gueltig_von, gueltig_bis, grund: grund || null })
                  });
                  const data = await resp.json();
                  if (!resp.ok) throw new Error(data.error || 'Fehler');
                  setRuhepauseSuccess('Antrag gestellt! Der Administrator wird ihn prüfen und bestätigen.');
                  setRuhepauseForm({ gueltig_von: '', gueltig_bis: '', grund: '' });
                  setShowRuhepauseForm(false);
                  // Ruhepause-Info neu laden
                  const r2 = await fetch('/api/vertrag-anpassungen/aktive-ruhepause', { headers: { 'Authorization': `Bearer ${token}` } });
                  const d2 = await r2.json();
                  if (d2.success) setRuhepauseInfo(d2);
                } catch (err) { setRuhepauseError(err.message); }
                finally { setRuhepauseLoading(false); }
              }}
              style={{ width: '100%', padding: '0.6rem', borderRadius: 8, background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', border: 'none', color: 'var(--ds-text)', fontWeight: 600, cursor: ruhepauseLoading ? 'not-allowed' : 'pointer', opacity: ruhepauseLoading ? 0.7 : 1 }}
            >
              {ruhepauseLoading ? '⏳ Senden…' : '⏸ Ruhepause beantragen'}
            </button>
          </div>
        )}

        {/* Bestehende Kündigung anzeigen */}
        {kuendigungInfo?.bereits_gekuendigt && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '0.75rem' }}>
            <span style={{ color: '#f87171', fontWeight: 600 }}>✕ Kündigung aktiv</span>
            {kuendigungInfo.kuendigungsdatum && (
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginLeft: 8 }}>
                zum {new Date(kuendigungInfo.kuendigungsdatum + 'T00:00').toLocaleDateString('de-DE')}
              </span>
            )}
          </div>
        )}
        {kuendigungInfo?.offener_antrag && !kuendigungInfo?.bereits_gekuendigt && (
          <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '0.65rem 1rem', marginBottom: '0.75rem', fontSize: '0.85rem', color: '#f87171' }}>
            ⏳ Kündigung beantragt — wartet auf Bestätigung durch den Administrator.
          </div>
        )}

        {/* Kündigung-Formular */}
        {showKuendigungForm && (
          <div style={{ background: 'rgba(239,68,68,0.06)', borderRadius: 10, padding: '1rem', border: '1px solid rgba(239,68,68,0.25)', marginBottom: '0.75rem' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
              Deine Kündigungsfrist beträgt <strong style={{ color: 'var(--text-primary)' }}>{kuendigungInfo?.kuendigungsfrist_monate || 3} Monate</strong>.
              {kuendigungInfo?.fruehestens_datum && (
                <> Frühestmögliches Vertragsende: <strong style={{ color: '#f87171' }}>{new Date(kuendigungInfo.fruehestens_datum + 'T00:00').toLocaleDateString('de-DE')}</strong>.</>
              )}
            </p>
            <div style={{ marginBottom: '0.65rem' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 3 }}>Kündigungsgrund (optional)</label>
              <textarea
                value={kuendigungGrund}
                onChange={e => setKuendigungGrund(e.target.value)}
                placeholder="Grund für die Kündigung…"
                rows={3}
                style={{ width: '100%', borderRadius: 7, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', padding: '0.5rem 0.65rem', fontSize: '0.85rem', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.83rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={kuendigungBestaetigt} onChange={e => setKuendigungBestaetigt(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
              Ich bestätige, dass ich meinen Vertrag kündigen möchte. Die Kündigung wird nach Prüfung durch den Administrator wirksam.
            </label>
            {kuendigungError && <p style={{ color: '#f87171', fontSize: '0.82rem', marginBottom: '0.5rem' }}>{kuendigungError}</p>}
            {kuendigungSuccess && <p style={{ color: '#4ade80', fontSize: '0.82rem', marginBottom: '0.5rem' }}>{kuendigungSuccess}</p>}
            <button
              disabled={!kuendigungBestaetigt || kuendigungLoading}
              onClick={async () => {
                setKuendigungLoading(true); setKuendigungError(''); setKuendigungSuccess('');
                try {
                  const token = localStorage.getItem('memberToken') || localStorage.getItem('token');
                  const resp = await fetch('/api/vertrag-anpassungen/beantragen', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ typ: 'kuendigung', gueltig_bis: kuendigungInfo?.fruehestens_datum, grund: kuendigungGrund || null }),
                  });
                  const data = await resp.json();
                  if (!resp.ok) throw new Error(data.error || 'Fehler');
                  setKuendigungSuccess('Deine Kündigung wurde übermittelt und wird geprüft.');
                  setShowKuendigungForm(false);
                  setKuendigungInfo(prev => ({ ...prev, offener_antrag: { id: data.id } }));
                } catch (e) { setKuendigungError(e.message); }
                finally { setKuendigungLoading(false); }
              }}
              style={{ background: kuendigungBestaetigt ? 'rgba(239,68,68,0.8)' : 'rgba(255,255,255,0.1)', color: 'var(--ds-text)', border: 'none', borderRadius: 8, padding: '0.5rem 1.25rem', fontWeight: 600, cursor: kuendigungBestaetigt ? 'pointer' : 'not-allowed', fontSize: '0.85rem', opacity: kuendigungBestaetigt ? 1 : 0.5 }}
            >
              {kuendigungLoading ? '⏳ Senden…' : '✕ Kündigung beantragen'}
            </button>
          </div>
        )}

        {/* Antrags-Formular */}
        {showAnpassungForm && (
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '1rem', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginBottom: '0.65rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 3 }}>Grund der Anpassung</label>
                <select
                  value={anpassungForm.typ}
                  onChange={e => setAnpassungForm(f => ({ ...f, typ: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)' }}
                >
                  <option value="schueler">Schüler</option>
                  <option value="student">Student</option>
                  <option value="azubi">Azubi</option>
                  <option value="rentner">Rentner</option>
                  <option value="sonstiges">Sonstiges</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 3 }}>Gültig von</label>
                <input type="date" value={anpassungForm.gueltig_von} onChange={e => setAnpassungForm(f => ({ ...f, gueltig_von: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 3 }}>Gültig bis</label>
                <input type="date" value={anpassungForm.gueltig_bis} onChange={e => setAnpassungForm(f => ({ ...f, gueltig_bis: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 3 }}>Begründung (optional)</label>
                <input type="text" placeholder="z.B. Immatrikulation liegt vor" value={anpassungForm.grund} onChange={e => setAnpassungForm(f => ({ ...f, grund: e.target.value }))}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
              </div>
            </div>
            {anpassungError && <div style={{ color: '#ff6b6b', fontSize: '0.82rem', marginBottom: '0.5rem' }}>⚠️ {anpassungError}</div>}
            {anpassungSuccess && <div style={{ color: '#4caf50', fontSize: '0.82rem', marginBottom: '0.5rem' }}>✓ {anpassungSuccess}</div>}
            <button
              disabled={anpassungLoading}
              onClick={async () => {
                const { typ, gueltig_von, gueltig_bis, grund } = anpassungForm;
                if (!gueltig_von || !gueltig_bis) { setAnpassungError('Bitte Beginn und Ende ausfüllen.'); return; }
                setAnpassungLoading(true); setAnpassungError('');
                try {
                  const token = localStorage.getItem('memberToken') || localStorage.getItem('token');
                  const resp = await fetch('/api/vertrag-anpassungen/beantragen', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ typ, gueltig_von, gueltig_bis, grund: grund || null })
                  });
                  const data = await resp.json();
                  if (!resp.ok) throw new Error(data.error || 'Fehler');
                  setAnpassungSuccess('Antrag erfolgreich gestellt! Der Administrator wird ihn prüfen.');
                  setAnpassungForm({ typ: 'student', gueltig_von: '', gueltig_bis: '', grund: '' });
                  setShowAnpassungForm(false);
                  // Anpassungen neu laden
                  const r2 = await fetch('/api/vertrag-anpassungen/meine', { headers: { 'Authorization': `Bearer ${token}` } });
                  const d2 = await r2.json();
                  setMeineAnpassungen(d2.anpassungen || []);
                } catch (err) { setAnpassungError(err.message); }
                finally { setAnpassungLoading(false); }
              }}
              style={{ width: '100%', padding: '0.6rem', borderRadius: 8, background: 'linear-gradient(135deg, var(--primary), var(--primary-dark, #b8860b))', border: 'none', color: 'var(--ds-text)', fontWeight: 600, cursor: anpassungLoading ? 'not-allowed' : 'pointer' }}
            >
              {anpassungLoading ? '⏳ Senden...' : '📩 Antrag stellen'}
            </button>
          </div>
        )}
      </div>
  );
}

export default React.memo(MemberContractStatus);
