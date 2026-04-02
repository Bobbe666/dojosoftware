// ============================================================================
// STRIPE CHECKOUT - Stripe Zahlungsformular
// ============================================================================
// Verwendet Stripe Elements für sichere Kreditkarten-/SEPA-Eingabe

import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import config from '../config/config';
import { Loader2, CreditCard, AlertCircle } from 'lucide-react';

// Stripe Promise - wird mit dem Public Key initialisiert
let stripePromise = null;

const getStripePromise = async (token) => {
  if (!stripePromise) {
    try {
      // Hole den Stripe Public Key vom Backend
      const res = await axios.get(`${config.apiBaseUrl}/payment-provider/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const publishableKey = res.data?.stripe?.publishable_key;

      if (publishableKey) {
        stripePromise = loadStripe(publishableKey);
      } else {
        console.error('Stripe publishable key nicht gefunden');
        return null;
      }
    } catch (err) {
      console.error('Fehler beim Laden des Stripe Keys:', err);
      return null;
    }
  }
  return stripePromise;
};

// Stripe Checkout Form Komponente
const StripeCheckoutForm = ({ amount, currency, rechnungId, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const { error: submitError } = await elements.submit();

      if (submitError) {
        setError(submitError.message);
        setProcessing(false);
        return;
      }

      // Bestätige die Zahlung
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/zahlung/${rechnungId}?status=success`,
        },
        redirect: 'if_required'
      });

      if (confirmError) {
        setError(confirmError.message);
        onError?.(confirmError);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess?.({ id: paymentIntent.id, status: paymentIntent.status });
      }
    } catch (err) {
      console.error('Stripe Error:', err);
      setError(err.message);
      onError?.(err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="stripe-form">
      <div className="stripe-element-container">
        <PaymentElement
          options={{
            layout: 'tabs',
            paymentMethodOrder: ['card', 'sepa_debit'],
            defaultValues: {
              billingDetails: {
                address: {
                  country: 'DE'
                }
              }
            }
          }}
        />
      </div>

      {error && (
        <div className="stripe-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        className="stripe-submit-btn"
      >
        {processing ? (
          <>
            <Loader2 className="spin" size={18} />
            Wird verarbeitet...
          </>
        ) : (
          <>
            <CreditCard size={18} />
            {amount.toLocaleString('de-DE', { style: 'currency', currency: currency.toUpperCase() })} bezahlen
          </>
        )}
      </button>
    </form>
  );
};

// Wrapper Komponente die Stripe Elements bereitstellt
const StripeCheckout = ({ amount, currency = 'eur', rechnungId, onSuccess, onError }) => {
  const { token } = useAuth();
  const [clientSecret, setClientSecret] = useState(null);
  const [stripeReady, setStripeReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stripe, setStripe] = useState(null);

  useEffect(() => {
    initStripe();
  }, []);

  const initStripe = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Lade Stripe
      const stripeInstance = await getStripePromise(token);

      if (!stripeInstance) {
        setError('Stripe konnte nicht initialisiert werden. Bitte prüfen Sie die Konfiguration.');
        setLoading(false);
        return;
      }

      setStripe(stripeInstance);

      // 2. Erstelle Payment Intent
      const res = await axios.post(`${config.apiBaseUrl}/payment-provider/payment-intent`, {
        amount: Math.round(amount * 100), // Stripe erwartet Cents
        currency: currency,
        rechnung_id: rechnungId,
        description: `Rechnung #${rechnungId}`
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.client_secret) {
        setClientSecret(res.data.client_secret);
        setStripeReady(true);
      } else {
        setError('Payment Intent konnte nicht erstellt werden');
      }

    } catch (err) {
      console.error('Stripe Init Error:', err);
      setError(err.response?.data?.error || 'Fehler beim Initialisieren der Zahlung');
      onError?.(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="stripe-loading">
        <Loader2 className="spin" size={32} />
        <p>Zahlungsformular wird geladen...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stripe-init-error">
        <AlertCircle size={24} />
        <p>{error}</p>
        <button onClick={initStripe} className="btn-retry">
          Erneut versuchen
        </button>
      </div>
    );
  }

  if (!stripeReady || !clientSecret || !stripe) {
    return (
      <div className="stripe-not-ready">
        <AlertCircle size={24} />
        <p>Stripe Checkout ist nicht verfügbar</p>
      </div>
    );
  }

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#FFD700',
        colorBackground: '#1e293b',
        colorText: '#ffffff',
        colorDanger: '#ef4444',
        fontFamily: 'Inter, system-ui, sans-serif',
        borderRadius: '8px'
      },
      rules: {
        '.Input': {
          backgroundColor: '#334155',
          border: '1px solid #475569',
          color: '#ffffff'
        },
        '.Input:focus': {
          borderColor: '#FFD700',
          boxShadow: '0 0 0 2px rgba(255, 215, 0, 0.2)'
        },
        '.Label': {
          color: '#94a3b8'
        },
        '.Tab': {
          backgroundColor: '#1e293b',
          border: '1px solid #334155',
          color: '#94a3b8'
        },
        '.Tab--selected': {
          backgroundColor: '#334155',
          borderColor: '#FFD700',
          color: '#ffffff'
        },
        '.Tab:hover': {
          backgroundColor: '#334155'
        }
      }
    },
    locale: 'de'
  };

  return (
    <Elements stripe={stripe} options={options}>
      <StripeCheckoutForm
        amount={amount}
        currency={currency}
        rechnungId={rechnungId}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  );
};

export default StripeCheckout;
