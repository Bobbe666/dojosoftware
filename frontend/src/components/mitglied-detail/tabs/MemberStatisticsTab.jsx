import React from 'react';

// Gemeinsame Card-Styles
const cardStyle = {
  background: 'rgba(255, 255, 255, 0.08)',
  backdropFilter: 'blur(10px)',
  borderRadius: '10px',
  padding: '0.75rem 1rem',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
  border: '1px solid rgba(255, 215, 0, 0.2)',
  position: 'relative',
  transition: 'transform 0.2s ease'
};

const accentBar = (gradient) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: '2px',
  background: gradient,
  borderRadius: '10px 10px 0 0'
});

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
    <div className="statistiken-content" style={{ padding: '1rem', background: 'transparent' }}>
      {/* Kompakte Statistik-Karten Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        {/* Trainings absolviert */}
        <div style={cardStyle}>
          <div style={accentBar('linear-gradient(90deg, #28a745, #20c997)')}></div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.25rem' }}>Trainings</div>
          <div style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 700, textShadow: '0 0 10px rgba(255, 215, 0, 0.3)' }}>
            {statistikDaten.totalAnwesenheiten || 0}
          </div>
        </div>

        {/* Anwesenheitsquote */}
        <div style={cardStyle}>
          <div style={accentBar('linear-gradient(90deg, #3b82f6, #8b5cf6)')}></div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.25rem' }}>Quote</div>
          <div style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 700, textShadow: '0 0 10px rgba(255, 215, 0, 0.3)' }}>
            {statistikDaten.anwesenheitsquote || 0}%
          </div>
          <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '0.5rem', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${statistikDaten.anwesenheitsquote || 0}%`, background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', borderRadius: '2px', transition: 'width 0.3s ease' }}></div>
          </div>
        </div>

        {/* Streak */}
        <div style={cardStyle}>
          <div style={accentBar('linear-gradient(90deg, #f59e0b, #ef4444)')}></div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.25rem' }}>Streak</div>
          <div style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 700, textShadow: '0 0 10px rgba(255, 215, 0, 0.3)' }}>
            {statistikDaten.currentStreak || 0}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '0.25rem' }}>Trainings in Folge</div>
        </div>

        {/* Diesen Monat */}
        <div style={cardStyle}>
          <div style={accentBar('linear-gradient(90deg, #10b981, #14b8a6)')}></div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.25rem' }}>Dieser Monat</div>
          <div style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 700, textShadow: '0 0 10px rgba(255, 215, 0, 0.3)' }}>
            {statistikDaten.thisMonthAttendances || 0}
          </div>
        </div>

        {/* Durchschnitt pro Monat */}
        <div style={cardStyle}>
          <div style={accentBar('linear-gradient(90deg, #8b5cf6, #d946ef)')}></div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.25rem' }}>Monat (6M)</div>
          <div style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 700, textShadow: '0 0 10px rgba(255, 215, 0, 0.3)' }}>
            {statistikDaten.avgPerMonth || 0}
          </div>
        </div>

        {/* Letzte Woche */}
        <div style={cardStyle}>
          <div style={accentBar('linear-gradient(90deg, #06b6d4, #3b82f6)')}></div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.25rem' }}>Letzte Woche</div>
          <div style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 700, textShadow: '0 0 10px rgba(255, 215, 0, 0.3)' }}>
            {statistikDaten.lastWeekAttendances || 0}
          </div>
        </div>

        {/* Konsistenz */}
        <div style={cardStyle}>
          <div style={accentBar('linear-gradient(90deg, #f59e0b, #fbbf24)')}></div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.25rem' }}>Konsistenz</div>
          <div style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 700, textShadow: '0 0 10px rgba(255, 215, 0, 0.3)' }}>
            {statistikDaten.consecutiveMonths || 0}
          </div>
          <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '0.25rem' }}>Monate aktiv</div>
        </div>

        {/* Kontostand */}
        <div style={cardStyle}>
          <div style={accentBar('linear-gradient(90deg, #10b981, #059669)')}></div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.25rem' }}>Kontostand</div>
          <div style={{ color: mitglied?.kontostand >= 0 ? '#10b981' : '#ef4444', fontSize: '1.2rem', fontWeight: 700, textShadow: '0 0 10px rgba(255, 215, 0, 0.3)' }}>
            {mitglied?.kontostand ? `${mitglied.kontostand.toFixed(2)} EUR` : "0,00 EUR"}
          </div>
        </div>
      </div>

      {/* Monatliche Uebersicht - Balkendiagramm */}
      {statistikDaten.monthlyStats && statistikDaten.monthlyStats.length > 0 && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          padding: '1rem',
          marginBottom: '1rem',
          border: '1px solid rgba(255, 215, 0, 0.2)'
        }}>
          <h3 style={{ fontSize: '0.9rem', color: '#ffd700', marginBottom: '1rem', fontWeight: 600 }}>Trainings pro Monat (12 Monate)</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '140px', position: 'relative' }}>
            {statistikDaten.monthlyStats.slice(-12).map((monthStat, index) => {
              const last12Months = statistikDaten.monthlyStats.slice(-12);
              const maxCount = Math.max(...last12Months.map(m => m.count), 1);
              const heightPixels = maxCount > 0 ? (monthStat.count / maxCount) * 110 : 2;
              const percentage = maxCount > 0 ? (monthStat.count / maxCount) : 0;
              const { color1, color2 } = getColorByPercentage(percentage, monthStat.count);

              return (
                <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: '0.25rem' }}>
                  <div style={{ fontSize: '0.7rem', color: monthStat.count > 0 ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.4)', fontWeight: 700, minHeight: '16px' }}>
                    {monthStat.count > 0 ? monthStat.count : ''}
                  </div>
                  <div style={{
                    width: '100%',
                    height: `${heightPixels}px`,
                    background: monthStat.count > 0 ? `linear-gradient(180deg, ${color1}, ${color2})` : color1,
                    borderRadius: '4px 4px 0 0',
                    minHeight: monthStat.count > 0 ? '8px' : '2px',
                    transition: 'all 0.3s ease',
                    boxShadow: monthStat.count > 0 ? `0 0 8px ${color1}40` : 'none'
                  }}></div>
                  <div style={{ fontSize: '0.6rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '0.25rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                    {monthStat.month.substring(0, 3)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Zusaetzliche Infos Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
        {/* Beste Performance */}
        {statistikDaten.bestMonth && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            borderRadius: '10px',
            padding: '1rem',
            border: '1px solid rgba(255, 215, 0, 0.2)'
          }}>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.5rem' }}>Bester Monat</div>
            <div style={{ color: '#10b981', fontSize: '1.3rem', fontWeight: 700 }}>{statistikDaten.bestMonth.month}</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '0.25rem' }}>{statistikDaten.bestMonth.count} Trainings</div>
          </div>
        )}

        {/* Letzte Anwesenheit */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          borderRadius: '10px',
          padding: '1rem',
          border: '1px solid rgba(255, 215, 0, 0.2)'
        }}>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.5rem' }}>Letzte Anwesenheit</div>
          <div style={{ color: '#ffffff', fontSize: '1.1rem', fontWeight: 600 }}>
            {statistikDaten.letzteAnwesenheit ? new Date(statistikDaten.letzteAnwesenheit).toLocaleDateString("de-DE") : "-"}
          </div>
        </div>

        {/* Mitgliedschaft */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          borderRadius: '10px',
          padding: '1rem',
          border: '1px solid rgba(255, 215, 0, 0.2)'
        }}>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.5rem' }}>Mitgliedschaft</div>
          <div style={{ color: '#ffffff', fontSize: '1.3rem', fontWeight: 700 }}>
            {mitglied?.eintrittsdatum ? Math.floor((new Date() - new Date(mitglied.eintrittsdatum)) / (1000 * 60 * 60 * 24 * 30.44)) : 0} Monate
          </div>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '0.25rem' }}>
            seit {mitglied?.eintrittsdatum ? new Date(mitglied.eintrittsdatum).toLocaleDateString("de-DE") : "-"}
          </div>
        </div>

        {/* Status & Graduierungen */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          borderRadius: '10px',
          padding: '1rem',
          border: '1px solid rgba(255, 215, 0, 0.2)'
        }}>
          <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.5rem' }}>Graduierungen</div>
          {memberStile && memberStile.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {memberStile.map((stil, index) => {
                const stilData = stile.find(s => s.stil_id === stil.stil_id);
                const stilSpecificData = styleSpecificData[stil.stil_id];
                const currentGrad = stilData?.graduierungen?.find(g => g.graduierung_id === stilSpecificData?.current_graduierung_id);
                return (
                  <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)' }}>{stil.stil_name}:</span>
                    <span style={{ fontSize: '0.85rem', color: '#ffd700', fontWeight: 600 }}>{currentGrad?.name || "Nicht definiert"}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ color: '#ffd700', fontSize: '1.1rem', fontWeight: 600 }}>Keine Stile</div>
          )}
          <div style={{ fontSize: '0.75rem', color: mitglied?.status === 'aktiv' ? '#10b981' : '#ef4444', marginTop: '0.5rem', fontWeight: 600, paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
            {mitglied?.status === 'aktiv' ? 'Aktiv' :
             mitglied?.status === 'ruhepause' ? 'Ruhepause' :
             mitglied?.status === 'gekuendigt' ? 'Gekuendigt' : 'Aktiv'}
          </div>
        </div>
      </div>

      {/* Wochentagsverteilung - Heatmap */}
      {statistikDaten.weekdayStats && statistikDaten.weekdayStats.length > 0 && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          padding: '1rem',
          marginTop: '1rem',
          border: '1px solid rgba(255, 215, 0, 0.2)'
        }}>
          <h3 style={{ fontSize: '0.9rem', color: '#ffd700', marginBottom: '1rem', fontWeight: 600 }}>Trainingstage nach Wochentag</h3>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
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
                <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.9)', fontWeight: 700 }}>{dayStat.count}</div>
                  <div style={{
                    width: '100%',
                    aspectRatio: '1',
                    background: color,
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: dayStat.count > 0 ? '#ffffff' : 'rgba(255, 255, 255, 0.3)',
                    boxShadow: dayStat.count > 0 ? `0 0 12px ${color}60` : 'none',
                    transition: 'all 0.3s ease'
                  }}>
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
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          padding: '1rem',
          marginTop: '1rem',
          border: '1px solid rgba(255, 215, 0, 0.2)'
        }}>
          <h3 style={{ fontSize: '0.9rem', color: '#ffd700', marginBottom: '1rem', fontWeight: 600 }}>Jahresvergleich</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '100px' }}>
            {statistikDaten.yearlyStats.map((yearStat, index) => {
              const maxYearCount = Math.max(...statistikDaten.yearlyStats.map(y => y.count), 1);
              const heightPixels = (yearStat.count / maxYearCount) * 80;
              const isCurrentYear = yearStat.year === new Date().getFullYear();

              return (
                <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.9)', fontWeight: 700 }}>{yearStat.count}</div>
                  <div style={{
                    width: '100%',
                    height: `${heightPixels}px`,
                    background: isCurrentYear ? 'linear-gradient(180deg, #ffd700, #f59e0b)' : 'linear-gradient(180deg, #3b82f6, #2563eb)',
                    borderRadius: '8px 8px 0 0',
                    minHeight: '8px',
                    boxShadow: isCurrentYear ? '0 0 12px rgba(255, 215, 0, 0.5)' : '0 0 8px rgba(59, 130, 246, 0.3)',
                    transition: 'all 0.3s ease'
                  }}></div>
                  <div style={{ fontSize: '0.75rem', color: isCurrentYear ? '#ffd700' : 'rgba(255, 255, 255, 0.7)', fontWeight: isCurrentYear ? 700 : 600 }}>{yearStat.year}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Weitere Insights */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '1rem' }}>
        {/* Bester Wochentag */}
        {statistikDaten.bestWeekday && statistikDaten.bestWeekday.count > 0 && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            position: 'relative'
          }}>
            <div style={accentBar('linear-gradient(90deg, #10b981, #059669)')}></div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.25rem' }}>Bester Wochentag</div>
            <div style={{ color: '#10b981', fontSize: '1.2rem', fontWeight: 700 }}>{statistikDaten.bestWeekday.day}</div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '0.25rem' }}>{statistikDaten.bestWeekday.count} Trainings</div>
          </div>
        )}

        {/* Durchschnitt pro Woche */}
        {statistikDaten.avgPerWeek > 0 && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            position: 'relative'
          }}>
            <div style={accentBar('linear-gradient(90deg, #8b5cf6, #7c3aed)')}></div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.25rem' }}>pro Woche</div>
            <div style={{ color: '#8b5cf6', fontSize: '1.5rem', fontWeight: 700 }}>{statistikDaten.avgPerWeek}</div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '0.25rem' }}>Trainings/Woche</div>
          </div>
        )}

        {/* Laengste Pause */}
        {statistikDaten.longestPause > 0 && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            position: 'relative'
          }}>
            <div style={accentBar('linear-gradient(90deg, #ef4444, #dc2626)')}></div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.25rem' }}>Laengste Pause</div>
            <div style={{ color: '#ef4444', fontSize: '1.5rem', fontWeight: 700 }}>{statistikDaten.longestPause}</div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '0.25rem' }}>Tage ohne Training</div>
          </div>
        )}

        {/* Bester Streak */}
        {statistikDaten.bestStreak > 0 && (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            border: '1px solid rgba(255, 215, 0, 0.3)',
            position: 'relative'
          }}>
            <div style={accentBar('linear-gradient(90deg, #ffd700, #f59e0b)')}></div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.25rem' }}>Bester Streak</div>
            <div style={{ color: '#ffd700', fontSize: '1.5rem', fontWeight: 700 }}>{statistikDaten.bestStreak}</div>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '0.25rem' }}>Trainings in Folge</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MemberStatisticsTab;
