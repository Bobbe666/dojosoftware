import React from 'react';
import { Check, Scroll, Printer } from 'lucide-react';

// Ausgelagert aus PruefungsVerwaltung.jsx (Zugelassene-Pruefungen-Tab).
const PruefungsZugelasseneTab = ({
  stile, loading, setError,
  datumFilter, setDatumFilter, graduierungenProStil,
  showErgebnisModal, setShowErgebnisModal,
  selectedPruefung, setSelectedPruefung,
  pruefungsErgebnis, setPruefungsErgebnis,
  zugelassenePruefungen, gebuehrDialog, setGebuehrDialog,
  erinnerungStatus, druckAuswahlModal, setDruckAuswahlModal,
  zugelasseneStilFilter, setZugelasseneStilFilter,
  openZwischenPruefId, setOpenZwischenPruefId,
  openZugGroups, setOpenZugGroups,
  handleErinnerungSenden, druckeErgebnis, handleZulassungEntfernen,
  handleGraduierungZulassungAendern, handleAdminStatus, handleBatchRechnungErstellen,
  saveZwischengurt, loadGraduierungenFuerModal
}) => {
  return (
        <div className="pv3-zugelassen-section">
          <div className="pv2-mb-15">
            <div className="pv3-tab-section-header">
              <h2 className="pv3-zug-h2">Zugelassene Prüfungen ({zugelassenePruefungen.length})</h2>

              {/* Datum Filter */}
              <div className="pv3-zug-filter-group">
                <button
                  onClick={() => setDatumFilter('alle')}
                  className={`pv3-zug-filter-btn ${datumFilter === 'alle' ? 'active' : ''}`}
                >
                  Alle
                </button>
                <button
                  onClick={() => setDatumFilter('zukuenftig')}
                  className={`pv3-zug-filter-btn ${datumFilter === 'zukuenftig' ? 'active' : ''}`}
                >
                  Zukünftig
                </button>
                <button
                  onClick={() => setDatumFilter('vergangen')}
                  className={`pv3-zug-filter-btn ${datumFilter === 'vergangen' ? 'active' : ''}`}
                >
                  Vergangen
                </button>
              </div>
            </div>

            {/* Stilfilter */}
            <div className="pv-flex-row">
              <span className="pv-secondary-bold">
                Stil:
              </span>
              <select
                value={zugelasseneStilFilter}
                onChange={(e) => setZugelasseneStilFilter(e.target.value)}
                className="pv3-dark-select"
              >
                <option value="all" className="pv2-dark-input">
                  Alle Stile
                </option>
                {stile.map(stil => (
                  <option
                    key={stil.stil_id}
                    value={stil.stil_id}
                    className="pv2-dark-input"
                  >
                    {stil.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="pv2-center-3rem">Lädt...</div>
          ) : (() => {
            const heute = new Date();
            heute.setHours(0, 0, 0, 0);

            let gefiltert = zugelassenePruefungen.filter(pruefung => {
              if (zugelasseneStilFilter !== 'all' && pruefung.stil_id !== parseInt(zugelasseneStilFilter)) return false;
              const istAbgeschlossen = pruefung.status === 'bestanden' || pruefung.status === 'nicht_bestanden';
              if (datumFilter === 'zukuenftig') {
                if (istAbgeschlossen) return false;
                if (!pruefung.pruefungsdatum) return true;
                const d = new Date(pruefung.pruefungsdatum); d.setHours(0,0,0,0);
                return d >= heute;
              } else if (datumFilter === 'vergangen') {
                if (istAbgeschlossen) return true;
                if (!pruefung.pruefungsdatum) return false;
                const d = new Date(pruefung.pruefungsdatum); d.setHours(0,0,0,0);
                return d < heute;
              }
              return true;
            });

            if (gefiltert.length === 0) {
              return (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  {zugelassenePruefungen.length === 0
                    ? '🥋 Noch keine Kandidaten zur Prüfung zugelassen.'
                    : datumFilter === 'vergangen'
                      ? '📅 Keine vergangenen zugelassenen Prüfungen gefunden.'
                      : '📅 Keine zukünftigen zugelassenen Prüfungen gefunden.'}
                </div>
              );
            }

            // Gruppieren nach Datum + Stil
            const groupMap = {};
            gefiltert.forEach(p => {
              const key = `${p.pruefungsdatum || '__kein__'}___${p.stil_id}`;
              if (!groupMap[key]) {
                groupMap[key] = { datum: p.pruefungsdatum, stil_name: p.stil_name, stil_id: p.stil_id, candidates: [] };
              }
              groupMap[key].candidates.push(p);
            });

            const sortedGroups = Object.values(groupMap).sort((a, b) => {
              if (!a.datum && !b.datum) return 0;
              if (!a.datum) return 1;
              if (!b.datum) return -1;
              const da = new Date(a.datum); da.setHours(0,0,0,0);
              const db = new Date(b.datum); db.setHours(0,0,0,0);
              const aF = da >= heute, bF = db >= heute;
              if (aF && bF) return da - db;
              if (!aF && !bF) return db - da;
              return aF ? -1 : 1;
            });

            return (
              <div className="pv3-grouped-list">
                {sortedGroups.map(group => {
                  const groupDate = group.datum ? new Date(group.datum) : null;
                  if (groupDate) groupDate.setHours(0,0,0,0);
                  const isFuture = groupDate ? groupDate >= heute : false;
                  const dateStr = group.datum
                    ? new Date(group.datum).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
                    : 'Datum nicht festgelegt';
                  const sortedCandidates = [...group.candidates].sort((a, b) =>
                    `${a.nachname} ${a.vorname}`.localeCompare(`${b.nachname} ${b.vorname}`)
                  );

                  const groupKey = `${group.datum}___${group.stil_id}`;
                  const isOpen = !!openZugGroups[groupKey];

                  return (
                    <div key={groupKey} className="pv3-group-section">
                      <div
                        className={`pv3-group-header ${isFuture ? 'future' : 'past'} clickable`}
                        onClick={() => setOpenZugGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                      >
                        <div className="pv3-group-header-left">
                          <span className={`pv3-group-chevron ${isOpen ? 'open' : ''}`}>▶</span>
                          <span className={`pv3-group-date-label ${isFuture ? 'future' : 'past'}`}>
                            {isFuture ? '📅' : '🗓'} {dateStr}
                          </span>
                          <span className="pv3-stil-badge-sm">{group.stil_name}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                          <span className="pv3-group-count">
                            {group.candidates.length} Kandidat{group.candidates.length !== 1 ? 'en' : ''}
                          </span>
                          {group.candidates.filter(c => c.mitglied_antwort === 'kommt').length > 0 && (
                            <span style={{ fontSize: '11px', background: 'rgba(34,197,94,.15)', border: '1px solid rgba(34,197,94,.35)', color: '#22c55e', borderRadius: '4px', padding: '1px 6px' }}>
                              ✓ {group.candidates.filter(c => c.mitglied_antwort === 'kommt').length} Ja
                            </span>
                          )}
                          {(() => {
                            const neinKandidaten = group.candidates.filter(c => c.mitglied_antwort === 'kommt_nicht');
                            if (neinKandidaten.length === 0) return null;
                            // Meistgenannte alternative Termine aggregieren
                            const datumCounter = {};
                            neinKandidaten.forEach(c => {
                              let daten = c.alternative_termine;
                              if (typeof daten === 'string') { try { daten = JSON.parse(daten); } catch { daten = []; } }
                              (daten || []).forEach(d => { datumCounter[d] = (datumCounter[d] || 0) + 1; });
                            });
                            const topDaten = Object.entries(datumCounter).sort((a,b) => b[1]-a[1]).slice(0,3);
                            const tooltipText = topDaten.length > 0
                              ? `Alternative Termine:\n${topDaten.map(([d,n]) => `${new Date(d+'T12:00:00').toLocaleDateString('de-DE',{weekday:'short',day:'2-digit',month:'2-digit'})}: ${n}x`).join('\n')}`
                              : `${neinKandidaten.length} Teilnehmer kann nicht kommen`;
                            return (
                              <span
                                style={{ fontSize: '11px', background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.35)', color: '#f87171', borderRadius: '4px', padding: '1px 6px', cursor: topDaten.length > 0 ? 'help' : 'default' }}
                                title={tooltipText}
                              >
                                ✗ {neinKandidaten.length} Nein{topDaten.length > 0 && ` · ${new Date(topDaten[0][0]+'T12:00:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})} beliebt`}
                              </span>
                            );
                          })()}
                          {group.candidates.filter(c => c.teilnahme_bestaetigt).length > 0 && (
                            <span style={{ fontSize: '11px', background: 'rgba(99,102,241,.15)', border: '1px solid rgba(99,102,241,.35)', color: '#818cf8', borderRadius: '4px', padding: '1px 6px' }}>
                              ★ {group.candidates.filter(c => c.teilnahme_bestaetigt).length} Best.
                            </span>
                          )}
                          {group.candidates.filter(c => c.benachrichtigung_gelesen).length > 0 && (
                            <span style={{ fontSize: '11px', background: 'rgba(6,182,212,.15)', border: '1px solid rgba(6,182,212,.35)', color: '#22d3ee', borderRadius: '4px', padding: '1px 6px' }}>
                              👁 {group.candidates.filter(c => c.benachrichtigung_gelesen).length} Gel.
                            </span>
                          )}
                          {group.candidates.filter(c => c.erinnerung_gesendet_am).length > 0 && (
                            <span
                              style={{ fontSize: '11px', background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.35)', color: '#fbbf24', borderRadius: '4px', padding: '1px 6px', cursor: 'default' }}
                              title={`Erinnerung zuletzt gesendet: ${new Date(Math.max(...group.candidates.filter(c=>c.erinnerung_gesendet_am).map(c=>new Date(c.erinnerung_gesendet_am)))).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}`}
                            >
                              📩 {group.candidates.filter(c => c.erinnerung_gesendet_am).length} Erin.
                            </span>
                          )}
                          {/* Erinnerung-Button: nur für zukünftige Termine mit offenen Antworten */}
                          {isFuture && (() => {
                            const ohneAntwort = group.candidates.filter(c => !c.mitglied_antwort).length;
                            const key = `${group.datum}___${group.stil_id}`;
                            const status = erinnerungStatus[key];
                            if (ohneAntwort === 0) return null;
                            return (
                              <button
                                onClick={() => handleErinnerungSenden(group)}
                                disabled={status === 'sending'}
                                title={`Erinnerung an ${ohneAntwort} Mitglied${ohneAntwort !== 1 ? 'er' : ''} ohne Antwort senden`}
                                style={{
                                  fontSize: '11px',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  border: `1px solid ${status === 'sent' ? 'rgba(34,197,94,.4)' : status === 'error' ? 'rgba(239,68,68,.4)' : 'rgba(234,179,8,.4)'}`,
                                  background: status === 'sent' ? 'rgba(34,197,94,.12)' : status === 'error' ? 'rgba(239,68,68,.12)' : 'rgba(234,179,8,.1)',
                                  color: status === 'sent' ? '#22c55e' : status === 'error' ? '#ef4444' : '#EAB308',
                                  cursor: status === 'sending' ? 'wait' : 'pointer',
                                  whiteSpace: 'nowrap',
                                  lineHeight: 1.6,
                                }}
                              >
                                {status === 'sending' ? '⏳ Sendet…' : status === 'sent' ? '✓ Gesendet' : status === 'error' ? '✗ Fehler' : `🔔 ${ohneAntwort} erinnern`}
                              </button>
                            );
                          })()}
                          {/* Batch-Rechnung-Button: wenn Kandidaten ohne Rechnung vorhanden */}
                          {(() => {
                            const ohneRechnung = group.candidates.filter(c => c.pruefungsgebuehr && parseFloat(c.pruefungsgebuehr) > 0 && !c.gebuehr_rechnung_id && !c.gebuehr_bezahlt);
                            if (ohneRechnung.length === 0) return null;
                            return (
                              <button
                                onClick={() => handleBatchRechnungErstellen(group.candidates)}
                                title={`Rechnungen für ${ohneRechnung.length} Kandidat${ohneRechnung.length !== 1 ? 'en' : ''} ohne Rechnung erstellen`}
                                style={{
                                  fontSize: '11px',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid rgba(255,215,0,.4)',
                                  background: 'rgba(255,215,0,.1)',
                                  color: '#ffd700',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                  lineHeight: 1.6,
                                }}
                              >
                                💶 {ohneRechnung.length} Rechnung{ohneRechnung.length !== 1 ? 'en' : ''} erstellen
                              </button>
                            );
                          })()}
                        </div>
                      </div>

                      {isOpen && <div className="pv3-candidate-list">
                        {sortedCandidates.map(pruefung => (
                          <div key={pruefung.pruefung_id} className="pv3-candidate-row">
                            <div className="pv3-cand-name">
                              {pruefung.vorname} {pruefung.nachname}
                              {pruefung.guertellaenge_cm && (
                                <span style={{
                                  marginLeft:'0.4rem',fontSize:'0.68rem',fontWeight:700,
                                  padding:'1px 5px',borderRadius:'4px',
                                  background:'rgba(99,102,241,0.15)',color:'#a5b4fc',
                                  border:'1px solid rgba(99,102,241,0.3)',
                                  verticalAlign:'middle',
                                }}>
                                  📏 {pruefung.guertellaenge_cm} cm
                                </span>
                              )}
                            </div>
                            <div className="pv3-cand-grad" style={{ display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'flex-end', flexWrap: 'nowrap' }}>
                              {/* Vorhanden */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontSize: '9px', color: 'var(--text-muted,#888)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Vorhanden</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <div className="pv3-gurt-dot-sm" style={{ '--dot-color': pruefung.farbe_vorher || '#6b7280' }} />
                                  <select
                                    value={pruefung.graduierung_vorher_id || ''}
                                    className="pv3-inline-grad-select"
                                    title="Aktuellen Gurt ändern (wird in der Prüfung gespeichert)"
                                    onFocus={() => { if (!graduierungenProStil[pruefung.stil_id]) loadGraduierungenFuerModal(pruefung.stil_id); }}
                                    onChange={e => {
                                      const vorher_id = e.target.value ? parseInt(e.target.value) : null;
                                      const grads = (graduierungenProStil[pruefung.stil_id] || []).filter(g => g.aktiv === 1).sort((a, b) => a.reihenfolge - b.reihenfolge);
                                      const selectedGrad = grads.find(g => g.graduierung_id === vorher_id);
                                      const nextGrad = selectedGrad ? grads.find(g => g.reihenfolge > selectedGrad.reihenfolge) : null;
                                      const nachher_id = nextGrad ? nextGrad.graduierung_id : pruefung.graduierung_nachher_id;
                                      handleGraduierungZulassungAendern(pruefung, vorher_id, nachher_id);
                                    }}
                                  >
                                    <option value="">– kein –</option>
                                    {(graduierungenProStil[pruefung.stil_id] || []).filter(g => g.aktiv === 1).sort((a, b) => a.reihenfolge - b.reihenfolge).map(g =>
                                      <option key={g.graduierung_id} value={g.graduierung_id}>{g.name}</option>
                                    )}
                                    {!graduierungenProStil[pruefung.stil_id] && pruefung.graduierung_vorher_id && (
                                      <option value={pruefung.graduierung_vorher_id}>{pruefung.graduierung_vorher || '…'}</option>
                                    )}
                                  </select>
                                </div>
                              </div>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted,#888)', paddingBottom: '3px' }}>→</span>
                              {/* Prüfung zum */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontSize: '9px', color: 'rgba(234,179,8,0.85)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Prüfung zum</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                  <div className="pv3-gurt-dot-sm" style={{ '--dot-color': pruefung.farbe_nachher || '#EAB308' }} />
                                  <select
                                    value={pruefung.graduierung_nachher_id || ''}
                                    className="pv3-inline-grad-select pv3-inline-grad-select--ziel"
                                    title="Zielgurt ändern"
                                    onFocus={() => { if (!graduierungenProStil[pruefung.stil_id]) loadGraduierungenFuerModal(pruefung.stil_id); }}
                                    onChange={e => handleGraduierungZulassungAendern(pruefung, pruefung.graduierung_vorher_id, parseInt(e.target.value))}
                                  >
                                    {(graduierungenProStil[pruefung.stil_id] || []).filter(g => g.aktiv === 1).sort((a, b) => a.reihenfolge - b.reihenfolge).map(g =>
                                      <option key={g.graduierung_id} value={g.graduierung_id}>{g.name}</option>
                                    )}
                                    {!graduierungenProStil[pruefung.stil_id] && pruefung.graduierung_nachher_id && (
                                      <option value={pruefung.graduierung_nachher_id}>{pruefung.graduierung_nachher || '…'}</option>
                                    )}
                                  </select>
                                </div>
                              </div>
                            </div>
                            <div className="pv3-cand-status" style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'nowrap', justifyContent: 'flex-start' }}>
                              <button
                                onClick={() => handleAdminStatus(pruefung, { mitglied_antwort: pruefung.mitglied_antwort === 'kommt' ? null : 'kommt' })}
                                title="Kommt"
                                className={`pv3-status-btn${pruefung.mitglied_antwort === 'kommt' ? ' pv3-status-btn--kommt' : ''}`}
                              >✓ Kommt</button>
                              <button
                                onClick={() => handleZulassungEntfernen(pruefung)}
                                title="Kommt nicht — Zulassung entfernen"
                                className="pv3-status-btn"
                              >✗ Nein</button>
                              <button
                                onClick={() => handleAdminStatus(pruefung, { teilnahme_bestaetigt: !pruefung.teilnahme_bestaetigt })}
                                title={pruefung.teilnahme_bestaetigt ? 'Bestätigung zurücksetzen' : 'Als bestätigt markieren'}
                                className={`pv3-status-btn${pruefung.teilnahme_bestaetigt ? ' pv3-status-btn--best' : ''}`}
                              >{pruefung.teilnahme_bestaetigt ? '★ Best.' : '☆ Best.'}</button>
                              <button
                                title={pruefung.benachrichtigung_gelesen ? `Einladung gelesen${pruefung.benachrichtigung_gelesen_am ? ' am ' + new Date(pruefung.benachrichtigung_gelesen_am).toLocaleString('de-DE', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : ''}` : 'Einladung noch nicht gelesen'}
                                className={`pv3-status-btn${pruefung.benachrichtigung_gelesen ? ' pv3-status-btn--gelesen' : ''}`}
                              >{pruefung.benachrichtigung_gelesen ? '👁 Gel.' : '○ Ungel.'}</button>
                              {pruefung.erinnerung_gesendet_am && (
                                <span
                                  className="pv3-status-btn pv3-status-btn--erinnerung"
                                  title={`Erinnerung gesendet am ${new Date(pruefung.erinnerung_gesendet_am).toLocaleString('de-DE', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}${pruefung.erinnerung_anzahl > 1 ? ' ('+pruefung.erinnerung_anzahl+'x)' : ''}`}
                                >
                                  📩 {pruefung.erinnerung_anzahl > 1 ? `${pruefung.erinnerung_anzahl}x` : ''} Erin.
                                </span>
                              )}
                            </div>
                            <div className="pv3-cand-actions u-flex-wrap-gap">
                                {(pruefung.status === 'bestanden' || pruefung.status === 'nicht_bestanden') ? (
                                  <>
                                    <button
                                      onClick={() => setDruckAuswahlModal({ open: true, termin: { datum: pruefung.pruefungsdatum, stil_id: pruefung.stil_id, stil_name: pruefung.stil_name, ort: pruefung.pruefungsort || '', zeit: pruefung.pruefungszeit || '', pruefer_name: pruefung.pruefer_name || '', pruefungen: [pruefung] }, selected: [pruefung.pruefung_id], vorlage: 'pruefungsurkunde' })}
                                      className="pv3-zug-btn-neutral"
                                      title="Urkunde drucken"
                                    >
                                      <Scroll size={13} /> Urkunde
                                    </button>
                                    <button
                                      onClick={() => druckeErgebnis(pruefung, { datum: pruefung.pruefungsdatum, stil_name: pruefung.stil_name, ort: pruefung.pruefungsort || '', zeit: pruefung.pruefungszeit || '', pruefer_name: pruefung.pruefer_name || '' })}
                                      className="pv3-zug-btn-neutral"
                                      title="Protokoll drucken"
                                    >
                                      <Printer size={13} /> Protokoll
                                    </button>
                                    {pruefung.graduierung_zwischen ? (
                                      <span style={{display:'flex',alignItems:'center',gap:'3px',background:'rgba(34,197,94,0.12)',border:'1px solid rgba(34,197,94,0.4)',borderRadius:'5px',padding:'3px 7px',fontSize:'11px',color:'#22c55e',whiteSpace:'nowrap'}}>
                                        2× {pruefung.graduierung_zwischen}
                                        <button onClick={() => saveZwischengurt(pruefung, null)} title="Doppelprüfung entfernen" style={{background:'none',border:'none',color:'#22c55e',cursor:'pointer',fontSize:'13px',lineHeight:1,padding:'0 0 0 2px'}}>×</button>
                                      </span>
                                    ) : (
                                      <div style={{position:'relative'}}>
                                        <button
                                          onClick={() => setOpenZwischenPruefId(openZwischenPruefId === pruefung.pruefung_id ? null : pruefung.pruefung_id)}
                                          title="Doppelprüfung: Zwischengurt setzen (2 Urkunden)"
                                          style={{background:'none',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'5px',color:'var(--text-muted,#aaa)',cursor:'pointer',padding:'4px 7px',fontSize:'11px',lineHeight:1,whiteSpace:'nowrap'}}
                                        >2×</button>
                                        {openZwischenPruefId === pruefung.pruefung_id && graduierungenProStil[pruefung.stil_id] && (
                                          <div style={{position:'absolute',right:0,top:'110%',background:'var(--surface,#1e252c)',border:'1px solid var(--border,#2a3038)',borderRadius:'8px',padding:'6px',zIndex:50,minWidth:'160px',boxShadow:'0 4px 16px rgba(0,0,0,0.5)'}}>
                                            <p style={{fontSize:'10px',color:'var(--text-muted,#aaa)',marginBottom:'5px',paddingLeft:'2px'}}>Zwischengurt wählen:</p>
                                            {(() => {
                                              const grads = graduierungenProStil[pruefung.stil_id] || [];
                                              const vorherGrad = grads.find(g => g.graduierung_id === pruefung.graduierung_vorher_id);
                                              const nachherGrad = grads.find(g => g.graduierung_id === pruefung.graduierung_nachher_id);
                                              const filtered = grads.filter(g =>
                                                g.aktiv === 1 &&
                                                (!vorherGrad || g.reihenfolge > vorherGrad.reihenfolge) &&
                                                (!nachherGrad || g.reihenfolge < nachherGrad.reihenfolge)
                                              );
                                              if (filtered.length === 0) return <p style={{fontSize:'11px',color:'var(--text-muted,#aaa)',padding:'2px'}}>Kein Zwischengurt möglich</p>;
                                              return filtered.map(g => (
                                                <button key={g.graduierung_id}
                                                  onClick={() => saveZwischengurt(pruefung, g.graduierung_id)}
                                                  style={{display:'flex',alignItems:'center',gap:'7px',width:'100%',background:'none',border:'none',color:'var(--text,#e8eaed)',cursor:'pointer',padding:'5px 6px',borderRadius:'5px',fontSize:'12px',textAlign:'left'}}
                                                  onMouseEnter={e => e.currentTarget.style.background='var(--surface2,#2a3038)'}
                                                  onMouseLeave={e => e.currentTarget.style.background='none'}
                                                >
                                                  <span style={{width:'10px',height:'10px',borderRadius:'50%',background:g.farbe_hex||'#555',flexShrink:0,display:'inline-block'}}/>
                                                  {g.name}
                                                </button>
                                              ));
                                            })()}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={async () => {
                                        if (!pruefung.stil_id) { setError('Stil-ID fehlt für diese Prüfung'); return; }
                                        setSelectedPruefung(pruefung);
                                        const grads = await loadGraduierungenFuerModal(pruefung.stil_id);
                                        const currentIndex = grads.findIndex(g => g.graduierung_id === pruefung.graduierung_nachher_id);
                                        const targetGrad = grads[currentIndex] || grads[0];
                                        setPruefungsErgebnis({
                                          bestanden: false, punktzahl: '', max_punktzahl: '100', prueferkommentar: '',
                                          graduierung_nachher_index: currentIndex >= 0 ? currentIndex : 0,
                                          graduierung_nachher_id: targetGrad?.graduierung_id || null,
                                          graduierung_nachher_name: targetGrad?.name || '',
                                          graduierung_nachher_farbe: targetGrad?.farbe_hex || ''
                                        });
                                        setShowErgebnisModal(true);
                                      }}
                                      className="pv3-zug-btn-primary"
                                    >
                                      <Check size={13} /> Ergebnis
                                    </button>
                                    {pruefung.pruefungsgebuehr && parseFloat(pruefung.pruefungsgebuehr) > 0 && (
                                      <button
                                        onClick={() => {
                                          if (!pruefung.gebuehr_rechnung_id && !pruefung.gebuehr_bezahlt) {
                                            setGebuehrDialog(pruefung);
                                          }
                                        }}
                                        title={
                                          pruefung.gebuehr_bezahlt && pruefung.zahlungsart === 'bar'
                                            ? 'Bar bezahlt ✓'
                                            : pruefung.gebuehr_rechnung_id
                                            ? `Rechnung erstellt (ID ${pruefung.gebuehr_rechnung_id})`
                                            : `Gebühr ${parseFloat(pruefung.pruefungsgebuehr).toFixed(2)} € abrechnen`
                                        }
                                        className={`pv3-zug-btn-neutral pv3-gebuehr-toggle${pruefung.gebuehr_rechnung_id ? ' pv3-gebuehr-toggle--on' : pruefung.gebuehr_bezahlt ? ' pv3-gebuehr-toggle--on' : ''}`}
                                        disabled={!!pruefung.gebuehr_rechnung_id || !!pruefung.gebuehr_bezahlt}
                                      >
                                        {pruefung.gebuehr_bezahlt && pruefung.zahlungsart === 'bar'
                                          ? '💵 Bar ✓'
                                          : pruefung.gebuehr_rechnung_id
                                          ? '🧾 Rechnung ✓'
                                          : '💶 Rechnung'}
                                      </button>
                                    )}
                                  </>
                                )}
                            </div>
                          </div>
                        ))}
                      </div>}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
  );
};

export default PruefungsZugelasseneTab;
