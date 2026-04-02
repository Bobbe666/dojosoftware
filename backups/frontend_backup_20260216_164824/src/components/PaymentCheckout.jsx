// ============================================================================
// PAYMENT CHECKOUT - Zahlungs-Checkout für Rechnungen
// ============================================================================
// Unterstützt: Stripe (Kreditkarte, SEPA), PayPal
// Wird aufgerufen mit einer Rechnungs-ID

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import config from '../config/config';
import {
  CreditCard, CheckCircle, XCircle, Loader2, ArrowLeft,
  Building2, AlertCircle, Shield, Lock, Smartphone
} from 'lucide-react';
import StripeCheckout from './StripeCheckout';
import PayPalCheckout from './PayPalCheckout';
import SumUpCheckout from './SumUpCheckout';
import '../styles/PaymentCheckout.css';

const PaymentCheckout = () => {
  const { rechnungId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rechnung, setRechnung] = useState(null);
  const [dojoConfig, setDojoConfig] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null); // 'success', 'error', 'processing'

  // Payment Provider Status
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [paypalEnabled, setPaypalEnabled] = useState(false);
  const [sumupEnabled, setSumupEnabled] = useState(false);
  const [dojoId, setDojoId] = useState(null);

  // Lade Rechnungsdaten und Payment-Konfiguration
  useEffect(() => {
    loadData();
  }, [rechnungId]);

  // Check URL params für Rückleitung von PayPal
  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'success') {
      setPaymentStatus('success');
    } else if (status === 'cancelled') {
      setPaymentStatus('cancelled');
    }
  }, [searchParams]);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      // Lade Rechnung und Payment-Konfiguration parallel
      const [rechnungRes, configRes] = await Promise.all([
        axios.get(`${config.apiBaseUrl}/rechnungen/${rechnungId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${config.apiBaseUrl}/integrations/status`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (rechnungRes.data.success) {
        setRechnung(rechnungRes.data.rechnung);
      } else {
        setError('Rechnung nicht gefunden');
        return;
      }

      // Prüfe welche Payment Provider aktiv sind
      const integrationStatus = configRes.data;
      setStripeEnabled(integrationStatus?.stripe?.configured || false);
      setPaypalEnabled(integrationStatus?.paypal?.configured || false);
      setSumupEnabled(integrationStatus?.sumup?.configured && integrationStatus?.sumup?.active || false);

      // Dojo ID für SumUp speichern
      if (rechnungRes.data.rechnung?.dojo_id) {
        setDojoId(rechnungRes.data.rechnung.dojo_id);
      }

      // Setze Standard-Zahlungsmethode
      if (integrationStatus?.stripe?.configured) {
        setPaymentMethod('stripe');
      } else if (integrationStatus?.paypal?.configured) {
        setPaymentMethod('paypal');
      } else if (integrationStatus?.sumup?.configured && integrationStatus?.sumup?.active) {
        setPaymentMethod('sumup');
      }

    } catch (err) {
      console.error('Fehler beim Laden:', err);
      setError(err.response?.data?.error || 'Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  // Zahlungserfolg Handler
  const handlePaymentSuccess = async (paymentData) => {
    setPaymentStatus('success');

    // Optional: Rechnung als bezahlt markieren
    try {
      const zahlungsart = paymentMethod === 'stripe' ? 'kreditkarte' : paymentMethod === 'sumup' ? 'sumup' : 'paypal';
      await axios.post(`${config.apiBaseUrl}/rechnungen/${rechnungId}/zahlung`, {
        betrag: rechnung.gesamtbetrag,
        zahlungsart: zahlungsart,
        referenz: paymentData.id || paymentData.orderId || paymentData.transactionId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.error('Fehler beim Aktualisieren der Rechnung:', err);
    }
  };

  // Zahlungsfehler Handler
  const handlePaymentError = (error) => {
    console.error('Payment Error:', error);
    setPaymentStatus('error');
    setError(error.message || 'Zahlung fehlgeschlagen');
  };

  // Loading State
  if (loading) {
    return (
      <div className="payment-checkout">
        <div className="payment-loading">
          <Loader2 className="spin" size={48} />
          <p>Lade Zahlungsdaten...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error && !rechnung) {
    return (
      <div className="payment-checkout">
        <div className="payment-error-full">
          <XCircle size={48} />
          <h2>Fehler</h2>
          <p>{error}</p>
          <button onClick={() => navigate(-1)} className="btn-back">
            <ArrowLeft size={16} />
            Zurück
          </button>
        </div>
      </div>
    );
  }

  // Success State
  if (paymentStatus === 'success') {
    return (
      <div className="payment-checkout">
        <div className="payment-success">
          <CheckCircle size={64} />
          <h2>Zahlung erfolgreich!</h2>
          <p>Ihre Zahlung wurde erfolgreich verarbeitet.</p>
          <div className="payment-success-details">
            <p><strong>Rechnungsnummer:</strong> {rechnung?.rechnungsnummer}</p>
            <p><strong>Betrag:</strong> {parseFloat(rechnung?.gesamtbetrag || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</p>
          </div>
          <button onClick={() => navigate('/rechnungen')} className="btn-primary">
            Zu meinen Rechnungen
          </button>
        </div>
      </div>
    );
  }

  // Cancelled State
  if (paymentStatus === 'cancelled') {
    return (
      <div className="payment-checkout">
        <div className="payment-cancelled">
          <AlertCircle size={64} />
          <h2>Zahlung abgebrochen</h2>
          <p>Sie haben die Zahlung abgebrochen.</p>
          <div className="payment-actions">
            <button onClick={() => setPaymentStatus(null)} className="btn-primary">
              Erneut versuchen
            </button>
            <button onClick={() => navigate('/rechnungen')} className="btn-secondary">
              Zurück zu Rechnungen
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Keine Payment Provider konfiguriert
  if (!stripeEnabled && !paypalEnabled && !sumupEnabled) {
    return (
      <div className="payment-checkout">
        <div className="payment-not-available">
          <AlertCircle size={48} />
          <h2>Online-Zahlung nicht verfügbar</h2>
          <p>Derzeit sind keine Online-Zahlungsmethoden konfiguriert.</p>
          <p>Bitte kontaktieren Sie uns für alternative Zahlungsmöglichkeiten.</p>
          <button onClick={() => navigate(-1)} className="btn-back">
            <ArrowLeft size={16} />
            Zurück
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-checkout">
      {/* Header */}
      <div className="payment-header">
        <button onClick={() => navigate(-1)} className="btn-back-link">
          <ArrowLeft size={18} />
          Zurück
        </button>
        <h1>
          <CreditCard size={28} />
          Rechnung bezahlen
        </h1>
      </div>

      <div className="payment-content">
        {/* Rechnungsübersicht */}
        <div className="payment-invoice-summary">
          <h2>Rechnungsdetails</h2>
          <div className="invoice-info">
            <div className="invoice-row">
              <span>Rechnungsnummer:</span>
              <strong>{rechnung?.rechnungsnummer}</strong>
            </div>
            <div className="invoice-row">
              <span>Datum:</span>
              <span>{new Date(rechnung?.rechnungsdatum).toLocaleDateString('de-DE')}</span>
            </div>
            {rechnung?.positionen?.map((pos, idx) => (
              <div key={idx} className="invoice-position">
                <span>{pos.beschreibung}</span>
                <span>{parseFloat(pos.betrag).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
              </div>
            ))}
            <div className="invoice-total">
              <span>Gesamtbetrag:</span>
              <strong>{parseFloat(rechnung?.gesamtbetrag || 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</strong>
            </div>
          </div>
        </div>

        {/* Zahlungsmethode wählen */}
        <div className="payment-methods">
          <h2>Zahlungsmethode wählen</h2>

          <div className="payment-method-tabs">
            {stripeEnabled && (
              <button
                className={`method-tab ${paymentMethod === 'stripe' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('stripe')}
              >
                <CreditCard size={20} />
                <span>Kreditkarte / SEPA</span>
              </button>
            )}
            {paypalEnabled && (
              <button
                className={`method-tab ${paymentMethod === 'paypal' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('paypal')}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.77.77 0 0 1 .757-.629h6.774c2.236 0 3.833.585 4.744 1.74.873 1.106 1.096 2.58.661 4.388-.04.17-.078.326-.124.493a8.591 8.591 0 0 1-.266.89c-.93 2.753-3.16 4.148-6.632 4.148h-1.58a.953.953 0 0 0-.94.804l-.897 5.683-.163.1z"/>
                </svg>
                <span>PayPal</span>
              </button>
            )}
            {sumupEnabled && (
              <button
                className={`method-tab ${paymentMethod === 'sumup' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('sumup')}
              >
                <Smartphone size={20} />
                <span>SumUp</span>
              </button>
            )}
          </div>

          {/* Payment Form */}
          <div className="payment-form-container">
            {paymentMethod === 'stripe' && stripeEnabled && (
              <StripeCheckout
                amount={parseFloat(rechnung?.gesamtbetrag || 0)}
                currency="eur"
                rechnungId={rechnungId}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
              />
            )}

            {paymentMethod === 'paypal' && paypalEnabled && (
              <PayPalCheckout
                amount={parseFloat(rechnung?.gesamtbetrag || 0)}
                currency="EUR"
                rechnungId={rechnungId}
                description={`Rechnung ${rechnung?.rechnungsnummer}`}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
              />
            )}

            {paymentMethod === 'sumup' && sumupEnabled && (
              <SumUpCheckout
                amount={parseFloat(rechnung?.gesamtbetrag || 0)}
                description={`Rechnung ${rechnung?.rechnungsnummer}`}
                dojoId={dojoId}
                rechnungId={rechnungId}
                zahlungstyp="rechnung"
                onSuccess={(result) => {
                  handlePaymentSuccess({
                    id: result.checkoutId,
                    transactionId: result.transactionId
                  });
                }}
                onError={(error) => {
                  handlePaymentError({ message: error });
                }}
              />
            )}
          </div>
        </div>

        {/* Sicherheitshinweise */}
        <div className="payment-security">
          <Lock size={16} />
          <span>Sichere Verbindung - Ihre Daten werden verschlüsselt übertragen</span>
        </div>

        {/* Error Anzeige */}
        {error && (
          <div className="payment-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentCheckout;
