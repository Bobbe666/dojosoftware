import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, CheckCircle, Printer, Clock, Calendar, TrendingUp, Plus } from 'lucide-react';
import '../styles/PruefungsStatus.css';

const API_BASE = '/api';

const PruefungsStatus = ({ mitgliedId, readOnly = false, mitglied = null }) => {
  const [stileDaten, setStileDaten] = useState([]);
  const [graduierungenProStil, setGraduierungenProStil] = useState({}); // stil_id → [{ graduierung_id, name, farbe_hex, reihenfolge }]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [druckenId, setDruckenId] = useState(null); // pruefung_id die gerade gedruckt wird

  // Historische Prüfung Modal
  const [showHistorischModal, setShowHistorischModal] = useState(false);
  const [historischForm, setHistorischForm] = useState({ stil_name: '', graduierung_name: '', pruefungsdatum: '', bemerkung: '' });
  const [historischePruefungen, setHistorischePruefungen] = useState([]);

  // Teilnahme Modal
  const [showTeilnahmeModal, setShowTeilnahmeModal] = useState(false);
  const [selectedPruefung, setSelectedPruefung] = useState(null);
  const [teilnahmeBedingungAkzeptiert, setTeilnahmeBedingungAkzeptiert] = useState(false);
  const [teilnahmeLoading, setTeilnahmeLoading] = useState(false);

  useEffect(() => {
    if (mitgliedId) {
      loadPruefungsdaten();
      loadHistorischePruefungen();
    }
  }, [mitgliedId]);

  const loadPruefungsdaten = async () => {
    try {
      setLoading(true);
      setError(null);
      const mitgliedStileResponse = await axios.get(`/mitglieder/${mitgliedId}/stile`);
      const zugewieseneStile = mitgliedStileResponse.data?.stile || [];
      if (zugewieseneStile.length === 0) { setStileDaten([]); setLoading(false); return; }

      const [historieResponse, trainingsResponse, ...gradResponses] = await Promise.all([
        axios.get(`/pruefungen/mitglied/${mitgliedId}/historie`),
        axios.get(`/anwesenheitProtokoll/pruefung/${mitgliedId}`),
        ...zugewieseneStile.map(s => axios.get(`/stile/${s.stil_id}/graduierungen`).catch(() => ({ data: [] })))
      ]);
      const historie = historieResponse.data?.historie || historieResponse.data || [];
      const trainings = trainingsResponse.data || {};

      // Graduierungen pro Stil speichern (nach reihenfolge sortiert)
      // Endpoint gibt Array direkt zurück (nicht { graduierungen: [] })
      const gradMap = {};
      zugewieseneStile.forEach((s, i) => {
        const raw = gradResponses[i]?.data;
        const grads = Array.isArray(raw) ? raw : (raw?.graduierungen || []);
        gradMap[s.stil_id] = grads.sort((a, b) => a.reihenfolge - b.reihenfolge);
      });
      setGraduierungenProStil(gradMap);

      const stileMitDaten = zugewieseneStile.map(stil => {
        const stilHistorie = historie.filter(p => p.stil_id === stil.stil_id);
        const stilTrainings = trainings.stile?.[stil.stil_name] || trainings.statistiken || trainings || {};
        const letztePruefung = stilHistorie
          .filter(p => p.bestanden === true || p.status === 'bestanden')
          .sort((a, b) => new Date(b.pruefungsdatum) - new Date(a.pruefungsdatum))[0];
        const naechstePruefung = stilHistorie.find(p => p.status === 'geplant');
        return {
          stil_id: stil.stil_id,
          stil_name: stil.stil_name,
          stil_emoji: stil.stil_emoji || '🥋',
          historie: stilHistorie,
          trainingsstunden: stilTrainings,
          letztePruefung,
          naechstePruefung,
          aktuelleGraduierung: letztePruefung?.graduierung_nachher || stil.graduierung_name || 'Anfänger',
          graduierungFarbe: letztePruefung?.farbe_nachher || stil.farbe || '#888',
        };
      });
      setStileDaten(stileMitDaten);
    } catch (e) {
      console.error('Fehler beim Laden der Prüfungsdaten:', e);
      setError('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const loadHistorischePruefungen = async () => {
    try {
      const r = await axios.get('/pruefungen-historisch/mitglied/' + mitgliedId);
      setHistorischePruefungen(r.data?.data || []);
    } catch {}
  };

  const fmt = (d) => d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

  const getFortschritt = (td) => {
    const anwesend = parseInt(td.trainingsstunden?.anwesend_stunden || td.trainingsstunden?.total_stunden || 0);
    const benoetigt = parseInt(td.trainingsstunden?.requirements?.min_stunden || 20);
    return Math.min(100, Math.round((anwesend / benoetigt) * 100));
  };

  const getMemberName = (pruefung) =>
    mitglied ? `${mitglied.vorname || ''} ${mitglied.nachname || ''}`.trim()
      : pruefung?.vorname ? `${pruefung.vorname} ${pruefung.nachname}` : '—';

  const certCSS = `
  @page { size: A4 landscape; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: transparent; }
  .cert-page { width: 297mm; height: 210mm; position: relative; break-inside: avoid; page-break-inside: avoid; }
  .cert-name { position: absolute; width: 100%; top: 64mm; text-align: center; font-family: 'Times New Roman', Georgia, serif; font-size: 22pt; font-style: italic; color: #000; letter-spacing: 0.5px; }
  .cert-rank { position: absolute; width: 100%; top: 102mm; text-align: center; font-family: 'Times New Roman', Georgia, serif; font-size: 22pt; font-style: italic; color: #000; letter-spacing: 0.5px; }
  .cert-nummer { position: absolute; width: 100%; top: 165mm; text-align: center; font-family: 'Times New Roman', Georgia, serif; font-size: 11pt; color: #000; letter-spacing: 1px; }
  .cert-datum { position: absolute; width: 100%; top: 173mm; text-align: center; font-family: 'Times New Roman', Georgia, serif; font-size: 11pt; color: #000; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } @page { size: A4 landscape; margin: 0; } }`;

  const buildCertPage = (name, grad, datum, nummer, index) => `
    <div class="cert-page" style="${index > 0 ? 'page-break-before: always; break-before: page;' : ''}">
      <div class="cert-name">${name}</div>
      <div class="cert-rank">${grad}</div>
      ${nummer ? `<div class="cert-nummer">${nummer}</div>` : ''}
      <div class="cert-datum">${datum}</div>
    </div>`;

  // Einzelne Urkunde drucken
  const druckeUrkunde = async (entry) => {
    setDruckenId(entry._key);
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Bitte Popup-Blocker deaktivieren'); setDruckenId(null); return; }

    const name = getMemberName(entry);
    const datum = fmt(entry.pruefungsdatum);
    const grad = entry._displayGrad || '—';

    const token = localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken');
    let urkundennummer = null;
    try {
      const r = await fetch(`${API_BASE}/verband-urkunden/naechste-nummer`, { headers: { 'Authorization': `Bearer ${token}` } });
      const d = await r.json();
      if (d.success && d.nummer) urkundennummer = d.nummer;
    } catch {}

    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Urkunde – ${name}</title><style>${certCSS}</style></head><body>${buildCertPage(name, grad, datum, urkundennummer, 0)}</body></html>`;
    win.document.open(); win.document.write(html); win.document.close(); win.focus();
    setTimeout(() => { win.print(); setDruckenId(null); }, 400);
  };

  // Alle Urkunden eines Stils drucken (eine Seite pro Urkunde)
  const druckeAlleUrkunden = async (entries) => {
    setDruckenId('alle');
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { alert('Bitte Popup-Blocker deaktivieren'); setDruckenId(null); return; }

    const name = getMemberName(entries[0]);
    const token = localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken');
    let baseNr = 0, datePart = '';
    try {
      const r = await fetch(`${API_BASE}/verband-urkunden/naechste-nummer`, { headers: { 'Authorization': `Bearer ${token}` } });
      const d = await r.json();
      if (d.success && d.nummer) { const p = d.nummer.split('-'); datePart = p[0]; baseNr = parseInt(p[1], 10); }
    } catch {}

    // Älteste zuerst drucken (chronologisch)
    const chronoEntries = [...entries].reverse();
    const pages = chronoEntries.map((e, i) => {
      const nummer = baseNr > 0 ? `${datePart}-${String(baseNr + i).padStart(5, '0')}` : null;
      return buildCertPage(name, e._displayGrad || '—', fmt(e.pruefungsdatum), nummer, i);
    }).join('');

    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Urkunden – ${name}</title><style>${certCSS}</style></head><body>${pages}</body></html>`;
    win.document.open(); win.document.write(html); win.document.close(); win.focus();
    setTimeout(() => { win.print(); setDruckenId(null); }, 400);
  };

  // Bestandene Prüfungen expandieren: übersprungene Gurte werden automatisch erkannt
  const expandBestandene = (bestandene) => {
    const entries = [];
    bestandene.forEach((p) => {
      const grads = graduierungenProStil[p.stil_id] || [];

      // Automatisch übersprungene Graduierungen erkennen
      let uebersprungene = [];
      if (grads.length > 0 && p.graduierung_vorher_id && p.graduierung_nachher_id) {
        const vorherIdx = grads.findIndex(g => g.graduierung_id === p.graduierung_vorher_id);
        const nachherIdx = grads.findIndex(g => g.graduierung_id === p.graduierung_nachher_id);
        if (vorherIdx >= 0 && nachherIdx > vorherIdx + 1) {
          // Alle Stufen zwischen vorher (exkl.) und nachher (exkl.)
          uebersprungene = grads.slice(vorherIdx + 1, nachherIdx);
        }
      } else if (p.graduierung_zwischen) {
        // Fallback: manuell gesetzter Zwischengurt
        uebersprungene = [{ name: p.graduierung_zwischen, farbe_hex: '#888' }];
      }

      // Übersprungene als eigene Einträge hinzufügen (älteste/niedrigste zuerst)
      uebersprungene.forEach((g, i) => {
        entries.push({
          ...p,
          _key: `${p.pruefung_id}_skip_${i}`,
          _displayGrad: g.name,
          _displayFarbe: g.farbe_hex || '#888',
          _isLatest: false,
          _isZwischen: true,
        });
      });

      // Eigentliche Prüfungsgraduierung
      entries.push({
        ...p,
        _key: `${p.pruefung_id}`,
        _displayGrad: p.graduierung_nachher,
        _displayFarbe: p.farbe_nachher || '#888',
        _isLatest: false,
        _isZwischen: false,
      });
    });

    // Aktuellsten Eintrag (höchster Gurt = letzter Eintrag der neuesten Prüfung) markieren
    if (bestandene.length > 0) {
      const neuesteId = `${bestandene[0].pruefung_id}`;
      const latest = entries.find(e => e._key === neuesteId);
      if (latest) latest._isLatest = true;
    }
    return entries;
  };

  const handleTeilnahmeBestaetigen = async () => {
    if (!selectedPruefung || !teilnahmeBedingungAkzeptiert) return;
    setTeilnahmeLoading(true);
    try {
      await axios.post(`/pruefungen/${selectedPruefung.pruefung_id}/teilnahme-bestaetigen`, { mitglied_id: mitgliedId });
      setShowTeilnahmeModal(false);
      setSelectedPruefung(null);
      loadPruefungsdaten();
    } catch (err) {
      alert('❌ ' + (err.response?.data?.error || 'Fehler beim Bestätigen'));
    } finally {
      setTeilnahmeLoading(false);
    }
  };

  const handleSaveHistorisch = async () => {
    if (!historischForm.stil_name || !historischForm.graduierung_name || !historischForm.pruefungsdatum) {
      alert('Bitte Stil, Graduierung und Datum eingeben'); return;
    }
    try {
      await axios.post('/pruefungen-historisch', { mitglied_id: mitgliedId, ...historischForm });
      setShowHistorischModal(false);
      loadHistorischePruefungen();
    } catch { alert('Fehler beim Speichern'); }
  };

  const handleDeleteHistorisch = async (id) => {
    if (!window.confirm('Wirklich löschen?')) return;
    try { await axios.delete('/pruefungen-historisch/' + id); loadHistorischePruefungen(); } catch {}
  };

  if (loading) return (
    <div className="ps2-loading">
      <div className="ps2-spinner" />
      <span>Lade Prüfungsdaten…</span>
    </div>
  );

  if (error) return (
    <div className="ps2-error">⚠️ {error}</div>
  );

  if (stileDaten.length === 0) return (
    <div className="ps2-empty">
      <div className="ps2-empty-icon">🎓</div>
      <p>{readOnly ? 'Noch keine Stile zugewiesen.' : 'Diesem Mitglied wurden noch keine Stile zugewiesen. Bitte im Tab "Stile" einen Stil zuweisen.'}</p>
    </div>
  );

  return (
    <div className="ps2-wrapper">
      {stileDaten.map(sd => {
        const bestandene = sd.historie.filter(p => p.bestanden === true || p.status === 'bestanden')
          .sort((a, b) => new Date(b.pruefungsdatum) - new Date(a.pruefungsdatum));
        const urkundenEntries = expandBestandene(bestandene);
        const fortschritt = getFortschritt(sd);
        const anwesend = parseInt(sd.trainingsstunden?.anwesend_stunden || sd.trainingsstunden?.total_stunden || 0);
        const benoetigt = parseInt(sd.trainingsstunden?.requirements?.min_stunden || 20);
        const nochBenoetigt = Math.max(0, benoetigt - anwesend);

        return (
          <div key={sd.stil_id} className="ps2-stil-section">
            {/* Stil Header */}
            <div className="ps2-stil-header">
              <span className="ps2-stil-emoji">{sd.stil_emoji}</span>
              <h2 className="ps2-stil-name">{sd.stil_name}</h2>
              <div className="ps2-stil-belt" style={{ background: sd.graduierungFarbe }} />
              <span className="ps2-stil-current-grad">{sd.aktuelleGraduierung}</span>
            </div>

            <div className="ps2-grid">
              {/* Status Card */}
              <div className="ps2-card ps2-card-status">
                <div className="ps2-card-head">
                  <TrendingUp size={15} />
                  <span>Training & Fortschritt</span>
                </div>
                <div className="ps2-stat-row">
                  <span className="ps2-stat-label">Absolviert</span>
                  <span className="ps2-stat-value ps2-stat-ok">{anwesend} Std.</span>
                </div>
                <div className="ps2-stat-row">
                  <span className="ps2-stat-label">Benötigt</span>
                  <span className="ps2-stat-value">{benoetigt} Std.</span>
                </div>
                <div className="ps2-stat-row">
                  <span className="ps2-stat-label">Noch fehlend</span>
                  <span className={`ps2-stat-value ${nochBenoetigt === 0 ? 'ps2-stat-ok' : 'ps2-stat-warn'}`}>{nochBenoetigt} Std.</span>
                </div>
                <div className="ps2-progress-wrap">
                  <div className="ps2-progress-track">
                    <div className="ps2-progress-fill" style={{ width: `${fortschritt}%`, background: fortschritt >= 80 ? '#22c55e' : fortschritt >= 50 ? '#f59e0b' : '#ef4444' }} />
                  </div>
                  <span className="ps2-progress-pct">{fortschritt}%</span>
                </div>
                {sd.letztePruefung && (
                  <div className="ps2-stat-row ps2-stat-row-top">
                    <span className="ps2-stat-label"><Calendar size={12} /> Letzte Prüfung</span>
                    <span className="ps2-stat-value">{fmt(sd.letztePruefung.pruefungsdatum)}</span>
                  </div>
                )}
              </div>

              {/* Nächste Prüfung Card */}
              {sd.naechstePruefung ? (
                <div className="ps2-card ps2-card-next">
                  <div className="ps2-card-head">
                    <Clock size={15} />
                    <span>Nächste Prüfung</span>
                  </div>
                  <div className="ps2-next-date">{fmt(sd.naechstePruefung.pruefungsdatum)}</div>
                  <div className="ps2-next-grad">{sd.naechstePruefung.graduierung_nachher || sd.naechstePruefung.graduierung || '—'}</div>
                  {sd.naechstePruefung.pruefungsort && (
                    <div className="ps2-next-ort">📍 {sd.naechstePruefung.pruefungsort}</div>
                  )}
                  {!readOnly && (
                    <div className="ps2-mt">
                      {sd.naechstePruefung.teilnahme_bestaetigt ? (
                        <div className="ps2-confirmed"><CheckCircle size={14} /> Teilnahme bestätigt</div>
                      ) : (
                        <button className="ps2-btn-confirm" onClick={() => { setSelectedPruefung(sd.naechstePruefung); setTeilnahmeBedingungAkzeptiert(false); setShowTeilnahmeModal(true); }}>
                          <CheckCircle size={14} /> Teilnahme bestätigen
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="ps2-card ps2-card-next ps2-card-no-exam">
                  <div className="ps2-card-head">
                    <Clock size={15} />
                    <span>Nächste Prüfung</span>
                  </div>
                  <p className="ps2-no-exam-text">Keine Prüfung geplant</p>
                </div>
              )}
            </div>

            {/* Urkunden-Archiv */}
            <div className="ps2-card ps2-card-full">
              <div className="ps2-card-head ps2-card-head-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🎖️</span>
                  <span>Urkunden-Archiv</span>
                  {urkundenEntries.length > 0 && <span className="ps2-badge">{urkundenEntries.length}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {urkundenEntries.length > 1 && (
                    <button
                      className={`ps2-btn-print-all ${druckenId === 'alle' ? 'ps2-btn-print-all--loading' : ''}`}
                      onClick={() => druckeAlleUrkunden(urkundenEntries)}
                      disabled={druckenId === 'alle'}
                      title="Alle Urkunden nacheinander drucken"
                    >
                      <Printer size={13} />
                      {druckenId === 'alle' ? 'Druckt…' : `Alle drucken (${urkundenEntries.length})`}
                    </button>
                  )}
                  {!readOnly && (
                    <button className="ps2-btn-add" onClick={() => { setHistorischForm({ stil_name: sd.stil_name, graduierung_name: '', pruefungsdatum: '', bemerkung: '' }); setShowHistorischModal(true); }}>
                      <Plus size={13} /> Historisch
                    </button>
                  )}
                </div>
              </div>

              {urkundenEntries.length === 0 ? (
                <p className="ps2-empty-hist">Noch keine bestandenen Prüfungen in {sd.stil_name}.</p>
              ) : (
                <div className="ps2-urkunden-list">
                  {urkundenEntries.map((entry) => (
                    <div key={entry._key} className={`ps2-urkunde-row ${entry._isLatest ? 'ps2-urkunde-row--latest' : ''}`}>
                      <div className="ps2-urkunde-left">
                        <div className="ps2-urkunde-belt" style={{ background: entry._displayFarbe }} />
                        <div className="ps2-urkunde-info">
                          <span className="ps2-urkunde-grad">{entry._displayGrad || '—'}</span>
                          <span className="ps2-urkunde-date">{fmt(entry.pruefungsdatum)}</span>
                        </div>
                        {entry._isLatest && <span className="ps2-urkunde-current-badge">Aktuell</span>}
                        {entry._isZwischen && <span className="ps2-urkunde-zw-badge">Zwischengurt</span>}
                      </div>
                      <button
                        className={`ps2-btn-print ${druckenId === entry._key ? 'ps2-btn-print--loading' : ''}`}
                        onClick={() => druckeUrkunde(entry)}
                        disabled={!!druckenId}
                        title="Urkunde nachdrucken"
                      >
                        <Printer size={14} />
                        {druckenId === entry._key ? 'Druckt…' : 'Nachdrucken'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Historische Prüfungen (vor Systemeinführung) */}
      {historischePruefungen.length > 0 && (
        <div className="ps2-card ps2-card-full ps2-card-historisch">
          <div className="ps2-card-head">
            <span>📜</span>
            <span>Vor Systemeinführung</span>
          </div>
          <div className="ps2-hist-list">
            {historischePruefungen.map(p => (
              <div key={p.id} className="ps2-hist-row">
                <span className="ps2-hist-date">{new Date(p.pruefungsdatum).toLocaleDateString('de-DE')}</span>
                <span className="ps2-hist-stil">{p.stil_name}</span>
                <span className="ps2-hist-grad">{p.graduierung_name}</span>
                {p.bemerkung && <span className="ps2-hist-note">{p.bemerkung}</span>}
                {!readOnly && (
                  <button className="ps2-btn-delete" onClick={() => handleDeleteHistorisch(p.id)} title="Löschen">
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historische Prüfung Modal */}
      {showHistorischModal && (
        <div className="ps2-modal-overlay" onClick={() => setShowHistorischModal(false)}>
          <div className="ps2-modal" onClick={e => e.stopPropagation()}>
            <div className="ps2-modal-head">
              <h3>📜 Historische Prüfung</h3>
              <button className="ps2-modal-close" onClick={() => setShowHistorischModal(false)}><X size={18} /></button>
            </div>
            <div className="ps2-modal-body">
              {[
                { label: 'Stil', key: 'stil_name', placeholder: 'z.B. Kickboxen, Karate…' },
                { label: 'Graduierung', key: 'graduierung_name', placeholder: 'z.B. Gelbgurt, 5. Kyu…' },
                { label: 'Bemerkung (optional)', key: 'bemerkung', placeholder: 'Optional…' },
              ].map(({ label, key, placeholder }) => (
                <div key={key} className="ps2-field">
                  <label>{label}</label>
                  <input type="text" value={historischForm[key]} onChange={e => setHistorischForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} className="ps2-input" />
                </div>
              ))}
              <div className="ps2-field">
                <label>Datum *</label>
                <input type="date" value={historischForm.pruefungsdatum} onChange={e => setHistorischForm(f => ({ ...f, pruefungsdatum: e.target.value }))} className="ps2-input" />
              </div>
            </div>
            <div className="ps2-modal-foot">
              <button className="ps2-btn-cancel" onClick={() => setShowHistorischModal(false)}>Abbrechen</button>
              <button className="ps2-btn-save" onClick={handleSaveHistorisch}>Speichern</button>
            </div>
          </div>
        </div>
      )}

      {/* Teilnahme bestätigen Modal */}
      {showTeilnahmeModal && selectedPruefung && (
        <div className="ps2-modal-overlay" onClick={() => setShowTeilnahmeModal(false)}>
          <div className="ps2-modal" onClick={e => e.stopPropagation()}>
            <div className="ps2-modal-head">
              <h3>🎓 Prüfungsanmeldung</h3>
              <button className="ps2-modal-close" onClick={() => setShowTeilnahmeModal(false)}><X size={18} /></button>
            </div>
            <div className="ps2-modal-body">
              <div className="ps2-detail-grid">
                <span className="ps2-dl">Stil</span><span className="ps2-dv">{selectedPruefung.stil_name}</span>
                <span className="ps2-dl">Ziel-Graduierung</span><span className="ps2-dv ps2-dv-accent">{selectedPruefung.graduierung_nachher || '—'}</span>
                {selectedPruefung.pruefungsdatum && (<><span className="ps2-dl">Datum</span><span className="ps2-dv">📅 {new Date(selectedPruefung.pruefungsdatum).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}{selectedPruefung.pruefungszeit && ` um ${selectedPruefung.pruefungszeit} Uhr`}</span></>)}
                {selectedPruefung.pruefungsort && (<><span className="ps2-dl">Ort</span><span className="ps2-dv">📍 {selectedPruefung.pruefungsort}</span></>)}
                {selectedPruefung.pruefungsgebuehr && (<><span className="ps2-dl">Gebühr</span><span className="ps2-dv">💰 {parseFloat(selectedPruefung.pruefungsgebuehr).toFixed(2)} €</span></>)}
              </div>
              <div className="ps2-storno-hinweis">
                <div className="ps2-storno-icon">📋</div>
                <div className="ps2-storno-text">
                  <strong>Hinweis zur Stornierung</strong>
                  <p>
                    Wir freuen uns riesig, dich bei deiner Prüfung begrüßen zu dürfen! 🎉 Damit alles reibungslos klappen kann, möchten wir dich herzlich auf Folgendes hinweisen: <strong>Eine Abmeldung ist bis 7 Tage vor dem Prüfungstermin kostenlos möglich.</strong> Ab diesem Zeitpunkt laufen alle Vorbereitungen auf Hochtouren — deine Urkunde wird gedruckt, Prüfer sind eingeplant und die gesamte Organisation steht. Der damit verbundene Aufwand ist dann bereits entstanden und kann leider nicht mehr rückgängig gemacht werden. <strong>Die Prüfungsgebühr bleibt in diesem Fall in voller Höhe fällig</strong> — auch bei Verhinderung. Wir danken dir für dein Verständnis und drücken dir schon jetzt ganz fest die Daumen! 🥋
                  </p>
                </div>
              </div>
              <label className="ps2-checkbox-row">
                <input type="checkbox" checked={teilnahmeBedingungAkzeptiert} onChange={e => setTeilnahmeBedingungAkzeptiert(e.target.checked)} />
                <span>Ich habe den Stornierungshinweis gelesen und bestätige meine Teilnahme. Mir ist bewusst, dass die Prüfungsgebühr bei Abmeldung innerhalb von 7 Tagen vor der Prüfung fällig bleibt.</span>
              </label>
              <div className="ps2-modal-actions">
                <button className="ps2-btn-cancel" onClick={() => setShowTeilnahmeModal(false)}>Abbrechen</button>
                <button className={`ps2-btn-confirm-modal ${teilnahmeBedingungAkzeptiert ? 'ps2-btn-confirm-modal--active' : ''}`} onClick={handleTeilnahmeBestaetigen} disabled={!teilnahmeBedingungAkzeptiert || teilnahmeLoading}>
                  {teilnahmeLoading ? '…' : '✅ Jetzt anmelden'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PruefungsStatus;
