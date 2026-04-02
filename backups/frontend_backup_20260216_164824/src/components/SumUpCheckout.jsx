// ============================================================================
// SUMUP CHECKOUT COMPONENT
// Frontend/src/components/SumUpCheckout.jsx
// Wiederverwendbare Komponente für SumUp Kartenzahlungen
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { CreditCard, Loader2, CheckCircle, XCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const SumUpCheckout = ({
  amount,
  description,
  reference,
  dojoId,
  // Optionale Referenzen für DB-Tracking
  mitgliedId,
  rechnungId,
  verkaufId,
  eventAnmeldungId,
  verbandsmitgliedschaftId,
  zahlungstyp = 'sonstig',
  // Callbacks
  onSuccess,
  onError,
  onCancel,
  // UI Options
  showQRCode = true,
  autoCheckStatus = true,
  pollInterval = 3000,
  maxPollAttempts = 60
}) => {
  const [status, setStatus] = useState('idle'); // idle, creating, pending, paid, failed, expired
  const [checkoutData, setCheckoutData] = useState(null);
  const [error, setError] = useState(null);
  const [pollCount, setPollCount] = useState(0);

  // Checkout erstellen
  const createCheckout = useCallback(async () => {
    setStatus('creating');
    setError(null);

    try {
      const response = await axios.post('/sumup/checkout', {
        dojo_id: dojoId,
        amount,
        description,
        reference,
        mitgliedId,
        rechnungId,
        verkaufId,
        eventAnmeldungId,
        verbandsmitgliedschaftId,
        zahlungstyp,
        returnUrl: window.location.href
      });

      if (response.data.success) {
        setCheckoutData(response.data);
        setStatus('pending');
      } else {
        setError(response.data.error || 'Fehler beim Erstellen der Zahlung');
        setStatus('failed');
        if (onError) onError(response.data.error);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      setError(errorMsg);
      setStatus('failed');
      if (onError) onError(errorMsg);
    }
  }, [amount, description, reference, dojoId, mitgliedId, rechnungId, verkaufId, eventAnmeldungId, verbandsmitgliedschaftId, zahlungstyp, showQRCode, onError]);

  // Status abfragen
  const checkStatus = useCallback(async () => {
    if (!checkoutData?.checkoutId) return;

    try {
      const response = await axios.get(`/sumup/checkout/${checkoutData.checkoutId}?dojo_id=${dojoId}`);

      if (response.data.status === 'PAID') {
        setStatus('paid');
        if (onSuccess) {
          onSuccess({
            checkoutId: checkoutData.checkoutId,
            transactionId: response.data.transactionId,
            amount: response.data.amount
          });
        }
        return true;
      } else if (response.data.status === 'FAILED') {
        setStatus('failed');
        setError('Zahlung fehlgeschlagen');
        if (onError) onError('Zahlung fehlgeschlagen');
        return true;
      }
    } catch (err) {
      console.error('Status check error:', err);
    }
    return false;
  }, [checkoutData, dojoId, onSuccess, onError]);

  // Automatisches Polling
  useEffect(() => {
    if (status !== 'pending' || !autoCheckStatus) return;

    const interval = setInterval(async () => {
      setPollCount(prev => prev + 1);
      const isDone = await checkStatus();

      if (isDone || pollCount >= maxPollAttempts) {
        clearInterval(interval);
        if (pollCount >= maxPollAttempts && status === 'pending') {
          setStatus('expired');
          setError('Zahlung abgelaufen');
          if (onError) onError('Zahlung abgelaufen');
        }
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [status, autoCheckStatus, checkStatus, pollCount, maxPollAttempts, pollInterval, onError]);

  // Checkout abbrechen
  const handleCancel = async () => {
    if (checkoutData?.checkoutId) {
      try {
        await axios.delete(`/sumup/checkout/${checkoutData.checkoutId}?dojo_id=${dojoId}`);
      } catch (err) {
        console.error('Cancel error:', err);
      }
    }
    setStatus('idle');
    setCheckoutData(null);
    if (onCancel) onCancel();
  };

  // Nochmal versuchen
  const handleRetry = () => {
    setStatus('idle');
    setCheckoutData(null);
    setError(null);
    setPollCount(0);
    createCheckout();
  };

  // Zahlungslink öffnen
  const openPaymentLink = () => {
    if (checkoutData?.checkoutUrl) {
      window.open(checkoutData.checkoutUrl, '_blank');
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <CreditCard size={24} color="#00b5ad" />
        <span style={styles.title}>SumUp Kartenzahlung</span>
      </div>

      {/* Betrag */}
      <div style={styles.amountDisplay}>
        <span style={styles.amountLabel}>Betrag</span>
        <span style={styles.amountValue}>{parseFloat(amount).toFixed(2)} EUR</span>
      </div>

      {/* Status: Idle - Start Button */}
      {status === 'idle' && (
        <button style={styles.primaryButton} onClick={createCheckout}>
          <CreditCard size={20} />
          Kartenzahlung starten
        </button>
      )}

      {/* Status: Creating */}
      {status === 'creating' && (
        <div style={styles.statusBox}>
          <Loader2 size={32} style={styles.spinner} />
          <span style={styles.statusText}>Zahlung wird erstellt...</span>
        </div>
      )}

      {/* Status: Pending - Warten auf Zahlung */}
      {status === 'pending' && checkoutData && (
        <div style={styles.pendingBox}>
          {/* QR Code */}
          {showQRCode && checkoutData?.checkoutUrl && (
            <div style={styles.qrContainer}>
              <QRCodeSVG
                value={checkoutData.checkoutUrl}
                size={180}
                bgColor="#ffffff"
                fgColor="#000000"
                level="M"
              />
              <span style={styles.qrHint}>QR-Code scannen oder Link öffnen</span>
            </div>
          )}

          {/* Zahlungslink Button */}
          <button style={styles.linkButton} onClick={openPaymentLink}>
            <ExternalLink size={18} />
            Zahlungslink öffnen
          </button>

          {/* Status-Anzeige */}
          <div style={styles.waitingBox}>
            <Loader2 size={20} style={styles.smallSpinner} />
            <span>Warte auf Zahlung...</span>
          </div>

          {/* Manueller Status-Check */}
          <button style={styles.secondaryButton} onClick={checkStatus}>
            <RefreshCw size={16} />
            Status prüfen
          </button>

          {/* Abbrechen */}
          <button style={styles.cancelButton} onClick={handleCancel}>
            Abbrechen
          </button>
        </div>
      )}

      {/* Status: Paid - Erfolgreich */}
      {status === 'paid' && (
        <div style={styles.successBox}>
          <CheckCircle size={48} color="#22c55e" />
          <span style={styles.successText}>Zahlung erfolgreich!</span>
          {checkoutData?.transactionId && (
            <span style={styles.transactionId}>
              Transaktions-ID: {checkoutData.transactionId}
            </span>
          )}
        </div>
      )}

      {/* Status: Failed / Expired */}
      {(status === 'failed' || status === 'expired') && (
        <div style={styles.errorBox}>
          <XCircle size={48} color="#ef4444" />
          <span style={styles.errorText}>
            {status === 'expired' ? 'Zahlung abgelaufen' : 'Zahlung fehlgeschlagen'}
          </span>
          {error && <span style={styles.errorDetail}>{error}</span>}
          <button style={styles.retryButton} onClick={handleRetry}>
            <RefreshCw size={16} />
            Erneut versuchen
          </button>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(0, 181, 173, 0.3)',
    borderRadius: '12px',
    padding: '24px',
    maxWidth: '400px'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px'
  },
  title: {
    color: '#fff',
    fontSize: '18px',
    fontWeight: '600'
  },
  amountDisplay: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '8px',
    marginBottom: '20px'
  },
  amountLabel: {
    color: '#aaa',
    fontSize: '14px'
  },
  amountValue: {
    color: '#ffd700',
    fontSize: '24px',
    fontWeight: 'bold'
  },
  primaryButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '14px 20px',
    background: '#00b5ad',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  statusBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '24px'
  },
  spinner: {
    animation: 'spin 1s linear infinite',
    color: '#00b5ad'
  },
  smallSpinner: {
    animation: 'spin 1s linear infinite',
    color: '#00b5ad'
  },
  statusText: {
    color: '#aaa',
    fontSize: '14px'
  },
  pendingBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px'
  },
  qrContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '16px',
    background: '#fff',
    borderRadius: '12px'
  },
    qrHint: {
    color: '#666',
    fontSize: '12px',
    textAlign: 'center'
  },
  linkButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    background: 'rgba(0, 181, 173, 0.2)',
    border: '1px solid #00b5ad',
    borderRadius: '8px',
    color: '#00b5ad',
    fontSize: '14px',
    cursor: 'pointer'
  },
  waitingBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    color: '#aaa',
    fontSize: '14px'
  },
  secondaryButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 16px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    cursor: 'pointer'
  },
  cancelButton: {
    padding: '10px 16px',
    background: 'transparent',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    color: '#aaa',
    fontSize: '14px',
    cursor: 'pointer'
  },
  successBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '24px'
  },
  successText: {
    color: '#22c55e',
    fontSize: '18px',
    fontWeight: '600'
  },
  transactionId: {
    color: '#aaa',
    fontSize: '12px'
  },
  errorBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '24px'
  },
  errorText: {
    color: '#ef4444',
    fontSize: '18px',
    fontWeight: '600'
  },
  errorDetail: {
    color: '#aaa',
    fontSize: '14px',
    textAlign: 'center'
  },
  retryButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 20px',
    background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid #ef4444',
    borderRadius: '8px',
    color: '#ef4444',
    fontSize: '14px',
    cursor: 'pointer',
    marginTop: '8px'
  }
};

// CSS Keyframes für Spinner Animation (füge dies in deine CSS-Datei ein)
const spinKeyframes = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

// Füge Keyframes zum Document hinzu
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = spinKeyframes;
  document.head.appendChild(style);
}

export default SumUpCheckout;
