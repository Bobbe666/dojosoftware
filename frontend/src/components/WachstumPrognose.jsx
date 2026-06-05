import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { TrendingUp, RefreshCw } from 'lucide-react';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import config from '../config/config';

// ============================================================================
// Wachstum & Prognose — visualisiert die ZENTRALE Prognose-Engine
// (/api/admin/prognose: Ø-Wachstum 12 Monate, Median-Spike-Filter).
// Teil des Statistik-Hubs im Entwicklung-Tab des Super-Admin-Dashboards.
// ============================================================================

const ENTITIES = [
  { key: 'dojos',              label: '🏯 Aktive Dojos',       color: '#8b5cf6' },
  { key: 'verbandsmitglieder', label: '🏆 Verbandsmitglieder', color: '#eab308' },
  { key: 'mitglieder',         label: '👥 Mitglieder (aktiv)', color: '#22c55e' },
];

// Monatsverlauf (neu/Monat) + 12 Prognose-Monate als kumulierten Bestand aufbereiten
const buildChartData = (p) => {
  if (!p?.verlauf) return [];
  const data = [];
  // Rückwärts den Bestand rekonstruieren: aktuell minus künftige Zuwächse
  let bestand = p.aktuell - p.verlauf.reduce((s, r) => s + Number(r.neu || 0), 0);
  p.verlauf.forEach(r => {
    bestand += Number(r.neu || 0);
    const [y, m] = r.monat.split('-');
    data.push({ label: `${m}/${y.slice(-2)}`, bestand, neu: Number(r.neu) });
  });
  // Prognose-Punkte
  const now = new Date();
  for (let i = 1; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    data.push({
      label: `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`,
      prognose: Math.round(p.aktuell + p.wachstum_monat * i),
      isPrognose: true,
    });
  }
  return data;
};

const WachstumPrognose = () => {
  const [prognose, setPrognose] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true); setError('');
    fetchWithAuth(`${config.apiBaseUrl}/admin/prognose`)
      .then(r => r.json())
      .then(d => { if (d.success) setPrognose(d); else setError('Fehler beim Laden'); })
      .catch(() => setError('Fehler beim Laden'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Lade Prognose…</div>;
  if (error)   return <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>{error}</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={18} /> Wachstum & Prognose
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}>
            — zentrale Engine: Ø-Wachstum 12 Monate, Ausreißer gefiltert
          </span>
        </h3>
        <button className="btn-icon" onClick={load} title="Neu laden"><RefreshCw size={15} /></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {ENTITIES.map(({ key, label, color }) => {
          const p = prognose?.[key];
          if (!p) return null;
          const chartData = buildChartData(p);
          return (
            <div key={key} style={{
              background: 'var(--bg-card, rgba(255,255,255,0.03))',
              border: '1px solid var(--border, rgba(255,255,255,0.08))',
              borderTop: `3px solid ${color}`, borderRadius: 12, padding: '16px 18px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{label}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>+{p.wachstum_monat}/Monat</span>
              </div>
              <div style={{ display: 'flex', gap: 18, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>{p.aktuell}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>aktuell</div>
                </div>
                {[['in 3 Mon.', p.prognose_3m], ['in 6 Mon.', p.prognose_6m], ['in 12 Mon.', p.prognose_12m]].map(([l, v]) => (
                  <div key={l}>
                    <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.3 }}>{v}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l}</div>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                  <defs>
                    <linearGradient id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 12 }}
                    formatter={(value, name) => [value, name === 'bestand' ? 'Bestand' : 'Prognose']}
                  />
                  <Area type="monotone" dataKey="bestand" stroke={color} strokeWidth={2} fill={`url(#grad-${key})`} dot={false} name="bestand" />
                  <Area type="monotone" dataKey="prognose" stroke={color} strokeWidth={2} strokeDasharray="5 5" fill="none" dot={false} name="prognose" />
                  <ReferenceLine x={chartData.find(d => d.isPrognose)?.label} stroke="rgba(255,255,255,0.25)" strokeDasharray="2 2" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WachstumPrognose;
