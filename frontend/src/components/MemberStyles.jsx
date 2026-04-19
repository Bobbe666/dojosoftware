import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Trophy, Calendar, ChevronRight, CheckCircle, Target, Award, FileText } from 'lucide-react';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import MemberHeader from './MemberHeader.jsx';
import GuertelRechner from './GuertelRechner.jsx';
import '../styles/themes.css';
import '../styles/MemberStyles.css';
import '../styles/MitgliedDetailShared.css';

const API_BASE = config.apiBaseUrl;

const MemberStyles = () => {
  const { user } = useAuth();
  const [stileData, setStileData] = useState([]); // Array of { stil, stilData, analysis }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.mitglied_id) loadAll();
  }, [user?.mitglied_id]);

  const loadAll = async () => {
    try {
      const mitgliedId = user.mitglied_id;

      // 1. Stile mit Graduierungen
      const stileRes = await fetchWithAuth(`${API_BASE}/mitglieder/${mitgliedId}/stile`);
      if (!stileRes.ok) return;
      const stileResult = await stileRes.json();
      const stile = stileResult.success ? stileResult.stile : [];

      // 2. Für jeden Stil: aktuelle Daten + Training-Analyse parallel laden
      const enriched = await Promise.all(stile.map(async (stil) => {
        const [dataRes, analysisRes] = await Promise.all([
          fetchWithAuth(`${API_BASE}/mitglieder/${mitgliedId}/stil/${stil.stil_id}/data`),
          fetchWithAuth(`${API_BASE}/mitglieder/${mitgliedId}/stil/${stil.stil_id}/training-analysis`),
        ]);
        const stilData = dataRes.ok ? (await dataRes.json()).data : null;
        const analysis = analysisRes.ok ? (await analysisRes.json()).analysis : null;
        return { stil, stilData, analysis };
      }));

      setStileData(enriched);
    } catch (e) {
      console.error('Fehler beim Laden der Stile:', e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return null;
    return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-content mst-loading-center">
          <div className="mst-spinner-center">
            <div className="mst-spinner" />
            <p>Lade Stil & Gürtel...</p>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <MemberHeader />
      <div className="dashboard-content mst-page-pad">
        <div className="mst-centered-900">

          {/* Page Header */}
          <div className="mst-title-section">
            <div className="mst-eyebrow">
              技 — Waza
            </div>
            <h1 className="mst-gradient-title">
              Stil & Gürtel
            </h1>
            <div className="mst-subtitle-caps">
              Dein Fortschritt auf dem Weg zur Meisterschaft
            </div>
          </div>

          {stileData.length === 0 ? (
            <div className="mst-empty-card">
              <Trophy size={48} className="mst-empty-trophy" />
              <h3 className="mst-empty-heading">Noch keine Stile zugewiesen</h3>
              <p className="mst-empty-text">Wende dich an deinen Trainer, um Stile zuzuweisen.</p>
            </div>
          ) : (
            <div className="mst-styles-col">
              {stileData.map(({ stil, stilData, analysis }) => {
                const grads = stil.graduierungen || [];
                const currentGradId = stilData?.current_graduierung_id;
                const currentGrad = grads.find(g => g.graduierung_id === currentGradId);
                const currentIdx = grads.findIndex(g => g.graduierung_id === currentGradId);
                const nextGrad = analysis?.next_graduation;
                const sessionsCompleted = analysis?.training_sessions_completed || 0;
                const sessionsRequired = analysis?.training_sessions_required || 0;
                const progressPct = sessionsRequired > 0
                  ? Math.min(100, Math.round((sessionsCompleted / sessionsRequired) * 100))
                  : null;
                const isReady = analysis?.is_ready_for_exam || false;
                const beltColor = currentGrad?.farbe_hex || stilData?.farbe_hex || '#888';

                return (
                  <div key={stil.stil_id} className="mst-stil-card">

                    {/* Style Header Bar */}
                    <div className="mst-stil-header">
                      <Trophy size={20} className="mst-icon-primary" />
                      <h2 className="mst-stil-name">
                        {stil.name}
                      </h2>
                      {isReady && (
                        <div className="mst-active-badge">
                          <CheckCircle size={12} /> Prüfungsreif
                        </div>
                      )}
                    </div>

                    <div className="mst-card-body">

                      {/* Current Belt + Next Belt */}
                      <div className={`mst-belt-grid${nextGrad ? ' mst-belt-grid--with-next' : ''}`}>
                        {/* Aktueller Gürtel */}
                        <div className="mst-belt-current" style={{ '--bc': beltColor, '--bc44': `${beltColor}44` }}>
                          <div className="mst-belt-bar" style={{ '--bc': beltColor, '--bc66': `${beltColor}66` }} />
                          <div className="mst-belt-label">{currentGrad?.name || '—'}</div>
                          <div className="mst-belt-caption">Aktueller Gürtel</div>
                        </div>

                        {/* Arrow */}
                        {nextGrad && (
                          <div className="mst-arrow-center">
                            <ChevronRight size={24} className="mst-arrow-icon" />
                          </div>
                        )}

                        {/* Nächster Gürtel */}
                        {nextGrad && (
                          <div className="mst-belt-next">
                            <div className="mst-belt-bar mst-belt-bar--next" style={{ '--bc': nextGrad.farbe_hex || '#555' }} />
                            <div className="mst-belt-label-secondary">{nextGrad.name}</div>
                            <div className="mst-belt-caption">Nächster Gürtel</div>
                          </div>
                        )}
                      </div>

                      {/* Training Progress */}
                      {nextGrad && sessionsRequired > 0 && (
                        <div className="mst-progress-section">
                          <div className="mst-progress-header">
                            <div className="mst-progress-label">
                              <Target size={14} className="u-text-accent" />
                              Trainingseinheiten bis {nextGrad.name}
                            </div>
                            <div className={`mst-progress-counter${isReady ? ' mst-progress-counter--ready' : ''}`}>
                              {sessionsCompleted} / {sessionsRequired}
                            </div>
                          </div>
                          <div className="mst-progress-track">
                            <div
                              className={`mst-progress-fill${isReady ? ' mst-progress-fill--ready' : ''}`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <div className="mst-progress-note">
                            {isReady ? '✓ Bereit für die Prüfung!' : `Noch ${sessionsRequired - sessionsCompleted} Einheiten`}
                          </div>
                        </div>
                      )}

                      {/* Belt Ladder */}
                      {grads.length > 0 && (
                        <div className="mst-progress-section">
                          <div className="mst-grad-path-label">Graduierungsweg</div>
                          <div className="mst-grad-path-items">
                            {grads.map((grad, idx) => {
                              const isCurrent = grad.graduierung_id === currentGradId;
                              const isPast = idx < currentIdx;
                              const isFuture = idx > currentIdx;
                              return (
                                <React.Fragment key={grad.graduierung_id}>
                                  <div
                                  className={`mst-grad-item${isCurrent ? ' mst-grad-item--current' : ''}`}
                                  style={{ '--gc': grad.farbe_hex || '#ffd700', '--gc66': `${grad.farbe_hex || '#ffd700'}66`, '--gc88': `${grad.farbe_hex || '#ffd700'}88` }}
                                >
                                    {isCurrent && (
                                      <div className="mst-arrow-indicator">▼</div>
                                    )}
                                    <div className={`mst-grad-belt-bar${isCurrent ? ' mst-grad-belt-bar--current' : isFuture ? ' mst-grad-belt-bar--future' : ''}`} style={{ '--gc': grad.farbe_hex || '#555' }} />
                                    <div className={`mst-grad-name${isCurrent ? ' mst-grad-name--current' : isPast ? ' mst-grad-name--past' : ' mst-grad-name--future'}`}>
                                      {grad.name}
                                    </div>
                                    {isPast && (
                                      <CheckCircle size={9} className="u-text-success" />
                                    )}
                                  </div>
                                  {idx < grads.length - 1 && (
                                    <div className={`mst-grad-connector${isPast ? ' mst-grad-connector--past' : ''}`} />
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Exam Dates + Gürtellänge */}
                      <div className="mst-exam-grid">
                        <div className="mst-exam-box">
                          <Calendar size={14} className="mst-icon-muted" />
                          <div>
                            <div className="mst-exam-box-label">Letzte Prüfung</div>
                            <div className="mst-exam-date-text">
                              {formatDate(analysis?.last_exam_date) || '—'}
                            </div>
                          </div>
                        </div>
                        <div className="mst-exam-box">
                          <Calendar size={14} className="mst-icon-primary" />
                          <div>
                            <div className="mst-exam-box-label">Nächste Prüfung</div>
                            <div className={`mst-exam-date-primary${stilData?.naechste_pruefung ? ' mst-exam-date-primary--set' : ''}`}>
                              {formatDate(stilData?.naechste_pruefung) || 'Nicht geplant'}
                            </div>
                          </div>
                        </div>
                        {stilData?.guertellaenge_cm && (
                          <div className="mst-exam-box">
                            <Award size={14} className="mst-icon-primary" />
                            <div>
                              <div className="mst-exam-box-label">Gürtellänge</div>
                              <div className="mst-exam-date-primary mst-exam-date-primary--set">
                                {stilData.guertellaenge_cm} cm
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Gürtellängen-Rechner */}
                      <div className="mst-progress-section" style={{marginTop:'1rem'}}>
                        <GuertelRechner
                          onApply={async (laenge) => {
                            try {
                              await fetchWithAuth(`${API_BASE}/mitglieder/${user.mitglied_id}/stil/${stil.stil_id}/guertellaenge`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ guertellaenge_cm: laenge }),
                              });
                              loadAll();
                            } catch (e) { console.error('Gürtellänge speichern:', e); }
                          }}
                        />
                      </div>

                      {/* Prüfungshistorie */}
                      {analysis?.pruefungs_historie?.length > 0 && (
                        <div className="mst-progress-section" style={{marginTop:'1rem'}}>
                          <div className="mst-grad-path-label">
                            <FileText size={13} style={{display:'inline',verticalAlign:'middle',marginRight:'4px'}} />
                            Prüfungshistorie
                          </div>
                          <div style={{display:'flex',flexDirection:'column',gap:'0.5rem',marginTop:'0.5rem'}}>
                            {analysis.pruefungs_historie.map((p, idx) => {
                              const hatProtokoll = !!(p.gesamtkommentar || p.staerken || p.verbesserungen || p.empfehlungen);
                              const bestandenColor = p.bestanden ? '#4ade80' : p.status === 'durchgefuehrt' ? '#fbbf24' : '#f87171';
                              const bestandenText = p.bestanden ? 'Bestanden' : p.status === 'durchgefuehrt' ? 'Durchgeführt' : 'Nicht bestanden';
                              return (
                                <div key={idx} style={{
                                  background:'rgba(255,255,255,0.04)',
                                  border:'1px solid rgba(255,255,255,0.08)',
                                  borderRadius:'8px', padding:'0.6rem 0.85rem',
                                }}>
                                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'0.35rem'}}>
                                    <div style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                                      <span style={{
                                        fontSize:'0.7rem',fontWeight:700,padding:'2px 7px',borderRadius:'4px',
                                        background:`${bestandenColor}20`,color:bestandenColor,
                                        border:`1px solid ${bestandenColor}44`,
                                      }}>
                                        {bestandenText}
                                      </span>
                                      <span style={{fontSize:'0.82rem',fontWeight:600,color:'var(--text-1,#fff)'}}>
                                        {formatDate(p.pruefungsdatum)}
                                      </span>
                                    </div>
                                    <div style={{fontSize:'0.75rem',color:'var(--text-3,#888)'}}>
                                      {p.graduierung_vorher} → {p.graduierung_nachher}
                                      {p.punktzahl ? ` · ${p.punktzahl}/${p.max_punktzahl} Pkt.` : ''}
                                    </div>
                                  </div>
                                  {hatProtokoll && (
                                    <div style={{marginTop:'0.5rem',padding:'0.4rem 0.6rem',
                                      background:'rgba(99,102,241,0.07)',borderRadius:'5px',
                                      borderLeft:'2px solid rgba(99,102,241,0.4)'}}>
                                      {p.gesamtkommentar && (
                                        <p style={{fontSize:'0.78rem',color:'var(--text-2,#ccc)',margin:'0 0 0.25rem 0'}}>
                                          {p.gesamtkommentar}
                                        </p>
                                      )}
                                      {p.staerken && (
                                        <p style={{fontSize:'0.72rem',color:'#4ade80',margin:'0 0 0.15rem 0'}}>
                                          <strong>Stärken:</strong> {p.staerken}
                                        </p>
                                      )}
                                      {p.verbesserungen && (
                                        <p style={{fontSize:'0.72rem',color:'#fbbf24',margin:'0 0 0.15rem 0'}}>
                                          <strong>Verbesserung:</strong> {p.verbesserungen}
                                        </p>
                                      )}
                                      {p.empfehlungen && (
                                        <p style={{fontSize:'0.72rem',color:'#a5b4fc',margin:'0'}}>
                                          <strong>Empfehlungen:</strong> {p.empfehlungen}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                  {p.prueferkommentar && !hatProtokoll && (
                                    <p style={{fontSize:'0.78rem',color:'var(--text-3,#888)',margin:'0.3rem 0 0 0',fontStyle:'italic'}}>
                                      {p.prueferkommentar}
                                    </p>
                                  )}
                                  {!hatProtokoll && !p.prueferkommentar && (
                                    <p style={{fontSize:'0.72rem',color:'rgba(255,255,255,0.2)',margin:'0.25rem 0 0 0',fontStyle:'italic'}}>
                                      Prüfungsprotokoll wird vorbereitet…
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default MemberStyles;
