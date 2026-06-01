import React, { useState } from 'react';
import axios from 'axios';
import BeltPreview from '../BeltPreview';
import MemberAdditionalDataTab from './MemberAdditionalDataTab';
import GuertelRechner from '../../GuertelRechner';

const GurtStilTab = ({
  mitgliedId,
  mitglied,
  stile,
  memberStile,
  setMemberStile,
  styleSpecificData,
  setStyleSpecificData,
  trainingAnalysis,
  isAdmin,
  editMode,
  selectedStilId,
  setSelectedStilId,
  handleAddStyle,
  handleRemoveStyle,
  handleGraduationArrowChange,
  handleExamDateChange,
}) => {
  const [hauptTab, setHauptTab] = useState('stile');
  const [gradListCollapsedPerStil, setGradListCollapsedPerStil] = useState({});

  return (
    <div className="style-management-container">

      {/* Haupt-Tab-Bar */}
      <div className="gurt-haupttab-bar">
        <button
          className={`gurt-haupttab${hauptTab === 'stile' ? ' gurt-haupttab--active' : ''}`}
          onClick={() => setHauptTab('stile')}
        >
          🥋 Stile
        </button>
        <button
          className={`gurt-haupttab${hauptTab === 'lehrgaenge' ? ' gurt-haupttab--active' : ''}`}
          onClick={() => setHauptTab('lehrgaenge')}
        >
          📚 Lehrgänge
        </button>
        <button
          className={`gurt-haupttab${hauptTab === 'ehrungen' ? ' gurt-haupttab--active' : ''}`}
          onClick={() => setHauptTab('ehrungen')}
        >
          🏆 Ehrungen
        </button>
      </div>

      {/* Stile */}
      {hauptTab === 'stile' && (
        <div className="stile-haupt-content">
          {isAdmin && editMode && (
            <div className="mds-stil-add-controls" style={{ marginBottom: '1rem' }}>
              <select
                value={selectedStilId}
                onChange={(e) => setSelectedStilId(e.target.value)}
                className="mds2-dark-input"
              >
                <option value="">➕ Stil wählen...</option>
                {stile
                  .filter(s => s.aktiv === 1 || s.aktiv === true)
                  .filter(s => !memberStile.find(ms => ms.stil_id === s.stil_id))
                  .map(stil => (
                    <option key={stil.stil_id} value={stil.stil_id}>
                      {stil.stil_name || stil.name}
                    </option>
                  ))}
              </select>
              <button
                onClick={handleAddStyle}
                disabled={!selectedStilId}
                className={selectedStilId ? 'mds-stil-add-btn-active' : 'mds-stil-add-btn-inactive'}
              >
                Hinzufügen
              </button>
            </div>
          )}

          {memberStile.length > 0 ? (
            <div className="stile-side-by-side">
              {memberStile.map((ms) => {
                const stilData = stile.find(s => s.stil_id === ms.stil_id);
                const ssd = styleSpecificData[ms.stil_id] || {};
                const ta = trainingAnalysis[ms.stil_id];
                const currentGrad = stilData?.graduierungen?.find(g => g.graduierung_id === ssd.current_graduierung_id);
                const stilLastExam = ssd.letzte_pruefung || ta?.last_exam_date;
                const isCollapsed = gradListCollapsedPerStil[ms.stil_id] !== false;
                const grads = stilData?.graduierungen || [];
                const historie = ta?.pruefungs_historie || [];
                const hatLetzteP = !!stilLastExam;

                return (
                  <div key={ms.stil_id} className="stil-card-col">

                    <div className="mds-stil-header">
                      <h2 className="mds-stil-title">
                        {ms.ist_hauptstil && <span title="Hauptstil" style={{ marginRight: '6px', fontSize: '16px' }}>⭐</span>}
                        {ms.stil_name}
                        {ms.ist_hauptstil && (
                          <span style={{ marginLeft: '8px', fontSize: '11px', background: '#c8a84b', color: '#fff', borderRadius: '4px', padding: '2px 7px', fontWeight: 600, verticalAlign: 'middle' }}>
                            Hauptstil
                          </span>
                        )}
                      </h2>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {isAdmin && !ms.ist_hauptstil && memberStile.length > 1 && (
                          <button
                            onClick={async () => {
                              try {
                                await axios.post(`/mitglieder/${mitgliedId}/stile/hauptstil`, { stil: ms.stil_enum || ms.stil_name });
                                setMemberStile(prev => prev.map(s => ({ ...s, ist_hauptstil: s.stil_id === ms.stil_id })));
                              } catch (e) { console.error('Hauptstil setzen fehlgeschlagen', e); }
                            }}
                            style={{ fontSize: '12px', padding: '4px 10px', border: '1px solid #c8a84b', borderRadius: '5px', background: 'transparent', color: '#c8a84b', cursor: 'pointer', fontWeight: 500 }}
                          >
                            ⭐ Als Hauptstil setzen
                          </button>
                        )}
                        {editMode && isAdmin && !ms.ist_hauptstil && memberStile.length > 1 && (
                          <button onClick={() => handleRemoveStyle(ms.stil_id)} className="mds-stil-remove-btn">
                            🗑️ Stil entfernen
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Aktuelle Graduierung */}
                    <div className="grt-card">
                      <h3 className="grt-card-title">Aktuelle Graduierung</h3>
                      <div className="grt-belt-row">
                        <BeltPreview primaer={currentGrad?.farbe_hex || '#666'} sekundaer={currentGrad?.farbe_sekundaer} size="normal" />
                        <span className="grt-belt-name">{currentGrad?.name || 'Keine Graduierung'}</span>
                      </div>

                      {isAdmin && (
                        <div className="grt-grad-btns">
                          <button
                            className="grt-grad-btn"
                            onClick={() => handleGraduationArrowChange(currentGrad?.graduierung_id, 'up', stilData)}
                            disabled={!currentGrad || grads.findIndex(g => g.graduierung_id === currentGrad.graduierung_id) === 0}
                          >
                            ⬇ Niedriger
                          </button>
                          <button
                            className="grt-grad-btn grt-grad-btn--up"
                            onClick={() => handleGraduationArrowChange(currentGrad?.graduierung_id, 'down', stilData)}
                            disabled={!currentGrad || grads.findIndex(g => g.graduierung_id === currentGrad.graduierung_id) === grads.length - 1}
                          >
                            ⬆ Höher
                          </button>
                        </div>
                      )}

                      {currentGrad && (
                        <div className="grt-kv-grid">
                          <span className="grt-kv-label">Min. Stunden</span>
                          <span className="grt-kv-value">{currentGrad.trainingsstunden_min || 0} h</span>
                          <span className="grt-kv-label">Mindestzeit</span>
                          <span className="grt-kv-value">{currentGrad.mindestzeit_monate || 0} Monate</span>
                          {currentGrad.kategorie && (
                            <>
                              <span className="grt-kv-label">Kategorie</span>
                              <span className="grt-kv-value"><span className="grt-kategorie-badge">{currentGrad.kategorie}</span></span>
                            </>
                          )}
                        </div>
                      )}

                      <div className="grt-kv-grid grt-kv-grid--mt">
                        <span className="grt-kv-label">Letzte Prüfung</span>
                        {editMode && isAdmin ? (
                          <input
                            type="date"
                            className="grt-date-input"
                            value={stilLastExam ? String(stilLastExam).split('T')[0] : ''}
                            onChange={(e) => handleExamDateChange(ms.stil_id, 'letzte_pruefung', e.target.value)}
                          />
                        ) : (
                          <span className="grt-kv-value">
                            {stilLastExam
                              ? new Date(stilLastExam).toLocaleDateString('de-DE')
                              : <span className="grt-kv-empty">Keine Prüfung dokumentiert</span>}
                          </span>
                        )}
                        <span className="grt-kv-label">Gürtellänge</span>
                        {editMode && isAdmin ? (
                          <select
                            className="grt-date-input"
                            value={ssd.guertellaenge_cm || ''}
                            onChange={async (e) => {
                              const laenge = e.target.value ? parseInt(e.target.value, 10) : null;
                              try {
                                await axios.put(`/mitglieder/${mitgliedId}/stil/${ms.stil_id}/guertellaenge`, { guertellaenge_cm: laenge });
                                setStyleSpecificData(prev => ({ ...prev, [ms.stil_id]: { ...prev[ms.stil_id], guertellaenge_cm: laenge } }));
                              } catch (err) { console.error('Gürtellänge speichern:', err); }
                            }}
                          >
                            <option value="">— nicht gesetzt —</option>
                            {[220, 240, 260, 280, 300, 320, 340].map(l => (
                              <option key={l} value={l}>{l} cm</option>
                            ))}
                          </select>
                        ) : (
                          <span className="grt-kv-value">
                            {ssd.guertellaenge_cm
                              ? `${ssd.guertellaenge_cm} cm`
                              : <span className="grt-kv-empty">Nicht erfasst</span>}
                          </span>
                        )}
                      </div>

                      <GuertelRechner
                        compact={true}
                        onApply={isAdmin ? async (laenge) => {
                          try {
                            await axios.put(`/mitglieder/${mitgliedId}/stil/${ms.stil_id}/guertellaenge`, { guertellaenge_cm: laenge });
                            setStyleSpecificData(prev => ({ ...prev, [ms.stil_id]: { ...prev[ms.stil_id], guertellaenge_cm: laenge } }));
                          } catch (err) { console.error('Gürtellänge speichern:', err); }
                        } : undefined}
                      />
                    </div>

                    {/* Alle Graduierungen */}
                    <div className="grt-card grt-card--full grt-card--mt">
                      <div
                        className="grt-collapse-header"
                        onClick={() => setGradListCollapsedPerStil(prev => ({ ...prev, [ms.stil_id]: !isCollapsed }))}
                      >
                        <h3 className="grt-card-title grt-card-title--inline">📊 Alle Graduierungen — {ms.stil_name}</h3>
                        <span className={`grt-collapse-icon${isCollapsed ? '' : ' grt-collapse-icon--open'}`}>▼</span>
                      </div>
                      {!isCollapsed && (
                        <div className="grt-grad-list">
                          {grads.length > 0 ? (
                            [...grads].sort((a, b) => a.reihenfolge - b.reihenfolge).map((grad, idx) => {
                              const isCurrent = currentGrad?.graduierung_id === grad.graduierung_id;
                              return (
                                <div key={grad.graduierung_id} className={`grt-grad-row${isCurrent ? ' grt-grad-row--current' : ''}`}>
                                  <BeltPreview primaer={grad.farbe_hex} sekundaer={grad.farbe_sekundaer} size="small" />
                                  <div className="grt-grad-row-info">
                                    <div className="grt-grad-row-name">
                                      {grad.name}
                                      {isCurrent && <span className="grt-aktuell-badge">⭐ Aktuell</span>}
                                    </div>
                                    <div className="grt-grad-row-sub">
                                      {grad.reihenfolge || idx + 1}. Kyu · {grad.trainingsstunden_min}h · {grad.mindestzeit_monate} Monate
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <p className="grt-empty-text">Keine Graduierungen verfügbar</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Prüfungshistorie */}
                    {(historie.length > 0 || hatLetzteP) && (
                      <div className="grt-card grt-card--full grt-card--mt">
                        <h3 className="grt-card-title">📋 Prüfungshistorie</h3>
                        {historie.length === 0 ? (
                          <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', margin: '0.5rem 0 0 0' }}>
                            Prüfungsprotokoll wird vorbereitet…
                          </p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                            {historie.map((p, pidx) => {
                              const bestandenColor = p.bestanden ? '#4ade80' : p.status === 'durchgefuehrt' ? '#fbbf24' : '#f87171';
                              const bestandenText = p.bestanden ? 'Bestanden' : p.status === 'durchgefuehrt' ? 'Durchgeführt' : 'Nicht bestanden';
                              const datum = p.pruefungsdatum ? new Date(p.pruefungsdatum).toLocaleDateString('de-DE') : '—';
                              const hatProtokoll = !!(p.gesamtkommentar || p.staerken || p.verbesserungen || p.empfehlungen);
                              return (
                                <div key={pidx} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '0.6rem 0.85rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.35rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                      <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: `${bestandenColor}20`, color: bestandenColor, border: `1px solid ${bestandenColor}44` }}>
                                        {bestandenText}
                                      </span>
                                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary,#fff)' }}>{datum}</span>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary,#888)' }}>
                                      {p.graduierung_vorher} → {p.graduierung_nachher}
                                      {p.punktzahl ? ` · ${p.punktzahl}/${p.max_punktzahl} Pkt.` : ''}
                                    </div>
                                  </div>
                                  {hatProtokoll ? (
                                    <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.6rem', background: 'rgba(99,102,241,0.07)', borderRadius: '5px', borderLeft: '2px solid rgba(99,102,241,0.4)' }}>
                                      {p.gesamtkommentar && <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary,#ccc)', margin: '0 0 0.25rem 0' }}>{p.gesamtkommentar}</p>}
                                      {p.staerken && <p style={{ fontSize: '0.72rem', color: '#4ade80', margin: '0 0 0.15rem 0' }}><strong>Stärken:</strong> {p.staerken}</p>}
                                      {p.verbesserungen && <p style={{ fontSize: '0.72rem', color: '#fbbf24', margin: '0 0 0.15rem 0' }}><strong>Verbesserung:</strong> {p.verbesserungen}</p>}
                                      {p.empfehlungen && <p style={{ fontSize: '0.72rem', color: '#a5b4fc', margin: '0' }}><strong>Empfehlungen:</strong> {p.empfehlungen}</p>}
                                    </div>
                                  ) : (
                                    <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.2)', margin: '0.25rem 0 0 0', fontStyle: 'italic' }}>
                                      {p.prueferkommentar || 'Prüfungsprotokoll wird vorbereitet…'}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grt-card">
              <h3 className="grt-card-title">Stil-Verwaltung</h3>
              <p className="grt-empty-text">Keine Stile zugeordnet</p>
              <p className="grt-empty-hint">Stil oben auswählen und hinzufügen.</p>
            </div>
          )}
        </div>
      )}

      {/* Lehrgänge */}
      {hauptTab === 'lehrgaenge' && (
        <MemberAdditionalDataTab
          mitgliedId={mitgliedId}
          dojoId={mitglied?.dojo_id}
          editMode={editMode}
          filterArts={['Lehrgang', 'Seminar']}
        />
      )}

      {/* Ehrungen */}
      {hauptTab === 'ehrungen' && (
        <MemberAdditionalDataTab
          mitgliedId={mitgliedId}
          dojoId={mitglied?.dojo_id}
          editMode={editMode}
          filterArts={['Ehrung']}
        />
      )}

    </div>
  );
};

export default GurtStilTab;
