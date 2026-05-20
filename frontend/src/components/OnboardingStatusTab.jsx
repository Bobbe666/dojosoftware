import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const CHECK_CFG = {
  adresse:    { label: 'Adresse',    icon: '📍' },
  sepa:       { label: 'SEPA',       icon: '🏦' },
  tarife:     { label: 'Tarife',     icon: '💶' },
  mitglieder: { label: 'Mitglieder', icon: '👤' },
  vertraege:  { label: 'Verträge',   icon: '📄' },
  onboarding: { label: 'Onboarding', icon: '✅' },
};

const PLAN_COLOR = {
  enterprise: '#d4af37', pro: '#8b5cf6', basic: '#4ea8de',
  free: '#27ae60', custom: '#e36209', trial: '#7f8c8d'
};

function CompletionBar({ pct }) {
  const color = pct === 100 ? '#27ae60' : pct >= 66 ? '#d4af37' : '#e74c3c';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{ flex: 1, height: 7, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s' }} />
      </div>
      <span style={{ fontSize: '11px', color, fontWeight: 700, minWidth: 32, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

export default function OnboardingStatusTab({ token }) {
  const [dojos, setDojos]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [filter, setFilter]     = useState('alle'); // alle | offen | fertig
  const [search, setSearch]     = useState('');

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/admin/onboarding-status', { headers });
      setDojos(res.data.dojos || []);
    } catch (e) {
      console.error('Onboarding-Status Fehler:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, []);

  const filtered = dojos.filter(d => {
    if (filter === 'offen'  && d.completion === 100) return false;
    if (filter === 'fertig' && d.completion < 100)   return false;
    if (search && !d.dojoname?.toLowerCase().includes(search.toLowerCase()) &&
                  !d.inhaber?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const offenCount  = dojos.filter(d => d.completion < 100).length;
  const fertigCount = dojos.filter(d => d.completion === 100).length;
  const avgCompletion = dojos.length
    ? Math.round(dojos.reduce((s, d) => s + d.completion, 0) / dojos.length)
    : 0;

  return (
    <div>
      {/* Zusammenfassung */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        <div className="section-card" style={{ padding: '0.9rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#27ae60' }}>{fertigCount}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '0.2rem' }}>Vollständig</div>
        </div>
        <div className="section-card" style={{ padding: '0.9rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#e74c3c' }}>{offenCount}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '0.2rem' }}>Unvollständig</div>
        </div>
        <div className="section-card" style={{ padding: '0.9rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#d4af37' }}>{avgCompletion}%</div>
          <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '0.2rem' }}>Ø Completion</div>
        </div>
        <div className="section-card" style={{ padding: '0.9rem', textAlign: 'center' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{dojos.length}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '0.2rem' }}>Dojos gesamt</div>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['alle', 'offen', 'fertig'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={filter === f ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '0.3rem 0.9rem', fontSize: '13px', textTransform: 'capitalize' }}
          >
            {f === 'alle' ? `Alle (${dojos.length})` : f === 'offen' ? `Offen (${offenCount})` : `Fertig (${fertigCount})`}
          </button>
        ))}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Dojo suchen…"
          style={{ marginLeft: 'auto', padding: '0.3rem 0.75rem', fontSize: '13px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-1)', minWidth: 160 }}
        />
        <button className="btn-secondary" onClick={load} disabled={loading} style={{ padding: '0.3rem 0.65rem', fontSize: '12px' }}>
          {loading ? '⏳' : '↺'}
        </button>
      </div>

      {/* Dojo-Liste */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {filtered.length === 0 && !loading && (
          <div className="section-card" style={{ textAlign: 'center', color: 'var(--text-3)', padding: '2rem' }}>
            Keine Dojos gefunden
          </div>
        )}

        {filtered.map(dojo => (
          <div key={dojo.id} className="section-card" style={{ padding: '0.9rem 1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
              {/* Links: Name + Meta */}
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{dojo.dojoname}</span>
                  {dojo.subscription_plan && (
                    <span style={{
                      background: (PLAN_COLOR[dojo.subscription_plan] || '#888') + '28',
                      color: PLAN_COLOR[dojo.subscription_plan] || '#888',
                      padding: '1px 6px', borderRadius: 4, fontSize: '10px', fontWeight: 700
                    }}>
                      {dojo.subscription_plan.toUpperCase()}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                  {dojo.inhaber && <span>{dojo.inhaber}</span>}
                  {dojo.ort && <span> · {dojo.ort}</span>}
                  {dojo.subdomain && <span> · {dojo.subdomain}</span>}
                </div>
              </div>

              {/* Mitte: Completion Bar */}
              <div style={{ flex: 1, minWidth: 160, maxWidth: 260 }}>
                <CompletionBar pct={dojo.completion} />
              </div>

              {/* Rechts: Checkboxen */}
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {Object.entries(CHECK_CFG).map(([key, cfg]) => (
                  <span
                    key={key}
                    title={cfg.label}
                    style={{
                      padding: '2px 7px', borderRadius: 4, fontSize: '11px',
                      background: dojo.checks[key] ? 'rgba(39,174,96,0.15)' : 'rgba(231,76,60,0.12)',
                      color: dojo.checks[key] ? '#27ae60' : '#e74c3c',
                      fontWeight: 600, whiteSpace: 'nowrap'
                    }}
                  >
                    {dojo.checks[key] ? '✓' : '✗'} {cfg.icon} {cfg.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Zählwerte */}
            <div style={{ display: 'flex', gap: '1.2rem', marginTop: '0.5rem', fontSize: '12px', color: 'var(--text-3)' }}>
              <span>👤 {dojo.mitglieder_count} Mitgl.</span>
              <span>📄 {dojo.vertraege_count} Verträge</span>
              <span>💶 {dojo.tarife_count} Tarife</span>
              <span>🧑‍💼 {dojo.benutzer_count} Benutzer</span>
              {dojo.created_at && (
                <span style={{ marginLeft: 'auto' }}>
                  Seit {new Date(dojo.created_at).toLocaleDateString('de-DE', { month: '2-digit', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
