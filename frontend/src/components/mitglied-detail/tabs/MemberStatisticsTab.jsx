import React from 'react';
import BadgeDisplay from '../../BadgeDisplay';
import '../../../styles/MemberStatisticsTab.css';


/**
 * MemberStatisticsTab - Trainingsstatistiken anzeigen
 *
 * Props:
 * - statistikDaten: Objekt mit allen Statistikdaten
 * - mitglied: Das Mitglied-Objekt
 * - memberStile: Array der zugewiesenen Stile
 * - stile: Array aller verfuegbaren Stile (fuer Graduierungs-Lookup)
 * - styleSpecificData: Objekt mit stil-spezifischen Daten (fuer Graduierungen)
 */
const MemberStatisticsTab = ({
  statistikDaten = {},
  mitglied,
  memberStile = [],
  stile = [],
  styleSpecificData = {}
}) => {
  // Hilfsfunktion fuer Farben basierend auf Prozentsatz
  const getColorByPercentage = (percentage, count) => {
    if (count === 0) return { color1: 'rgba(255, 255, 255, 0.1)', color2: 'rgba(255, 255, 255, 0.1)' };
    if (percentage >= 0.8) return { color1: '#10b981', color2: '#059669' };
    if (percentage >= 0.6) return { color1: '#84cc16', color2: '#65a30d' };
    if (percentage >= 0.4) return { color1: '#fbbf24', color2: '#f59e0b' };
    if (percentage >= 0.2) return { color1: '#fb923c', color2: '#f97316' };
    return { color1: '#ef4444', color2: '#dc2626' };
  };

  return (
    <div className="statistiken-content mst-content">
      {/* Kompakte Statistik-Karten Grid */}
      <div className="stats-grid-responsive mst-stats-grid">
        {/* Trainings absolviert */}
        <div className="mst-card">
          <div className="mst-accent-bar mst-accent-green"></div>
          <div className="u-label-xs-secondary">Trainings</div>
          <div className="u-gold-glow-lg">
            {statistikDaten.totalAnwesenheiten || 0}
          </div>
        </div>

        {/* Anwesenheitsquote */}
        <div className="mst-card">
          <div className="mst-accent-bar mst-accent-blue-purple"></div>
          <div className="u-label-xs-secondary">Quote</div>
          <div className="u-gold-glow-lg">
            {statistikDaten.anwesenheitsquote || 0}%
          </div>
          <div className="mst-progress-track">
            <div className="mst-progress-fill" style={{ width: `${statistikDaten.anwesenheitsquote || 0}%` }}></div>
          </div>
        </div>

        {/* Streak */}
        <div className="mst-card">
          <div className="mst-accent-bar mst-accent-orange-red"></div>
          <div className="u-label-xs-secondary">Streak</div>
          <div className="u-gold-glow-lg">
            {statistikDaten.currentStreak || 0}
          </div>
          <div className="u-label-xs-bottom">Trainings in Folge</div>
        </div>

        {/* Diesen Monat */}
        <div className="mst-card">
          <div className="mst-accent-bar mst-accent-teal"></div>
          <div className="u-label-xs-secondary">Dieser Monat</div>
          <div className="u-gold-glow-lg">
            {statistikDaten.thisMonthAttendances || 0}
          </div>
        </div>

        {/* Durchschnitt pro Monat */}
        <div className="mst-card">
          <div className="mst-accent-bar mst-accent-purple"></div>
          <div className="u-label-xs-secondary">Monat (6M)</div>
          <div className="u-gold-glow-lg">
            {statistikDaten.avgPerMonth || 0}
          </div>
        </div>

        {/* Letzte Woche */}
        <div className="mst-card">
          <div className="mst-accent-bar mst-accent-cyan"></div>
          <div className="u-label-xs-secondary">Letzte Woche</div>
          <div className="u-gold-glow-lg">
            {statistikDaten.lastWeekAttendances || 0}
          </div>
        </div>

        {/* Konsistenz */}
        <div className="mst-card">
          <div className="mst-accent-bar mst-accent-amber"></div>
          <div className="u-label-xs-secondary">Konsistenz</div>
          <div className="u-gold-glow-lg">
            {statistikDaten.consecutiveMonths || 0}
          </div>
          <div className="u-label-xs-bottom">Monate aktiv</div>
        </div>

        {/* Kontostand */}
        <div className="mst-card">
          <div className="mst-accent-bar mst-accent-emerald"></div>
          <div className="u-label-xs-secondary">Kontostand</div>
          <div className={`mst-kontostand-value${(mitglied?.kontostand ?? 0) >= 0 ? ' mst-kontostand-value--pos' : ' mst-kontostand-value--neg'}`}>
            {mitglied?.kontostand ? `${mitglied.kontostand.toFixed(2)} EUR` : "0,00 EUR"}
          </div>
        </div>
      </div>

      {/* Monatliche Uebersicht - Balkendiagramm */}
      {statistikDaten.monthlyStats && statistikDaten.monthlyStats.length > 0 && (
        <div className="mst-chart-section">
          <h3 className="mst-chart-heading">Trainings pro Monat (12 Monate)</h3>
          <div className="mst-bar-chart-row">
            {statistikDaten.monthlyStats.slice(-12).map((monthStat, index) => {
              const last12Months = statistikDaten.monthlyStats.slice(-12);
              const maxCount = Math.max(...last12Months.map(m => m.count), 1);
              const heightPixels = maxCount > 0 ? (monthStat.count / maxCount) * 110 : 2;
              const percentage = maxCount > 0 ? (monthStat.count / maxCount) : 0;
              const { color1, color2 } = getColorByPercentage(percentage, monthStat.count);

              return (
                <div key={index} className="mst-bar-col">
                  <div className={`mst-bar-count${monthStat.count > 0 ? ' mst-bar-count--active' : ''}`}>
                    {monthStat.count > 0 ? monthStat.count : ''}
                  </div>
                  <div
                    className={`mst-bar-fill${monthStat.count === 0 ? ' mst-bar-fill--empty' : ''}`}
                    style={{ '--bar-c1': color1, '--bar-c2': color2, height: `${heightPixels}px` }}
                  ></div>
                  <div className="mst-bar-month">
                    {monthStat.month.substring(0, 3)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Zusaetzliche Infos Grid */}
      <div className="mst-info-grid">
        {/* Beste Performance */}
        {statistikDaten.bestMonth && (
          <div className="mst-info-card">
            <div className="mst-info-label">Bester Monat</div>
            <div className="mst-info-value-success">{statistikDaten.bestMonth.month}</div>
            <div className="mst-info-sub">{statistikDaten.bestMonth.count} Trainings</div>
          </div>
        )}

        {/* Letzte Anwesenheit */}
        <div className="mst-info-card">
          <div className="mst-info-label">Letzte Anwesenheit</div>
          <div className="mst-info-value-md">
            {statistikDaten.letzteAnwesenheit ? new Date(statistikDaten.letzteAnwesenheit).toLocaleDateString("de-DE") : "-"}
          </div>
        </div>

        {/* Mitgliedschaft */}
        <div className="mst-info-card">
          <div className="mst-info-label">Mitgliedschaft</div>
          <div className="mst-info-value-lg">
            {mitglied?.eintrittsdatum ? Math.floor((new Date() - new Date(mitglied.eintrittsdatum)) / (1000 * 60 * 60 * 24 * 30.44)) : 0} Monate
          </div>
          <div className="mst-info-sub">
            seit {mitglied?.eintrittsdatum ? new Date(mitglied.eintrittsdatum).toLocaleDateString("de-DE") : "-"}
          </div>
        </div>

        {/* Status & Graduierungen */}
        <div className="mst-info-card">
          <div className="mst-info-label">Graduierungen</div>
          {memberStile && memberStile.length > 0 ? (
            <div className="u-flex-col-sm">
              {memberStile.map((stil, index) => {
                const stilData = stile.find(s => s.stil_id === stil.stil_id);
                const stilSpecificData = styleSpecificData[stil.stil_id];
                const currentGrad = stilData?.graduierungen?.find(g => g.graduierung_id === stilSpecificData?.current_graduierung_id);
                return (
                  <div key={index} className="mst-grad-row">
                    <span className="mst-grad-label">{stil.stil_name}:</span>
                    <span className="mst-grad-value">{currentGrad?.name || "Nicht definiert"}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mst-no-stile">Keine Stile</div>
          )}
          <div className={`mst-status-divider${mitglied?.status === 'aktiv' ? ' mst-status-divider--aktiv' : ' mst-status-divider--inaktiv'}`}>
            {mitglied?.status === 'aktiv' ? 'Aktiv' :
             mitglied?.status === 'ruhepause' ? 'Ruhepause' :
             mitglied?.status === 'gekuendigt' ? 'Gekuendigt' : 'Aktiv'}
          </div>
        </div>
      </div>

      {/* Wochentagsverteilung - Heatmap */}
      {statistikDaten.weekdayStats && statistikDaten.weekdayStats.length > 0 && (
        <div className="mst-chart-section-mt">
          <h3 className="mst-chart-heading">Trainingstage nach Wochentag</h3>
          <div className="mst-weekday-row">
            {statistikDaten.weekdayStats.map((dayStat, index) => {
              const maxDayCount = Math.max(...statistikDaten.weekdayStats.map(d => d.count), 1);
              const percentage = dayStat.count / maxDayCount;
              let color;
              if (percentage >= 0.8) color = '#10b981';
              else if (percentage >= 0.6) color = '#84cc16';
              else if (percentage >= 0.4) color = '#fbbf24';
              else if (percentage >= 0.2) color = '#fb923c';
              else if (percentage > 0) color = '#ef4444';
              else color = 'rgba(255, 255, 255, 0.1)';

              return (
                <div key={index} className="mst-weekday-col">
                  <div className="mst-weekday-count">{dayStat.count}</div>
                  <div
                    className={`mst-weekday-tile${dayStat.count > 0 ? ' mst-weekday-tile--active' : ''}`}
                    style={{ '--tile-color': color }}
                  >
                    {dayStat.dayShort}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Jahresvergleich */}
      {statistikDaten.yearlyStats && statistikDaten.yearlyStats.length > 1 && (
        <div className="mst-chart-section-mt">
          <h3 className="mst-chart-heading">Jahresvergleich</h3>
          <div className="mst-year-row">
            {statistikDaten.yearlyStats.map((yearStat, index) => {
              const maxYearCount = Math.max(...statistikDaten.yearlyStats.map(y => y.count), 1);
              const heightPixels = (yearStat.count / maxYearCount) * 80;
              const isCurrentYear = yearStat.year === new Date().getFullYear();

              return (
                <div key={index} className="mst-year-col">
                  <div className="mst-year-count">{yearStat.count}</div>
                  <div
                    className={`mst-year-bar${isCurrentYear ? ' mst-year-bar--current' : ''}`}
                    style={{ height: `${heightPixels}px` }}
                  ></div>
                  <div className={`mst-year-label${isCurrentYear ? ' mst-year-label--current' : ''}`}>{yearStat.year}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Weitere Insights */}
      <div className="stats-grid-responsive mst-insights-grid">
        {/* Bester Wochentag */}
        {statistikDaten.bestWeekday && statistikDaten.bestWeekday.count > 0 && (
          <div className="mst-card mst-insight-card-green">
            <div className="mst-accent-bar mst-accent-emerald"></div>
            <div className="u-label-xs-secondary">Bester Wochentag</div>
            <div className="mst-val-success">{statistikDaten.bestWeekday.day}</div>
            <div className="u-label-xs-bottom">{statistikDaten.bestWeekday.count} Trainings</div>
          </div>
        )}

        {/* Durchschnitt pro Woche */}
        {statistikDaten.avgPerWeek > 0 && (
          <div className="mst-card mst-insight-card-purple">
            <div className="mst-accent-bar mst-accent-violet"></div>
            <div className="u-label-xs-secondary">pro Woche</div>
            <div className="mst-val-purple">{statistikDaten.avgPerWeek}</div>
            <div className="u-label-xs-bottom">Trainings/Woche</div>
          </div>
        )}

        {/* Laengste Pause */}
        {statistikDaten.longestPause > 0 && (
          <div className="mst-card mst-insight-card-red">
            <div className="mst-accent-bar mst-accent-red"></div>
            <div className="u-label-xs-secondary">Laengste Pause</div>
            <div className="mst-val-error">{statistikDaten.longestPause}</div>
            <div className="u-label-xs-bottom">Tage ohne Training</div>
          </div>
        )}

        {/* Bester Streak */}
        {statistikDaten.bestStreak > 0 && (
          <div className="mst-card mst-insight-card-gold">
            <div className="mst-accent-bar mst-accent-gold"></div>
            <div className="u-label-xs-secondary">Bester Streak</div>
            <div className="mst-val-primary">{statistikDaten.bestStreak}</div>
            <div className="u-label-xs-bottom">Trainings in Folge</div>
          </div>
        )}
      </div>

      {/* Auszeichnungen / Badges */}
      {mitglied?.mitglied_id && (
        <div className="mst-badge-wrapper">
          <BadgeDisplay mitgliedId={mitglied.mitglied_id} compact={false} />
        </div>
      )}
    </div>
  );
};

export default MemberStatisticsTab;
