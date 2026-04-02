// ============================================================================
// MEMBER RECHNUNG CHECKOUT — Sichere Kreditkartenzahlung für Mitglieder
// PCI DSS: Kartendaten berühren niemals unseren Server (Stripe Elements)
// PSD2/SCA: 3D Secure wird automatisch ausgelöst wenn nötig
// DSGVO: Einwilligung vor dem Speichern von Zahlungsdaten
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import {
  CreditCard, CheckCircle, XCircle, Loader2, ArrowLeft,
  Shield, Lock, AlertCircle, Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import config from '../config/config.js';
import MemberHeader from './MemberHeader.jsx';
import '../styles/MemberRechnungCheckout.css';

// Stripe-Instanz — wird einmalig mit dem Dojo-Key initialisiert
// WICHTIG: loadStripe NUR von js.stripe.com laden (PCI DSS Requirement)
let stripePromise = null;
const getStripePromise = (publishableKey) => {
  if (!stripePromise && publishableKey) {
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
};

// ============================================================================
// Checkout-Formular (innerhalb Elements-Context)
// ============================================================================
const CheckoutForm = ({ rechnungId, betrag, rechnungsnummer, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [saveCard, setSaveCard] = useState(false);
  const [gdprConsent, setGdprConsent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    // Wenn Karte gespeichert werden soll, DSGVO-Einwilligung prüfen
    if (saveCard && !gdprConsent) {
      setError('Bitte bestätige die Datenschutzeinwilligung, um deine Karte zu speichern.');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Schritt 1: Formular validieren
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message);
        setProcessing(false);
        return;
      }

      // Schritt 2: Neuen PaymentIntent vom Server holen
      // Betrag wird IMMER serverseitig aus DB geladen — Frontend kann ihn nicht manipulieren
      const piRes = await fetchWithAuth(`${config.apiBaseUrl}/payment-provider/member/payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rechnung_id: rechnungId,
          save_card: saveCard,
          gdpr_consent: saveCard ? gdprConsent : false
        })
      });

      if (!piRes.ok) {
        const err = await piRes.json();
        setError(err.error || 'Zahlung konnte nicht gestartet werden.');
        setProcessing(false);
        return;
      }

      const { client_secret } = await piRes.json();

      // Schritt 3: Zahlung bestätigen (3DS wird automatisch ausgelöst wenn nötig)
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret: client_secret,
        confirmParams: {
          return_url: `${window.location.origin}/member/zahlung/${rechnungId}?status=success`
        },
        redirect: 'if_required' // Nur weiterleiten wenn 3DS oder Bank-Redirect nötig
      });

      if (confirmError) {
        if (confirmError.type === 'card_error') {
          setError(getCardErrorMessage(confirmError.code));
        } else {
          setError(confirmError.message);
        }
        setProcessing(false);
        return;
      }

      if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') {
        // Rechnung serverseitig als bezahlt markieren (mit Verifikation am Server)
        await fetchWithAuth(`${config.apiBaseUrl}/member-payments/rechnung/${rechnungId}/bezahlt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payment_intent_id: paymentIntent.id })
        });
        onSuccess(paymentIntent);
      }

    } catch (err) {
      setError('Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.');
      console.error('Checkout error:', err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mrc-form">
      {/* Stripe Payment Element — PCI DSS compliant, läuft in Stripe-iFrame */}
      <div className="mrc-stripe-element">
        <PaymentElement
          options={{
            layout: 'tabs',
            paymentMethodOrder: ['card'],
            defaultValues: {
              billingDetails: {
                address: { country: 'DE' }
              }
            },
            terms: { card: 'never' } // Wir zeigen die Hinweise selbst unten
          }}
        />
      </div>

      {/* Karte für zukünftige Zahlungen speichern */}
      <div className="mrc-save-card-section">
        <label className="mrc-checkbox-label">
          <input
            type="checkbox"
            checked={saveCard}
            onChange={e => setSaveCard(e.target.checked)}
            className="mrc-checkbox"
          />
          <span>Zahlungsmethode für zukünftige Zahlungen speichern</span>
        </label>

        {saveCard && (
          <div className="mrc-gdpr-block">
            <label className="mrc-checkbox-label mrc-gdpr-label">
              <input
                type="checkbox"
                checked={gdprConsent}
                onChange={e => setGdprConsent(e.target.checked)}
                className="mrc-checkbox"
                required
              />
              <span>
                Ich stimme zu, dass meine Zahlungsdaten (Kartenart, letzte 4 Ziffern,
                Ablaufdatum) bei unserem Zahlungsdienstleister Stripe gespeichert werden,
                um zukünftige Zahlungen zu erleichtern. Die Einwilligung kann jederzeit
                in den Zahlungseinstellungen widerrufen werden.{' '}
                <strong>Kartennummern werden niemals auf unseren Servern gespeichert</strong>{' '}
                (gemäß PCI DSS Standard).
              </span>
            </label>
          </div>
        )}
      </div>

      {error && (
        <div className="mrc-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        className="mrc-submit-btn"
      >
        {processing ? (
          <>
            <Loader2 className="mrc-spin" size={18} />
            Zahlung wird verarbeitet...
          </>
        ) : (
          <>
            <Lock size={18} />
            {betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} sicher bezahlen
          </>
        )}
      </button>

      {/* Rechtliche Hinweise */}
      <div className="mrc-legal">
        <div className="mrc-legal-item">
          <Shield size={14} />
          <span>SSL-verschlüsselt · PCI DSS Level 1 (Stripe) · PSD2/SCA-konform</span>
        </div>
        <div className="mrc-legal-item">
          <Info size={14} />
          <span>
            Deine Kartendaten werden direkt und verschlüsselt an Stripe übermittelt —
            sie berühren niemals unsere Server. Datenverarbeitung gem. Art. 6 Abs. 1 lit. b DSGVO
            (Vertragserfüllung).
          </span>
        </div>
      </div>
    </form>
  );
};

// Verständliche Fehlermeldungen für häufige Kartenfehler
const getCardErrorMessage = (code) => {
  const messages = {
    insufficient_funds: 'Unzureichendes Guthaben auf der Karte.',
    card_declined: 'Karte wurde abgelehnt. Bitte wende dich an deine Bank oder nutze eine andere Karte.',
    expired_card: 'Die Karte ist abgelaufen.',
    incorrect_cvc: 'Falscher Sicherheitscode (CVC).',
    incorrect_number: 'Falsche Kartennummer.',
    invalid_expiry_month: 'Ungültiger Ablaufmonat.',
    invalid_expiry_year: 'Ungültiges Ablaufjahr.',
    processing_error: 'Verarbeitungsfehler bei der Bank. Bitte versuche es erneut.',
    authentication_required: 'Deine Bank erfordert eine weitere Bestätigung (3D Secure).'
  };
  return messages[code] || 'Zahlung fehlgeschlagen. Bitte versuche es erneut oder kontaktiere deine Bank.';
};

// ============================================================================
// Haupt-Komponente
// ============================================================================
const MemberRechnungCheckout = () => {
  const { rechnungId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rechnung, setRechnung] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [publishableKey, setPublishableKey] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null); // 'success', 'processing'
  const [stripe, setStripe] = useState(null);

  // Rückleitung nach 3DS-Redirect
  useEffect(() => {
    const status = searchParams.get('status');
    const piId = searchParams.get('payment_intent');

    if (status === 'success' || (piId && status !== 'failed')) {
      setPaymentStatus('success');
      setLoading(false);
    }
  }, [searchParams]);

  // Rechnungsdaten laden
  const loadRechnung = useCallback(async () => {
    if (!rechnungId || paymentStatus) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/member-payments/rechnungen`);
      if (!res.ok) throw new Error('Fehler beim Laden');
      const data = await res.json();

      const found = data.rechnungen?.find(r => String(r.rechnung_id) === String(rechnungId));
      if (!found) {
        setError('Rechnung nicht gefunden oder bereits bezahlt.');
        setLoading(false);
        return;
      }

      setRechnung(found);

      // Publishable Key holen
      const statusRes = await fetchWithAuth(`${config.apiBaseUrl}/payment-provider/status`);
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        const pk = statusData?.stripe?.publishable_key;
        if (pk) {
          setPublishableKey(pk);
          setStripe(getStripePromise(pk));
        } else {
          setError('Online-Zahlung ist momentan nicht verfügbar.');
        }
      }

    } catch (err) {
      setError('Fehler beim Laden der Rechnungsdaten.');
    } finally {
      setLoading(false);
    }
  }, [rechnungId, paymentStatus]);

  useEffect(() => {
    loadRechnung();
  }, [loadRechnung]);

  // Erfolgreich bezahlt
  if (paymentStatus === 'success') {
    return (
      <div className="dashboard-container">
        <MemberHeader />
        <div className="mrc-wrapper">
          <div className="mrc-success">
            <CheckCircle size={64} className="mrc-success-icon" />
            <h2>Zahlung erfolgreich!</h2>
            <p>Deine Zahlung wurde erfolgreich verarbeitet.</p>
            {rechnung && (
              <div className="mrc-success-details">
                <span>Rechnung: <strong>{rechnung.rechnungsnummer}</strong></span>
                <span>Betrag: <strong>{parseFloat(rechnung.gesamtsumme || rechnung.betrag).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</strong></span>
              </div>
            )}
            <div className="mrc-success-actions">
              <button onClick={() => navigate('/member/payments')} className="mrc-btn-primary">
                Zu meinen Zahlungen
              </button>
              <button onClick={() => navigate('/member/dashboard')} className="mrc-btn-secondary">
                Zum Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="dashboard-container">
        <MemberHeader />
        <div className="mrc-wrapper">
          <div className="mrc-loading">
            <Loader2 className="mrc-spin" size={40} />
            <p>Lade Zahlungsformular...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <MemberHeader />
        <div className="mrc-wrapper">
          <div className="mrc-error-full">
            <XCircle size={48} />
            <h2>Fehler</h2>
            <p>{error}</p>
            <button onClick={() => navigate('/member/payments')} className="mrc-btn-secondary">
              <ArrowLeft size={16} /> Zurück
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!rechnung || !stripe) {
    return (
      <div className="dashboard-container">
        <MemberHeader />
        <div className="mrc-wrapper">
          <div className="mrc-error-full">
            <AlertCircle size={48} />
            <p>Zahlung nicht verfügbar.</p>
            <button onClick={() => navigate('/member/payments')} className="mrc-btn-secondary">
              <ArrowLeft size={16} /> Zurück
            </button>
          </div>
        </div>
      </div>
    );
  }

  const betrag = parseFloat(rechnung.gesamtsumme || rechnung.betrag || 0);

  const stripeOptions = {
    mode: 'payment',
    amount: Math.round(betrag * 100),
    currency: 'eur',
    paymentMethodTypes: ['card'],
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#FFD700',
        colorBackground: '#1e293b',
        colorText: '#f1f5f9',
        colorDanger: '#ef4444',
        fontFamily: 'Inter, system-ui, sans-serif',
        borderRadius: '8px',
        spacingUnit: '4px'
      },
      rules: {
        '.Input': {
          backgroundColor: '#334155',
          border: '1px solid #475569',
          color: '#f1f5f9'
        },
        '.Input:focus': {
          borderColor: '#FFD700',
          boxShadow: '0 0 0 2px rgba(255,215,0,0.2)'
        },
        '.Label': { color: '#94a3b8' },
        '.Tab': {
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          color: '#94a3b8'
        },
        '.Tab--selected': {
          backgroundColor: '#334155',
          borderColor: '#FFD700',
          color: '#f1f5f9'
        }
      }
    },
    locale: 'de'
  };

  return (
    <div className="dashboard-container">
      <MemberHeader />
      <div className="mrc-wrapper">
        <div className="mrc-container">
          {/* Header */}
          <div className="mrc-header">
            <button onClick={() => navigate('/member/payments')} className="mrc-back-btn">
              <ArrowLeft size={18} /> Zurück
            </button>
            <h1>
              <CreditCard size={24} />
              Rechnung bezahlen
            </h1>
          </div>

          <div className="mrc-layout">
            {/* Rechnungsdetails */}
            <div className="mrc-invoice-card">
              <h2>Rechnungsdetails</h2>
              <div className="mrc-invoice-row">
                <span>Rechnungsnummer</span>
                <strong>{rechnung.rechnungsnummer}</strong>
              </div>
              <div className="mrc-invoice-row">
                <span>Art</span>
                <span>{rechnung.art === 'mitgliedsbeitrag' ? 'Mitgliedsbeitrag' :
                       rechnung.art === 'pruefungsgebuehr' ? 'Prüfungsgebühr' :
                       rechnung.art === 'kursgebuehr' ? 'Kursgebühr' :
                       rechnung.art === 'ausruestung' ? 'Ausrüstung' : rechnung.art}</span>
              </div>
              {rechnung.beschreibung && (
                <div className="mrc-invoice-row">
                  <span>Beschreibung</span>
                  <span>{rechnung.beschreibung}</span>
                </div>
              )}
              <div className="mrc-invoice-row">
                <span>Fällig am</span>
                <span className={new Date(rechnung.faelligkeitsdatum) < new Date() ? 'mrc-overdue' : ''}>
                  {new Date(rechnung.faelligkeitsdatum).toLocaleDateString('de-DE')}
                  {new Date(rechnung.faelligkeitsdatum) < new Date() && ' (überfällig)'}
                </span>
              </div>
              <div className="mrc-invoice-total">
                <span>Gesamtbetrag</span>
                <strong className="mrc-total-amount">
                  {betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                </strong>
              </div>

              {/* Sicherheits-Badges */}
              <div className="mrc-security-badges">
                <div className="mrc-badge">
                  <Shield size={14} />
                  <span>256-Bit SSL</span>
                </div>
                <div className="mrc-badge">
                  <Lock size={14} />
                  <span>PCI DSS</span>
                </div>
                <div className="mrc-badge">
                  <CheckCircle size={14} />
                  <span>3D Secure</span>
                </div>
              </div>
            </div>

            {/* Checkout-Formular */}
            <div className="mrc-checkout-card">
              <h2>Zahlungsmethode</h2>
              <Elements stripe={stripe} options={stripeOptions}>
                <CheckoutForm
                  rechnungId={parseInt(rechnungId)}
                  betrag={betrag}
                  rechnungsnummer={rechnung.rechnungsnummer}
                  onSuccess={() => setPaymentStatus('success')}
                />
              </Elements>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberRechnungCheckout;
