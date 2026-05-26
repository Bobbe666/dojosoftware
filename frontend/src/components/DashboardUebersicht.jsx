import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useDojoContext } from '../context/DojoContext';
import './DashboardUebersicht.css';

function withDojoParam(url, activeDojo) {
  if (!activeDojo || activeDojo === 'super-admin') return url;
  const id = activeDojo?.id;
  if (!id) return url;
  return `${url}${url.includes('?') ? '&' : '?'}dojo_id=${id}`;
}

const STATUS_LABELS = {
  neu: { label: 'Neu', color: '#6ca0dc' },
  kontaktiert: { label: 'Kontaktiert', color: '#FFD700' },
  probetraining_vereinbart: { label: 'Probetraining vereinbart', color: '#ff9800' },
  probetraining_absolviert: { label: 'Probetraining absolviert', color: '#a3e635' },
  konvertiert: { label: 'Mitglied geworden', color: '#50c864' },
  mitglied_geworden: { label: 'Mitglied geworden', color: '#50c864' },
  in_warteliste: { label: 'Warteliste', color: '#a78bfa' },
  kein_interesse: { label: 'Kein Interesse', color: '#f87171' },
  abgesagt: { label: 'Abgesagt', color: '#f87171' },
};

const CHART_TOOLTIP_STYLE = {
  background: 'rgba(26,26,46,0.99)',
  border: '1px solid rgba(255,215,0,0.2)',
  borderRadius: '8px',
  fontSize: '0.82rem',
  color: '#fff',
};

