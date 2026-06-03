import React from 'react';
import { TrendingUp, Download, Edit } from 'lucide-react';

// Ausgelagert aus PruefungsVerwaltung.jsx (Abgeschlossene-Pruefungen-Tab).
const PruefungsAbgeschlossenTab = ({
  stile, loading, graduierungenProStil, abgeschlossenePruefungen,
  druckAuswahlModal, setDruckAuswahlModal,
  abgeschlosseneStilFilter, setAbgeschlosseneStilFilter,
  openZwischenPruefId, setOpenZwischenPruefId,
  openZugGroups, setOpenZugGroups,
  druckeErgebnis, handleStatusAendern, saveZwischengurt
}) => {
  return (
        <div className="pv3-zugelassen-section">
          <div className="pv2-mb-15">
            <div className="pv3-tab-section-header">
              <h2 className="pv3-zug-h2">Abgeschlossene Prüfungen ({abgeschlossenePruefungen.length})</h2>
              <div className="pv-flex-row">
                <span className="pv-secondary-bold">Stil:</span>
                <select
                  value={abgeschlosseneStilFilter}
                  onChange={(e) => setAbgeschlosseneStilFilter(e.target.value)}
                  className="pv3-dark-select"
                >
                  <option value="all">Alle Stile</option>
                  {stile.map(stil => (
                    <option key={stil.stil_id} value={stil.stil_id}>{stil.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="pv2-center-3rem">Lädt...</div>
          ) : (() => {
            let gefiltert = abgeschlossenePruefungen;
            if (abgeschlosseneStilFilter !== 'all') {
              gefiltert = gefiltert.filter(p => p.stil_id === parseInt(abgeschlosseneStilFilter));
            }

            if (gefiltert.length === 0) {
              return (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  📋 Keine abgeschlossenen Prüfungen gefunden.
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

            // Neueste zuerst
            const sortedGroups = Object.values(groupMap).sort((a, b) => {
              if (!a.datum && !b.datum) return 0;
              if (!a.datum) return 1;
              if (!b.datum) return -1;
              return new Date(b.datum) - new Date(a.datum);
            });

            return (
              <div className="pv3-grouped-list">
                {sortedGroups.map(group => {
                  const groupKey = `abg_${group.datum}___${group.stil_id}`;
                  const isOpen = !!openZugGroups[groupKey];
                  const dateStr = group.datum
                    ? new Date(group.datum).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
                    : 'Datum nicht festgelegt';
                  const bestandenCount = group.candidates.filter(c => c.bestanden).length;
                  const sortedCandidates = [...group.candidates].sort((a, b) =>
                    `${a.nachname} ${a.vorname}`.localeCompare(`${b.nachname} ${b.vorname}`)
                  );

                  return (
                    <div key={groupKey} className="pv3-group-section">
                      <div
                        className="pv3-group-header past clickable"
                        onClick={() => setOpenZugGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))}
                      >
                        <div className="pv3-group-header-left">
                          <span className={`pv3-group-chevron ${isOpen ? 'open' : ''}`}>▶</span>
                          <span className="pv3-group-date-label past">🗓 {dateStr}</span>
                          <span className="pv3-stil-badge-sm">{group.stil_name}</span>
                        </div>
                        <div className="pv3-group-header-right">
                          <span className="pv3-abg-summary-badge bestanden">{bestandenCount} ✓</span>
                          {group.candidates.length - bestandenCount > 0 && (
                            <span className="pv3-abg-summary-badge nicht-bestanden">{group.candidates.length - bestandenCount} ✗</span>
                          )}
                          <span className="pv3-group-count">{group.candidates.length} Kandid.</span>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="pv3-candidate-list">
                          {sortedCandidates.map(pruefung => (
                            <div key={pruefung.pruefung_id} className="pv3-candidate-row abg">
                              <div className="pv3-cand-name">
                                {pruefung.vorname} {pruefung.nachname}
                              </div>
                              <div className="pv3-cand-grad">
                                <div
                                  className="pv3-gurt-dot-sm"
                                  style={{ '--dot-color': pruefung.farbe_nachher || 'rgba(255,255,255,0.1)' }}
                                  title={pruefung.graduierung_nachher}
                                />
                                <span>{pruefung.graduierung_nachher}</span>
                              </div>
                              <div className="pv3-cand-status">
                                {pruefung.bestanden
                                  ? <span className="pv3-badge-confirmed">✓ Bestanden</span>
                                  : <span className="pv3-badge-failed">✗ Nicht bestanden</span>
                                }
                                {pruefung.punktzahl && (
                                  <span className="pv3-cand-punkte">{pruefung.punktzahl}/{pruefung.max_punktzahl}</span>
                                )}
                              </div>
                              <div className="pv3-cand-actions u-flex-wrap-gap">
                                <button
                                  onClick={() => setDruckAuswahlModal({ open: true, termin: { datum: pruefung.pruefungsdatum, stil_id: pruefung.stil_id, stil_name: pruefung.stil_name, ort: pruefung.pruefungsort || '', zeit: pruefung.pruefungszeit || '', pruefer_name: pruefung.pruefer_name || '', pruefungen: [pruefung] }, selected: [pruefung.pruefung_id], vorlage: 'pruefungsurkunde' })}
                                  className="pv3-zug-btn-neutral"
                                  title="Urkunde drucken"
                                >
                                  <Download size={13} /> Urkunde
                                </button>
                                <button
                                  onClick={() => druckeErgebnis(pruefung, { datum: pruefung.pruefungsdatum, stil_name: pruefung.stil_name, ort: pruefung.pruefungsort || '', zeit: pruefung.pruefungszeit || '', pruefer_name: pruefung.pruefer_name || '' })}
                                  className="pv3-zug-btn-neutral"
                                  title="Protokoll drucken"
                                >
                                  <TrendingUp size={13} /> Protokoll
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
                                <button
                                  onClick={() => handleStatusAendern(pruefung)}
                                  className="pv3-zug-btn-warning"
                                >
                                  <Edit size={13} /> Status
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
  );
};

export default PruefungsAbgeschlossenTab;
