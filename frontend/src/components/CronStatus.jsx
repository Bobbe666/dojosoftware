import React, { useState, useEffect } from 'react';
import axios from 'axios';

// ============================================================================
// Cron-Status — zeigt, ob die geplanten Jobs (Briefing, Feedback …) laufen
// Eingebettet im System-Tab → Status (SuperAdminDashboard)
// ============================================================================

function fmt(dt) {
  if (!dt) return 'noch nie';
  return new Date(dt).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

function ampel(job) {
  if (!job.letzter_lauf) return { icon: '⚪', text: 'noch kein Lauf' };
  if (!job.erfolg) return { icon: '🔴', text: 'Fehler beim letzten Lauf' };
  // Älter als 26 h → vermutlich nicht gelaufen
  const alt = (Date.now() - new Date(job.letzter_lauf).getTime()) > 26 * 60 * 60 * 1000;
  return alt ? { icon: '🟠', text: 'letzter Lauf liegt länger zurück' } : { icon: '🟢', text: 'läuft' };
}

export default function CronStatus({ token }) {
  const [jobs, setJobs] = useState(null);

  useEffect(() => {
    axios.get('/admin/cron-status', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setJobs(r.data.jobs || []))
      .catch(() => setJobs([]));
  }, [token]);

  if (!jobs) return null;

  return (
    <div className="section-card" style={{ marginBottom: '1rem' }}>
      <h3 className="sad2-flex-align-05-mb">⏱ Geplante Aufgaben (Cron)</h3>
      <p className="sad2-text-secondary-mb">Automatische Jobs — letzter Lauf und Status.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {jobs.map(job => {
          const a = ampel(job);
          return (
            <div key={job.key} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
              padding: '0.6rem 0.8rem', borderRadius: '8px',
              background: 'rgba(148,163,184,0.06)', border: '1px solid rgba(148,163,184,0.15)'
            }}>
              <span style={{ fontSize: '1.1rem' }} title={a.text}>{a.icon}</span>
              <span style={{ fontWeight: 600, flex: '1 1 240px' }}>{job.label}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)' }}>{job.plan}</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #94a3b8)' }}>
                letzter Lauf: {fmt(job.letzter_lauf)}
                {job.info ? ` · ${job.info}` : ''}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
