import React from 'react';
import { motion } from 'framer-motion';
import GurtStatistikItem from './GurtStatistikDropdown.jsx';

// Ausgelagert aus Stilverwaltung.jsx (Statistiken-Tab, read-only).
const StilStatistikenTab = ({ currentStil, success, statistiken, pruefungsStats, loadingStats }) => {
  return (
                  <motion.div
                    className="statistiken-tab"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {loadingStats && (
                      <div className="no-data-message">
                        <p>Statistiken werden geladen...</p>
                      </div>
                    )}

                    {!statistiken && !loadingStats && (
                      <div className="no-data-message">
                        <p>Keine Statistiken verfügbar. Bitte wählen Sie einen Stil aus.</p>
                      </div>
                    )}

                    {statistiken && !loadingStats && (
                      <div className="stats-container">

                        {/* Zusammenfassung oben - 3 Boxen nebeneinander */}
                        {statistiken?.summary && (
                          <div className="sv-stats-summary-grid">
                            <div className="sv-stat-summary-card">
                              <div className="sv-stat-label">
                                Gürtel gesamt
                              </div>
                              <div className="sv-stat-value">
                                {statistiken.summary.total_graduierungen || 0}
                              </div>
                            </div>
                            <div className="sv-stat-summary-card">
                              <div className="sv-stat-label">
                                Aktive Mitglieder
                              </div>
                              <div className="sv-stat-value">
                                {statistiken.summary.total_mitglieder || 0}
                              </div>
                            </div>
                            <div className="sv-stat-summary-card">
                              <div className="sv-stat-label">
                                Kategorien
                              </div>
                              <div className="sv-stat-value">
                                {statistiken.summary.kategorien_count || 0}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Hauptbereich: Schüler-Verteilung und Prüfungs-Erfolgsrate nebeneinander */}
                        <div className="sv-stats-main-grid">

                          {/* Linke Spalte: Schüler-Verteilung */}
                          {statistiken?.graduierungen && statistiken.graduierungen.length > 0 && (
                            <div className="sv-stats-card">
                              <h4 className="sv-stats-card-title">
                                👥 Schüler-Verteilung nach Gürteln
                              </h4>
                              <p className="sv-stats-card-subtitle">
                                Anzahl der Schüler pro Gürtelfarbe
                              </p>
                              <div className="sv-punkte-grid">
                                {statistiken.graduierungen.map((grad, idx) => (
                                  <GurtStatistikItem
                                    key={grad.graduierung_id || idx}
                                    grad={grad}
                                    stilId={currentStil?.stil_id}
                                    API_BASE={API_BASE}
                                  />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Rechte Spalte: Prüfungs-Erfolgsrate */}
                          {pruefungsStats?.gesamt && (
                            <div className="sv-pruef-success-panel">
                              <h4 className="sv-stats-card-title-center">
                                ✅ Prüfungs-Erfolgsrate
                              </h4>
                              <p className="sv-stats-card-subtitle-center">
                                Erfolgsquote bei Gürtelprüfungen
                              </p>

                              {/* Großer Prozentkreis */}
                              <div className="sv-percent-circle-wrap">
                                <div className="sv-percent-circle">
                                  <div className="sv-percent-number">
                                    {pruefungsStats.gesamt.gesamt > 0
                                      ? Math.round((pruefungsStats.gesamt.bestanden / pruefungsStats.gesamt.gesamt) * 100)
                                      : 0}%
                                  </div>
                                  <div className="sv-percent-label">
                                    Erfolgsrate
                                  </div>
                                </div>
                              </div>

                              {/* Details */}
                              <div className="sv-stat-details-col">
                                <div className="sv-stat-detail-row">
                                  <span className="sv-stat-detail-label">Gesamt:</span>
                                  <span className="sv-stat-detail-value">
                                    {pruefungsStats.gesamt.gesamt || 0}
                                  </span>
                                </div>
                                <div className="sv-stat-detail-row--green">
                                  <span className="sv-stat-detail-label">Bestanden:</span>
                                  <span className="sv-stat-detail-value--green">
                                    {pruefungsStats.gesamt.bestanden || 0}
                                  </span>
                                </div>
                                <div className="sv-stat-detail-row--red">
                                  <span className="sv-stat-detail-label">Nicht bestanden:</span>
                                  <span className="sv-stat-detail-value--red">
                                    {pruefungsStats.gesamt.nicht_bestanden || 0}
                                  </span>
                                </div>
                                <div className="sv-stat-detail-row--orange">
                                  <span className="sv-stat-detail-label">Geplant:</span>
                                  <span className="sv-stat-detail-value--orange">
                                    {pruefungsStats.gesamt.geplant || 0}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                        </div>

                        {/* Pruefungs-Punkte Statistik */}
                        {statistiken?.pruefungsPunkte?.pro_graduierung?.length > 0 && (
                          <div className="sv-stats-card-mt">
                            <h4 className="sv-stats-card-title">
                              📊 Pruefungs-Punkte nach Graduierung
                            </h4>
                            <p className="sv-stats-card-subtitle">
                              Durchschnittliche Punktzahl bei Pruefungen
                            </p>

                            {/* Gesamt-Durchschnitt */}
                            {statistiken.pruefungsPunkte.gesamt && (
                              <div className="sv-punkte-gesamt-row">
                                <div className="sv-center-flex">
                                  <div className="sv-meta-label">
                                    Gesamt-Durchschnitt
                                  </div>
                                  <div className="sv-stat-lg">
                                    {statistiken.pruefungsPunkte.gesamt.durchschnitt?.toFixed(1) || '0'}
                                  </div>
                                </div>
                                <div className="sv-center-flex">
                                  <div className="sv-meta-label">
                                    Pruefungen gesamt
                                  </div>
                                  <div className="sv-stat-lg">
                                    {statistiken.pruefungsPunkte.gesamt.gesamt_pruefungen || 0}
                                  </div>
                                </div>
                                <div className="sv-center-flex">
                                  <div className="sv-meta-label">
                                    Erfolgsquote
                                  </div>
                                  <div className="sv-erfolgsquote">
                                    {statistiken.pruefungsPunkte.gesamt.gesamt_pruefungen > 0
                                      ? Math.round((statistiken.pruefungsPunkte.gesamt.gesamt_bestanden / statistiken.pruefungsPunkte.gesamt.gesamt_pruefungen) * 100)
                                      : 0}%
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Punkte pro Graduierung */}
                            <div className="sv-punkte-grid">
                              {statistiken.pruefungsPunkte.pro_graduierung.map((grad, idx) => (
                                <div
                                  key={idx}
                                  className="sv-punkte-row"
                                  style={{ '--grad-farbe': grad.graduierung_farbe || '#FFD700' }}
                                >
                                  <div className="sv-punkte-dot" />
                                  <div className="u-flex-1-min0">
                                    <div className="sv-text-primary-14">
                                      {grad.graduierung_name}
                                    </div>
                                    <div className="sv-text-muted-12">
                                      {grad.anzahl_pruefungen} Pruefungen
                                    </div>
                                  </div>
                                  <div className="sv-text-right">
                                    <div className="sv-stat-md">
                                      {parseFloat(grad.durchschnitt_punkte)?.toFixed(1) || '0'}
                                    </div>
                                    <div className="sv-text-muted-11">
                                      ({parseFloat(grad.min_punkte)?.toFixed(0) ?? '0'} - {parseFloat(grad.max_punkte)?.toFixed(0) ?? '0'})
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Hochstufungen / Promotions */}
                        {statistiken?.hochstufungen && (
                          <div className="sv-stats-card-mt">
                            <h4 className="sv-stats-card-title">
                              🎓 Hochstufungen (letzte 12 Monate)
                            </h4>
                            <p className="sv-stats-card-subtitle">
                              Erfolgreiche Pruefungen und Graduierungswechsel
                            </p>

                            {/* Gesamt-Zahl */}
                            <div className="sv-hochstufungen-total">
                              <div className="sv-hochstufungen-number">
                                {statistiken.hochstufungen.gesamt_12_monate || 0}
                              </div>
                              <div className="sv-hochstufungen-label">
                                Hochstufungen in 12 Monaten
                              </div>
                            </div>

                            {/* Hochstufungen pro Monat */}
                            {statistiken.hochstufungen.pro_monat?.length > 0 && (
                              <div className="sv-mb-20">
                                <div className="sv-label-secondary-13">
                                  Verlauf nach Monat:
                                </div>
                                <div className="sv-monat-chips">
                                  {statistiken.hochstufungen.pro_monat.slice(0, 6).map((monat, idx) => (
                                    <div key={idx} className="sv-monat-chip">
                                      <div className="sv-stat-md">
                                        {monat.anzahl}
                                      </div>
                                      <div className="sv-text-muted-11">
                                        {monat.monat_label}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Letzte Hochstufungen */}
                            {statistiken.hochstufungen.letzte?.length > 0 && (
                              <div>
                                <div className="sv-label-secondary-13">
                                  Letzte Hochstufungen:
                                </div>
                                <div className="sv-letzte-hochstufungen">
                                  {statistiken.hochstufungen.letzte.slice(0, 10).map((h, idx) => (
                                    <div
                                      key={idx}
                                      className="sv-hochstufung-row"
                                      style={{ '--zu-farbe': h.zu_farbe || '#FFD700', '--von-farbe': h.von_farbe || '#ccc' }}
                                    >
                                      <div className="u-flex-1">
                                        <div className="sv-text-primary-14">
                                          {h.vorname} {h.nachname}
                                        </div>
                                        <div className="sv-farb-arrow">
                                          <div className="sv-farb-dot-sm" style={{ '--dot-color': h.von_farbe || '#ccc' }} />
                                          <span className="sv-text-muted-12">→</span>
                                          <div className="sv-farb-dot-sm" style={{ '--dot-color': h.zu_farbe || '#FFD700' }} />
                                          <span className="sv-text-secondary-12">
                                            {h.zu_graduierung}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="sv-text-right">
                                        <div className="sv-text-secondary-12">
                                          {new Date(h.pruefungsdatum).toLocaleDateString('de-DE')}
                                        </div>
                                        {h.punktzahl && (
                                          <div className="sv-punktzahl">
                                            {h.punktzahl}/{h.max_punktzahl || 100} Pkt.
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                      </div>
                    )}
                  </motion.div>
  );
};

export default StilStatistikenTab;
