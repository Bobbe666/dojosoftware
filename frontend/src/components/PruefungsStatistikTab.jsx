import React from 'react';

// Ausgelagert aus PruefungsVerwaltung.jsx (Statistik-Tab, reine Anzeige).
const PruefungsStatistikTab = ({
  statistiken, technikStats, erwStats,
  kandidaten, stile, zugelassenePruefungen, abgeschlossenePruefungen,
  statsJahr, setStatsJahr, gurtView, setGurtView
}) => {
  if (!statistiken) return null;
  return (
        <div className="pv3-stat-section">

          {/* ── JAHRESFILTER ──────────────────────────────────────── */}
          <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', marginBottom:'1rem', flexWrap:'wrap' }}>
            <span style={{ fontSize:'0.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-3,#888)' }}>Jahr:</span>
            {['', ...Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i))].map(j => (
              <button
                key={j || 'alle'}
                onClick={() => setStatsJahr(j)}
                style={{
                  padding:'0.2rem 0.6rem', borderRadius:'6px', border:'none', cursor:'pointer',
                  fontSize:'0.75rem', fontWeight:600,
                  background: statsJahr === j ? 'rgba(255,215,0,0.18)' : 'rgba(255,255,255,0.05)',
                  color: statsJahr === j ? 'var(--primary,#ffd700)' : 'var(--text-3,#888)',
                  boxShadow: statsJahr === j ? '0 0 0 1px rgba(255,215,0,0.35) inset' : 'none',
                  transition: 'all 0.12s',
                }}
              >{j || 'Alle Jahre'}</button>
            ))}
            <button
              onClick={() => window.print()}
              style={{
                marginLeft: 'auto',
                padding: '0.25rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.06)',
                color: 'var(--text-2,#ccc)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              🖨️ Drucken / PDF
            </button>
          </div>

          {/* ── KPI CARDS ─────────────────────────────────────────── */}
          <div className="pvs-kpi-grid">
            {/* Termine */}
            <div className="stat-card pvs-kpi-card">
              <div className="pvs-kpi-label">Termine</div>
              <div className="pvs-kpi-value pvs-kpi-purple">{statistiken.gesamt.termine ?? statistiken.gesamt.gesamt}</div>
              <div className="pvs-kpi-sub">{statistiken.gesamt.gesamt} Teilnehmer</div>
            </div>
            {/* Bestanden */}
            <div className="stat-card pvs-kpi-card">
              <div className="pvs-kpi-label">Bestanden</div>
              <div className="pvs-kpi-value pvs-kpi-green">{statistiken.gesamt.bestanden}</div>
              <div className="pvs-kpi-bar-wrap">
                <div className="pvs-kpi-bar-fill pvs-kpi-bar-green"
                  style={{ width: `${statistiken.gesamt.gesamt > 0 ? Math.round(statistiken.gesamt.bestanden / statistiken.gesamt.gesamt * 100) : 0}%` }} />
              </div>
              <div className="pvs-kpi-sub pvs-kpi-green-text" style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
                {statistiken.gesamt.gesamt > 0 ? Math.round(statistiken.gesamt.bestanden / statistiken.gesamt.gesamt * 100) : 0}% Quote
                {(() => {
                  const months = statistiken.nach_monat || [];
                  if (months.length < 4) return null;
                  const r = months.slice(0,3).reduce((a,m) => ({ g: a.g+m.anzahl, b: a.b+m.bestanden }), {g:0,b:0});
                  const o = months.slice(3,6).reduce((a,m) => ({ g: a.g+m.anzahl, b: a.b+m.bestanden }), {g:0,b:0});
                  const diff = (r.g>0 ? r.b/r.g*100 : 0) - (o.g>0 ? o.b/o.g*100 : 0);
                  if (Math.abs(diff) < 2) return null;
                  return <span style={{ color: diff>0 ? '#4ade80' : '#f87171', fontWeight:700, fontSize:'0.7rem' }}>{diff>0 ? '↑' : '↓'} Trend</span>;
                })()}
              </div>
            </div>
            {/* Nicht bestanden */}
            <div className="stat-card pvs-kpi-card">
              <div className="pvs-kpi-label">Nicht bestanden</div>
              <div className="pvs-kpi-value pvs-kpi-red">{statistiken.gesamt.nicht_bestanden}</div>
              <div className="pvs-kpi-bar-wrap">
                <div className="pvs-kpi-bar-fill pvs-kpi-bar-red"
                  style={{ width: `${statistiken.gesamt.gesamt > 0 ? Math.round(statistiken.gesamt.nicht_bestanden / statistiken.gesamt.gesamt * 100) : 0}%` }} />
              </div>
              <div className="pvs-kpi-sub pvs-kpi-red-text">
                {statistiken.gesamt.gesamt > 0 ? Math.round(statistiken.gesamt.nicht_bestanden / statistiken.gesamt.gesamt * 100) : 0}%
              </div>
            </div>
            {/* Geplant */}
            <div className="stat-card pvs-kpi-card">
              <div className="pvs-kpi-label">Geplant</div>
              <div className="pvs-kpi-value pvs-kpi-yellow">{statistiken.gesamt.geplant}</div>
              <div className="pvs-kpi-sub">Anstehend</div>
            </div>
            {/* Kandidaten */}
            <div className="stat-card pvs-kpi-card">
              <div className="pvs-kpi-label">Kandidaten</div>
              <div className="pvs-kpi-value pvs-kpi-cyan">{kandidaten.length}</div>
              <div className="pvs-kpi-sub">{kandidaten.filter(k => k.berechtigt).length} berechtigt</div>
            </div>
            {/* Ø Punktzahl */}
            <div className="stat-card pvs-kpi-card">
              <div className="pvs-kpi-label">Ø Punktzahl</div>
              <div className="pvs-kpi-value pvs-kpi-purple">
                {(() => {
                  const bp = abgeschlossenePruefungen.filter(p => p.bestanden && p.punktzahl && p.max_punktzahl);
                  return bp.length > 0 ? Math.round(bp.reduce((s, p) => s + (p.punktzahl / p.max_punktzahl * 100), 0) / bp.length) : 0;
                })()}%
              </div>
              <div className="pvs-kpi-sub">Ø bestandene Prüfungen</div>
            </div>
            {/* Ø Training */}
            <div className="stat-card pvs-kpi-card">
              <div className="pvs-kpi-label">Ø Training</div>
              <div className="pvs-kpi-value pvs-kpi-green">
                {kandidaten.length > 0 ? Math.round(kandidaten.reduce((s, k) => s + (k.absolvierte_stunden || 0), 0) / kandidaten.length) : 0}
              </div>
              <div className="pvs-kpi-sub">Einheiten pro Kandidat</div>
            </div>
            {/* Ø Monate */}
            <div className="stat-card pvs-kpi-card">
              <div className="pvs-kpi-label">Ø Wartezeit</div>
              <div className="pvs-kpi-value pvs-kpi-cyan">
                {kandidaten.length > 0 ? Math.round(kandidaten.reduce((s, k) => s + (k.monate_seit_letzter_pruefung || 0), 0) / kandidaten.length) : 0}
              </div>
              <div className="pvs-kpi-sub">Monate seit letzter</div>
            </div>
          </div>

          {/* ── PRÜFUNGSGEBÜHREN ──────────────────────────────────── */}
          {statistiken.gesamt.gebuehren_gesamt > 0 && (
            <div style={{ marginTop:'1rem' }}>
              <div style={{ fontSize:'0.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-3,#888)', marginBottom:'0.5rem' }}>
                Prüfungsgebühren
              </div>
              <div className="pvs-kpi-grid">
                <div className="stat-card pvs-kpi-card">
                  <div className="pvs-kpi-label">Gesamt</div>
                  <div className="pvs-kpi-value pvs-kpi-purple">{Number(statistiken.gesamt.gebuehren_gesamt).toLocaleString('de-DE', { minimumFractionDigits:2, maximumFractionDigits:2 })} €</div>
                  <div className="pvs-kpi-sub">alle Prüfungsgebühren</div>
                </div>
                <div className="stat-card pvs-kpi-card">
                  <div className="pvs-kpi-label">Bezahlt</div>
                  <div className="pvs-kpi-value pvs-kpi-green">{Number(statistiken.gesamt.gebuehren_bezahlt).toLocaleString('de-DE', { minimumFractionDigits:2, maximumFractionDigits:2 })} €</div>
                  <div className="pvs-kpi-sub pvs-kpi-green-text">{statistiken.gesamt.gebuehren_gesamt > 0 ? Math.round(statistiken.gesamt.gebuehren_bezahlt / statistiken.gesamt.gebuehren_gesamt * 100) : 0}% eingegangen</div>
                </div>
                <div className="stat-card pvs-kpi-card">
                  <div className="pvs-kpi-label">Offen</div>
                  <div className={`pvs-kpi-value ${statistiken.gesamt.gebuehren_offen > 0 ? 'pvs-kpi-red' : 'pvs-kpi-green'}`}>{Number(statistiken.gesamt.gebuehren_offen).toLocaleString('de-DE', { minimumFractionDigits:2, maximumFractionDigits:2 })} €</div>
                  <div className="pvs-kpi-sub">ausstehend</div>
                </div>
              </div>
            </div>
          )}

          <div className="pvs-sep" />

          {/* ── STIL + GRADUIERUNG nebeneinander ─────────────────── */}
          <div className="pvs-two-col">
            <div>
              <h3 className="pv3-section-h3">Nach Stil</h3>
              <div className="pvs-stil-list">
                {statistiken.nach_stil.map((stat, i) => {
                  const quote = stat.anzahl > 0 ? Math.round(stat.bestanden / stat.anzahl * 100) : 0;
                  const barColor = quote >= 80 ? '#4ade80' : quote >= 50 ? '#fbbf24' : '#f87171';
                  return (
                    <div key={i} className="pvs-stil-row">
                      <div className="pvs-stil-row-top">
                        <span className="pvs-stil-name">{stat.stil_name}</span>
                        <span className="pvs-stil-pct" style={{ color: barColor }}>{quote}%</span>
                      </div>
                      <div className="pvs-bar-track pvs-bar-track--full">
                        <div className="pvs-bar-fill-green" style={{ width: `${quote}%`, background: barColor }} />
                      </div>
                      <div className="pvs-stil-sub">
                        <span>{stat.anzahl} Prüfungen</span>
                        <span style={{ color: barColor }}>{stat.bestanden} bestanden</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <h3 className="pv3-section-h3">Nach Graduierung</h3>
              <div className="pvs-grad-list">
                {(() => {
                  const gs = {};
                  abgeschlossenePruefungen.forEach(p => {
                    const g = p.graduierung_nachher || 'Unbekannt';
                    if (!gs[g]) gs[g] = { gesamt: 0, bestanden: 0, farbe: p.farbe_nachher };
                    gs[g].gesamt++;
                    if (p.bestanden) gs[g].bestanden++;
                  });
                  return Object.entries(gs).sort((a, b) => b[1].gesamt - a[1].gesamt).slice(0, 8).map(([grad, s]) => {
                    const q = s.gesamt > 0 ? Math.round(s.bestanden / s.gesamt * 100) : 0;
                    return (
                      <div key={grad} className="pvs-grad-row">
                        <div className="pvs-grad-dot" style={{ background: s.farbe || '#6b7280' }} />
                        <div className="pvs-grad-name">{grad}</div>
                        <div className="pvs-bar-track">
                          <div className="pvs-bar-fill-green" style={{ width: `${q}%` }} />
                        </div>
                        <div className="pvs-grad-stats">
                          <span className="pvs-grad-count">{s.gesamt}</span>
                          <span className="pvs-text-muted">{q}%</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          <div className="pvs-sep" />

          {/* ── TECHNIK-STATISTIKEN (aus einzelbewertungen) ─────── */}
          {technikStats && (
            <div className="pvs-technik-section">
              <h3 className="pv3-section-h3">Technik-Auswertung
                {technikStats.total_pruefungen > 0 && (
                  <span className="pvs-technik-basis"> · {technikStats.total_pruefungen} Prüfungen ausgewertet</span>
                )}
              </h3>
              {technikStats.techniken.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.75rem 0' }}>
                  Noch keine Einzelbewertungen vorhanden. Führe Prüfungen über „Prüfung starten" durch, um hier Technik-Auswertungen zu sehen.
                </p>
              )}

              {/* Punkte nach Kategorie */}
              {technikStats.kategorien.length > 0 && (
                <div className="pvs-kat-grid">
                  {technikStats.kategorien.filter(k => k.avg_prozent !== null).map((kat, i) => {
                    const colors = ['#6366f1','#22c55e','#f59e0b','#06b6d4','#ec4899','#8b5cf6'];
                    const col = colors[i % colors.length];
                    return (
                      <div key={kat.kategorie} className="pvs-kat-card stat-card">
                        <div className="pvs-kat-label">{kat.label}</div>
                        <div className="pvs-kat-bar-track">
                          <div className="pvs-kat-bar-fill" style={{ width: `${kat.avg_prozent}%`, background: col }} />
                        </div>
                        <div className="pvs-kat-footer">
                          <span className="pvs-kat-pct" style={{ color: col }}>{kat.avg_prozent}%</span>
                          <span className="pvs-text-muted">{kat.count} Bewertungen</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Top Techniken + Verbesserungspotenzial */}
              {technikStats.techniken.length > 0 && <div className="pvs-two-col pvs-mt-1">
                {/* Top 5 */}
                <div>
                  <div className="pvs-rank-header pvs-rank-header--gold">🏆 Top Techniken</div>
                  <div className="pvs-rank-list">
                    {technikStats.techniken.slice(0, 5).map((t, i) => (
                      <div key={t.inhalt_id} className="pvs-rank-row">
                        <div className="pvs-rank-pos pvs-rank-pos--gold">{i + 1}</div>
                        <div className="pvs-rank-info">
                          <div className="pvs-rank-name">{t.titel}</div>
                          <div className="pvs-rank-cat">{t.kategorie}</div>
                        </div>
                        <div className="pvs-rank-bar-wrap">
                          <div className="pvs-bar-track">
                            <div className="pvs-bar-fill-gold" style={{ width: `${t.avg_prozent}%` }} />
                          </div>
                        </div>
                        <div className="pvs-rank-score pvs-text-gold">{t.avg_punkte} / {t.max_punktzahl}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Bottom 5 */}
                <div>
                  <div className="pvs-rank-header pvs-rank-header--red">📉 Verbesserungspotenzial</div>
                  <div className="pvs-rank-list">
                    {[...technikStats.techniken].reverse().slice(0, 5).map((t, i) => (
                      <div key={t.inhalt_id} className="pvs-rank-row">
                        <div className="pvs-rank-pos pvs-rank-pos--red">{technikStats.techniken.length - i}</div>
                        <div className="pvs-rank-info">
                          <div className="pvs-rank-name">{t.titel}</div>
                          <div className="pvs-rank-cat">{t.kategorie}</div>
                        </div>
                        <div className="pvs-rank-bar-wrap">
                          <div className="pvs-bar-track">
                            <div className="pvs-bar-fill-red" style={{ width: `${t.avg_prozent}%` }} />
                          </div>
                        </div>
                        <div className="pvs-rank-score pvs-text-red">{t.avg_punkte} / {t.max_punktzahl}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>}
            </div>
          )}

          {/* ── GURTVERTEILUNG ────────────────────────────────────── */}
          {statistiken.gurtverteilung && statistiken.gurtverteilung.length > 0 && (
            <div className="pvs-mt-2">
              <div className="pvs-gurt-header-row">
                <h3 className="pv3-section-h3" style={{ margin: 0 }}>Aktuelle Gurtverteilung</h3>
                <div className="pvs-gurt-view-toggle">
                  <button className={`pvs-gurt-view-btn${gurtView === 'stil' ? ' active' : ''}`} onClick={() => setGurtView('stil')}>Nach Stil</button>
                  <button className={`pvs-gurt-view-btn${gurtView === 'farbe' ? ' active' : ''}`} onClick={() => setGurtView('farbe')}>Nach Gurtfarbe</button>
                </div>
              </div>

              {gurtView === 'stil' ? (() => {
                const byStil = {};
                statistiken.gurtverteilung.forEach(g => {
                  if (!byStil[g.stil_name]) byStil[g.stil_name] = [];
                  byStil[g.stil_name].push(g);
                });
                return (
                  <div className="pvs-gurt-stil-groups">
                    {Object.entries(byStil)
                      .sort((a, b) => b[1].reduce((s, g) => s + g.anzahl, 0) - a[1].reduce((s, g) => s + g.anzahl, 0))
                      .map(([stil, gurte]) => {
                        const total = gurte.reduce((s, g) => s + g.anzahl, 0);
                        const maxA = Math.max(...gurte.map(g => g.anzahl), 1);
                        return (
                          <div key={stil} className="pvs-gurt-stil-group">
                            <div className="pvs-gurt-stil-header-row">
                              <span className="pvs-gurt-stil-name">{stil}</span>
                              <span className="pvs-gurt-stil-total">{total} {total === 1 ? 'Mitglied' : 'Mitglieder'}</span>
                            </div>
                            <div className="pvs-gurt-belt-rows">
                              {gurte.sort((a, b) => b.anzahl - a.anzahl).map((g, i) => (
                                <div key={i} className="pvs-gurt-belt-row">
                                  <div className="pvs-gurt-belt-swatch" style={{ background: g.farbe || '#6b7280' }} />
                                  <div className="pvs-gurt-belt-name">{g.graduierung_name}</div>
                                  <div className="pvs-bar-track pvs-bar-track--full">
                                    <div className="pvs-bar-fill-green" style={{ width: `${Math.round(g.anzahl / maxA * 100)}%`, background: g.farbe || '#4ade80', opacity: 0.55 }} />
                                  </div>
                                  <div className="pvs-gurt-belt-count">{g.anzahl}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })() : (() => {
                const byFarbe = {};
                statistiken.gurtverteilung.forEach(g => {
                  const key = g.farbe || '#808080';
                  if (!byFarbe[key]) byFarbe[key] = { farbe: key, name: g.graduierung_name, anzahl: 0, stile: [] };
                  byFarbe[key].anzahl += g.anzahl;
                  if (!byFarbe[key].stile.includes(g.stil_name)) byFarbe[key].stile.push(g.stil_name);
                });
                const sorted = Object.values(byFarbe).sort((a, b) => b.anzahl - a.anzahl);
                const maxA = sorted[0]?.anzahl || 1;
                return (
                  <div className="pvs-gurt-farbe-grid">
                    {sorted.map((g, i) => (
                      <div key={i} className="pvs-gurt-farbe-card">
                        <div className="pvs-gurt-farbe-top">
                          <div className="pvs-gurt-farbe-swatch" style={{ background: g.farbe }} />
                          <div className="pvs-gurt-farbe-name">{g.name}</div>
                        </div>
                        <div className="pvs-gurt-farbe-count">{g.anzahl}</div>
                        <div className="pvs-bar-track pvs-bar-track--full">
                          <div className="pvs-bar-fill-green" style={{ width: `${Math.round(g.anzahl / maxA * 100)}%`, background: g.farbe || '#4ade80', opacity: 0.6 }} />
                        </div>
                        <div className="pvs-gurt-farbe-stile">{g.stile.join(' · ')}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          <div className="pvs-sep" />

          {/* ── VERLAUF LETZTE 12 MONATE ─────────────────────────── */}
          <div className="pvs-mt-2">
            <h3 className="pv3-section-h3">Verlauf letzte 12 Monate</h3>
            <div className="pvs-month-grid">
              {(() => {
                const now = new Date();
                return Array.from({ length: 12 }, (_, i) => {
                  const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
                  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                  const label = d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
                  let gesamt = 0, bestanden = 0;
                  abgeschlossenePruefungen.forEach(p => {
                    if (!p.pruefungsdatum) return;
                    const pk = p.pruefungsdatum.slice(0, 7);
                    if (pk === key) { gesamt++; if (p.bestanden) bestanden++; }
                  });
                  const quote = gesamt > 0 ? Math.round(bestanden / gesamt * 100) : 0;
                  return (
                    <div key={key} className={`pvs-month-col${gesamt === 0 ? ' pvs-month-col--empty' : ''}`}>
                      <div className="pvs-month-bar-wrap">
                        <div className="pvs-month-bar" style={{ height: `${gesamt > 0 ? Math.max(8, quote) : 0}%` }} />
                      </div>
                      <div className="pvs-month-count">{gesamt > 0 ? gesamt : '·'}</div>
                      <div className="pvs-month-label">{label}</div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* ── RADAR + SCHWACHSTELLEN ───────────────────────────── */}
          {technikStats && technikStats.kategorien.length > 0 && (() => {
            const cx = 150, cy = 150, r = 108;
            const kats = technikStats.kategorien;
            const angles = kats.map((_, i) => (i * (360 / kats.length) - 90) * Math.PI / 180);
            const toXY = (angle, pct) => ({
              x: cx + r * Math.cos(angle) * pct / 100,
              y: cy + r * Math.sin(angle) * pct / 100
            });
            const gridPoints = (pct) => angles.map(a => `${toXY(a, pct).x},${toXY(a, pct).y}`).join(' ');
            const dataPoints = kats.map((k, i) => {
              const p = toXY(angles[i], k.avg_prozent || 0);
              return `${p.x},${p.y}`;
            }).join(' ');
            const schwach = technikStats.techniken.filter(t => t.avg_prozent !== null && t.avg_prozent < 75).slice(0, 8);
            return (
              <div className="pvs-two-col pvs-mt-2">
                {/* Radar */}
                <div>
                  <h3 className="pv3-section-h3">Kategorie-Radar</h3>
                  <div className="pvs-radar-wrap">
                    <svg viewBox="0 0 300 300" className="pvs-radar-svg" style={{ overflow:'visible' }}>
                      {[25,50,75,100].map(pct => (
                        <polygon key={pct} points={gridPoints(pct)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
                      ))}
                      {angles.map((a, i) => (
                        <line key={i} x1={cx} y1={cy} x2={toXY(a,100).x} y2={toXY(a,100).y} stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
                      ))}
                      <polygon points={dataPoints} fill="rgba(99,102,241,0.18)" stroke="#6366f1" strokeWidth="2"/>
                      {kats.map((k, i) => {
                        const p = toXY(angles[i], k.avg_prozent || 0);
                        return <circle key={i} cx={p.x} cy={p.y} r="5" fill="#6366f1" stroke="rgba(0,0,0,0.4)" strokeWidth="1.5"/>;
                      })}
                      {kats.map((k, i) => {
                        const lp = toXY(angles[i], 122);
                        const shortLabel = k.label.split(' / ')[0].split(' ')[0];
                        return (
                          <text key={i} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="rgba(255,255,255,0.45)">
                            {shortLabel}
                          </text>
                        );
                      })}
                      {kats.map((k, i) => {
                        const p = toXY(angles[i], Math.max((k.avg_prozent || 0) - 14, 8));
                        return (
                          <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#a78bfa" fontWeight="700">
                            {k.avg_prozent}%
                          </text>
                        );
                      })}
                    </svg>
                  </div>
                </div>
                {/* Schwachstellen */}
                <div>
                  <h3 className="pv3-section-h3">
                    ⚠️ Schwachstellen
                    <span className="pvs-technik-basis"> · unter 75%</span>
                  </h3>
                  {schwach.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Alle Techniken über 75% — sehr gut!</p>
                  ) : (
                    <div className="pvs-schwach-list">
                      {schwach.map(t => (
                        <div key={t.inhalt_id} className="pvs-schwach-row">
                          <div className="pvs-schwach-info">
                            <div className="pvs-schwach-name">{t.titel}</div>
                            <div className="pvs-schwach-kat">{t.kategorie}</div>
                          </div>
                          <div className="pvs-schwach-bar-wrap">
                            <div className="pvs-bar-track">
                              <div className="pvs-bar-fill-red" style={{ width: `${t.avg_prozent}%` }}/>
                            </div>
                          </div>
                          <div className="pvs-schwach-score">{t.avg_prozent}%</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          <div className="pvs-sep" />

          {/* ── Ø WARTEZEIT PRO GRADUIERUNGSSTUFE ────────────────── */}
          {statistiken.wartezeit && statistiken.wartezeit.length > 0 && (
            <div style={{ marginTop:'1.5rem' }}>
              <h3 className="pv3-section-h3" style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
                Ø Wartezeit bis Prüfung
                <span className="pv-tooltip-wrap" data-tip="Durchschnittliche Wartezeit in Monaten zwischen der letzten Prüfung und der nächsten Prüfung, gruppiert nach Graduierungsstufe. Nur Stufen mit mindestens 2 Prüfungen werden angezeigt.">
                  <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:'16px', height:'16px', borderRadius:'50%', background:'rgba(99,102,241,0.2)', border:'1px solid rgba(99,102,241,0.4)', color:'#a5b4fc', fontSize:'0.6rem', fontWeight:700, cursor:'help', flexShrink:0 }}>i</span>
                </span>
              </h3>
              <div className="pvs-grad-diff-list">
                {statistiken.wartezeit.map((w, i) => {
                  const monate = w.avg_wartezeit_monate || 0;
                  const maxMonate = Math.max(...statistiken.wartezeit.map(x => x.avg_wartezeit_monate || 0), 1);
                  const pct = Math.round(monate / maxMonate * 100);
                  const col = monate <= 3 ? '#4ade80' : monate <= 6 ? '#fbbf24' : '#f87171';
                  return (
                    <div key={i} className="pvs-grad-diff-row">
                      <div className="pvs-grad-dot" style={{ background: w.farbe || '#ccc' }}/>
                      <div className="pvs-grad-diff-info">
                        <div className="pvs-grad-diff-name">{w.graduierung_name}</div>
                        <div className="pvs-grad-diff-stil">{w.stil_name}</div>
                      </div>
                      <div className="pvs-grad-diff-bar">
                        <div className="pvs-bar-track">
                          <div style={{ height:'100%', width:`${pct}%`, background:col, borderRadius:4, transition:'width 0.5s', opacity:0.85 }}/>
                        </div>
                      </div>
                      <div className="pvs-grad-diff-score" style={{ color:col }}>
                        {monate} Mon.
                        <span className="pvs-text-muted" style={{ fontSize:'0.65rem', display:'block' }}>{w.anzahl} Prüfg.</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── GRAD-SCHWIERIGKEIT + TOP-PRÜFLINGE ───────────────── */}
          {erwStats && (
            <div className="pvs-two-col pvs-mt-2">
              {/* Graduierungs-Schwierigkeit */}
              <div>
                <h3 className="pv3-section-h3" style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
                  Bestehensquote nach Graduierung
                  <span className="pv-tooltip-wrap" data-tip="Zeigt pro Graduierungsstufe wie viele Prüflinge bestanden haben. Grün = hohe Bestehensquote, Rot = viele sind durchgefallen. So erkennst du welche Prüfungen besonders anspruchsvoll sind.">
                    <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
                      width:'16px', height:'16px', borderRadius:'50%',
                      background:'rgba(99,102,241,0.2)', border:'1px solid rgba(99,102,241,0.4)',
                      color:'#a5b4fc', fontSize:'0.6rem', fontWeight:700, cursor:'help',
                      flexShrink:0 }}>i</span>
                  </span>
                </h3>
                {erwStats.grad_stats.length === 0 ? (
                  <p style={{ color:'var(--text-muted)', fontSize:'0.85rem' }}>Noch keine abgeschlossenen Prüfungen vorhanden</p>
                ) : (
                  <div className="pvs-grad-diff-list">
                    {erwStats.grad_stats.map((g, i) => {
                      const bestandenPct = g.gesamt > 0 ? Math.round(g.bestanden / g.gesamt * 100) : 0;
                      const durchfallPct = g.gesamt > 0 ? Math.round(g.nicht_bestanden / g.gesamt * 100) : 0;
                      const col = bestandenPct === 100 ? '#4ade80' : bestandenPct >= 80 ? '#a3e635' : bestandenPct >= 60 ? '#fbbf24' : '#f87171';
                      return (
                        <div key={i} className="pvs-grad-diff-row">
                          <div className="pvs-grad-dot" style={{ background: g.farbe || '#ccc' }}/>
                          <div className="pvs-grad-diff-info">
                            <div className="pvs-grad-diff-name">{g.graduierung_name}</div>
                            <div className="pvs-grad-diff-stil">{g.stil_name}</div>
                          </div>
                          <div className="pvs-grad-diff-bar">
                            <div className="pvs-bar-track" style={{ position:'relative', overflow:'hidden' }}>
                              <div style={{ position:'absolute', height:'100%', width:`${bestandenPct}%`, background:col, borderRadius:4, transition:'width 0.5s', opacity:0.85 }}/>
                              {durchfallPct > 0 && (
                                <div style={{ position:'absolute', left:`${bestandenPct}%`, height:'100%', width:`${durchfallPct}%`, background:'#f87171', borderRadius:4, transition:'width 0.5s', opacity:0.7 }}/>
                              )}
                            </div>
                          </div>
                          <div className="pvs-grad-diff-score" style={{ color: col }}>
                            {bestandenPct}%
                            <span className="pvs-text-muted" style={{ fontSize:'0.65rem', display:'block' }}>
                              {g.bestanden}/{g.gesamt} best.
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Wiederholer */}
                {erwStats.zweiter_anlauf && erwStats.zweiter_anlauf.total_kombis > 0 && (
                  <div className="pvs-wiederholer-card stat-card">
                    <div className="pvs-kpi-label">Zweiter Anlauf</div>
                    <div style={{ display:'flex', gap:'1.5rem', alignItems:'center', marginTop:'0.4rem' }}>
                      <div>
                        <div className="pvs-kpi-value pvs-kpi-yellow">{erwStats.zweiter_anlauf.wiederholer_kombis}</div>
                        <div className="pvs-kpi-sub">Prüfungen wiederholt</div>
                      </div>
                      <div>
                        <div className="pvs-kpi-value pvs-kpi-cyan">{erwStats.zweiter_anlauf.extra_versuche}</div>
                        <div className="pvs-kpi-sub">Extra-Versuche</div>
                      </div>
                      <div>
                        <div className="pvs-kpi-value" style={{ color:'var(--text-muted)' }}>
                          {erwStats.zweiter_anlauf.total_kombis > 0
                            ? Math.round(erwStats.zweiter_anlauf.wiederholer_kombis / erwStats.zweiter_anlauf.total_kombis * 100)
                            : 0}%
                        </div>
                        <div className="pvs-kpi-sub">Wiederholquote</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* Top-Prüflinge */}
              <div>
                <h3 className="pv3-section-h3" style={{ display:'flex', alignItems:'center', gap:'0.4rem' }}>
                  🏅 Top-Prüflinge
                  <span className="pv-tooltip-wrap" data-tip="Ranking der Mitglieder nach ihrer durchschnittlichen Punktzahl über alle bestandenen Prüfungen. Nur Prüfungen mit Punktbewertung werden berücksichtigt.">
                    <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
                      width:'16px', height:'16px', borderRadius:'50%',
                      background:'rgba(99,102,241,0.2)', border:'1px solid rgba(99,102,241,0.4)',
                      color:'#a5b4fc', fontSize:'0.6rem', fontWeight:700, cursor:'help',
                      flexShrink:0 }}>i</span>
                  </span>
                </h3>
                {erwStats.top_pruefling.length === 0 ? (
                  <p style={{ color:'var(--text-muted)', fontSize:'0.85rem' }}>Noch keine Punktzahlen erfasst</p>
                ) : (
                  <div className="pvs-top-list">
                    {erwStats.top_pruefling.map((p, i) => {
                      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
                      const col = i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : 'var(--text-muted)';
                      return (
                        <div key={p.mitglied_id} className="pvs-top-row">
                          <div className="pvs-top-medal">{medal}</div>
                          <div className="pvs-top-info">
                            <div className="pvs-top-name">{p.vorname} {p.nachname}</div>
                            <div className="pvs-top-sub">{p.anzahl} {p.anzahl === 1 ? 'Prüfung' : 'Prüfungen'}</div>
                          </div>
                          <div className="pvs-top-bar">
                            <div className="pvs-bar-track">
                              <div style={{ height:'100%', width:`${p.avg_prozent}%`, background: col, borderRadius:4, opacity:0.85, transition:'width 0.5s' }}/>
                            </div>
                          </div>
                          <div className="pvs-top-score" style={{ color: col }}>{p.avg_prozent}%</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="pvs-sep" />

          {/* ── INSIGHTS ──────────────────────────────────────────── */}
          <div className="pvs-mt-2">
            <h3 className="pv3-section-h3">Insights</h3>
            <div className="pv3-insights-grid">
              <div className="stat-card">
                <h4 className="pv2-warning-label">Beste Erfolgsquote</h4>
                {(() => {
                  const best = statistiken.nach_stil.length > 0
                    ? statistiken.nach_stil.reduce((b, c) => (c.bestanden / c.anzahl) > (b.bestanden / b.anzahl) ? c : b)
                    : null;
                  return best ? (
                    <>
                      <div className="pv2-heading-primary">{best.stil_name}</div>
                      <div className="pv3-insight-success">{Math.round(best.bestanden / best.anzahl * 100)}%</div>
                      <div className="pv2-muted-mt">{best.bestanden} von {best.anzahl} bestanden</div>
                    </>
                  ) : <div className="pv-text-muted">Keine Daten</div>;
                })()}
              </div>
              <div className="stat-card">
                <h4 className="pv2-warning-label">Aktivster Monat</h4>
                {(() => {
                  const mc = {};
                  abgeschlossenePruefungen.forEach(p => {
                    if (!p.pruefungsdatum) return;
                    const k = new Date(p.pruefungsdatum).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
                    mc[k] = (mc[k] || 0) + 1;
                  });
                  const top = Object.entries(mc).sort((a, b) => b[1] - a[1])[0];
                  return top ? (
                    <>
                      <div className="pv2-heading-primary">{top[0]}</div>
                      <div className="pv3-insight-purple">{top[1]}</div>
                      <div className="pv2-muted-mt">Prüfungen durchgeführt</div>
                    </>
                  ) : <div className="pv-text-muted">Keine Daten</div>;
                })()}
              </div>
              <div className="stat-card">
                <h4 className="pv2-warning-label">Nächste Prüfung</h4>
                {(() => {
                  const heute = new Date(); heute.setHours(0,0,0,0);
                  const zk = zugelassenePruefungen.filter(p => p.pruefungsdatum && new Date(p.pruefungsdatum) >= heute);
                  if (zk.length === 0) return <div className="pv-text-muted">Keine geplant</div>;
                  const gp = {};
                  zk.forEach(p => {
                    const k = `${p.pruefungsdatum}_${p.stil_name}`;
                    if (!gp[k]) gp[k] = { datum: p.pruefungsdatum, stil: p.stil_name || '—', anzahl: 0 };
                    gp[k].anzahl++;
                  });
                  const n = Object.values(gp).sort((a, b) => new Date(a.datum) - new Date(b.datum))[0];
                  return (
                    <>
                      <div className="pv2-heading-primary">{new Date(n.datum).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                      <div className="pv3-insight-next-stil">{n.stil}</div>
                      <div className="pv2-muted-mt">{n.anzahl} Teilnehmer</div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

        </div>
  );
};

export default PruefungsStatistikTab;
