// ============================================================================
// ELTERN-PORTAL — Read-only Ansicht für Eltern (token-basiert)
// Route: /eltern-portal?token=xxx
// ============================================================================

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/themes.css';
import '../styles/components.css';

const ElternPortal = () => {
  const token = new URLSearchParams(window.location.search).get('token');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Kein Zugangstoken angegeben.');
      setLoading(false);
      return;
    }
    axios.get(`/api/public/eltern?token=${encodeURIComponent(token)}`)
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.response?.data?.error || 'Fehler beim Laden der Daten');
        setLoading(false);
      });
  }, [token]);

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-primary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" />
          <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>Lade Daten...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-primary)', padding: '1rem' }}>
        <div className="card" style={{ maxWidth: '400px', textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Zugriff nicht möglich</h2>
          <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '1rem' }}>
            Bitte wenden Sie sich an das Dojo, um einen neuen Zugangslink zu erhalten.
          </p>
        </div>
      </div>
    );
  }

  const { kind, pruefungen, anwesenheit_30_tage, eltern_name } = data;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '1rem' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,215,0,0.05))',
          border: '1px solid rgba(255,215,0,0.3)',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>👨‍👩‍👧</div>
          <h1 style={{ color: 'var(--primary)', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Eltern-Portal
          </h1>
          {eltern_name && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Willkommen, {eltern_name}
            </p>
          )}
        </div>

        {/* Kind-Info */}
        <div className="card" style={{ marginBottom: '1rem', padding: '1.5rem' }}>
          <h2 style={{ color: 'var(--primary)', fontSize: '1.1rem', marginBottom: '1rem' }}>
            🥋 {kind.vorname} {kind.nachname}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>Geburtsdatum</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{formatDate(kind.geburtsdatum)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>Dojo</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{kind.dojoname || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>Kampfkünste</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{kind.stile || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.2rem' }}>Graduierung</div>
              <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{kind.graduierungen || '—'}</div>
            </div>
          </div>
        </div>

        {/* Anwesenheit */}
        <div className="card" style={{ marginBottom: '1rem', padding: '1.5rem' }}>
          <h3 style={{ color: 'var(--primary)', fontSize: '1rem', marginBottom: '1rem' }}>📊 Anwesenheit (letzte 30 Tage)</h3>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '1rem',
            background: 'rgba(255,215,0,0.08)', borderRadius: '12px', padding: '1rem'
          }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--primary)' }}>
              {anwesenheit_30_tage}
            </div>
            <div style={{ color: 'var(--text-secondary)' }}>
              Training{anwesenheit_30_tage !== 1 ? 'seinheiten' : 'seinheit'} besucht
            </div>
          </div>
        </div>

        {/* Anstehende Prüfungen */}
        <div className="card" style={{ marginBottom: '1rem', padding: '1.5rem' }}>
          <h3 style={{ color: 'var(--primary)', fontSize: '1rem', marginBottom: '1rem' }}>🏆 Anstehende Prüfungen</h3>
          {pruefungen.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Keine anstehenden Prüfungen.
            </p>
          ) : (
            pruefungen.map((p, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.75rem 1rem',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: '8px',
                marginBottom: '0.5rem'
              }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.stil}</div>
                  {p.ziel_graduierung && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Ziel: {p.ziel_graduierung}
                    </div>
                  )}
                </div>
                <div style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.9rem' }}>
                  {formatDate(p.pruefungsdatum)}
                </div>
              </div>
            ))
          )}
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '1.5rem' }}>
          Dojosoftware • Eltern-Portal • Dieses Portal zeigt nur grundlegende Informationen.
        </p>
      </div>
    </div>
  );
};

export default ElternPortal;
