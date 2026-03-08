import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Trophy, Calendar, ChevronRight, CheckCircle, Target } from 'lucide-react';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import MemberHeader from './MemberHeader.jsx';
import '../styles/themes.css';
import '../styles/MemberStyles.css';

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

                      {/* Exam Dates */}
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
                      </div>

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
