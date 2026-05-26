import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';
import './DashboardUebersicht.css';

function withDojoParam(url, activeDojo) {
  if (!activeDojo || activeDojo === 'super-admin') return url;
  const id = activeDojo?.id;
  if (!id) return url;
  return `${url}${url.includes('?') ? '&' : '?'}dojo_id=${id}`;
}

export default function DashboardUebersicht() {
  const navigate = useNavigate();
  const { activeDojo } = useDojoContext();

  const [stats, setStats] = useState(null);
  const [cockpit, setCockpit] = useState(null);
  const [neuste, setNeuste] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const goToMember = (id) => navigate(`/dashboard/mitglieder/${id}`);

  const initials = (m) => {
    const v = (m.vorname || '').charAt(0).toUpperCase();
    const n = (m.nachname || '').charAt(0).toUpperCase();
    return v + n;
  };

  // Alert chips config
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
      {/* ── KPI Cards ── */}
      <div>
        <div className="du-section-title">Übersicht</div>
        <div className="du-kpi-grid">
          <div className="du-kpi-card du-kpi-card--gold">
            <div className="du-kpi-icon">👥</div>
            <div className="du-kpi-value">{stats ? stats.mitglieder : '—'}</div>
            <div className="du-kpi-label">Aktive Mitglieder</div>
          </div>
          <div className="du-kpi-card">
            <div className="du-kpi-icon">📱</div>
            <div className="du-kpi-value">{stats ? stats.checkins_heute : '—'}</div>
            <div className="du-kpi-label">Check-ins heute</div>
          </div>
          <div className="du-kpi-card">
            <div className="du-kpi-icon">💸</div>
            <div className="du-kpi-value">{stats ? stats.beitraege : '—'}</div>
            <div className="du-kpi-label">Offene Beiträge</div>
          </div>
          <div className="du-kpi-card">
            <div className="du-kpi-icon">🌱</div>
            <div className="du-kpi-value">{stats ? stats.interessenten : '—'}</div>
            <div className="du-kpi-label">Interessenten</div>
          </div>
        </div>
      </div>

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
