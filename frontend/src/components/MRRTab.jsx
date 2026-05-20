import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const PLAN_COLOR = {
  enterprise: '#d4af37', pro: '#8b5cf6', basic: '#4ea8de',
  free: '#27ae60', custom: '#e36209', trial: '#7f8c8d'
};

const INTERVAL_LABEL = {
  monthly:   'monatl.',
  quarterly: 'quartl.',
  yearly:    'jährl.',
};

function fmt(n) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

function fmtDec(n) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
}

export default function MRRTab({ token }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState('');
  const [sortBy, setSortBy]   = useState('mrr'); // mrr | name | plan

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/admin/mrr', { headers });
      setData(res.data);
    } catch (e) {
      console.error('MRR Fehler:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, []);

  const dojos = (data?.dojos || [])
    .filter(d => !search || d.dojoname?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'mrr')  return b.mrr - a.mrr;
      if (sortBy === 'name') return a.dojoname?.localeCompare(b.dojoname);
      if (sortBy === 'plan') return (a.subscription_plan || '').localeCompare(b.subscription_plan || '');
      return 0;
    });

  const maxMrr = Math.max(...(data?.dojos || []).map(d => d.mrr), 1);

  return (
    <div>
      {/* KPI-Kacheln */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        <div className="section-card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>MRR</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#d4af37' }}>{fmt(data?.total_mrr)}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '0.2rem' }}>pro Monat</div>
        </div>
        <div className="section-card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>ARR</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#8b5cf6' }}>{fmt(data?.total_arr)}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '0.2rem' }}>pro Jahr</div>
        </div>
        <div className="section-card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Aktive Abos</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#27ae60' }}>{data?.active_count ?? '—'}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '0.2rem' }}>zahlende Dojos</div>
        </div>
        <div className="section-card" style={{ padding: '1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Trials</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#7f8c8d' }}>{data?.trial_count ?? '—'}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '0.2rem' }}>potenzielle Einnahmen</div>
        </div>
      </div>

      {/* Plan-Breakdown */}
      {data?.by_plan?.length > 0 && (
        <div className="section-card" style={{ marginBottom: '1rem' }}>
          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem' }}>MRR nach Plan</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {data.by_plan.map(p => {
              const color = PLAN_COLOR[p.plan] || '#888';
              const pct   = data.total_mrr > 0 ? Math.round(p.mrr / data.total_mrr * 100) : 0;
              return (
                <div key={p.plan}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem', fontSize: '13px' }}>
                    <span style={{ color, fontWeight: 600 }}>
                      {p.display || p.plan}
                      <span style={{ color: 'var(--text-3)', fontWeight: 400, marginLeft: '0.4rem' }}>({p.count} Dojo{p.count !== 1 ? 's' : ''})</span>
                    </span>
                    <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>
                      {fmtDec(p.mrr)} <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: '11px' }}>/ Monat · {pct}%</span>
                    </span>
                  </div>
                  <div style={{ height: 7, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dojo-Tabelle */}
      <div className="section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Einzelübersicht</h4>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Dojo suchen…"
              style={{ padding: '0.28rem 0.65rem', fontSize: '12px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-1)', width: 150 }}
            />
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: '0.28rem 0.65rem', fontSize: '12px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-1)' }}>
              <option value="mrr">MRR ↓</option>
              <option value="name">Name A–Z</option>
              <option value="plan">Plan</option>
            </select>
            <button className="btn-secondary" onClick={load} disabled={loading} style={{ padding: '0.28rem 0.65rem', fontSize: '12px' }}>
              {loading ? '⏳' : '↺'}
            </button>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {[['Dojo', 'left'], ['Plan', 'left'], ['Intervall', 'center'], ['Preis', 'right'], ['MRR', 'right'], ['Abo bis', 'right']].map(([label, align]) => (
                <th key={label} style={{ padding: '0.4rem 0.6rem', color: 'var(--text-3)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: align }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dojos.map(d => {
              const color = PLAN_COLOR[d.subscription_plan] || '#888';
              const pct   = maxMrr > 0 ? d.mrr / maxMrr * 100 : 0;
              return (
                <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '0.45rem 0.6rem' }}>
                    <div style={{ fontWeight: 600 }}>{d.dojoname}</div>
                    {d.subscription_status === 'trial' && (
                      <div style={{ fontSize: '10px', color: '#7f8c8d' }}>Trial</div>
                    )}
                  </td>
                  <td style={{ padding: '0.45rem 0.6rem' }}>
                    <span style={{ color, fontWeight: 600, fontSize: '12px' }}>
                      {d.plan_display || d.subscription_plan || '—'}
                    </span>
                  </td>
                  <td style={{ padding: '0.45rem 0.6rem', textAlign: 'center', color: 'var(--text-3)', fontSize: '12px' }}>
                    {INTERVAL_LABEL[d.payment_interval] || '—'}
                  </td>
                  <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: 'var(--text-3)', fontSize: '12px' }}>
                    {d.price_monthly > 0 ? fmtDec(d.payment_interval === 'yearly' ? d.price_yearly : d.price_monthly) : '—'}
                  </td>
                  <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end' }}>
                      <div style={{ width: 48, height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
                      </div>
                      <span style={{ fontWeight: 700, color: d.mrr > 0 ? 'var(--text-1)' : 'var(--text-3)', minWidth: 52, textAlign: 'right' }}>
                        {d.mrr > 0 ? fmtDec(d.mrr) : '—'}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: 'var(--text-3)', fontSize: '11px' }}>
                    {d.subscription_ends_at
                      ? new Date(d.subscription_ends_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
                      : '∞'}
                  </td>
                </tr>
              );
            })}
            {dojos.length === 0 && !loading && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)' }}>Keine Daten</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
