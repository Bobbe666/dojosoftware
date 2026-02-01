// ============================================================================
// PAYPAL CHECKOUT - PayPal Zahlungsbuttons
// ============================================================================
// Verwendet PayPal React SDK für sichere Zahlungen

import React, { useState, useEffect } from 'react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import config from '../config/config';
import { Loader2, AlertCircle } from 'lucide-react';

const PayPalCheckout = ({ amount, currency = 'EUR', rechnungId, description, onSuccess, onError }) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clientId, setClientId] = useState(null);
  const [sandbox, setSandbox] = useState(true);

  useEffect(() => {
    loadPayPalConfig();
  }, []);

  const loadPayPalConfig = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await axios.get(`${config.apiBaseUrl}/integrations/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.paypal?.configured && res.data?.paypal?.client_id) {
        setClientId(res.data.paypal.client_id);
        setSandbox(res.data.paypal.sandbox !== false);
      } else {
        setError('PayPal ist nicht konfiguriert');
      }
    } catch (err) {
      console.error('PayPal Config Error:', err);
      setError('Fehler beim Laden der PayPal-Konfiguration');
    } finally {
      setLoading(false);
    }
  };

  // Order erstellen
  const createOrder = async () => {
    try {
      const res = await axios.post(`${config.apiBaseUrl}/integrations/paypal/create-order`, {
        amount: amount,
        currency: currency,
        rechnung_id: rechnungId,
        description: description || `Zahlung für Rechnung #${rechnungId}`
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.order_id) {
        return res.data.order_id;
      } else {
        throw new Error('Keine Order-ID erhalten');
      }
    } catch (err) {
      console.error('Create Order Error:', err);
      onError?.(err);
      throw err;
    }
  };

  // Order abschließen
  const onApprove = async (data) => {
    try {
      const res = await axios.post(`${config.apiBaseUrl}/integrations/paypal/capture-order/${data.orderID}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        onSuccess?.({
          orderId: data.orderID,
          status: 'completed',
          details: res.data
        });
      } else {
        throw new Error(res.data?.error || 'Zahlung konnte nicht abgeschlossen werden');
      }
    } catch (err) {
      console.error('Capture Order Error:', err);
      onError?.(err);
    }
  };

  // Abbruch
  const onCancel = () => {
    console.log('PayPal Zahlung abgebrochen');
    // Optional: Callback an Parent
  };

  // Fehler
  const handleError = (err) => {
    console.error('PayPal Error:', err);
    setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
    onError?.(err);
  };

  if (loading) {
    return (
      <div className="paypal-loading">
        <Loader2 className="spin" size={32} />
        <p>PayPal wird geladen...</p>
      </div>
    );
  }

  if (error || !clientId) {
    return (
      <div className="paypal-error">
        <AlertCircle size={24} />
        <p>{error || 'PayPal ist nicht verfügbar'}</p>
        <button onClick={loadPayPalConfig} className="btn-retry">
          Erneut versuchen
        </button>
      </div>
    );
  }

  const initialOptions = {
    'client-id': clientId,
    currency: currency,
    intent: 'capture',
    locale: 'de_DE',
    'disable-funding': 'credit,card', // Nur PayPal-Konto, keine Kreditkarte über PayPal
  };

  return (
    <div className="paypal-checkout">
      <PayPalScriptProvider options={initialOptions}>
        <div className="paypal-amount-info">
          <p>Zahlungsbetrag:</p>
          <strong>{amount.toLocaleString('de-DE', { style: 'currency', currency: currency })}</strong>
        </div>

        <div className="paypal-buttons-container">
          <PayPalButtons
            style={{
              layout: 'vertical',
              color: 'gold',
              shape: 'rect',
              label: 'pay',
              height: 45
            }}
            createOrder={createOrder}
            onApprove={onApprove}
            onCancel={onCancel}
            onError={handleError}
            forceReRender={[amount, currency]}
          />
        </div>

        <div className="paypal-info">
          <p>Sie werden zu PayPal weitergeleitet, um die Zahlung abzuschließen.</p>
        </div>

        {sandbox && (
          <div className="paypal-sandbox-notice">
            <AlertCircle size={14} />
            <span>Sandbox-Modus aktiv (Testumgebung)</span>
          </div>
        )}
      </PayPalScriptProvider>
    </div>
  );
};

export default PayPalCheckout;
