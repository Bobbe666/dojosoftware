import React, { useState, useEffect } from 'react';
import axios from 'axios';
import SslWarnungen from './SslWarnungen';
import JahreszieleProgress from './JahreszieleProgress';

// ============================================================================
// Daily Briefing Popup — einmal täglich beim ersten Login des Super-Admins.
// Ausgelagert aus SuperAdminDashboard.jsx.
// Props:
//   globalStats, overviewSummary, unreadCount, sslWarnings — Daten
//   onClose()           — schließen + Datum in localStorage merken (Parent)
//   onNavigate(tabId)   — Tab-Wechsel im Dashboard (schließt vorher das Popup)
// Lädt zusätzlich selbst GET /api/briefing:
//   To-Dos (überfällig + nächste 7 Tage) · Termine aller Plattformen ·
//   neue Pilot-Bewerbungen  (Backend: services/briefingService.js)
// ============================================================================

const PRIO_ICON = { dringend: '🔴', hoch: '🟠', normal: '🟡', niedrig: '⚪' };
const TYP_ICON = { turnier: '🥊', event: '🎪', hof: '🌟', pruefung: '🥋', demo: '🎯' };

const fmtTag = (d) =>
  new Date(d).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });

const DailyBriefing = ({ globalStats, overviewSummary, unreadCount, sslWarnings, onClose, onNavigate }) => {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend';
  const eingaenge = overviewSummary?.neue_eingaenge;

  // Terminplaner-Daten (To-Dos + plattformübergreifende Termine)
  const [agenda, setAgenda] = useState(null);
  useEffect(() => {
    const token = localStorage.getItem('dojo_auth_token');
    if (!token) return;
    axios.get('/briefing', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setAgenda(r.data.briefing))
      .catch(() => {}); // Briefing-Zusatz nicht ladbar → Rest des Popups bleibt nutzbar
  }, []);

  return (
    <div className="sad-briefing-overlay" onClick={onClose}>
      <div className="sad-briefing-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="sad-briefing-header">
          <div>
            <div className="sad-briefing-greeting">☀️ {greeting}!</div>
            <div className="sad-briefing-date">
              {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
          <button onClick={onClose} className="sad-briefing-close">×</button>
        </div>

        <div className="sad-briefing-body">

          {/* KPI-Schnellblick */}
          <div>
            <div className="sad-uppercase-meta">Aktueller Stand</div>
            <div className="sad-briefing-kpi-grid">
              {[
                { label: 'Aktive Dojos',          value: globalStats?.dojos?.active_dojos || 0,        icon: '🏯' },
                { label: 'Dojo-Mitglieder',        value: globalStats?.members?.active_members || 0,    icon: '👥' },
                { label: 'Verbandsmitglieder',     value: overviewSummary?.goals?.find(g => g.typ === 'verband_mitglieder')?.ist_wert || 0, icon: '🏆' },
                { label: 'Neu diese Woche (Dojos)', value: `+${overviewSummary?.new_registrations?.dojos?.week || 0}`,    icon: '🆕' },
                { label: 'Neu diese Woche (Mitgl.)',value: `+${overviewSummary?.new_registrations?.mitglieder?.week || 0}`,icon: '👤' },
                { label: 'Ungelesene Nachrichten', value: unreadCount,                                  icon: unreadCount > 0 ? '🔴' : '✅' },
              ].map((s, i) => (
                <div key={i} className="sad-briefing-kpi-item">
                  <span className="sad2-fs-12">{s.icon}</span>
                  <div>
                    <div className="sad-briefing-kpi-value">{s.value}</div>
                    <div className="sad2-text-secondary-075">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Terminplaner: To-Dos + Termine aller Plattformen ── */}
          {agenda && (agenda.ueberfaellige_todos.length > 0 || agenda.faellige_todos.length > 0) && (
            <div>
              <div className="sad-trial-warning-meta">📋 Deine Aufgaben</div>
              <div className="sad2-flex-col-04">
                {agenda.ueberfaellige_todos.map((t) => (
                  <a key={`ut-${t.id}`} href="https://todo.tda-intl.org" target="_blank" rel="noreferrer"
                     className="sad-trial-item sad-trial-item--urgent" style={{ textDecoration: 'none', cursor: 'pointer' }}>
                    <span className="sad2-fw600">🔥 {PRIO_ICON[t.prioritaet] || ''} {t.titel}{t.kontext ? ` · ${t.kontext}` : ''}</span>
                    <span className="sad-trial-days--urgent">überfällig seit {fmtTag(t.faellig_am)}</span>
                  </a>
                ))}
                {agenda.faellige_todos.map((t) => (
                  <a key={`ft-${t.id}`} href="https://todo.tda-intl.org" target="_blank" rel="noreferrer"
                     className="sad-trial-item sad-trial-item--warning" style={{ textDecoration: 'none', cursor: 'pointer' }}>
                    <span className="sad2-fw600">{PRIO_ICON[t.prioritaet] || '🟡'} {t.titel}{t.kontext ? ` · ${t.kontext}` : ''}</span>
                    <span className="sad-trial-days--warning">fällig {fmtTag(t.faellig_am)}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {agenda && (agenda.termine_heute.length > 0 || agenda.termine_demnaechst.length > 0) && (
            <div>
              <div className="sad-trial-warning-meta">📅 Termine — heute & nächste 7 Tage</div>
              <div className="sad2-flex-col-04">
                {agenda.termine_heute.map((t) => (
                  <div key={t.id} className="sad-trial-item sad-trial-item--urgent">
                    <span className="sad2-fw600">{TYP_ICON[t.typ] || '📅'} HEUTE{t.uhrzeit ? ` ${t.uhrzeit}` : ''}: {t.titel}{t.ort ? ` (${t.ort})` : ''}</span>
                  </div>
                ))}
                {agenda.termine_demnaechst.map((t) => (
                  <div key={t.id} className="sad-trial-item sad-trial-item--warning">
                    <span className="sad2-fw600">{TYP_ICON[t.typ] || '📅'} {t.titel}{t.ort ? ` (${t.ort})` : ''}</span>
                    <span className="sad-trial-days--warning">{fmtTag(t.datum)}{t.uhrzeit ? ` ${t.uhrzeit}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {agenda?.neues?.neue_pilot_bewerbungen > 0 && (
            <div className="sad2-flex-col-04">
              <div className="sad-trial-item sad-trial-item--warning">
                <span className="sad2-fw600">🏆 {agenda.neues.neue_pilot_bewerbungen} neue Pilot-Bewerbung(en) — PlattformZentrale → Pilot-Programm</span>
              </div>
            </div>
          )}

          {/* Neue Eingänge — alles, was bearbeitet werden will, an einem Ort */}
          {(eingaenge?.verband_registrierungen?.length > 0 || eingaenge?.kontakt_anfragen?.length > 0 ||
            eingaenge?.wiedervorlagen?.length > 0 || eingaenge?.bestellungen?.length > 0 ||
            eingaenge?.ruecklastschriften?.length > 0 || eingaenge?.tickets?.length > 0) && (
            <div>
              <div className="sad-trial-warning-meta">📨 Neue Eingänge — bitte bearbeiten</div>
              <div className="sad2-flex-col-04">
                {(eingaenge?.verband_registrierungen || []).map((r, i) => (
                  <div
                    key={`vr-${i}`}
                    className={`sad-trial-item ${r.tage_offen >= 3 ? 'sad-trial-item--urgent' : 'sad-trial-item--warning'}`}
                    onClick={() => onNavigate?.('verband')}
                    style={{ cursor: 'pointer' }}
                    title="Zum Verband-Tab wechseln"
                  >
                    <span className="sad2-fw600">🏆 Verbands-Registrierung: {r.name}{r.person_email ? ` (${r.person_email})` : ''}</span>
                    <span className={r.tage_offen >= 3 ? 'sad-trial-days--urgent' : 'sad-trial-days--warning'}>
                      {r.tage_offen === 0 ? 'heute' : `seit ${r.tage_offen} Tag${r.tage_offen !== 1 ? 'en' : ''}`} ausstehend
                    </span>
                  </div>
                ))}
                {(eingaenge?.kontakt_anfragen || []).map((a, i) => (
                  <div
                    key={`ka-${i}`}
                    className={`sad-trial-item ${a.tage_offen >= 3 ? 'sad-trial-item--urgent' : 'sad-trial-item--warning'}`}
                  >
                    <span className="sad2-fw600">✉️ Kontaktanfrage: {a.name}{a.subject ? ` — ${a.subject}` : ''}</span>
                    <span className={a.tage_offen >= 3 ? 'sad-trial-days--urgent' : 'sad-trial-days--warning'}>
                      {a.tage_offen === 0 ? 'heute' : `seit ${a.tage_offen} Tag${a.tage_offen !== 1 ? 'en' : ''}`} unbearbeitet
                    </span>
                  </div>
                ))}
                {/* Rücklastschriften — fehlgeschlagene Stripe-Abbuchungen der letzten 7 Tage */}
                {(eingaenge?.ruecklastschriften || []).map((l, i) => (
                  <div
                    key={`rl-${i}`}
                    className="sad-trial-item sad-trial-item--urgent"
                    onClick={() => onNavigate?.('finanzen')}
                    style={{ cursor: 'pointer' }}
                    title="Zum Finanzen-Tab wechseln"
                  >
                    <span className="sad2-fw600">🏦 Lastschrift fehlgeschlagen: {l.mitglied_name} ({l.dojoname}) — {Number(l.betrag).toFixed(2)} €</span>
                    <span className="sad-trial-days--urgent">{l.error_message ? l.error_message.slice(0, 40) : 'failed'}</span>
                  </div>
                ))}
                {/* Akquise-Wiedervorlagen — heute fällig oder überfällig */}
                {(eingaenge?.wiedervorlagen || []).map((w, i) => (
                  <div
                    key={`wv-${i}`}
                    className={`sad-trial-item ${w.tage_ueberfaellig >= 3 ? 'sad-trial-item--urgent' : 'sad-trial-item--warning'}`}
                    onClick={() => onNavigate?.('kontakte')}
                    style={{ cursor: 'pointer' }}
                    title="Zu den Kontakten wechseln"
                  >
                    <span className="sad2-fw600">📞 Wiedervorlage: {w.organisation}{w.naechste_aktion_info ? ` — ${w.naechste_aktion_info}` : ''}</span>
                    <span className={w.tage_ueberfaellig >= 3 ? 'sad-trial-days--urgent' : 'sad-trial-days--warning'}>
                      {w.tage_ueberfaellig <= 0 ? 'heute fällig' : `${w.tage_ueberfaellig} Tag${w.tage_ueberfaellig !== 1 ? 'e' : ''} überfällig`}
                    </span>
                  </div>
                ))}
                {/* Offene Shop-Bestellungen */}
                {(eingaenge?.bestellungen || []).map((b, i) => (
                  <div
                    key={`bs-${i}`}
                    className={`sad-trial-item ${b.tage_offen >= 3 ? 'sad-trial-item--urgent' : 'sad-trial-item--warning'}`}
                    onClick={() => onNavigate?.('finanzen')}
                    style={{ cursor: 'pointer' }}
                    title="Zum Finanzen-Tab wechseln"
                  >
                    <span className="sad2-fw600">📦 Bestellung {b.bestellnummer}: {b.kunde_name} — {(b.gesamtbetrag_cent / 100).toFixed(2)} €</span>
                    <span className={b.tage_offen >= 3 ? 'sad-trial-days--urgent' : 'sad-trial-days--warning'}>
                      {b.tage_offen === 0 ? 'heute' : `seit ${b.tage_offen} Tag${b.tage_offen !== 1 ? 'en' : ''}`} offen
                    </span>
                  </div>
                ))}
                {/* Offene Support-Tickets */}
                {(eingaenge?.tickets || []).map((t, i) => (
                  <div
                    key={`ti-${i}`}
                    className={`sad-trial-item ${t.tage_offen >= 3 ? 'sad-trial-item--urgent' : 'sad-trial-item--warning'}`}
                    onClick={() => onNavigate?.('kommunikation')}
                    style={{ cursor: 'pointer' }}
                    title="Zum Kommunikation-Tab wechseln"
                  >
                    <span className="sad2-fw600">🎫 Ticket {t.ticket_nummer}: {t.betreff}{t.ersteller_name ? ` (${t.ersteller_name})` : ''}</span>
                    <span className={t.tage_offen >= 3 ? 'sad-trial-days--urgent' : 'sad-trial-days--warning'}>
                      {t.tage_offen === 0 ? 'heute' : `seit ${t.tage_offen} Tag${t.tage_offen !== 1 ? 'en' : ''}`} offen
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trial-Warnungen */}
          {overviewSummary?.trial_expiring?.length > 0 && (
            <div>
              <div className="sad-trial-warning-meta">⚠️ Trial läuft bald ab</div>
              <div className="sad2-flex-col-04">
                {overviewSummary.trial_expiring.map((d, i) => (
                  <div key={i} className={`sad-trial-item ${d.tage_noch <= 3 ? 'sad-trial-item--urgent' : 'sad-trial-item--warning'}`}>
                    <span className="sad2-fw600">{d.dojoname}</span>
                    <span className={d.tage_noch <= 3 ? 'sad-trial-days--urgent' : 'sad-trial-days--warning'}>noch {d.tage_noch} Tag{d.tage_noch !== 1 ? 'e' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SSL-Zertifikat-Warnungen */}
          <SslWarnungen warnings={sslWarnings} variant="briefing" />

          {/* Jahresziele */}
          <JahreszieleProgress goals={overviewSummary?.goals || []} variant="briefing" />

        </div>

        {/* Footer */}
        <div className="sad-briefing-footer">
          <span className="sad-briefing-footer-hint">Erscheint einmal täglich beim ersten Login</span>
          <button onClick={onClose} className="sad-briefing-footer-btn">
            Los geht's →
          </button>
        </div>
      </div>
    </div>
  );
};

export default DailyBriefing;
