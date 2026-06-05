// ── Hall-of-Fame-Sektion (ausgelagert aus SuperAdminDashboard.jsx) ───────────
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { RefreshCw } from 'lucide-react';

const HOF_API = 'https://hof.tda-intl.org/api';

export default function HofLiveSection() {
  const [stats, setStats]       = useState(null);
  const [neueste, setNeueste]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [sRes, nRes] = await Promise.all([
        axios.get(HOF_API + '/nominierungen/stats'),
        axios.get(HOF_API + '/nominierungen/neueste'),
      ]);
      setStats(sRes.data);
      setNeueste(Array.isArray(nRes.data) ? nRes.data : []);
    } catch {
      setError('HOF-Daten konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      {/* Header */}
      <div className="sad-hof-header">
        <h2 className="sad-hof-title">🌟 TDA Hall of Fame</h2>
        <div className="sad-hof-btn-row">
          <button onClick={load} className="sad-hof-refresh-btn" title="Daten neu laden">
            <RefreshCw size={14} />
          </button>
          <a href="https://hof.tda-intl.org/login" target="_blank" rel="noreferrer" className="sad-hof-admin-link">
            🔐 HoF Admin Login
          </a>
          <a href="https://hof.tda-intl.org" target="_blank" rel="noreferrer" className="sad-hof-public-link">
            ↗ hof.tda-intl.org
          </a>
        </div>
      </div>

      {/* Nav Links */}
      <div className="sad-hof-nav-grid">
        {[
          { icon: '🏠', label: 'Übersicht',       url: 'https://hof.tda-intl.org/dashboard' },
          { icon: '🏅', label: 'Sportler',        url: 'https://hof.tda-intl.org/dashboard/sportler' },
          { icon: '🏷️', label: 'Kategorien',      url: 'https://hof.tda-intl.org/dashboard/kategorien' },
          { icon: '📋', label: 'Nominierungen',   url: 'https://hof.tda-intl.org/dashboard/nominierungen' },
          { icon: '🏟️', label: 'Veranstaltungen', url: 'https://hof.tda-intl.org/dashboard/veranstaltungen' },
        ].map(item => (
          <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className="sad-hof-nav-link">
            <span className="sad2-fs-12">{item.icon}</span>
            {item.label}
          </a>
        ))}
      </div>

      {error && <div className="sad-hof-error">{error}</div>}

      {/* Stats */}
      {loading ? (
        <div className="sad-hof-loading">Lade HOF-Daten…</div>
      ) : stats && (
        <div className="sad-hof-stats-grid">
          <div className="sad-hof-stat-card">
            <div className="sad-hof-stat-icon">🏆</div>
            <div className="sad-hof-stat-value">{stats.gesamt}</div>
            <div className="sad-hof-stat-label">Nominierungen gesamt</div>
          </div>
          <div className="sad-hof-stat-card">
            <div className="sad-hof-stat-icon">📅</div>
            <div className="sad-hof-stat-value">{stats.dieses_jahr}</div>
            <div className="sad-hof-stat-label">In {stats.year}</div>
          </div>
          <div className="sad-hof-stat-card sad-hof-stat-card--gold">
            <div className="sad-hof-stat-icon">🔢</div>
            <div className="sad-hof-stat-value sad-hof-stat-nr">{stats.naechste_nummer}</div>
            <div className="sad-hof-stat-label">Nächste Nummer</div>
          </div>
        </div>
      )}

      {/* Neueste Nominierungen */}
      {!loading && neueste.length > 0 && (
        <div className="sad-hof-table-wrap">
          <div className="sad-hof-table-title">Neueste Nominierungen</div>
          <table className="sad-hof-table">
            <thead>
              <tr>
                <th>Nummer</th>
                <th>Sportler</th>
                <th>Kategorie</th>
                <th>Jahr</th>
                <th>Bezahlt</th>
              </tr>
            </thead>
            <tbody>
              {neueste.map(n => (
                <tr key={n.id}>
                  <td className="sad-hof-td-nr">{n.nominierungsnummer || '—'}</td>
                  <td>{n.vorname} {n.nachname}</td>
                  <td>{n.kategorie}</td>
                  <td>{n.jahr}</td>
                  <td>{n.bezahlt ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
