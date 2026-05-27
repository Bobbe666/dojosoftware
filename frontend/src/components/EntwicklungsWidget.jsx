import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';
import { useAuth } from '../context/AuthContext';

const formatZahl = (wert, einheit) => {
  if (einheit === 'EUR') return `${Math.round(wert).toLocaleString('de-DE')} €`;
  return Math.round(wert).toLocaleString('de-DE');
};

const ZielCard = ({ label, ist, soll, einheit, color, onClick }) => {
  if (soll <= 0) return null;

  const prozent = Math.min(100, Math.round((ist / soll) * 100));
  const differenz = ist - soll;
  const trend = prozent >= 100 ? 'up' : prozent >= 80 ? 'neutral' : 'down';

  const barColor = trend === 'up'
    ? 'linear-gradient(90deg, #10b981, #34d399)'
    : trend === 'down'
      ? 'linear-gradient(90deg, #ef4444, #f87171)'
      : 'linear-gradient(90deg, #f59e0b, #fbbf24)';

  const prozentColor = trend === 'up' ? 'var(--status-success)' : trend === 'down' ? 'var(--status-error)' : 'var(--status-warning)';

  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 0,
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${color}33`,
        borderRadius: 'var(--comp-radius-xl, 12px)',
        padding: '1rem',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.2s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ color: '#a0a0b0', fontSize: '0.82rem', fontWeight: 500 }}>{label}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.5rem' }}>
        <div>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#6b6b7a', marginBottom: 2 }}>IST</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--status-success, #10b981)' }}>
            {formatZahl(ist, einheit)}
          </div>
        </div>
        <div style={{ color: '#4a4a5a', fontSize: '0.9rem' }}>→</div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#6b6b7a', marginBottom: 2 }}>SOLL</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#818cf8' }}>
            {formatZahl(soll, einheit)}
          </div>
        </div>
      </div>

      <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 3, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${prozent}%`, height: '100%', borderRadius: 3, background: barColor, transition: 'width 0.4s ease' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.78rem' }}>
        <span style={{ fontWeight: 600, color: prozentColor }}>{prozent}%</span>
        <span style={{ color: differenz >= 0 ? 'var(--status-success, #10b981)' : 'var(--status-error, #ef4444)' }}>
          {differenz >= 0 ? '+' : ''}{formatZahl(differenz, einheit)}
        </span>
      </div>
    </div>
  );
};

const EntwicklungsWidget = ({ onTabChange }) => {
  const { activeDojo } = useDojoContext();
  const { token } = useAuth();
  const [daten, setDaten] = useState(null);

  useEffect(() => {
    if (!activeDojo?.id || !token) return;
    axios.get(`/entwicklungsziele/widget?dojo_id=${activeDojo.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => setDaten(r.data))
      .catch(() => {});
  }, [activeDojo?.id, token]);

  if (!daten) return null;
  if (daten.soll_mitglieder <= 0 && daten.soll_umsatz <= 0) return null;

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.8rem', color: '#6b6b7a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Ziele {daten.year} — IST vs. SOLL
        </span>
        <button
          onClick={() => onTabChange?.('entwicklung')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#818cf8', fontSize: '0.78rem', padding: '2px 6px',
          }}
        >
          Details →
        </button>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {daten.soll_mitglieder > 0 && (
          <ZielCard
            label="Dojo-Mitglieder"
            ist={daten.ist_mitglieder}
            soll={daten.soll_mitglieder}
            einheit=""
            color="var(--success, #10b981)"
            onClick={() => onTabChange?.('entwicklung')}
          />
        )}
        {daten.soll_umsatz > 0 && (
          <ZielCard
            label="Mitgliedsbeiträge"
            ist={daten.ist_umsatz}
            soll={daten.soll_umsatz}
            einheit="EUR"
            color="#f59e0b"
            onClick={() => onTabChange?.('entwicklung')}
          />
        )}
      </div>
    </div>
  );
};

export default EntwicklungsWidget;
