import { useState, useEffect } from 'react';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import config from '../config/config.js';
import '../styles/ReferralCodeVerwaltung.css';

const STATUS_LABEL = {
  registriert: 'Registriert',
  vertrag_abgeschlossen: 'Vertrag geschlossen',
  erste_zahlung: 'Erste Zahlung ausstehend',
  praemie_freigegeben: 'Prämie freigegeben',
  praemie_ausgezahlt: 'Prämie ausgezahlt',
};

const STATUS_COLOR = {
  registriert: '#6B7280',
  vertrag_abgeschlossen: '#3B82F6',
  erste_zahlung: '#F59E0B',
  praemie_freigegeben: '#10B981',
  praemie_ausgezahlt: '#D4AF37',
};

const ReferralCodeVerwaltung = ({ mitgliedId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!mitgliedId) return;
    const load = async () => {
      try {
        const res = await fetchWithAuth(`${config.apiBaseUrl}/referral/meine-werbungen/${mitgliedId}`);
        if (res.ok) setData(await res.json());
      } catch (err) {
        console.error('Referral-Daten Fehler:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [mitgliedId]);

  const copyCode = (code) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) return <p className="rcv-loading">Lade Empfehlungsdaten…</p>;

  const activeCode = data?.codes?.find(c => c.aktiv) || data?.codes?.[0];
  const stat = data?.statistik;

  return (
    <div className="rcv-root">

      {/* Dein Code */}
      {activeCode ? (
        <div className="rcv-code-box">
          <p className="rcv-section-label">
            Dein Empfehlungscode
          </p>
          <div className="rcv-code-row">
            <span className="rcv-code-value">
              {activeCode.code}
            </span>
            <button
              onClick={() => copyCode(activeCode.code)}
              className={`rcv-copy-btn ${copied ? 'rcv-copy-btn--copied' : 'rcv-copy-btn--default'}`}
            >
              {copied ? '✓ Kopiert' : 'Kopieren'}
            </button>
          </div>
          {activeCode.aktion_titel && (
            <p className="rcv-code-meta">
              Aktion: {activeCode.aktion_titel}
            </p>
          )}
        </div>
      ) : (
        <div className="rcv-code-box-empty">
          Du hast noch keinen aktiven Empfehlungscode. Frage dein Dojo-Team.
        </div>
      )}

      {/* Statistik */}
      {stat && (
        <div className="rcv-stats-grid">
          {[
            { label: 'Geworbene', value: stat.gesamt || 0, color: 'var(--text-primary)' },
            { label: 'Ausgezahlt', value: `${parseFloat(stat.praemien_ausgezahlt || 0).toFixed(0)} €`, color: '#D4AF37' },
            { label: 'Offen', value: `${parseFloat(stat.praemien_offen || 0).toFixed(0)} €`, color: 'var(--success)' },
          ].map(item => (
            <div key={item.label} className="rcv-stat-card">
              <div className="rcv-stat-value" style={{ '--stat-color': item.color }}>{item.value}</div>
              <div className="rcv-stat-label">{item.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Werbungen */}
      {data?.werbungen?.length > 0 ? (
        <div>
          <p className="rcv-list-label">
            Meine Empfehlungen
          </p>
          <div className="u-flex-col-sm">
            {data.werbungen.map(w => (
              <div key={w.id} className="rcv-list-item">
                <span className="rcv-list-name">
                  {w.geworbener_name}
                </span>
                <span
                  className="rcv-status-badge"
                  style={{ '--status-color': STATUS_COLOR[w.status] || '#6B7280' }}
                >
                  {STATUS_LABEL[w.status] || w.status}
                </span>
                {w.praemie_betrag && (
                  <span className="rcv-praemie">
                    {parseFloat(w.praemie_betrag).toFixed(0)} €
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : data && (
        <p className="rcv-empty">
          Noch keine Empfehlungen. Teile deinen Code und erhalte Prämien!
        </p>
      )}
    </div>
  );
};

export default ReferralCodeVerwaltung;
