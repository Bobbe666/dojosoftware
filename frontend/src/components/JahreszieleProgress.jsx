import React from 'react';
import { TrendingUp } from 'lucide-react';

// ============================================================================
// Jahresziele Soll/Ist — EINE Komponente für beide Darstellungen:
//   variant="briefing" → vertikale Liste (Daily Briefing Popup)
//   variant="cockpit"  → Grid-Sektion mit „Details →"-Button
// Vorher 2× inline in SuperAdminDashboard.jsx dupliziert.
// Datenquelle einheitlich: overviewSummary.goals aus /admin/overview-summary.
// ============================================================================

const GOAL_LABELS = {
  dojos: '🏯 Dojos',
  verband_mitglieder: '🏆 Verbandsmitglieder',
  software_nutzer: '🥋 Software-Nutzer',
  umsatz: '💰 Umsatz',
};

const pctClass = (pct) => `sad-goal-pct--${pct >= 80 ? 'good' : pct >= 50 ? 'mid' : 'low'}`;

const JahreszieleProgress = ({ goals = [], variant = 'cockpit', onDetails }) => {
  if (!goals.length) return null;
  const jahr = new Date().getFullYear();

  if (variant === 'briefing') {
    return (
      <div>
        <div className="sad-uppercase-meta">🎯 Jahresziele {jahr}</div>
        <div className="sad-briefing-goals-list">
          {goals.map(goal => {
            const pct = Math.min(goal.prozent, 100);
            return (
              <div key={goal.typ}>
                <div className="sad-briefing-goal-header">
                  <span className="sad2-fw600">{GOAL_LABELS[goal.typ] || goal.typ}</span>
                  <span className="u-text-secondary">{goal.ist_wert} / {goal.ziel_wert} <span className={`sad-briefing-goal-pct ${pctClass(pct)}`}>({pct}%)</span></span>
                </div>
                <div className="sad-briefing-goal-bar-track">
                  <div className="sad-briefing-goal-bar-fill" style={{ width: `${pct}%`, backgroundSize: `${Math.round(10000 / Math.max(pct, 1))}% 100%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // variant === 'cockpit'
  return (
    <section className="sad-goals-section">
      <div className="sad-goals-section-header">
        <h3 className="sad-goals-section-title">
          <TrendingUp size={18} /> Jahresziele {jahr} — Soll/Ist
        </h3>
        {onDetails && (
          <button onClick={onDetails} className="sad-goals-section-btn">Details →</button>
        )}
      </div>
      <div className="sad-goals-grid" style={{ gridTemplateColumns: `repeat(${goals.length}, 1fr)` }}>
        {goals.map(goal => {
          const pct = Math.min(goal.prozent, 100);
          return (
            <div key={goal.typ}>
              <div className="sad-goals-goal-header">
                <span className="sad2-fw600">{GOAL_LABELS[goal.typ] || goal.typ}</span>
                <span className="u-text-secondary">{goal.ist_wert} / {goal.ziel_wert}</span>
              </div>
              <div className="sad-goals-bar-track">
                <div className="sad-goals-bar-fill" style={{ width: `${pct}%`, backgroundSize: `${Math.round(10000 / Math.max(pct, 1))}% 100%` }} />
              </div>
              <div className={`sad-goals-pct-label ${pctClass(pct)}`}>{pct}%</div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default JahreszieleProgress;