export default function DashboardUebersicht() {
  const navigate = useNavigate();
  const { activeDojo } = useDojoContext();

  const [stats, setStats] = useState(null);
  const [cockpit, setCockpit] = useState(null);
  const [neuste, setNeuste] = useState([]);
  const [loading, setLoading] = useState(true);

  // Detail panels
  const [activeDetail, setActiveDetail] = useState(null); // 'mitglieder' | 'beitraege' | 'interessenten' | 'checkins'
  const [verlauf, setVerlauf] = useState(null);
  const [interessenten, setInteressenten] = useState(null);
  const [checkinsHeute, setCheckinsHeute] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    if (!activeDojo || activeDojo === 'super-admin') return;
    setLoading(true);
    try {
      const [batchRes, cockpitRes, neusteRes] = await Promise.all([
        axios.get(withDojoParam('/dashboard/batch', activeDojo)),
        axios.get(withDojoParam('/dashboard/cockpit-uebersicht', activeDojo)),
        axios.get(withDojoParam('/dashboard/neueste-mitglieder', activeDojo)),
      ]);
      setStats(batchRes.data?.stats || null);
      setCockpit(cockpitRes.data || null);
      setNeuste(neusteRes.data?.data || []);
    } catch (e) {
      console.error('DashboardUebersicht load error', e);
    } finally {
      setLoading(false);
    }
  }, [activeDojo]);

  useEffect(() => { load(); }, [load]);

  const loadDetail = useCallback(async (card) => {
    if (!activeDojo || activeDojo === 'super-admin') return;
    if (activeDetail === card) { setActiveDetail(null); return; }
    setActiveDetail(card);
    setDetailLoading(true);
    try {
      if ((card === 'mitglieder' || card === 'beitraege') && !verlauf) {
        const r = await axios.get(withDojoParam('/dashboard/verlauf', activeDojo));
        setVerlauf(r.data?.data || []);
      }
      if (card === 'interessenten' && !interessenten) {
        const r = await axios.get(withDojoParam('/dashboard/interessenten-liste', activeDojo));
        setInteressenten(r.data?.data || []);
      }
      if (card === 'checkins' && !checkinsHeute) {
        const r = await axios.get(withDojoParam('/dashboard/checkins-heute-liste', activeDojo));
        setCheckinsHeute(r.data?.data || []);
      }
    } catch (e) {
      console.error('Detail load error', e);
    } finally {
      setDetailLoading(false);
    }
  }, [activeDojo, activeDetail, verlauf, interessenten, checkinsHeute]);

  const goToMember = (id) => navigate(`/dashboard/mitglieder/${id}`);
  const goToInteressent = (id) => navigate(`/dashboard/interessenten/${id}`);

  const initials = (m) =>
    ((m.vorname || '').charAt(0) + (m.nachname || '').charAt(0)).toUpperCase();

  const alerts = cockpit ? [
    cockpit.geburtstage_heute > 0 && {
      label: `🎂 ${cockpit.geburtstage_heute} Geburtstag${cockpit.geburtstage_heute > 1 ? 'e' : ''} heute`,
      color: 'yellow',
    },
    cockpit.geburtstage_woche > 0 && {
      label: `🎁 ${cockpit.geburtstage_woche} diese Woche`,
      color: 'yellow',
    },
    cockpit.ablaufende_vertraege > 0 && {
      label: `⚠️ ${cockpit.ablaufende_vertraege} Vertrag${cockpit.ablaufende_vertraege > 1 ? 'e' : ''} läuft ab`,
      color: 'orange',
    },
    cockpit.offene_mahnungen > 0 && {
      label: `💸 ${cockpit.offene_mahnungen} offene Mahnung${cockpit.offene_mahnungen > 1 ? 'en' : ''}`,
      color: 'red',
    },
    cockpit.neue_vertraege_unbestaetigt > 0 && {
      label: `📄 ${cockpit.neue_vertraege_unbestaetigt} neuer Vertrag`,
      color: 'green',
    },
    cockpit.fehlgeschlagene_lastschriften > 0 && {
      label: `❌ ${cockpit.fehlgeschlagene_lastschriften} fehlgesch. Lastschrift${cockpit.fehlgeschlagene_lastschriften > 1 ? 'en' : ''}`,
      color: 'red',
    },
  ].filter(Boolean) : [];

  const kpiCards = [
    {
      id: 'mitglieder',
      icon: '👥',
      value: stats ? stats.mitglieder : '—',
      label: 'Aktive Mitglieder',
      gold: true,
    },
    {
      id: 'checkins',
      icon: '📱',
      value: stats ? stats.checkins_heute : '—',
      label: 'Check-ins heute',
      gold: false,
    },
    {
      id: 'beitraege',
      icon: '💸',
      value: stats ? stats.beitraege : '—',
      label: 'Offene Beiträge',
      gold: false,
    },
    {
      id: 'interessenten',
      icon: '🌱',
      value: stats ? stats.interessenten : '—',
      label: 'Interessenten',
      gold: false,
    },
  ];

  return (
    <div className="du-wrap">
      {/* ── KPI Grid ── */}
      <div>
        <div className="du-section-title">Übersicht</div>
        <div className="du-kpi-grid">
          {kpiCards.map((card) => (
            <button
              key={card.id}
              className={[
                'du-kpi-card',
                card.gold ? 'du-kpi-card--gold' : '',
                activeDetail === card.id ? 'du-kpi-card--active' : '',
              ].join(' ')}
              onClick={() => loadDetail(card.id)}
              title="Details anzeigen"
            >
              <div className="du-kpi-icon">{card.icon}</div>
              <div className="du-kpi-value">{card.value}</div>
              <div className="du-kpi-label">{card.label}</div>
              <div className="du-kpi-hint">Details anzeigen ›</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Detail Panel ── */}
      {activeDetail && (
        <div className="du-detail-panel">
          <div className="du-detail-header">
            <span className="du-detail-title">
              {activeDetail === 'mitglieder' && '👥 Mitglieder-Entwicklung'}
              {activeDetail === 'checkins' && '📱 Check-ins heute'}
              {activeDetail === 'beitraege' && '💸 Offene Beiträge-Entwicklung'}
              {activeDetail === 'interessenten' && '🌱 Interessenten'}
            </span>
            <button className="du-detail-close" onClick={() => setActiveDetail(null)}>×</button>
          </div>

          {detailLoading ? (
            <div className="du-loading">Wird geladen…</div>
          ) : (
            <>
              {/* ── Mitglieder Chart ── */}
              {activeDetail === 'mitglieder' && verlauf && (
                <div className="du-chart-wrap">
                  <p className="du-chart-subtitle">Neue Mitglieder pro Monat (letzte 12 Monate)</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={verlauf} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                      <XAxis dataKey="monat" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} allowDecimals={false} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ stroke: 'rgba(255,215,0,0.2)' }} />
                      <Line
                        type="monotone"
                        dataKey="neue_mitglieder"
                        stroke="#FFD700"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#FFD700', strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                        name="Neue Mitglieder"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* ── Beiträge Chart ── */}
              {activeDetail === 'beitraege' && verlauf && (
                <div className="du-chart-wrap">
                  <p className="du-chart-subtitle">Offene Beiträge pro Monat (nach Fälligkeitsdatum)</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={verlauf} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                      <XAxis dataKey="monat" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} allowDecimals={false} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ stroke: 'rgba(248,113,113,0.2)' }} />
                      <Line
                        type="monotone"
                        dataKey="offene_beitraege"
                        stroke="#f87171"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#f87171', strokeWidth: 0 }}
                        activeDot={{ r: 5 }}
                        name="Offene Beiträge"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* ── Check-ins heute Liste ── */}
              {activeDetail === 'checkins' && checkinsHeute && (
                <div className="du-detail-list">
                  {checkinsHeute.length === 0 ? (
                    <div className="du-empty">Heute noch keine Check-ins.</div>
                  ) : (
                    checkinsHeute.map((m) => (
                      <div
                        key={m.mitglied_id}
                        className="du-detail-row"
                        onClick={() => goToMember(m.mitglied_id)}
                      >
                        <div className="du-member-avatar">
                          {m.foto_pfad ? (
                            <img
                              src={m.foto_pfad.startsWith('http') ? m.foto_pfad : `/uploads/${m.foto_pfad}`}
                              alt=""
                              onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.textContent = initials(m); }}
                            />
                          ) : initials(m)}
                        </div>
                        <div className="du-member-info">
                          <div className="du-member-name">{m.vorname} {m.nachname}</div>
                        </div>
                        <div className="du-detail-time">{m.zeit} Uhr</div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ── Interessenten Liste ── */}
              {activeDetail === 'interessenten' && interessenten && (
                <div className="du-detail-list">
                  {interessenten.length === 0 ? (
                    <div className="du-empty">Keine aktiven Interessenten.</div>
                  ) : (
                    interessenten.map((i) => {
                      const st = STATUS_LABELS[i.status] || { label: i.status, color: '#888' };
                      return (
                        <div
                          key={i.id}
                          className="du-detail-row"
                          onClick={() => navigate('/dashboard/interessenten')}
                        >
                          <div className="du-int-avatar">
                            {((i.vorname || '').charAt(0) + (i.nachname || '').charAt(0)).toUpperCase()}
                          </div>
                          <div className="du-member-info">
                            <div className="du-member-name">{i.vorname} {i.nachname}</div>
                            <div className="du-member-meta">
                              {i.interessiert_an && (
                                <span className="du-member-date">{i.interessiert_an}</span>
                              )}
                              {i.kontakt_datum_fmt && (
                                <span className="du-member-date">seit {i.kontakt_datum_fmt}</span>
                              )}
                            </div>
                          </div>
                          <span
                            className="du-int-status"
                            style={{ color: st.color, borderColor: st.color + '44', background: st.color + '18' }}
                          >
                            {st.label}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Alerts ── */}
      {alerts.length > 0 && (
        <div>
          <div className="du-section-title">Hinweise</div>
          <div className="du-alert-row">
            {alerts.map((a, i) => (
              <span key={i} className={`du-alert-chip du-alert-chip--${a.color}`}>
                {a.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Neueste Mitglieder ── */}
      <div>
        <div className="du-section-title">Neueste Mitglieder</div>
        {loading ? (
          <div className="du-loading">Wird geladen…</div>
        ) : neuste.length === 0 ? (
          <div className="du-empty">Noch keine Mitglieder vorhanden.</div>
        ) : (
          <div className="du-member-list">
            {neuste.map((m) => (
              <div
                key={m.mitglied_id}
                className="du-member-row"
                onClick={() => goToMember(m.mitglied_id)}
              >
                <div className="du-member-avatar">
                  {m.foto_pfad ? (
                    <img
                      src={m.foto_pfad.startsWith('http') ? m.foto_pfad : `/uploads/${m.foto_pfad}`}
                      alt=""
                      onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.textContent = initials(m); }}
                    />
                  ) : initials(m)}
                </div>
                <div className="du-member-info">
                  <div className="du-member-name">{m.vorname} {m.nachname}</div>
                  <div className="du-member-meta">
                    <span className="du-member-date">Beitritt {m.eintrittsdatum_fmt || '—'}</span>
                    {m.tarif_name && <span className="du-member-tarif">{m.tarif_name}</span>}
                  </div>
                </div>
                <div className="du-member-arrow">›</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
