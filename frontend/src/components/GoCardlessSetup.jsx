// ============================================================================
// GOCARDLESS SEPA MANDATE SETUP
// frontend/src/components/GoCardlessSetup.jsx
// Komponente zur Einrichtung von SEPA-Lastschrift-Mandaten via GoCardless
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import fetchWithAuth from '../utils/fetchWithAuth';
import config from '../config';

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  container: {
    background: '#1a1a2e',
    border: '1px solid #2d2d4e',
    borderRadius: 10,
    padding: '1.5rem',
    maxWidth: 480,
    fontFamily: 'inherit'
  },
  title: {
    fontSize: '1.1rem',
    fontWeight: 600,
    color: '#e0e0e0',
    marginBottom: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    borderRadius: 8,
    marginBottom: '1rem',
    fontSize: '0.95rem'
  },
  statusActive: {
    background: 'rgba(34,197,94,0.12)',
    border: '1px solid rgba(34,197,94,0.3)',
    color: '#22c55e'
  },
  statusPending: {
    background: 'rgba(234,179,8,0.12)',
    border: '1px solid rgba(234,179,8,0.3)',
    color: '#eab308'
  },
  statusNone: {
    background: 'rgba(100,116,139,0.12)',
    border: '1px solid rgba(100,116,139,0.3)',
    color: '#94a3b8'
  },
  statusError: {
    background: 'rgba(239,68,68,0.12)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#ef4444'
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.6rem 1.25rem',
    background: 'linear-gradient(135deg, #0052cc, #0065ff)',
    color: 'var(--ds-text)',
    border: 'none',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: '0.9rem',
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  errorText: {
    color: '#ef4444',
    fontSize: '0.85rem',
    marginTop: '0.5rem'
  },
  infoText: {
    color: '#8892a4',
    fontSize: '0.82rem',
    marginTop: '0.75rem',
    lineHeight: 1.5
  }
};

// ============================================================================
// STATUS HELPERS
// ============================================================================

function getMandateStatusStyle(status) {
  switch (status) {
    case 'active':
      return styles.statusActive;
    case 'pending_submission':
    case 'submitted':
    case 'pending':
      return styles.statusPending;
    case 'cancelled':
    case 'failed':
    case 'expired':
      return styles.statusError;
    default:
      return styles.statusNone;
  }
}

function getMandateStatusLabel(status) {
  const labels = {
    active: 'Aktives SEPA-Mandat',
    pending_submission: 'Mandat wird ubermittelt...',
    submitted: 'Mandat eingereicht — Bestatigung ausstehend',
    pending: 'Mandat ausstehend',
    cancelled: 'Mandat gekündigt',
    failed: 'Mandat fehlgeschlagen',
    expired: 'Mandat abgelaufen',
    none: 'Kein SEPA-Mandat eingerichtet'
  };
  return labels[status] || `Status: ${status}`;
}

function getMandateStatusIcon(status) {
  switch (status) {
    case 'active':
      return '✓';
    case 'pending_submission':
    case 'submitted':
    case 'pending':
      return '⟳';
    case 'cancelled':
    case 'failed':
    case 'expired':
      return '✗';
    default:
      return '○';
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * GoCardlessSetup — zeigt den SEPA-Mandat-Status eines Mitglieds
 * und ermöglicht das Einrichten eines neuen Mandats.
 *
 * Props:
 *   mitgliedId  {number}  — ID des Mitglieds
 *   dojoId      {number}  — ID des Dojos
 *   onSuccess   {func}    — Callback nach erfolgreichem Mandate-Setup (optional)
 */
const GoCardlessSetup = ({ mitgliedId, dojoId, onSuccess }) => {
  const [mandateStatus, setMandateStatus] = useState('none');
  const [mandateId, setMandateId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settingUp, setSettingUp] = useState(false);
  const [error, setError] = useState(null);

  const apiBase = config.apiBaseUrl;

  const loadStatus = useCallback(async () => {
    if (!mitgliedId) return;
    try {
      setLoading(true);
      setError(null);
      const resp = await fetchWithAuth(`${apiBase}/gocardless/mandate/status/${mitgliedId}?dojo_id=${dojoId}`);
      if (!resp.ok) throw new Error('Status konnte nicht geladen werden');
      const data = await resp.json();
      setMandateStatus(data.mandate_status || 'none');
      setMandateId(data.mandate_id || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [mitgliedId, dojoId, apiBase]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleSetup = async () => {
    setSettingUp(true);
    setError(null);
    try {
      const resp = await fetchWithAuth(`${apiBase}/gocardless/mandate/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mitglied_id: mitgliedId, dojo_id: dojoId })
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || 'Einrichtung fehlgeschlagen');
      }
      const data = await resp.json();
      if (data.redirect_url) {
        // Zur GoCardless Hosted Mandate Page weiterleiten
        window.location.href = data.redirect_url;
      } else {
        throw new Error('Keine Redirect-URL erhalten');
      }
    } catch (err) {
      setError(err.message);
      setSettingUp(false);
    }
  };

  const statusStyle = getMandateStatusStyle(mandateStatus);
  const isActive = mandateStatus === 'active';
  const isPending = ['pending_submission', 'submitted', 'pending'].includes(mandateStatus);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.title}>SEPA-Lastschrift</div>
        <div style={{ ...styles.statusRow, ...styles.statusNone }}>
          <span>⟳</span> Lade Mandatstatus...
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.title}>
        <span>SEPA-Lastschrift (GoCardless)</span>
      </div>

      {/* Status-Anzeige */}
      <div style={{ ...styles.statusRow, ...statusStyle }}>
        <span style={{ fontSize: '1.1rem' }}>{getMandateStatusIcon(mandateStatus)}</span>
        <span>{getMandateStatusLabel(mandateStatus)}</span>
      </div>

      {mandateId && (
        <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.75rem' }}>
          Mandat-ID: {mandateId}
        </div>
      )}

      {/* Aktionsbereich */}
      {!isActive && !isPending && (
        <button
          style={{
            ...styles.button,
            ...(settingUp ? styles.buttonDisabled : {})
          }}
          onClick={handleSetup}
          disabled={settingUp}
        >
          {settingUp ? '⟳ Weiterleitung...' : 'SEPA-Lastschrift einrichten'}
        </button>
      )}

      {isPending && (
        <button
          style={{ ...styles.button, ...styles.buttonDisabled }}
          disabled
        >
          ⟳ Mandat wird verarbeitet...
        </button>
      )}

      {isActive && (
        <button
          style={{ ...styles.button, background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
          onClick={loadStatus}
        >
          ↻ Status aktualisieren
        </button>
      )}

      {error && (
        <div style={styles.errorText}>{error}</div>
      )}

      <div style={styles.infoText}>
        SEPA-Lastschrift ermöglicht automatische Beitragszahlungen direkt vom Bankkonto des Mitglieds.
        Der Einzug erfolgt sicher über GoCardless.
      </div>
    </div>
  );
};

export default GoCardlessSetup;
