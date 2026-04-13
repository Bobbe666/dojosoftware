/**
 * LastschriftZustimmung.jsx
 * Öffentliche Seite (kein Login nötig) für die Lastschrift-Einverständniserklärung.
 * Wird über E-Mail-Link aufgerufen: /lastschrift-zustimmung/:token
 * Optionaler Query-Param: ?antwort=ja|nein  → direkte Bestätigung aus E-Mail-Button
 */

import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import config from '../config/config.js';

const api = axios.create({ baseURL: config.apiBaseUrl });

export default function LastschriftZustimmung() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const antwortParam = searchParams.get('antwort'); // 'ja' | 'nein' | null

  const [loading, setLoading]   = useState(true);
  const [member, setMember]     = useState(null);
  const [error, setError]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]     = useState(null); // { status, message }

  // Mitgliedsdaten laden
  useEffect(() => {
    api.get(`/lastschrift-einverstaendnis/formular/${token}`)
      .then(res => {
        setMember(res.data);
        // Wenn schon beantwortet → zeige Status direkt
        if (res.data.status !== 'ausstehend' && !antwortParam) {
          setResult({ status: res.data.status, already: true });
        }
      })
      .catch(err => {
        setError(err.response?.data?.error || 'Dieser Link ist ungültig oder abgelaufen.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  // Wenn Query-Param gesetzt: sofort absenden
  useEffect(() => {
    if (!loading && member && antwortParam && !result) {
      absenden(antwortParam);
    }
  }, [loading, member, antwortParam]);

  const absenden = async (antwort) => {
    setSubmitting(true);
    try {
      const res = await api.post(`/lastschrift-einverstaendnis/formular/${token}`, { antwort });
      setResult({ status: res.data.status, message: res.data.message });
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Speichern.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.headerTitle}>
            {member?.dojoname || 'Kampfkunstschule'}
          </h1>
          <p style={styles.headerSub}>Lastschrift-Einverständnis</p>
        </div>

        <div style={styles.body}>
          {/* Lade-Zustand */}
          {loading && (
            <div style={styles.center}>
              <div style={styles.spinner} />
              <p style={styles.muted}>Lade…</p>
            </div>
          )}

          {/* Fehler */}
          {!loading && error && (
            <div style={styles.errorBox}>
              <span style={{ fontSize: '2rem' }}>⚠️</span>
              <p style={{ margin: '0.5rem 0 0' }}>{error}</p>
            </div>
          )}

          {/* Bereits beantwortet */}
          {!loading && !error && result?.already && (
            <div style={result.status === 'zugestimmt' ? styles.successBox : styles.neutralBox}>
              <span style={{ fontSize: '2.5rem' }}>
                {result.status === 'zugestimmt' ? '✅' : '❌'}
              </span>
              <h2 style={styles.resultTitle}>
                {result.status === 'zugestimmt'
                  ? 'Sie haben bereits zugestimmt.'
                  : 'Sie haben bereits abgelehnt.'}
              </h2>
              <p style={styles.muted}>
                {result.status === 'zugestimmt'
                  ? 'Ihr Einverständnis für den automatischen Lastschrifteinzug ist gespeichert.'
                  : 'Sie haben den automatischen Lastschrifteinzug abgelehnt.'}
              </p>
              <p style={styles.tiny}>
                Bei Fragen wenden Sie sich bitte direkt an Ihr Dojo.
              </p>
            </div>
          )}

          {/* Ergebnis nach Absenden */}
          {!loading && !error && result && !result.already && (
            <div style={result.status === 'zugestimmt' ? styles.successBox : styles.neutralBox}>
              <span style={{ fontSize: '3rem' }}>
                {result.status === 'zugestimmt' ? '✅' : '❌'}
              </span>
              <h2 style={styles.resultTitle}>
                {result.status === 'zugestimmt'
                  ? 'Zustimmung erteilt!'
                  : 'Ablehnung gespeichert.'}
              </h2>
              <p style={{ margin: '0.5rem 0', color: '#555' }}>{result.message}</p>
              <p style={styles.tiny}>Sie können dieses Fenster schließen.</p>
            </div>
          )}

          {/* Formular (noch nicht beantwortet, kein direkter Query-Param) */}
          {!loading && !error && !result && member && !antwortParam && (
            <>
              <p style={styles.greeting}>
                Hallo <strong>{member.vorname} {member.nachname}</strong>,
              </p>

              <p style={styles.text}>
                {member.dojoname} möchte Ihnen den Einkauf im Dojo-Shop so komfortabel
                wie möglich gestalten. Wir fragen daher, ob Sie damit einverstanden sind,
                dass zukünftige Einkäufe automatisch per <strong>SEPA-Lastschrift</strong> von
                Ihrem hinterlegten Konto eingezogen werden.
              </p>

              <div style={styles.infoBox}>
                <strong>Was bedeutet das?</strong>
                <ul style={styles.list}>
                  <li>Bei jedem Kauf wird der Betrag automatisch von Ihrem Bankkonto abgebucht.</li>
                  <li>Sie benötigen kein separates Zahlungsportal mehr.</li>
                  <li>Gemäß SEPA-Regelwerk haben Sie ein Widerrufsrecht von 8 Wochen.</li>
                  <li>Sie können das Einverständnis jederzeit beim Dojo widerrufen.</li>
                </ul>
              </div>

              <div style={styles.btnRow}>
                <button
                  style={styles.btnJa}
                  disabled={submitting}
                  onClick={() => absenden('ja')}
                >
                  {submitting ? '…' : '✓  Ja, ich stimme zu'}
                </button>
                <button
                  style={styles.btnNein}
                  disabled={submitting}
                  onClick={() => absenden('nein')}
                >
                  {submitting ? '…' : '✗  Nein, ich lehne ab'}
                </button>
              </div>

              <p style={styles.tiny}>
                Ihre Antwort wird mit Zeitstempel gespeichert. Bei Fragen wenden Sie sich
                direkt an {member.dojoname}.
              </p>
            </>
          )}

          {/* Lade-Spinner während Direktantwort verarbeitet wird */}
          {!loading && !error && !result && antwortParam && (
            <div style={styles.center}>
              <div style={styles.spinner} />
              <p style={styles.muted}>Ihre Antwort wird gespeichert…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Inline-Styles (kein CSS-Import nötig — eigenständige public Seite) ──────
const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    fontFamily: "'Segoe UI', Arial, sans-serif",
  },
  card: {
    width: '100%',
    maxWidth: '560px',
    background: '#fff',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
  },
  header: {
    background: '#1a1a2e',
    color: '#e0e0e0',
    padding: '1.5rem 2rem',
    textAlign: 'center',
  },
  headerTitle: {
    margin: 0,
    fontSize: '1.3rem',
    fontWeight: 700,
    color: '#fff',
  },
  headerSub: {
    margin: '0.3rem 0 0',
    fontSize: '0.85rem',
    color: '#aaa',
  },
  body: {
    padding: '2rem',
  },
  center: {
    textAlign: 'center',
    padding: '2rem 0',
  },
  spinner: {
    width: '36px',
    height: '36px',
    border: '4px solid #e0e0e0',
    borderTop: '4px solid #6c63ff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto 1rem',
  },
  greeting: {
    fontSize: '1rem',
    color: '#333',
    marginBottom: '0.75rem',
  },
  text: {
    fontSize: '0.95rem',
    color: '#444',
    lineHeight: 1.6,
    marginBottom: '1.25rem',
  },
  infoBox: {
    background: '#f0f4ff',
    borderLeft: '4px solid #6c63ff',
    borderRadius: '6px',
    padding: '1rem 1.25rem',
    marginBottom: '1.75rem',
    fontSize: '0.9rem',
    color: '#333',
  },
  list: {
    margin: '0.5rem 0 0',
    paddingLeft: '1.2rem',
    lineHeight: 1.7,
  },
  btnRow: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap',
    marginBottom: '1.25rem',
  },
  btnJa: {
    flex: 1,
    minWidth: '140px',
    padding: '0.9rem 1rem',
    background: '#2ea043',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  btnNein: {
    flex: 1,
    minWidth: '140px',
    padding: '0.9rem 1rem',
    background: '#d73a49',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  tiny: {
    fontSize: '0.78rem',
    color: '#999',
    lineHeight: 1.5,
  },
  muted: {
    color: '#888',
    fontSize: '0.9rem',
    marginTop: '0.5rem',
  },
  errorBox: {
    background: '#fff5f5',
    border: '1px solid #ffcdd2',
    borderRadius: '10px',
    padding: '1.5rem',
    textAlign: 'center',
    color: '#c62828',
  },
  successBox: {
    background: '#f0fff4',
    border: '1px solid #a5d6a7',
    borderRadius: '10px',
    padding: '1.75rem',
    textAlign: 'center',
  },
  neutralBox: {
    background: '#fafafa',
    border: '1px solid #ddd',
    borderRadius: '10px',
    padding: '1.75rem',
    textAlign: 'center',
  },
  resultTitle: {
    fontSize: '1.2rem',
    fontWeight: 700,
    margin: '0.5rem 0 0.25rem',
    color: '#333',
  },
};
