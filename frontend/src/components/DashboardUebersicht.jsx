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
  const [verlauf, setVerlauf] = useState(null);
  const [verlaufLoading, setVerlaufLoading] = useState(false);
  const [zeitraum, setZeitraum] = useState('letzte12');
  const [loading, setLoading] = useState(true);

  // Detail panels (nur für Interessenten + Check-ins)
  const [activeDetail, setActiveDetail] = useState(null);
  const [interessenten, setInteressenten] = useState(null);
  const [checkinsHeute, setCheckinsHeute] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    if (!activeDojo || activeDojo === 'super-admin') return;
    setLoading(true);
    try {
      const [batchRes, cockpitRes, neusteRes, verlaufRes] = await Promise.all([
        axios.get(withDojoParam('/dashboard/batch', activeDojo)),
        axios.get(withDojoParam('/dashboard/cockpit-uebersicht', activeDojo)),
        axios.get(withDojoParam('/dashboard/neueste-mitglieder', activeDojo)),
        axios.get(withDojoParam(`/dashboard/verlauf?zeitraum=${zeitraum}`, activeDojo)),
      ]);
      setStats(batchRes.data?.stats || null);
      setCockpit(cockpitRes.data || null);
      setNeuste(neusteRes.data?.data || []);
      setVerlauf(verlaufRes.data?.data || []);
    } catch (e) {
      console.error('DashboardUebersicht load error', e);
    } finally {
      setLoading(false);
    }
  }, [activeDojo, zeitraum]);

  const loadVerlauf = useCallback(async (z) => {
    if (!activeDojo || activeDojo === 'super-admin') return;
    setZeitraum(z);
    setVerlaufLoading(true);
    try {
      const r = await axios.get(withDojoParam(`/dashboard/verlauf?zeitraum=${z}`, activeDojo));
      setVerlauf(r.data?.data || []);
    } catch (e) {
      console.error('Verlauf load error', e);
    } finally {
      setVerlaufLoading(false);
    }
  }, [activeDojo]);

  useEffect(() => { load(); }, [load]);

  const loadDetail = useCallback(async (card) => {
    if (!activeDojo || activeDojo === 'super-admin') return;
    if (activeDetail === card) { setActiveDetail(null); return; }
    setActiveDetail(card);
    setDetailLoading(true);
    try {
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
  }, [activeDojo, activeDetail, interessenten, checkinsHeute]);

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

  return (
    <div className="du-wrap">
      {/* ── KPI Grid ── */}
      <div>
        <div className="du-section-title">Übersicht</div>
        <div className="du-kpi-grid">
          {/* Mitglieder — kein Detail-Toggle, direkt im Chart sichtbar */}
          <div className="du-kpi-card du-kpi-card--gold">
            <div className="du-kpi-icon">👥</div>
            <div className="du-kpi-value">{stats ? stats.mitglieder : '—'}</div>
            <div className="du-kpi-label">Aktive Mitglieder</div>
          </div>
          {/* Check-ins — klickbar */}
          <button
            className={['du-kpi-card', activeDetail === 'checkins' ? 'du-kpi-card--active' : ''].join(' ')}
            onClick={() => loadDetail('checkins')}
          >
            <div className="du-kpi-icon">📱</div>
            <div className="du-kpi-value">{stats ? stats.checkins_heute : '—'}</div>
            <div className="du-kpi-label">Check-ins heute</div>
            <div className="du-kpi-hint">Details ›</div>
          </button>
          {/* Beiträge — kein Detail-Toggle, direkt im Chart sichtbar */}
          <div className="du-kpi-card">
            <div className="du-kpi-icon">💸</div>
            <div className="du-kpi-value">{stats ? stats.beitraege : '—'}</div>
            <div className="du-kpi-label">Offene Beiträge</div>
          </div>
          {/* Interessenten — klickbar */}
          <button
            className={['du-kpi-card', activeDetail === 'interessenten' ? 'du-kpi-card--active' : ''].join(' ')}
            onClick={() => loadDetail('interessenten')}
          >
            <div className="du-kpi-icon">🌱</div>
            <div className="du-kpi-value">{stats ? stats.interessenten : '—'}</div>
            <div className="du-kpi-label">Interessenten</div>
            <div className="du-kpi-hint">Details ›</div>
          </button>
        </div>
      </div>

      {/* ── Charts nebeneinander (immer sichtbar) ── */}
      <div>
        <div className="du-section-title">Entwicklung</div>
        {/* Zeitraum-Selector — gemeinsam für beide Charts */}
        <div className="du-zeitraum-row">
          {[
            { id: 'woche', label: '7 Tage' },
            { id: 'monat', label: '4 Wochen' },
            { id: 'quartal', label: 'Quartal' },
            { id: 'letzte12', label: '12 Monate' },
            { id: 'jahr', label: '5 Jahre' },
          ].map((z) => (
            <button
              key={z.id}
              className={['du-zeitraum-btn', zeitraum === z.id ? 'du-zeitraum-btn--active' : ''].join(' ')}
              onClick={() => loadVerlauf(z.id)}
            >
              {z.label}
            </button>
          ))}
        </div>

        {verlaufLoading ? (
          <div className="du-loading" style={{ padding: '2rem 0', textAlign: 'center' }}>Wird geladen…</div>
        ) : verlauf ? (
          <div className="du-charts-row">
            <div className="du-chart-card">
              <div className="du-chart-card-title">👥 Neue Mitglieder</div>
              <p className="du-chart-subtitle">Anzahl pro Zeitraum</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={verlauf} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="monat" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }} allowDecimals={false} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ stroke: 'rgba(255,215,0,0.15)' }} />
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

            <div className="du-chart-card">
              <div className="du-chart-card-title">💸 Offene Beiträge</div>
              <p className="du-chart-subtitle">Betrag in € pro Zeitraum</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={verlauf} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="monat" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }} />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.35)' }}
                    tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : `${v}`}
                  />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    cursor={{ stroke: 'rgba(248,113,113,0.15)' }}
                    formatter={(v) => [`${Number(v).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €`, 'Offene Beiträge']}
                  />
                  <Line
                    type="monotone"
                    dataKey="offene_beitraege_euro"
                    stroke="#f87171"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#f87171', strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    name="Offene Beiträge"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}
      </div>

      {/* ── Detail Panel (nur Check-ins / Interessenten) ── */}
      {activeDetail && (
        <div className="du-detail-panel">
          <div className="du-detail-header">
            <span className="du-detail-title">
              {activeDetail === 'checkins' && '📱 Check-ins heute'}
              {activeDetail === 'interessenten' && '🌱 Interessenten'}
            </span>
            <button className="du-detail-close" onClick={() => setActiveDetail(null)}>×</button>
          </div>

          {detailLoading ? (
            <div className="du-loading">Wird geladen…</div>
          ) : (
            <>
              {activeDetail === 'checkins' && checkinsHeute && (
                <div className="du-detail-list">
                  {checkinsHeute.length === 0 ? (
                    <div className="du-empty">Heute noch keine Check-ins.</div>
                  ) : checkinsHeute.map((m) => (
                    <div key={m.mitglied_id} className="du-detail-row" onClick={() => goToMember(m.mitglied_id)}>
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
                  ))}
                </div>
              )}

              {activeDetail === 'interessenten' && interessenten && (
                <div className="du-detail-list">
                  {interessenten.length === 0 ? (
                    <div className="du-empty">Keine aktiven Interessenten.</div>
                  ) : interessenten.map((i) => {
                    const st = STATUS_LABELS[i.status] || { label: i.status, color: '#888' };
                    return (
                      <div key={i.id} className="du-detail-row" onClick={() => navigate('/dashboard/interessenten')}>
                        <div className="du-int-avatar">
                          {((i.vorname || '').charAt(0) + (i.nachname || '').charAt(0)).toUpperCase()}
                        </div>
                        <div className="du-member-info">
                          <div className="du-member-name">{i.vorname} {i.nachname}</div>
                          <div className="du-member-meta">
                            {i.interessiert_an && <span className="du-member-date">{i.interessiert_an}</span>}
                            {i.kontakt_datum_fmt && <span className="du-member-date">seit {i.kontakt_datum_fmt}</span>}
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
                  })}
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
