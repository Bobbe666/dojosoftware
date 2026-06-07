import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import '../styles/HeuteTab.css';

// ============================================================================
// ☀️ HEUTE — permanente Tagesansicht (Standard-Tab im SuperAdminDashboard)
// To-Dos direkt abhakbar · Termine aller Plattformen (7 Tage) · Neues
// Datenquelle: GET /api/briefing (services/briefingService.js)
// ============================================================================

const PRIO_ICON = { dringend: '🔴', hoch: '🟠', normal: '🟡', niedrig: '⚪' };
const TYP_META = {
  turnier:  { icon: '🥊', label: 'Turnier' },
  event:    { icon: '🎪', label: 'Event' },
  hof:      { icon: '🌟', label: 'HoF' },
  pruefung: { icon: '🥋', label: 'Prüfung' },
  demo:     { icon: '🎯', label: 'Demo' },
};

const fmtTag = (d) =>
  new Date(d).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });

export default function HeuteTab({ onNavigate }) {
  const { token } = useAuth();
  const authHeader = { Authorization: `Bearer ${token}` };

  const [agenda, setAgenda] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fehler, setFehler] = useState('');
  const [erledigt, setErledigt] = useState(new Set()); // optimistisch abgehakt

  const load = useCallback(async () => {
    setLoading(true);
    setFehler('');
    try {
      const r = await axios.get('/briefing', { headers: authHeader });
      setAgenda(r.data.briefing);
      setErledigt(new Set());
    } catch (err) {
      const m = err.response?.data?.error || err.message;
      setFehler(typeof m === 'string' ? m : JSON.stringify(m));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const abhaken = async (todoId) => {
    const war = erledigt.has(todoId);
    // Optimistisch togglen
    setErledigt(prev => {
      const next = new Set(prev);
      if (war) next.delete(todoId); else next.add(todoId);
      return next;
    });
    try {
      await axios.post(`/briefing/todo/${todoId}/status`,
        { status: war ? 'offen' : 'erledigt' }, { headers: authHeader });
    } catch {
      // Zurückrollen bei Fehler
      setErledigt(prev => {
        const next = new Set(prev);
        if (war) next.add(todoId); else next.delete(todoId);
        return next;
      });
    }
  };

  if (loading) return <div className="heute-loading">⏳ Lade deinen Tag…</div>;
  if (fehler) return <div className="heute-fehler">⚠️ {fehler} <button onClick={load}>Erneut versuchen</button></div>;
  if (!agenda) return null;

  const { ueberfaellige_todos: ueberfaellig, faellige_todos: faellig,
          termine_heute: heute, termine_demnaechst: demnaechst, neues } = agenda;

  const neuesItems = [];
  if (neues.ungelesene_meldungen > 0) neuesItems.push({ icon: '🔔', text: `${neues.ungelesene_meldungen} ungelesene Meldung(en)`, tab: 'kommunikation' });
  if (neues.neue_pilot_bewerbungen > 0) neuesItems.push({ icon: '🏆', text: `${neues.neue_pilot_bewerbungen} neue Pilot-Bewerbung(en)`, tab: 'plattform' });
  if (neues.pilot_feedback_letzte_7_tage > 0) neuesItems.push({ icon: '📝', text: `${neues.pilot_feedback_letzte_7_tage} Pilot-Feedback(s) diese Woche`, tab: 'plattform' });

  const allesLeer = !ueberfaellig.length && !faellig.length && !heute.length && !demnaechst.length && !neuesItems.length;

  const TodoZeile = ({ t, urgent }) => {
    const done = erledigt.has(t.id);
    return (
      <div className={`heute-todo ${urgent ? 'heute-todo--urgent' : ''} ${done ? 'heute-todo--done' : ''}`}>
        <button className="heute-check" onClick={() => abhaken(t.id)} title={done ? 'Wieder öffnen' : 'Erledigt!'}>
          {done ? '☑' : '☐'}
        </button>
        <span className="heute-todo-text">
          {PRIO_ICON[t.prioritaet] || '🟡'} {t.titel}
          {t.kontext && <em> · {t.kontext}</em>}
        </span>
        <span className={`heute-todo-frist ${urgent && !done ? 'urgent' : ''}`}>
          {urgent ? `überfällig seit ${fmtTag(t.faellig_am)}` : `fällig ${fmtTag(t.faellig_am)}`}
        </span>
      </div>
    );
  };

  const TerminZeile = ({ t, istHeute }) => {
    const meta = TYP_META[t.typ] || { icon: '📅', label: '' };
    return (
      <div className={`heute-termin ${istHeute ? 'heute-termin--heute' : ''}`}>
        <span className="heute-termin-datum">{istHeute ? 'HEUTE' : fmtTag(t.datum)}{t.uhrzeit ? ` · ${t.uhrzeit}` : ''}</span>
        <span className="heute-termin-text">{meta.icon} {t.titel}{t.ort ? ` (${t.ort})` : ''}</span>
        <span className="heute-termin-typ">{meta.label}</span>
      </div>
    );
  };

  return (
    <div className="heute-tab">
      <div className="heute-head">
        <div>
          <h2>☀️ {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</h2>
          <p className="heute-sub">Dein Tag auf einen Blick — To-Dos, Termine und Neues aus allen Plattformen</p>
        </div>
        <div className="heute-head-actions">
          <a href="https://todo.tda-intl.org" target="_blank" rel="noreferrer" className="heute-btn heute-btn--ghost">📋 To-Do-App</a>
          <button className="heute-btn heute-btn--ghost" onClick={load}>🔄 Aktualisieren</button>
        </div>
      </div>

      {allesLeer && (
        <div className="heute-leer">🎉 Keine offenen Punkte — alles im grünen Bereich!</div>
      )}

      <div className="heute-grid">
        {/* Linke Spalte: To-Dos */}
        {(ueberfaellig.length > 0 || faellig.length > 0) && (
          <div className="heute-spalte">
            {ueberfaellig.length > 0 && (
              <section className="heute-sektion heute-sektion--alarm">
                <h3>🔥 Überfällig ({ueberfaellig.length})</h3>
                {ueberfaellig.map(t => <TodoZeile key={t.id} t={t} urgent />)}
              </section>
            )}
            {faellig.length > 0 && (
              <section className="heute-sektion">
                <h3>✅ Zu tun — nächste 7 Tage ({faellig.length})</h3>
                {faellig.map(t => <TodoZeile key={t.id} t={t} />)}
              </section>
            )}
          </div>
        )}

        {/* Rechte Spalte: Termine + Neues */}
        <div className="heute-spalte">
          {(heute.length > 0 || demnaechst.length > 0) && (
            <section className="heute-sektion">
              <h3>📅 Termine — heute & nächste 7 Tage</h3>
              {heute.map(t => <TerminZeile key={t.id} t={t} istHeute />)}
              {demnaechst.map(t => <TerminZeile key={t.id} t={t} />)}
            </section>
          )}

          {neuesItems.length > 0 && (
            <section className="heute-sektion">
              <h3>🔔 Neues</h3>
              {neuesItems.map((n, i) => (
                <button key={i} className="heute-neues" onClick={() => onNavigate?.(n.tab)}>
                  <span>{n.icon} {n.text}</span>
                  <span className="heute-neues-pfeil">→</span>
                </button>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
