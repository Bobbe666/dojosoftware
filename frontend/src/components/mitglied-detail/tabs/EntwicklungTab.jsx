import React, { useState } from 'react';
import MitgliedFortschritt from '../../MitgliedFortschritt';
import MemberStatisticsTab from './MemberStatisticsTab';

const EntwicklungTab = ({
  mitgliedId,
  mitglied,
  anwesenheitsDaten,
  statistikDaten,
  stilStatistiken,
  memberStile,
  stile,
  styleSpecificData,
}) => {
  const [subTab, setSubTab] = useState('anwesenheit');

  return (
    <>
      {/* Sub-Tab-Navigation */}
      <div className="finance-sub-tabs mds-finance-sub-tabs-row mds-tabs--l1">
        <button
          className={`finance-sub-tab-btn ${subTab === 'anwesenheit' ? 'active' : ''}`}
          onClick={() => setSubTab('anwesenheit')}
        >
          📅 Anwesenheit
        </button>
        <button
          className={`finance-sub-tab-btn ${subTab === 'fortschritt' ? 'active' : ''}`}
          onClick={() => setSubTab('fortschritt')}
        >
          📈 Fortschritt
        </button>
        <button
          className={`finance-sub-tab-btn ${subTab === 'statistiken' ? 'active' : ''}`}
          onClick={() => setSubTab('statistiken')}
        >
          📊 Statistiken
        </button>
      </div>

      {/* Anwesenheit */}
      {subTab === 'anwesenheit' && (
        <div className="anw-container">
          <div className="anw-stats-row">
            <div className="field-group card anw-stat-card">
              <div className="anw-stat-icon">🎯</div>
              <div className="anw-stat-label">Trainings gesamt</div>
              <div className="anw-stat-number">{statistikDaten.totalAnwesenheiten || 0}</div>
              <div className="anw-stat-sub">dokumentierte Trainings</div>
            </div>

            <div className="field-group card anw-stat-card">
              <div className="anw-stat-icon">📆</div>
              <div className="anw-stat-label">Diesen Monat</div>
              <div className="anw-stat-number anw-good">{statistikDaten.thisMonthAttendances || 0}</div>
              <div className="anw-stat-sub">Trainings</div>
            </div>

            <div className="field-group card anw-stat-card">
              <div className="anw-stat-icon">🔥</div>
              <div className="anw-stat-label">Aktueller Streak</div>
              <div className={`anw-stat-number ${(statistikDaten.currentStreak || 0) >= 5 ? 'anw-good' : ''}`}>
                {statistikDaten.currentStreak || 0}
              </div>
              <div className="anw-stat-sub">Trainings in Folge</div>
            </div>

            <div className="field-group card anw-stat-card">
              <div className="anw-stat-icon">📅</div>
              <div className="anw-stat-label">Letzte Anwesenheit</div>
              <div className="anw-stat-number anw-stat-date">
                {statistikDaten.letzteAnwesenheit
                  ? new Date(statistikDaten.letzteAnwesenheit).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
                  : '—'}
              </div>
              <div className="anw-stat-sub">
                {statistikDaten.letzteAnwesenheit
                  ? new Date(statistikDaten.letzteAnwesenheit).getFullYear()
                  : 'Noch keine Daten'}
              </div>
            </div>
          </div>

          {stilStatistiken.length > 0 && (
            <div className="anw-quote-row">
              {stilStatistiken.map(s => {
                const pct = s.quote ?? 0;
                const color = pct >= 70 ? '#4ade80' : pct >= 40 ? '#FFD700' : '#f87171';
                return (
                  <div key={s.stil_id} className="field-group card anw-quote-card">
                    <div className="anw-quote-stil">{s.stil_name}</div>
                    <div className="anw-quote-pct" style={{ color }}>
                      {s.quote !== null ? `${s.quote}%` : '—'}
                    </div>
                    <div className="anw-quote-bar-wrap">
                      <div className="anw-quote-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
                    </div>
                    <div className="anw-quote-detail">
                      {s.anwesend} von {s.moeglich} möglichen Trainings
                    </div>
                    {s.eintrittsdatum && (
                      <div className="anw-quote-since">
                        seit {new Date(s.eintrittsdatum).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="anw-bottom-row">
            {statistikDaten.monthlyStats?.length > 0 && (() => {
              const maxCount = Math.max(...statistikDaten.monthlyStats.map(m => m.count), 1);
              return (
                <div className="field-group card anw-monthly-card">
                  <h3 className="anw-section-title">Monatliche Übersicht</h3>
                  <div className="anw-monthly-grid">
                    {statistikDaten.monthlyStats.map((m, i) => (
                      <div key={i} className="anw-month-col">
                        <div className="anw-month-bar-wrap">
                          <div
                            className={`anw-month-bar ${m.count >= 8 ? 'anw-bar-great' : m.count >= 4 ? 'anw-bar-good' : m.count > 0 ? 'anw-bar-ok' : 'anw-bar-none'}`}
                            style={{ height: `${Math.max((m.count / maxCount) * 100, m.count > 0 ? 10 : 3)}%` }}
                          />
                        </div>
                        <span className="anw-month-count">{m.count > 0 ? m.count : ''}</span>
                        <span className="anw-month-name">{m.month}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="field-group card anw-list-card">
              <h3 className="anw-section-title">Letzte Anwesenheiten</h3>
              {anwesenheitsDaten.filter(a => a.anwesend).length > 0 ? (
                <div className="anw-chips">
                  {anwesenheitsDaten
                    .filter(a => a.anwesend)
                    .sort((a, b) => new Date(b.datum) - new Date(a.datum))
                    .slice(0, 30)
                    .map((a, i) => {
                      const d = new Date(a.datum);
                      const isRecent = (Date.now() - d) < 14 * 24 * 60 * 60 * 1000;
                      return (
                        <span
                          key={i}
                          className={`anw-chip${isRecent ? ' anw-chip--recent' : ''}`}
                          title={d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                        >
                          {d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                        </span>
                      );
                    })}
                </div>
              ) : (
                <p className="anw-empty">Noch keine Anwesenheitsdaten verfügbar.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fortschritt */}
      {subTab === 'fortschritt' && (
        <div className="fortschritt-tab-container">
          <MitgliedFortschritt mitgliedId={mitgliedId} />
        </div>
      )}

      {/* Statistiken */}
      {subTab === 'statistiken' && (
        <MemberStatisticsTab
          statistikDaten={statistikDaten}
          mitglied={mitglied}
          memberStile={memberStile}
          stile={stile}
          styleSpecificData={styleSpecificData}
        />
      )}
    </>
  );
};

export default EntwicklungTab;
