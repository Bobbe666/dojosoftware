import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useCart } from './useCart';
import '../../styles/PublicShop.css';

export default function PublicShopCheckout() {
  const { dojoId } = useParams();
  const [einstellungen, setEinstellungen] = useState(null);
  const [loading, setLoading] = useState(true);
  const { cart, getCartTotal, clearCart } = useCart(dojoId);

  useEffect(() => {
    axios.get(`/shop/public/${dojoId}/einstellungen`)
      .then(r => setEinstellungen(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dojoId]);

  if (loading) return <div className="public-shop-loading"><div className="public-shop-spinner" /></div>;
  if (!einstellungen) return <div className="public-shop-error">Shop nicht gefunden</div>;
  if (cart.length === 0) return (
    <div className="public-shop public-shop-warenkorb-empty">
      <h2>Warenkorb ist leer</h2>
      <a href={`/shop/${dojoId}`}>Zum Shop</a>
    </div>
  );

  const totals = getCartTotal(einstellungen.versandkostenfrei_ab_cent, einstellungen.standard_versandkosten_cent);
  const stripePromise = einstellungen.stripe_publishable_key
    ? loadStripe(einstellungen.stripe_publishable_key)
    : null;

  return (
    <div className="public-shop">
      <header className="public-shop-header">
        <div className="public-shop-header-inner">
          <a href={`/shop/${dojoId}/warenkorb`} className="public-shop-back">← Zurück zum Warenkorb</a>
          <h1>Kasse</h1>
        </div>
      </header>
      <div className="public-shop-checkout-layout">
        {stripePromise ? (
          <Elements stripe={stripePromise}>
            <CheckoutForm
              dojoId={dojoId}
              einstellungen={einstellungen}
              cart={cart}
              totals={totals}
              clearCart={clearCart}
            />
          </Elements>
        ) : (
          <CheckoutForm
            dojoId={dojoId}
            einstellungen={einstellungen}
            cart={cart}
            totals={totals}
            clearCart={clearCart}
          />
        )}
      </div>
    </div>
  );
}

function CheckoutForm({ dojoId, einstellungen, cart, totals, clearCart }) {
  const navigate = useNavigate();
  const stripe = useStripe();
  const elements = useElements();

  const [form, setForm] = useState({
    vorname: '', nachname: '', email: '', strasse: '', plz: '', ort: '',
    land: 'Deutschland', zahlungsart: 'rechnung', kundennotiz: ''
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState('');

  const hasStripe = !!einstellungen.stripe_publishable_key;
  const hasRechnung = einstellungen.rechnung_erlaubt;

  const formatEur = (cent) => `${(cent / 100).toFixed(2)} €`;

  const validate = () => {
    const e = {};
    if (!form.vorname.trim()) e.vorname = 'Pflichtfeld';
    if (!form.nachname.trim()) e.nachname = 'Pflichtfeld';
    if (!form.email.trim() || !form.email.includes('@')) e.email = 'Gültige E-Mail erforderlich';
    if (!form.strasse.trim()) e.strasse = 'Pflichtfeld';
    if (!form.plz.trim()) e.plz = 'Pflichtfeld';
    if (!form.ort.trim()) e.ort = 'Pflichtfeld';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setGlobalError('');

    try {
      const positionen = cart.map(item => ({
        produkt_id: item.produkt_id,
        menge: item.menge,
        optionen: item.optionen || {},
        mitglied_id: item.mitglied_id || null,
        personalisierung: item.personalisierung || null
      }));

      const { data } = await axios.post(`/shop/public/${dojoId}/checkout`, {
        positionen,
        lieferadresse: {
          vorname: form.vorname, nachname: form.nachname, email: form.email,
          strasse: form.strasse, plz: form.plz, ort: form.ort, land: form.land
        },
        zahlungsart: form.zahlungsart,
        kundennotiz: form.kundennotiz || null
      });

      // Stripe Zahlung abschließen
      if (form.zahlungsart === 'stripe' && data.client_secret && stripe && elements) {
        const result = await stripe.confirmCardPayment(data.client_secret, {
          payment_method: {
            card: elements.getElement(CardElement),
            billing_details: { name: `${form.vorname} ${form.nachname}`, email: form.email }
          }
        });

        if (result.error) {
          setGlobalError(result.error.message || 'Kartenzahlung fehlgeschlagen');
          setSubmitting(false);
          return;
        }
      }

      clearCart();
      navigate(`/shop/${dojoId}/bestellung/${data.bestellnummer}`);
    } catch (err) {
      const msg = err.response?.data?.error || 'Fehler beim Bestellen';
      setGlobalError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSubmitting(false);
    }
  };

  const Field = ({ name, label, type = 'text', placeholder = '', half = false }) => (
    <div className={`public-shop-field ${half ? 'half' : ''}`}>
      <label>{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={form[name]}
        onChange={e => { setForm(f => ({ ...f, [name]: e.target.value })); setErrors(er => ({ ...er, [name]: '' })); }}
        className={errors[name] ? 'error' : ''}
      />
      {errors[name] && <span className="public-shop-field-error">{errors[name]}</span>}
    </div>
  );

  return (
    <form className="public-shop-checkout-form" onSubmit={handleSubmit}>
      <div className="public-shop-checkout-left">
        <section className="public-shop-checkout-section">
          <h3>Lieferadresse</h3>
          <div className="public-shop-field-grid">
            <Field name="vorname" label="Vorname *" half />
            <Field name="nachname" label="Nachname *" half />
            <Field name="email" label="E-Mail *" type="email" />
            <Field name="strasse" label="Straße & Hausnummer *" />
            <Field name="plz" label="PLZ *" half />
            <Field name="ort" label="Ort *" half />
            <div className="public-shop-field">
              <label>Land</label>
              <select value={form.land} onChange={e => setForm(f => ({ ...f, land: e.target.value }))}>
                <option value="Deutschland">Deutschland</option>
                <option value="Österreich">Österreich</option>
                <option value="Schweiz">Schweiz</option>
              </select>
            </div>
          </div>
        </section>

        <section className="public-shop-checkout-section">
          <h3>Zahlungsart</h3>
          <div className="public-shop-zahlungsart">
            {hasRechnung && (
              <label className={`public-shop-zahlungsart-option ${form.zahlungsart === 'rechnung' ? 'selected' : ''}`}>
                <input type="radio" name="zahlungsart" value="rechnung" checked={form.zahlungsart === 'rechnung'} onChange={e => setForm(f => ({ ...f, zahlungsart: e.target.value }))} />
                <span className="public-shop-zahlungsart-icon">📄</span>
                <div>
                  <strong>Rechnung</strong>
                  <small>Zahlung nach Erhalt</small>
                </div>
              </label>
            )}
            {hasStripe && (
              <label className={`public-shop-zahlungsart-option ${form.zahlungsart === 'stripe' ? 'selected' : ''}`}>
                <input type="radio" name="zahlungsart" value="stripe" checked={form.zahlungsart === 'stripe'} onChange={e => setForm(f => ({ ...f, zahlungsart: e.target.value }))} />
                <span className="public-shop-zahlungsart-icon">💳</span>
                <div>
                  <strong>Kreditkarte</strong>
                  <small>Sicher mit Stripe</small>
                </div>
              </label>
            )}
          </div>

          {form.zahlungsart === 'stripe' && stripe && (
            <div className="public-shop-stripe-card">
              <label>Kartendaten</label>
              <div className="public-shop-card-element">
                <CardElement options={{ style: { base: { fontSize: '16px', color: 'var(--text-primary, #fff)' } } }} />
              </div>
            </div>
          )}
        </section>

        <section className="public-shop-checkout-section">
          <h3>Anmerkungen (optional)</h3>
          <textarea
            rows={3}
            placeholder="Hinweise zur Bestellung..."
            value={form.kundennotiz}
            onChange={e => setForm(f => ({ ...f, kundennotiz: e.target.value }))}
            className="public-shop-textarea"
          />
        </section>
      </div>

      <div className="public-shop-checkout-right">
        <div className="public-shop-order-summary">
          <h3>Bestellübersicht</h3>
          {cart.map(item => (
            <div key={item._key} className="public-shop-summary-item">
              <span>{item.menge}× {item.name}</span>
              <span>{(item.preis * item.menge).toFixed(2)} €</span>
            </div>
          ))}
          <div className="public-shop-summary-divider" />
          <div className="public-shop-summary-row">
            <span>Zwischensumme</span>
            <span>{formatEur(totals.zwischensumme_cent)}</span>
          </div>
          <div className="public-shop-summary-row">
            <span>Versandkosten</span>
            <span>{totals.versandkosten_cent === 0 ? 'Kostenlos' : formatEur(totals.versandkosten_cent)}</span>
          </div>
          <div className="public-shop-summary-total">
            <strong>Gesamt</strong>
            <strong>{formatEur(totals.gesamt_cent)}</strong>
          </div>

          {globalError && <div className="public-shop-error" style={{ marginTop: '1rem' }}>{globalError}</div>}

          <button type="submit" className="public-shop-btn-primary" style={{ width: '100%', marginTop: '1.25rem' }} disabled={submitting}>
            {submitting ? 'Bestellung wird aufgegeben...' : `Jetzt bestellen (${formatEur(totals.gesamt_cent)})`}
          </button>
          <p className="public-shop-checkout-hint">Mit deiner Bestellung stimmst du unseren AGB zu.</p>
        </div>
      </div>
    </form>
  );
}
