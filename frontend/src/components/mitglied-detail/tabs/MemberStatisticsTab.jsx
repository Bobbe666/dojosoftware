import React from 'react';
import BadgeDisplay from '../../BadgeDisplay';
import '../../../styles/MemberStatisticsTab.css';

const MemberStatisticsTab = ({
  statistikDaten = {},
  mitglied,
  memberStile = [],
  stile = [],
  styleSpecificData = {}
}) => {
  // Farbe basierend auf Prozentsatz — Gold/Amber/Orange/Rot Palette
  const getBarColor = (percentage, count) => {
    if (count === 0) return { color1: 'rgba(255,255,255,0.08)', color2: 'rgba(255,255,255,0.05)' };
    if (percentage >= 0.75) return { color1: '#FFD700', color2: '#f59e0b' };
    if (percentage >= 0.5)  return { color1: '#f59e0b', color2: '#fb923c' };
    if (percentage >= 0.25) return { color1: '#fb923c', color2: '#ef4444' };
    return { color1: '#ef4444', color2: '#dc2626' };
  };

  // Weekday tile Farbe — Gold-Transparenz-Skala
  const getTileColor = (percentage) => {
    if (percentage >= 0.8) return 'rgba(255, 215, 0, 0.75)';
    if (percentage >= 0.6) return 'rgba(255, 215, 0, 0.55)';
    if (percentage >= 0.4) return 'rgba(255, 180, 0, 0.38)';
    if (percentage >= 0.2) return 'rgba(245, 158, 11, 0.25)';
    if (percentage > 0)    return 'rgba(245, 158, 11, 0.14)';
    return 'rgba(255, 255, 255, 0.06)';
  };

  return (
    <div className="mst-content">

      {/* ── 8 Statistik-Kacheln ── */}
      <div className="mst-stats-grid">
        <div className="mst-card">
          <div className="mst-accent-bar mst-accent-gold"></div>
          <div className="mst-kachel-label">Trainings</div>
          <div className="mst-kachel-value">{statistikDaten.totalAnwesenheiten || 0}</div>
        </div>

        <div className="mst-card">
          <div className="mst-accent-bar mst-accent-blue"></div>
          <div className="mst-kachel-label">Quote</div>
          <div className="mst-kachel-value">{statistikDaten.anwesenheitsquote || 0}%</div>
          <div className="mst-progress-track">
            <div className="mst-progress-fill" style={{ width: `${statistikDaten.anwesenheitsquote || 0}%` }}></div>
          </div>
        </div>

        <div className="mst-card">
          <div className="mst-accent-bar mst-accent-orange"></div>
          <div className="mst-kachel-label">Streak</div>
          <div className="mst-kachel-value">{statistikDaten.currentStreak || 0}</div>
          <div className="mst-kachel-sub">Trainings in Folge</div>
        </div>

        <div className="mst-card">
          <div className="mst-accent-bar mst-accent-amber"></div>
          <div className="mst-kachel-label">Dieser Monat</div>
          <div className="mst-kachel-value">{statistikDaten.thisMonthAttendances || 0}</div>
        </div>

        <div className="mst-card">
          <div className="mst-accent-bar mst-accent-purple"></div>
          <div className="mst-kachel-label">Monat (6M)</div>
          <div className="mst-kachel-value">{statistikDaten.avgPerMonth || 0}</div>
        </div>

        <div className="mst-card">
          <div className="mst-accent-bar mst-accent-blue"></div>
          <div className="mst-kachel-label">Letzte Woche</div>
          <div className="mst-kachel-value">{statistikDaten.lastWeekAttendances || 0}</div>
        </div>

        <div className="mst-card">
          <div className="mst-accent-bar mst-accent-amber"></div>
          <div className="mst-kachel-label">Konsistenz</div>
          <div className="mst-kachel-value">{statistikDaten.consecutiveMonths || 0}</div>
          <div className="mst-kachel-sub">Monate aktiv</div>
        </div>

        <div className="mst-card">
          <div className="mst-accent-bar mst-accent-gold"></div>
          <div className="mst-kachel-label">Kontostand</div>
          <div className={`mst-kontostand-value${(mitglied?.kontostand ?? 0) >= 0 ? ' mst-kontostand-value--pos' : ' mst-kontostand-value--neg'}`}>
            {mitglied?.kontostand != null ? `${Number(mitglied.kontostand).toFixed(2)} €` : '0,00 €'}
          </div>
        </div>
      </div>

      {/* ── Balkendiagramm: Trainings pro Monat ── */}
      {statistikDaten.monthlyStats && statistikDaten.monthlyStats.length > 0 && (
        <div className="mst-section">
          <h3 className="mst-section-title">Trainings pro Monat (12 Monate)</h3>
          <div className="mst-bar-chart-row">
            {statistikDaten.monthlyStats.slice(-12).map((monthStat, index) => {
              const last12 = statistikDaten.monthlyStats.slice(-12);
              const maxCount = Math.max(...last12.map(m => m.count), 1);
              const heightPx = maxCount > 0 ? (monthStat.count / maxCount) * 110 : 2;
              const pct = maxCount > 0 ? monthStat.count / maxCount : 0;
              const { color1, color2 } = getBarColor(pct, monthStat.count);
              return (
                <div key={index} className="mst-bar-col">
                  <div className={`mst-bar-count${monthStat.count > 0 ? ' mst-bar-count--active' : ''}`}>
                    {monthStat.count > 0 ? monthStat.count : ''}
                  </div>
                  <div
                    className={`mst-bar-fill${monthStat.count === 0 ? ' mst-bar-fill--empty' : ''}`}
                    style={{ '--bar-c1': color1, '--bar-c2': color2, height: `${heightPx}px` }}
                  />
                  <div className="mst-bar-month">{monthStat.month.substring(0, 3)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Info-Karten: Bester Monat / Letzte Anwesenheit / Mitgliedschaft / Graduierungen ── */}
      <div className="mst-info-grid">
        {statistikDaten.bestMonth && (
          <div className="mst-info-card">
            <div className="mst-info-label">Bester Monat</div>
            <div className="mst-info-value mst-info-value--gold">{statistikDaten.bestMonth.month}</div>
            <div className="mst-info-sub">{statistikDaten.bestMonth.count} Trainings</div>
          </div>
        )}

        <div className="mst-info-card">
          <div className="mst-info-label">Letzte Anwesenheit</div>
          <div className="mst-info-value">
            {statistikDaten.letzteAnwesenheit
              ? new Date(statistikDaten.letzteAnwesenheit).toLocaleDateString('de-DE')
              : '—'}
          </div>
        </div>

        <div className="mst-info-card">
          <div className="mst-info-label">Mitgliedschaft</div>
          <div className="mst-info-value">
            {mitglied?.eintrittsdatum
              ? Math.floor((new Date() - new Date(mitglied.eintrittsdatum)) / (1000 * 60 * 60 * 24 * 30.44))
              : 0} Monate
          </div>
          <div className="mst-info-sub">
            seit {mitglied?.eintrittsdatum ? new Date(mitglied.eintrittsdatum).toLocaleDateString('de-DE') : '—'}
          </div>
        </div>

        <div className="mst-info-card">
          <div className="mst-info-label">Graduierungen</div>
          {memberStile && memberStile.length > 0 ? (
            <div className="mst-grad-list">
              {memberStile.map((stil, index) => {
                const stilData = stile.find(s => s.stil_id === stil.stil_id);
                const stilSpecificData = styleSpecificData[stil.stil_id];
                const currentGrad = stilData?.graduierungen?.find(g => g.graduierung_id === stilSpecificData?.current_graduierung_id);
                return (
                  <div key={index} className="mst-grad-row">
                    <span className="mst-grad-label">{stil.stil_name}</span>
                    <span className="mst-grad-value">{currentGrad?.name || '—'}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mst-empty">Keine Stile</div>
          )}
          <div className={`mst-status-pill${mitglied?.status === 'aktiv' ? ' mst-status-pill--aktiv' : ' mst-status-pill--inaktiv'}`}>
            {mitglied?.status === 'aktiv' ? 'Aktiv' :
             mitglied?.status === 'ruhepause' ? 'Ruhepause' :
             mitglied?.status === 'gekuendigt' ? 'Gekündigt' : 'Aktiv'}
          </div>
        </div>
      </div>

      {/* ── Wochentags-Heatmap ── */}
      {statistikDaten.weekdayStats && statistikDaten.weekdayStats.length > 0 && (
        <div className="mst-section">
          <h3 className="mst-section-title">Trainingstage nach Wochentag</h3>
          <div className="mst-weekday-row">
            {statistikDaten.weekdayStats.map((dayStat, index) => {
              const maxDayCount = Math.max(...statistikDaten.weekdayStats.map(d => d.count), 1);
              const pct = dayStat.count / maxDayCount;
              const tileColor = getTileColor(pct);
              return (
                <div key={index} className="mst-weekday-col">
                  <div className="mst-weekday-count">{dayStat.count}</div>
                  <div
                    className={`mst-weekday-tile${dayStat.count > 0 ? ' mst-weekday-tile--active' : ''}`}
                    style={{ '--tile-color': tileColor }}
                  >
                    {dayStat.dayShort}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Jahresvergleich ── */}
      {statistikDaten.yearlyStats && statistikDaten.yearlyStats.length > 1 && (
        <div className="mst-section">
          <h3 className="mst-section-title">Jahresvergleich</h3>
          <div className="mst-year-row">
            {statistikDaten.yearlyStats.map((yearStat, index) => {
              const maxYearCount = Math.max(...statistikDaten.yearlyStats.map(y => y.count), 1);
              const heightPx = (yearStat.count / maxYearCount) * 80;
              const isCurrentYear = yearStat.year === new Date().getFullYear();
              return (
                <div key={index} className="mst-year-col">
                  <div className="mst-year-count">{yearStat.count}</div>
                  <div className={`mst-year-bar${isCurrentYear ? ' mst-year-bar--current' : ''}`} style={{ height: `${heightPx}px` }} />
                  <div className={`mst-year-label${isCurrentYear ? ' mst-year-label--current' : ''}`}>{yearStat.year}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Insights: Bester Tag / Ø pro Woche / Längste Pause / Bester Streak ── */}
      <div className="mst-stats-grid mst-insights-grid">
        {statistikDaten.bestWeekday && statistikDaten.bestWeekday.count > 0 && (
          <div className="mst-card mst-card--gold-border">
            <div className="mst-accent-bar mst-accent-gold"></div>
            <div className="mst-kachel-label">Bester Wochentag</div>
            <div className="mst-kachel-value mst-kachel-value--gold">{statistikDaten.bestWeekday.day}</div>
            <div className="mst-kachel-sub">{statistikDaten.bestWeekday.count} Trainings</div>
          </div>
        )}

        {statistikDaten.avgPerWeek > 0 && (
          <div className="mst-card mst-card--purple-border">
            <div className="mst-accent-bar mst-accent-purple"></div>
            <div className="mst-kachel-label">pro Woche</div>
            <div className="mst-kachel-value mst-kachel-value--purple">{statistikDaten.avgPerWeek}</div>
            <div className="mst-kachel-sub">Trainings/Woche</div>
          </div>
        )}

        {statistikDaten.longestPause > 0 && (
          <div className="mst-card mst-card--red-border">
            <div className="mst-accent-bar mst-accent-red"></div>
            <div className="mst-kachel-label">Längste Pause</div>
            <div className="mst-kachel-value mst-kachel-value--red">{statistikDaten.longestPause}</div>
            <div className="mst-kachel-sub">Tage ohne Training</div>
          </div>
        )}

        {statistikDaten.bestStreak > 0 && (
          <div className="mst-card mst-card--gold-border">
            <div className="mst-accent-bar mst-accent-orange"></div>
            <div className="mst-kachel-label">Bester Streak</div>
            <div className="mst-kachel-value mst-kachel-value--gold">{statistikDaten.bestStreak}</div>
            <div className="mst-kachel-sub">Trainings in Folge</div>
          </div>
        )}
      </div>

      {/* ── Auszeichnungen ── */}
      {mitglied?.mitglied_id && (
        <div className="mst-badge-wrapper">
          <BadgeDisplay mitgliedId={mitglied.mitglied_id} compact={false} />
        </div>
      )}

    </div>
  );
};

export default MemberStatisticsTab;
