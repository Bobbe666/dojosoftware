import React, { useState, useEffect } from 'react';
import { useDojoContext } from '../context/DojoContext';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import config from '../config';
import { CreditCard, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import '../styles/StripeConnectSetup.css';

const StripeConnectSetup = () => {
  const { activeDojo } = useDojoContext();
  const dojoId = activeDojo?.id || activeDojo;

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState(null);
  const [balance, setBalance] = useState(null);

  // Status laden
  const loadStatus = async () => {
    if (!dojoId) return;

    try {
      setLoading(true);
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/stripe-connect/status?dojo_id=${dojoId}`
      );
      const data = await response.json();
      setStatus(data);

      // Balance laden wenn verbunden
      if (data.connected && data.charges_enabled) {
        loadBalance();
      }
    } catch (err) {
      setError('Fehler beim Laden des Status');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Balance laden
  const loadBalance = async () => {
    try {
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/stripe-connect/balance?dojo_id=${dojoId}`
      );
      const data = await response.json();
      if (data.success) {
        setBalance(data.balance);
      }
    } catch (err) {
      console.error('Balance laden fehlgeschlagen:', err);
    }
  };

  // Mit Stripe verbinden
  const handleConnect = async () => {
    setConnecting(true);
    setError(null);

    try {
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/stripe-connect/authorize?dojo_id=${dojoId}`
      );
      const data = await response.json();

      if (data.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        setError('Fehler beim Starten der Verbindung');
      }
    } catch (err) {
      setError('Verbindung fehlgeschlagen: ' + err.message);
    } finally {
      setConnecting(false);
    }
  };

  // Verbindung trennen
  const handleDisconnect = async () => {
    if (!window.confirm('Möchtest du die Stripe-Verbindung wirklich trennen?')) {
      return;
    }

    setDisconnecting(true);
    setError(null);

    try {
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/stripe-connect/disconnect`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dojo_id: dojoId })
        }
      );

      if (response.ok) {
        setStatus({ connected: false, status: 'disconnected' });
        setBalance(null);
      } else {
        const data = await response.json();
        setError(data.error || 'Trennung fehlgeschlagen');
      }
    } catch (err) {
      setError('Trennung fehlgeschlagen: ' + err.message);
    } finally {
      setDisconnecting(false);
    }
  };

  // Dashboard öffnen
  const handleOpenDashboard = async () => {
    try {
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/stripe-connect/dashboard-link?dojo_id=${dojoId}`
      );
      const data = await response.json();

      if (data.url) {
        window.open(data.url, '_blank');
      } else {
        setError('Dashboard-Link konnte nicht generiert werden');
      }
    } catch (err) {
      setError('Fehler: ' + err.message);
    }
  };

  // URL-Parameter prüfen (nach OAuth Redirect)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const stripeConnected = urlParams.get('stripe_connected');
    const stripeError = urlParams.get('stripe_error');

    if (stripeConnected === 'true') {
      loadStatus();
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (stripeError) {
      setError(decodeURIComponent(stripeError));
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [dojoId]);

  // Formatiere Betrag
  const formatAmount = (amount, currency = 'eur') => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100);
  };

  if (loading) {
    return (
      <div style={styles.section}>
        <div style={styles.loading}>Lade Stripe Connect Status...</div>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <CreditCard size={24} color="#635bff" />
        <h3 style={styles.sectionTitle}>Stripe Connect</h3>
        {status?.connected && (
          <span style={styles.connectedBadge}>
            <CheckCircle size={14} /> Verbunden
          </span>
        )}
      </div>

      {error && (
        <div style={styles.errorBox}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {!status?.connected ? (
        // Nicht verbunden
        <div>
          <div style={styles.infoBox}>
            <p className="stripe-info-box-text">
              Verbinde dein Dojo mit Stripe Connect um Mitgliedsbeiträge automatisch per SEPA-Lastschrift einzuziehen.
              Jedes Dojo kann sein eigenes Bankkonto für Auszahlungen hinterlegen.
            </p>
          </div>

          <div style={styles.benefitsList}>
            <div style={styles.benefitItem}>
              <CheckCircle size={16} color="#22c55e" />
              <span>Automatischer Einzug per SEPA-Lastschrift</span>
            </div>
            <div style={styles.benefitItem}>
              <CheckCircle size={16} color="#22c55e" />
              <span>Auszahlung direkt auf dein Bankkonto</span>
            </div>
            <div style={styles.benefitItem}>
              <CheckCircle size={16} color="#22c55e" />
              <span>Separates Stripe-Dashboard für dein Dojo</span>
            </div>
          </div>

          <button
            className="scs-connect-btn"
            onClick={handleConnect}
            disabled={connecting}
            style={styles.connectButton}
          >
            {connecting ? 'Verbinde...' : 'Mit Stripe verbinden'}
          </button>
        </div>
      ) : (
        // Verbunden
        <div>
          {/* Status-Übersicht */}
          <div style={styles.statusGrid}>
            <div style={styles.statusCard}>
              <span style={styles.statusLabel}>Zahlungen</span>
              <span className={status.charges_enabled ? 'scs-status-value--ok' : 'scs-status-value--pending'} style={styles.statusValue}>
                {status.charges_enabled ? 'Aktiviert' : 'Ausstehend'}
              </span>
            </div>
            <div style={styles.statusCard}>
              <span style={styles.statusLabel}>Auszahlungen</span>
              <span className={status.payouts_enabled ? 'scs-status-value--ok' : 'scs-status-value--pending'} style={styles.statusValue}>
                {status.payouts_enabled ? 'Aktiviert' : 'Ausstehend'}
              </span>
            </div>
          </div>

          {/* Balance anzeigen */}
          {balance && (
            <div style={styles.balanceBox}>
              <span style={styles.balanceLabel}>Aktuelles Guthaben</span>
              <div style={styles.balanceValues}>
                {balance.available?.map((b, i) => (
                  <div key={i}>
                    <span style={styles.balanceAmount}>{formatAmount(b.amount, b.currency)}</span>
                    <span style={styles.balanceType}>Verfügbar</span>
                  </div>
                ))}
                {balance.pending?.map((b, i) => (
                  <div key={i}>
                    <span style={{ ...styles.balanceAmount, color: 'var(--text-muted)' }}>{formatAmount(b.amount, b.currency)}</span>
                    <span style={styles.balanceType}>Ausstehend</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Anforderungen */}
          {status.requirements?.currently_due?.length > 0 && (
            <div style={styles.warningBox}>
              <AlertCircle size={16} color="#eab308" />
              <div>
                <strong>Aktion erforderlich</strong>
                <p className="stripe-requirements-text">
                  Bitte vervollständige dein Stripe-Konto um alle Funktionen nutzen zu können.
                </p>
              </div>
            </div>
          )}

          {/* Account-Info */}
          <div style={styles.accountInfo}>
            <span>Account: {status.stripe_account_id}</span>
            <span>Verbunden seit: {status.connected_at ? new Date(status.connected_at).toLocaleDateString('de-DE') : '-'}</span>
          </div>

          {/* Aktionen */}
          <div style={styles.actions}>
            <button onClick={handleOpenDashboard} style={styles.dashboardButton}>
              <ExternalLink size={14} /> Stripe Dashboard
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              style={styles.disconnectButton}
            >
              {disconnecting ? 'Trenne...' : 'Trennen'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  section: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(99, 91, 255, 0.3)',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '20px'
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px'
  },
  sectionTitle: {
    color: 'var(--text-primary)',
    margin: 0,
    fontSize: '18px',
    flex: 1
  },
  connectedBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    background: 'rgba(34, 197, 94, 0.2)',
    border: '1px solid rgba(34, 197, 94, 0.5)',
    borderRadius: '20px',
    color: 'var(--success)',
    fontSize: '13px',
    fontWeight: '500'
  },
  infoBox: {
    background: 'rgba(99, 91, 255, 0.1)',
    border: '1px solid rgba(99, 91, 255, 0.3)',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '16px',
    color: 'var(--text-secondary)',
    fontSize: '14px'
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '16px',
    color: 'var(--error)',
    fontSize: '14px'
  },
  benefitsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '20px'
  },
  benefitItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: 'var(--text-secondary)',
    fontSize: '14px'
  },
  connectButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '14px 24px',
    background: '#635bff',
    border: 'none',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  statusGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginBottom: '16px'
  },
  statusCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '12px 16px',
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '8px'
  },
  statusLabel: {
    color: 'var(--text-muted)',
    fontSize: '12px'
  },
  statusValue: {
    fontWeight: '600',
    fontSize: '14px'
  },
  balanceBox: {
    background: 'rgba(99, 91, 255, 0.1)',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px'
  },
  balanceLabel: {
    color: '#635bff',
    fontSize: '13px',
    display: 'block',
    marginBottom: '8px'
  },
  balanceValues: {
    display: 'flex',
    gap: '24px'
  },
  balanceAmount: {
    display: 'block',
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#635bff'
  },
  balanceType: {
    display: 'block',
    fontSize: '11px',
    color: 'var(--text-muted)'
  },
  warningBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    background: 'rgba(234, 179, 8, 0.1)',
    border: '1px solid rgba(234, 179, 8, 0.3)',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '16px',
    color: 'var(--warning)',
    fontSize: '14px'
  },
  accountInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    color: 'var(--text-muted)',
    fontSize: '12px',
    marginBottom: '16px'
  },
  actions: {
    display: 'flex',
    gap: '12px',
    paddingTop: '16px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)'
  },
  dashboardButton: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 16px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    cursor: 'pointer'
  },
  disconnectButton: {
    padding: '10px 16px',
    background: 'transparent',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    color: 'var(--error)',
    fontSize: '14px',
    cursor: 'pointer'
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: 'var(--text-muted)'
  }
};

export default StripeConnectSetup;
