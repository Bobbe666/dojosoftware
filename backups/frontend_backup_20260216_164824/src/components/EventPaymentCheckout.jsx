// ============================================================================
// EVENT PAYMENT CHECKOUT - Zahlungs-Checkout für Event-Teilnahmegebühren
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import config from '../config/config';
import {
  CreditCard, CheckCircle, XCircle, Loader2, ArrowLeft,
  Calendar, MapPin, Clock, Users, Shield, Lock, AlertCircle, Smartphone
} from 'lucide-react';
import StripeCheckout from './StripeCheckout';
import PayPalCheckout from './PayPalCheckout';
import SumUpCheckout from './SumUpCheckout';
import '../styles/PaymentCheckout.css';

const EventPaymentCheckout = () => {
  const { eventId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [event, setEvent] = useState(null);
  const [anmeldungId, setAnmeldungId] = useState(null);
  const [mitgliedId, setMitgliedId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [publishableKey, setPublishableKey] = useState(null);

  // Payment Provider Status
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [paypalEnabled, setPaypalEnabled] = useState(false);
  const [sumupEnabled, setSumupEnabled] = useState(false);
  const [dojoId, setDojoId] = useState(null);

  useEffect(() => {
    loadData();
  }, [eventId]);

  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'success') {
      setPaymentStatus('success');
    } else if (status === 'cancelled') {
      setPaymentStatus('cancelled');
    }

    // Anmeldung-ID aus URL
    const anmeldung = searchParams.get('anmeldung');
    if (anmeldung) {
      setAnmeldungId(parseInt(anmeldung));
    }
  }, [searchParams]);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      // Lade Event-Daten
      const [eventRes, configRes] = await Promise.all([
        axios.get(`${config.apiBaseUrl}/events/${eventId}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${config.apiBaseUrl}/integrations/status`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (eventRes.data.success || eventRes.data.event) {
        setEvent(eventRes.data.event || eventRes.data);
      } else {
        setError('Event nicht gefunden');
        return;
      }

      // Mitglied-ID ermitteln
      if (user?.mitglied_id) {
        setMitgliedId(user.mitglied_id);
      } else if (user?.email) {
        // Mitglied per Email suchen
        const memberRes = await axios.get(`${config.apiBaseUrl}/mitglieder/by-email/${user.email}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (memberRes.data?.mitglied_id) {
          setMitgliedId(memberRes.data.mitglied_id);
        }
      }

      // Prüfe Payment Provider
      const integrationStatus = configRes.data;
      setStripeEnabled(integrationStatus?.stripe?.configured || false);
      setPaypalEnabled(integrationStatus?.paypal?.configured || false);
      setSumupEnabled(integrationStatus?.sumup?.configured && integrationStatus?.sumup?.active || false);

      // Dojo ID für SumUp speichern
      if (eventRes.data.event?.dojo_id || eventRes.data.dojo_id) {
        setDojoId(eventRes.data.event?.dojo_id || eventRes.data.dojo_id);
      }

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

  // Stripe PaymentIntent erstellen
  const createPaymentIntent = async () => {
    if (!mitgliedId) {
      setError('Mitglied nicht gefunden');
      return;
    }

    try {
      const response = await axios.post(
        `${config.apiBaseUrl}/events/${eventId}/create-payment-intent`,
        {
          mitglied_id: mitgliedId,
          anmeldung_id: anmeldungId
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setClientSecret(response.data.clientSecret);
        setPublishableKey(response.data.publishableKey);
      } else {
        setError(response.data.error || 'Fehler beim Erstellen der Zahlung');
      }
    } catch (err) {
      console.error('PaymentIntent Error:', err);
      setError(err.response?.data?.error || 'Zahlungsfehler');
    }
  };

  useEffect(() => {
    if (paymentMethod === 'stripe' && event && mitgliedId && !clientSecret) {
      createPaymentIntent();
    }
  }, [paymentMethod, event, mitgliedId]);

  // Zahlungserfolg Handler
  const handlePaymentSuccess = async (paymentData) => {
    setPaymentStatus('success');

    try {
      await axios.post(`${config.apiBaseUrl}/events/${eventId}/payment-success`, {
        mitglied_id: mitgliedId,
        anmeldung_id: anmeldungId,
        payment_intent_id: paymentData?.id || paymentData?.paymentIntent?.id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.error('Fehler beim Aktualisieren:', err);
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
          <p>Lade Event-Daten...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error && !event) {
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
          <p>Deine Teilnahme am Event ist bestätigt.</p>
          <div className="success-details">
            <h3>{event?.titel}</h3>
            <p><Calendar size={16} /> {new Date(event?.datum).toLocaleDateString('de-DE', {
              weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
            })}</p>
            {event?.ort && <p><MapPin size={16} /> {event.ort}</p>}
          </div>
          <button onClick={() => navigate('/member/events')} className="btn-primary">
            Zurück zu meinen Events
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
          <p>Du kannst die Zahlung jederzeit erneut versuchen.</p>
          <button onClick={() => setPaymentStatus(null)} className="btn-primary">
            Erneut versuchen
          </button>
          <button onClick={() => navigate('/member/events')} className="btn-secondary">
            Zurück zu Events
          </button>
        </div>
      </div>
    );
  }

  // No Payment Providers
  if (!stripeEnabled && !paypalEnabled && !sumupEnabled) {
    return (
      <div className="payment-checkout">
        <div className="payment-error-full">
          <AlertCircle size={48} />
          <h2>Zahlung nicht möglich</h2>
          <p>Momentan ist keine Online-Zahlung verfügbar. Bitte kontaktiere das Dojo.</p>
          <button onClick={() => navigate(-1)} className="btn-back">
            <ArrowLeft size={16} />
            Zurück
          </button>
        </div>
      </div>
    );
  }

  const gebuehr = parseFloat(event?.teilnahmegebuehr || 0);

  return (
    <div className="payment-checkout">
      <div className="payment-container">
        {/* Header */}
        <div className="payment-header">
          <button onClick={() => navigate(-1)} className="btn-back-icon">
            <ArrowLeft size={20} />
          </button>
          <h1>Event-Zahlung</h1>
        </div>

        {/* Event Details */}
        <div className="payment-details-card">
          <h2>{event?.titel}</h2>
          <div className="event-meta">
            <span><Calendar size={16} /> {new Date(event?.datum).toLocaleDateString('de-DE')}</span>
            {event?.uhrzeit_beginn && <span><Clock size={16} /> {event.uhrzeit_beginn.substring(0, 5)} Uhr</span>}
            {event?.ort && <span><MapPin size={16} /> {event.ort}</span>}
          </div>
          <div className="payment-amount">
            <span>Teilnahmegebühr:</span>
            <strong>{gebuehr.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</strong>
          </div>
        </div>

        {error && (
          <div className="payment-error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Payment Method Tabs */}
        {([stripeEnabled, paypalEnabled, sumupEnabled].filter(Boolean).length > 1) && (
          <div className="payment-tabs">
            {stripeEnabled && (
              <button
                className={`payment-tab ${paymentMethod === 'stripe' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('stripe')}
              >
                <CreditCard size={18} />
                Kreditkarte / SEPA
              </button>
            )}
            {paypalEnabled && (
              <button
                className={`payment-tab ${paymentMethod === 'paypal' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('paypal')}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M20.067 8.478c.492.88.556 2.014.3 3.327-.74 3.806-3.276 5.12-6.514 5.12h-.5a.805.805 0 0 0-.794.68l-.04.22-.63 3.993-.032.17a.804.804 0 0 1-.794.679H7.72a.483.483 0 0 1-.477-.558L7.418 21h1.518l.95-6.02h1.385c4.678 0 7.75-2.203 8.796-6.502z"/>
                </svg>
                PayPal
              </button>
            )}
            {sumupEnabled && (
              <button
                className={`payment-tab ${paymentMethod === 'sumup' ? 'active' : ''}`}
                onClick={() => setPaymentMethod('sumup')}
              >
                <Smartphone size={18} />
                SumUp
              </button>
            )}
          </div>
        )}

        {/* Stripe Payment Form */}
        {paymentMethod === 'stripe' && stripeEnabled && (
          <div className="payment-form-container">
            {clientSecret && publishableKey ? (
              <StripeCheckout
                clientSecret={clientSecret}
                publishableKey={publishableKey}
                amount={gebuehr}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
              />
            ) : (
              <div className="payment-loading-small">
                <Loader2 className="spin" size={24} />
                <span>Lade Zahlungsformular...</span>
              </div>
            )}
          </div>
        )}

        {/* PayPal Payment */}
        {paymentMethod === 'paypal' && paypalEnabled && (
          <div className="payment-form-container">
            <PayPalCheckout
              amount={gebuehr}
              description={`Event: ${event?.titel}`}
              onSuccess={handlePaymentSuccess}
              onError={handlePaymentError}
            />
          </div>
        )}

        {/* SumUp Payment */}
        {paymentMethod === 'sumup' && sumupEnabled && (
          <div className="payment-form-container">
            <SumUpCheckout
              amount={gebuehr}
              description={`Event: ${event?.titel}`}
              dojoId={dojoId}
              eventAnmeldungId={anmeldungId}
              mitgliedId={mitgliedId}
              zahlungstyp="event"
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
          </div>
        )}

        {/* Security Note */}
        <div className="payment-security">
          <Shield size={16} />
          <span>Sichere Zahlung - SSL-verschlüsselt</span>
          <Lock size={16} />
        </div>
      </div>
    </div>
  );
};

export default EventPaymentCheckout;
