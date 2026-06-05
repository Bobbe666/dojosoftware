import React, { useState, useEffect } from 'react';
import { Clock, Users, CreditCard, TrendingUp, PieChart, MapPin, Activity, DollarSign, HardDrive, Flag, Heart } from 'lucide-react';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import config from '../config/config';

// Ausgelagert aus DojoLizenzverwaltung.jsx (Statistics-Tab, read-only Dashboard).
const LizenzStatisticsTab = ({ dojos, message, stats, dojosWithHealth, healthOverview }) => {
  // Zentrale Prognose (eine Engine: /api/admin/prognose, Ø-Wachstum + Spike-Filter)
  const [zentralePrognose, setZentralePrognose] = useState(null);
  useEffect(() => {
    fetchWithAuth(`${config.apiBaseUrl}/admin/prognose`)
      .then(r => r.json())
      .then(d => { if (d.success) setZentralePrognose(d); })
      .catch(() => {});
  }, []);
  return (
          <div className="st-dashboard">

            {/* ── Row 1: KPI strip ─────────────────────────────────────────── */}
            <div className="st-full">
              <div className="st-kpi-row">
                <div className="st-kpi-item">
                  <span className="st-kpi-val">{stats.total}</span>
                  <span className="st-kpi-lbl">Dojos</span>
                </div>
                <div className="st-kpi-sep" />
                <div className="st-kpi-item">
                  <span className="st-kpi-val st-kpi-val--green">{stats.active}</span>
                  <span className="st-kpi-lbl">Aktiv</span>
                </div>
                <div className="st-kpi-sep" />
                <div className="st-kpi-item">
                  <span className="st-kpi-val st-kpi-val--yellow">{stats.trials}</span>
                  <span className="st-kpi-lbl">Trial</span>
                </div>
                <div className="st-kpi-sep" />
                <div className="st-kpi-item">
                  <span className="st-kpi-val st-kpi-val--blue">{stats.paid}</span>
                  <span className="st-kpi-lbl">Zahlend</span>
                </div>
                <div className="st-kpi-sep" />
                <div className="st-kpi-item">
                  <span className="st-kpi-val">{stats.free}</span>
                  <span className="st-kpi-lbl">Free</span>
                </div>
                <div className="st-kpi-sep" />
                <div className="st-kpi-item">
                  <span className="st-kpi-val">{stats.totalMembers.toLocaleString('de-DE')}</span>
                  <span className="st-kpi-lbl">Mitglieder</span>
                </div>
                <div className="st-kpi-sep" />
                <div className="st-kpi-item">
                  <span className="st-kpi-val st-kpi-val--gold">€{stats.potentialMrr.toLocaleString('de-DE')}</span>
                  <span className="st-kpi-lbl">pot. MRR</span>
                </div>
                <div className="st-kpi-sep" />
                <div className="st-kpi-item">
                  <span className="st-kpi-val st-kpi-val--gold">€{(stats.potentialMrr * 12).toLocaleString('de-DE')}</span>
                  <span className="st-kpi-lbl">ARR</span>
                </div>
                <div className="st-kpi-sep" />
                <div className="st-kpi-item">
                  <span className={`st-kpi-val ${Number(stats.conversionRate) > 0 ? 'st-kpi-val--green' : ''}`} style={Number(stats.conversionRate) === 0 ? { color: 'var(--ds-text-faint)' } : {}}>
                    {stats.conversionRate}%
                  </span>
                  <span className="st-kpi-lbl">Conversion</span>
                </div>
                <div className="st-kpi-sep" />
                <div className="st-kpi-item">
                  <span className={`st-kpi-val ${Number(stats.growthRate) >= 0 ? 'st-kpi-val--pos' : 'st-kpi-val--neg'}`}>
                    {Number(stats.growthRate) >= 0 ? '+' : ''}{stats.growthRate}%
                  </span>
                  <span className="st-kpi-lbl">MoM</span>
                </div>
              </div>
            </div>

            {/* ── Row 2: Growth chart + Plan distribution ───────────────────── */}
            <div className="st-card">
              <div className="st-card-title">
                <Activity size={13} />
                Wachstum – letzte 12 Monate
              </div>
              <div className="st-barchart">
                {(() => {
                  const maxCount = Math.max(...stats.monthlyGrowth.map(m => m.count), 1);
                  return stats.monthlyGrowth.map((month, idx) => {
                    const heightPct = Math.max((month.count / maxCount) * 72, month.count > 0 ? 3 : 0);
                    return (
                      <div key={idx} className="st-bar-wrap">
                        {month.new > 0 && <span className="st-bar-new">+{month.new}</span>}
                        <div
                          className="st-bar"
                          style={{ height: `${heightPct}px` }}
                          title={`${month.month}: ${month.count} Dojos${month.new > 0 ? ` (+${month.new} neu)` : ''}`}
                        />
                        <span className="st-bar-lbl">{month.month}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="st-card">
              <div className="st-card-title">
                <PieChart size={13} />
                Plan-Verteilung
              </div>
              {Object.entries(PLAN_NAMES).map(([plan, label]) => {
                const count = stats.planDistribution?.[plan] || 0;
                if (count === 0 && (plan === 'trial' || plan === 'basic' || plan === 'free')) return null;
                const percent = stats.total > 0 ? ((count / stats.total) * 100).toFixed(1) : 0;
                return (
                  <div key={plan} className="st-plan-row">
                    <span className={`plan-badge-mini plan-badge-mini--${plan}`} style={{ minWidth: 72, fontSize: '0.68rem' }}>{label}</span>
                    <span className="st-plan-count">{count}</span>
                    <div className="st-plan-bar-track">
                      <div className="st-plan-bar-fill" style={{ width: `${percent}%`, background: PLAN_COLORS?.[plan] || 'rgba(255,255,255,0.3)' }} />
                    </div>
                    <span className="st-plan-pct">{percent}%</span>
                  </div>
                );
              })}
              <div className="st-subsection-title">Einnahmen pro Plan</div>
              {Object.entries(PLAN_NAMES).map(([plan]) => {
                const count = stats.planDistribution?.[plan] || 0;
                const price = PLAN_PRICE_VALUES?.[plan] || 0;
                if (count === 0 || price === 0) return null;
                return (
                  <div key={plan} className="st-revenue-row">
                    <span className="st-revenue-plan">{PLAN_NAMES[plan]}</span>
                    <span className="st-revenue-calc">{count} × €{price}</span>
                    <span className="st-revenue-total">€{(count * price).toLocaleString('de-DE')}</span>
                  </div>
                );
              })}
            </div>

            {/* ── Row 3: Trial status + Registration cohort ─────────────────── */}
            <div className="st-card">
              <div className="st-card-title">
                <Clock size={13} />
                Trial-Status
              </div>
              <div className="st-trial-row">
                <span className="st-dot st-dot--green" />
                <span className="st-trial-label">Aktiv (&gt;7 Tage)</span>
                <span className="st-trial-val">{stats.activeTrials}</span>
              </div>
              <div className="st-trial-row">
                <span className="st-dot" style={{ background: '#fb923c' }} />
                <span className="st-trial-label">Bald ablaufend (≤7 Tage)</span>
                <span className="st-trial-val">{stats.expiringTrials}</span>
              </div>
              <div className="st-trial-row">
                <span className="st-dot st-dot--red" />
                <span className="st-trial-label">Abgelaufen</span>
                <span className="st-trial-val">{stats.expiredTrials}</span>
              </div>
              <div className="st-trial-row">
                <span className="st-dot st-dot--blue" />
                <span className="st-trial-label">Zahlend</span>
                <span className="st-trial-val">{stats.paid}</span>
              </div>
              <div className="st-trial-row" style={{ marginTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.4rem' }}>
                <span className="st-trial-label" style={{ color: 'var(--ds-text-muted)', fontSize: '0.72rem' }}>Ø Trial-Dauer</span>
                <span className="st-trial-val" style={{ fontSize: '0.82rem', color: 'var(--ds-text-muted)' }}>–</span>
              </div>
            </div>

            <div className="st-card">
              <div className="st-card-title">
                <CreditCard size={13} />
                Neue Registrierungen
              </div>
              {(() => {
                const now = Date.now();
                const days = [7, 30, 60, 90, 180, 365];
                const labels = ['Letzte 7 Tage', '30 Tage', '60 Tage', '90 Tage', '180 Tage', '365 Tage'];
                const counts = days.map(d => dojos.filter(dj => dj.created_at && (now - new Date(dj.created_at).getTime()) <= d * 86400000).length);
                const maxC = Math.max(...counts, 1);
                const avgPerMonth = ((stats.newThisMonth || 0) + (stats.newLastMonth || 0)) / 2;
                return (
                  <>
                    {days.map((d, i) => (
                      <div key={d} className="st-cohort-row">
                        <span className="st-cohort-lbl">{labels[i]}</span>
                        <div className="st-cohort-bar">
                          <div className="st-cohort-bar-fill" style={{ width: `${(counts[i] / maxC) * 100}%` }} />
                        </div>
                        <span className="st-cohort-val">{counts[i]}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--ds-text-muted)' }}>
                      Ø pro Monat: <span style={{ color: 'var(--ds-text-secondary)', fontWeight: 700 }}>{avgPerMonth.toFixed(1)}</span>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* ── Row 4: MRR Aufschlüsselung (full width) ──────────────────── */}
            <div className="st-card st-full">
              <div className="st-card-title">
                <DollarSign size={13} />
                MRR &amp; Revenue
              </div>
              <div className="st-mini-metrics">
                <div className="st-mini-metric">
                  <span className="st-mini-val" style={{ color: '#ffd700' }}>€{stats.potentialMrr.toLocaleString('de-DE')}</span>
                  <span className="st-mini-lbl">pot. MRR</span>
                </div>
                <div className="st-mini-metric">
                  <span className="st-mini-val" style={{ color: '#86efac' }}>€{(stats.mrr || 0).toLocaleString('de-DE')}</span>
                  <span className="st-mini-lbl">akt. MRR</span>
                </div>
                <div className="st-mini-metric">
                  <span className="st-mini-val" style={{ color: '#ffd700' }}>€{(stats.potentialMrr * 12).toLocaleString('de-DE')}</span>
                  <span className="st-mini-lbl">ARR</span>
                </div>
                <div className="st-mini-metric">
                  <span className="st-mini-val">€{(stats.total - 1) > 0 ? (stats.potentialMrr / (stats.total - 1)).toFixed(0) : '0'}</span>
                  <span className="st-mini-lbl">Ø pro Dojo</span>
                </div>
              </div>
              {stats.mrrDetails.length > 0 ? (
                <table className="st-mrr-table">
                  <thead>
                    <tr>
                      <th>Dojo</th>
                      <th>Plan</th>
                      <th style={{ textAlign: 'right' }}>MRR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.mrrDetails.map(d => (
                      <tr key={d.id}>
                        <td>{d.name}</td>
                        <td><span className={`plan-badge-mini plan-badge-mini--${d.plan}`}>{d.plan.toUpperCase()}</span></td>
                        <td>€{d.contribution.toLocaleString('de-DE')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="st-mrr-empty">Aktuell keine zahlenden Dojos.</div>
              )}
            </div>

            {/* ── Row 5: Top Dojos + Geographic ────────────────────────────── */}
            <div className="st-card">
              <div className="st-card-title">
                <Users size={13} />
                Top Dojos nach Mitglieder
              </div>
              {(() => {
                const sorted = [...dojos].sort((a, b) => (b.mitglieder_count || 0) - (a.mitglieder_count || 0)).slice(0, 5);
                const maxCount = sorted[0]?.mitglieder_count || 1;
                return sorted.map((d, i) => (
                  <div key={d.id} className="st-top-row">
                    <span className="st-top-rank">{String(i + 1).padStart(2, '0')}</span>
                    <span className="st-top-name">{d.dojoname}</span>
                    <span className={`plan-badge-mini plan-badge-mini--${d.plan || 'free'}`} style={{ fontSize: '0.62rem' }}>{(d.plan || 'free').toUpperCase()}</span>
                    <div className="st-top-bar">
                      <div className="st-top-bar-fill" style={{ width: `${((d.mitglieder_count || 0) / maxCount) * 100}%` }} />
                    </div>
                    <span className="st-top-val">{d.mitglieder_count || 0}</span>
                  </div>
                ));
              })()}
            </div>

            <div className="st-card">
              <div className="st-card-title">
                <MapPin size={13} />
                Geografisch
              </div>
              {(() => {
                const flagMap = { 'Deutschland': '🇩🇪', 'Österreich': '🇦🇹', 'Schweiz': '🇨🇭', 'Italien': '🇮🇹', 'USA': '🇺🇸', 'Frankreich': '🇫🇷', 'Spanien': '🇪🇸', 'Niederlande': '🇳🇱', 'Belgien': '🇧🇪', 'Polen': '🇵🇱' };
                const countries = Object.entries(stats.countryDistribution || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
                const maxC = countries[0]?.[1] || 1;
                return countries.map(([country, count]) => {
                  const pct = stats.total > 0 ? ((count / stats.total) * 100).toFixed(1) : 0;
                  return (
                    <div key={country} className="st-geo-row">
                      <span className="st-geo-flag">{flagMap[country] || '🌍'}</span>
                      <span className="st-geo-name">{country}</span>
                      <div className="st-geo-bar"><div className="st-geo-fill" style={{ width: `${(count / maxC) * 100}%` }} /></div>
                      <span className="st-geo-cnt">{count}</span>
                      <span className="st-geo-pct">{pct}%</span>
                    </div>
                  );
                });
              })()}
              {(() => {
                const regions = Object.entries(stats.regionDistribution || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
                if (!regions.length) return null;
                return (
                  <>
                    <div className="st-subsection-title">Top Regionen</div>
                    {regions.map(([region, count]) => (
                      <div key={region} className="st-geo-row" style={{ fontSize: '0.72rem' }}>
                        <span className="st-geo-flag" style={{ fontSize: '0.7rem', color: 'var(--ds-text-faint)' }}>•</span>
                        <span className="st-geo-name">{region}</span>
                        <span className="st-geo-cnt">{count}</span>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>

            {/* ── Row 6: Health + Forecast ──────────────────────────────────── */}
            <div className="st-card">
              <div className="st-card-title">
                <Heart size={13} />
                System-Gesundheit
              </div>
              <div className="st-health-grid">
                <div className="st-health-tile healthy">
                  <div>
                    <div className="st-health-tile-val">{healthOverview.healthy}</div>
                    <div className="st-health-tile-lbl">Gesund</div>
                  </div>
                </div>
                <div className="st-health-tile warning">
                  <div>
                    <div className="st-health-tile-val">{healthOverview.warning}</div>
                    <div className="st-health-tile-lbl">Warnungen</div>
                  </div>
                </div>
                <div className="st-health-tile critical">
                  <div>
                    <div className="st-health-tile-val">{healthOverview.critical}</div>
                    <div className="st-health-tile-lbl">Kritisch</div>
                  </div>
                </div>
                <div className="st-health-tile score">
                  <div>
                    <div className="st-health-tile-val">{healthOverview.avgScore.toFixed(0)}%</div>
                    <div className="st-health-tile-lbl">Ø Score</div>
                  </div>
                </div>
              </div>
              {(healthOverview.critical > 0 || healthOverview.warning > 0) && (
                <>
                  <div className="st-subsection-title">Problematische Dojos</div>
                  {dojosWithHealth
                    .filter(d => d.health.status !== 'healthy')
                    .sort((a, b) => a.health.score - b.health.score)
                    .slice(0, 5)
                    .map(d => (
                      <div key={d.id} className="st-health-issue">
                        <span className="st-health-issue-name">{d.dojoname}</span>
                        <span className={`st-score-badge ${d.health.status}`}>{d.health.score}%</span>
                        <span className="st-health-msg">{d.health.allProblems?.[0]?.message || ''}</span>
                      </div>
                    ))}
                </>
              )}
            </div>

            <div className="st-card">
              <div className="st-card-title">
                <TrendingUp size={13} />
                Prognose 6 Monate {zentralePrognose ? '(zentrale Engine)' : ''}
              </div>
              {[1, 2, 3, 4, 5, 6].map(month => {
                // ZENTRALE Prognose-Engine (/api/admin/prognose); Fallback: lokale Näherung
                const avgGrowth = zentralePrognose?.dojos?.wachstum_monat
                  ?? (stats.avgMonthlyGrowth || stats.newThisMonth || 0.5);
                const basis = zentralePrognose?.dojos?.aktuell ?? stats.total;
                const projected = Math.round(basis + avgGrowth * month);
                const avgMrrPerDojo = (stats.total - 1) > 0 ? stats.potentialMrr / (stats.total - 1) : 49;
                const projectedMrr = Math.round(stats.potentialMrr + Math.round(avgGrowth * month) * avgMrrPerDojo);
                const monthName = new Date(new Date().setMonth(new Date().getMonth() + month)).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
                return (
                  <div key={month} className="st-forecast-row">
                    <span className="st-forecast-month">{monthName}</span>
                    <span className="st-forecast-dojos">{projected} Dojos</span>
                    <span className="st-forecast-mrr">€{projectedMrr.toLocaleString('de-DE')}</span>
                  </div>
                );
              })}
            </div>

            {/* ── Row 7: Goal + Storage ─────────────────────────────────────── */}
            <div className="st-card">
              <div className="st-card-title">
                <Flag size={13} />
                Ziel: {stats.goalDojos} Dojos
              </div>
              <div className="st-goal-nums">
                <span className="st-goal-cur">{stats.total}</span>
                <span className="st-goal-sep">/</span>
                <span className="st-goal-target">{stats.goalDojos}</span>
              </div>
              <div className="st-goal-bar">
                <div className="st-goal-fill" style={{ width: `${Math.min(stats.goalProgress, 100)}%` }} />
              </div>
              <div className="st-goal-meta">
                <span>{stats.goalProgress}% erreicht</span>
                <span>Noch {stats.dojosToGoal} Dojos</span>
              </div>
              <div className="st-goal-eta">
                {stats.monthsToGoal ? (
                  <>
                    ETA: <strong>{stats.estimatedGoalDate?.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</strong>
                    {' '}(~{stats.monthsToGoal} Mo. bei Ø {stats.avgMonthlyGrowth?.toFixed(1)}/Mo.)
                  </>
                ) : (
                  <span style={{ color: 'var(--ds-text-faint)' }}>Kein Wachstum – ETA nicht berechenbar</span>
                )}
              </div>
            </div>

            <div className="st-card">
              <div className="st-card-title">
                <HardDrive size={13} />
                Speicherplatz
              </div>
              <div className="st-storage-summary">
                <div className="st-storage-tile">
                  <div className="st-storage-val">{stats.totalStorageMB.toFixed(1)} MB</div>
                  <div className="st-storage-lbl">Gesamt</div>
                </div>
                <div className="st-storage-tile">
                  <div className="st-storage-val">{stats.avgStorageMB.toFixed(1)} MB</div>
                  <div className="st-storage-lbl">Ø pro Dojo</div>
                </div>
                <div className="st-storage-tile">
                  <div className="st-storage-val">{parseFloat(stats.maxStorageDojo?.storage_mb || 0).toFixed(1)} MB</div>
                  <div className="st-storage-lbl">{stats.maxStorageDojo?.dojoname || '–'}</div>
                </div>
              </div>
              {[...dojos]
                .sort((a, b) => (parseFloat(b.storage_mb) || 0) - (parseFloat(a.storage_mb) || 0))
                .slice(0, 8)
                .map(d => {
                  const mb = parseFloat(d.storage_mb) || 0;
                  const kb = d.storage_kb || 0;
                  const maxMb = parseFloat(stats.maxStorageDojo?.storage_mb) || 1;
                  const pct = (mb / Math.max(maxMb, 1)) * 100;
                  const fillClass = mb > 500 ? 'warn' : mb > 100 ? 'med' : '';
                  return (
                    <div key={d.id} className="st-storage-row">
                      <span className="st-storage-name">{d.dojoname}</span>
                      <div className="st-storage-track">
                        <div className={`st-storage-fill ${fillClass}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="st-storage-size">{kb >= 1024 ? `${mb.toFixed(1)} MB` : `${kb} KB`}</span>
                    </div>
                  );
                })}
            </div>

          </div>
  );
};

export default LizenzStatisticsTab;
