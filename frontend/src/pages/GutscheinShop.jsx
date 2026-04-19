/**
 * GutscheinShop.jsx
 * Öffentliche Gutschein-Kaufseite — kein Login nötig
 * Route: /gutschein-shop/:dojoId
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Gift, ChevronRight, ChevronLeft, Check, Download,
  Loader2, AlertCircle, Copy, Star
} from 'lucide-react';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements, CardElement, useStripe, useElements
} from '@stripe/react-stripe-js';
import '../styles/GutscheinShop.css';

// ── Konstanten ────────────────────────────────────────────────────────────────

const API = '/api/gutscheine';

const ANLAESSE = [
  { id: 'alle',        label: 'Alle',        emoji: '🎁' },
  { id: 'weihnachten', label: 'Weihnachten', emoji: '🎄' },
  { id: 'geburtstag',  label: 'Geburtstag',  emoji: '🎂' },
  { id: 'kinder',      label: 'Kinder',      emoji: '🧒' },
  { id: 'erwachsene',  label: 'Erwachsene',  emoji: '🏋️' },
  { id: 'allgemein',   label: 'Allgemein',   emoji: '⭐' },
];

const PRESET_WERTE = [50, 100, 150, 200];

// ── Stripe-Formular (braucht Elements-Kontext) ───────────────────────────────

function StripeCardForm({ clientSecret, onSuccess, onError, loading }) {
  const stripe   = useStripe();
  const elements = useElements();
  const [err, setErr] = useState(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setErr(null);

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card: elements.getElement(CardElement) },
    });

    if (error) {
      setErr(error.message);
      onError(error.message);
      setProcessing(false);
    } else if (paymentIntent.status === 'succeeded') {
      onSuccess(paymentIntent.id);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="gs-stripe-form">
      <label className="gs-label">Kartendaten</label>
      <div className="gs-card-element">
        <CardElement options={{
          style: {
            base:    { fontSize: '16px', color: '#f0f0f0', '::placeholder': { color: '#888' } },
            invalid: { color: '#ff6b6b' },
          },
          hidePostalCode: true,
        }} />
      </div>
      {err && (
        <div className="gs-error-msg"><AlertCircle size={14} /> {err}</div>
      )}
      <button
        type="submit"
        disabled={!stripe || processing || loading}
        className="gs-pay-btn"
      >
        {processing
          ? <><Loader2 size={16} className="gs-spin" /> Wird verarbeitet…</>
          : 'Jetzt bezahlen'
        }
      </button>
    </form>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export default function GutscheinShop() {
  const { dojoId } = useParams();

  const [info, setInfo]       = useState(null);
  const [infoErr, setInfoErr] = useState(null);
  const [loading, setLoading] = useState(true);

  const [step, setStep]       = useState(1); // 1 Vorlage | 2 Details | 3 Zahlung | 4 Erfolg
  const [anlass, setAnlass]   = useState('alle');
  const [vorlage, setVorlage] = useState(null);
  const [wert, setWert]       = useState(null);
  const [wertCustom, setWertCustom] = useState('');
  const [zahlungsart, setZahlungsart] = useState(null);

  const [form, setForm] = useState({
    titel: '',
    nachricht: '',
    gueltig_bis: '',
    empfaenger_name: '',
    empfaenger_email: '',
    kaeufer_name: '',
    kaeufer_email: '',
  });

  // Zahlung state
  const [intentData, setIntentData]   = useState(null); // {client_secret, payment_intent_id}
  const [stripePromise, setStripePromise] = useState(null);
  const [payProcessing, setPayProcessing] = useState(false);
  const [payError, setPayError]       = useState(null);

  // Erfolg state
  const [result, setResult]           = useState(null); // {code, pdf_token, download_url}
  const [copied, setCopied]           = useState(false);

  // ── Daten laden ─────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch(`${API}/shop/${dojoId}/info`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) throw new Error(d.error || 'Fehler beim Laden');
        setInfo(d);
        if (d.zahlungsarten?.length) setZahlungsart(d.zahlungsarten[0].id);
      })
      .catch(e => setInfoErr(e.message))
      .finally(() => setLoading(false));
  }, [dojoId]);

  // ── Hilfsfunktionen ─────────────────────────────────────────────────────────

  const effectiveWert = wert === 'custom'
    ? parseFloat(wertCustom) || 0
    : wert;

  const filteredVorlagen = info?.vorlagen?.filter(
    v => anlass === 'alle' || v.anlass === anlass
  ) ?? [];

  const canProceedToStep2 = vorlage && effectiveWert > 0;
  const canProceedToStep3 = form.titel && form.kaeufer_name && form.kaeufer_email;

  const getGutscheinBody = () => ({
    vorlage_id:       vorlage?.id,
    wert:             effectiveWert,
    titel:            form.titel,
    nachricht:        form.nachricht || undefined,
    gueltig_bis:      form.gueltig_bis || undefined,
    empfaenger_name:  form.empfaenger_name || undefined,
    empfaenger_email: form.empfaenger_email || undefined,
    kaeufer_name:     form.kaeufer_name,
    kaeufer_email:    form.kaeufer_email,
  });

  // ── PayPal-Handlers ──────────────────────────────────────────────────────────

  const paypalCreateOrder = useCallback(async () => {
    setPayError(null);
    const body = getGutscheinBody();
    const res = await fetch(`${API}/shop/${dojoId}/paypal/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.orderId;
  }, [dojoId, vorlage, effectiveWert, form]);

  const paypalOnApprove = useCallback(async (ppData) => {
    setPayProcessing(true);
    try {
      const res = await fetch(`${API}/shop/${dojoId}/paypal/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: ppData.orderID, ...getGutscheinBody() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setResult(data);
      setStep(4);
    } catch (err) {
      setPayError(err.message);
    } finally {
      setPayProcessing(false);
    }
  }, [dojoId, vorlage, effectiveWert, form]);

  // ── Stripe-Flow ──────────────────────────────────────────────────────────────

  const initStripeIntent = async () => {
    setPayProcessing(true);
    setPayError(null);
    try {
      const res = await fetch(`${API}/shop/${dojoId}/stripe/intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getGutscheinBody()),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setIntentData(data);
      setStripePromise(loadStripe(data.publishable_key));
    } catch (err) {
      setPayError(err.message);
    } finally {
      setPayProcessing(false);
    }
  };

  const onStripeSuccess = async (paymentIntentId) => {
    setPayProcessing(true);
    try {
      const res = await fetch(`${API}/shop/${dojoId}/stripe/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_intent_id: paymentIntentId, ...getGutscheinBody() }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setResult(data);
      setStep(4);
    } catch (err) {
      setPayError(err.message);
    } finally {
      setPayProcessing(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(result?.code || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Loading / Error ──────────────────────────────────────────────────────────

  if (loading) return (
    <div className="gs-page gs-centered">
      <Loader2 size={36} className="gs-spin gs-spin-gold" />
      <p>Gutschein-Shop wird geladen…</p>
    </div>
  );

  if (infoErr) return (
    <div className="gs-page gs-centered gs-error-page">
      <AlertCircle size={40} />
      <h2>Gutschein-Shop nicht verfügbar</h2>
      <p>{infoErr}</p>
    </div>
  );

  const paypalConfig = info?.zahlungsarten?.find(z => z.id === 'paypal');

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="gs-page">
      {/* Header */}
      <header className="gs-header">
        <div className="gs-header-inner">
          <div className="gs-header-icon"><Gift size={22} /></div>
          <div>
            <h1 className="gs-header-title">
              {info?.dojo?.name || 'Kampfkunstschule'}
            </h1>
            <p className="gs-header-sub">Gutschein kaufen — das perfekte Geschenk</p>
          </div>
        </div>

        {/* Schritt-Anzeige */}
        <div className="gs-steps">
          {['Vorlage', 'Details', 'Zahlung', 'Fertig'].map((s, i) => (
            <div
              key={i}
              className={`gs-step ${step > i + 1 ? 'done' : ''} ${step === i + 1 ? 'active' : ''}`}
            >
              <span className="gs-step-num">{step > i + 1 ? <Check size={12} /> : i + 1}</span>
              <span className="gs-step-label">{s}</span>
            </div>
          ))}
        </div>
      </header>

      <main className="gs-main">

        {/* ── Schritt 1: Vorlage ──────────────────────────────────────────── */}
        {step === 1 && (
          <div className="gs-section">
            <h2 className="gs-section-title">1. Vorlage wählen</h2>

            {/* Anlass-Filter */}
            <div className="gs-anlass-filter">
              {ANLAESSE.map(a => (
                <button
                  key={a.id}
                  className={`gs-anlass-btn ${anlass === a.id ? 'active' : ''}`}
                  onClick={() => setAnlass(a.id)}
                >
                  {a.emoji} {a.label}
                </button>
              ))}
            </div>

            {/* Vorlage-Grid */}
            <div className="gs-vorlage-grid">
              {filteredVorlagen.map(v => (
                <button
                  key={v.id}
                  className={`gs-vorlage-card ${vorlage?.id === v.id ? 'selected' : ''}`}
                  onClick={() => setVorlage(v)}
                >
                  <img src={v.bild_url} alt={v.titel} className="gs-vorlage-img" />
                  <div className="gs-vorlage-label">{v.titel}</div>
                  {vorlage?.id === v.id && (
                    <div className="gs-vorlage-check"><Check size={16} /></div>
                  )}
                </button>
              ))}
            </div>

            {/* Wert-Auswahl */}
            {vorlage && (
              <div className="gs-wert-section">
                <h3 className="gs-sub-title">Betrag wählen</h3>
                <div className="gs-wert-presets">
                  {PRESET_WERTE.map(p => (
                    <button
                      key={p}
                      className={`gs-wert-btn ${wert === p ? 'active' : ''}`}
                      onClick={() => { setWert(p); setWertCustom(''); }}
                    >
                      {p} €
                    </button>
                  ))}
                  <button
                    className={`gs-wert-btn ${wert === 'custom' ? 'active' : ''}`}
                    onClick={() => setWert('custom')}
                  >
                    Eigener Betrag
                  </button>
                </div>
                {wert === 'custom' && (
                  <input
                    type="number"
                    min="5"
                    step="5"
                    placeholder="z. B. 75"
                    value={wertCustom}
                    onChange={e => setWertCustom(e.target.value)}
                    className="gs-input gs-wert-custom-input"
                  />
                )}
              </div>
            )}

            <div className="gs-nav">
              <span />
              <button
                className="gs-btn-primary"
                disabled={!canProceedToStep2}
                onClick={() => setStep(2)}
              >
                Weiter <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── Schritt 2: Details ──────────────────────────────────────────── */}
        {step === 2 && (
          <div className="gs-section">
            <h2 className="gs-section-title">2. Details ausfüllen</h2>

            {/* Preview-Miniatur */}
            <div className="gs-preview-mini">
              <img src={vorlage.bild_url} alt="" className="gs-preview-img" />
              <div className="gs-preview-info">
                <span className="gs-preview-wert">
                  {Number(effectiveWert).toLocaleString('de-DE', {
                    style: 'currency', currency: 'EUR'
                  })}
                </span>
                <span className="gs-preview-vorlage">{vorlage.titel}</span>
              </div>
            </div>

            <div className="gs-form-grid">
              <div className="gs-form-col">
                <h3 className="gs-sub-title">Gutschein-Angaben</h3>

                <label className="gs-label">Titel <span className="gs-required">*</span></label>
                <input
                  className="gs-input"
                  placeholder="z. B. Geburtstags-Gutschein für Lisa"
                  value={form.titel}
                  onChange={e => setForm(f => ({ ...f, titel: e.target.value }))}
                />

                <label className="gs-label">Persönliche Nachricht</label>
                <textarea
                  className="gs-input gs-textarea"
                  placeholder="Herzlichen Glückwunsch! Dieser Gutschein…"
                  value={form.nachricht}
                  onChange={e => setForm(f => ({ ...f, nachricht: e.target.value }))}
                  rows={3}
                />

                <label className="gs-label">Gültig bis</label>
                <input
                  type="date"
                  className="gs-input"
                  value={form.gueltig_bis}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={e => setForm(f => ({ ...f, gueltig_bis: e.target.value }))}
                />
              </div>

              <div className="gs-form-col">
                <h3 className="gs-sub-title">Empfänger (optional)</h3>
                <label className="gs-label">Name des Empfängers</label>
                <input
                  className="gs-input"
                  placeholder="z. B. Lisa Müller"
                  value={form.empfaenger_name}
                  onChange={e => setForm(f => ({ ...f, empfaenger_name: e.target.value }))}
                />
                <label className="gs-label">E-Mail des Empfängers</label>
                <input
                  type="email"
                  className="gs-input"
                  placeholder="lisa@example.de"
                  value={form.empfaenger_email}
                  onChange={e => setForm(f => ({ ...f, empfaenger_email: e.target.value }))}
                />

                <h3 className="gs-sub-title" style={{ marginTop: '1.25rem' }}>Käufer-Info <span className="gs-required">*</span></h3>
                <label className="gs-label">Ihr Name <span className="gs-required">*</span></label>
                <input
                  className="gs-input"
                  placeholder="Max Mustermann"
                  value={form.kaeufer_name}
                  onChange={e => setForm(f => ({ ...f, kaeufer_name: e.target.value }))}
                />
                <label className="gs-label">Ihre E-Mail <span className="gs-required">*</span></label>
                <input
                  type="email"
                  className="gs-input"
                  placeholder="max@example.de"
                  value={form.kaeufer_email}
                  onChange={e => setForm(f => ({ ...f, kaeufer_email: e.target.value }))}
                />
              </div>
            </div>

            <div className="gs-nav">
              <button className="gs-btn-secondary" onClick={() => setStep(1)}>
                <ChevronLeft size={16} /> Zurück
              </button>
              <button
                className="gs-btn-primary"
                disabled={!canProceedToStep3}
                onClick={() => setStep(3)}
              >
                Weiter zur Zahlung <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── Schritt 3: Zahlung ──────────────────────────────────────────── */}
        {step === 3 && (
          <div className="gs-section">
            <h2 className="gs-section-title">3. Zahlung</h2>

            {/* Zusammenfassung */}
            <div className="gs-summary-box">
              <img src={vorlage.bild_url} alt="" className="gs-summary-img" />
              <div className="gs-summary-info">
                <div className="gs-summary-titel">{form.titel}</div>
                {form.empfaenger_name && <div className="gs-summary-detail">Für: {form.empfaenger_name}</div>}
                {form.gueltig_bis && <div className="gs-summary-detail">
                  Gültig bis: {new Date(form.gueltig_bis).toLocaleDateString('de-DE')}
                </div>}
              </div>
              <div className="gs-summary-wert">
                {Number(effectiveWert).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              </div>
            </div>

            {/* Zahlungsart-Tabs */}
            {info.zahlungsarten.length > 1 && !intentData && (
              <div className="gs-pay-tabs">
                {info.zahlungsarten.map(z => (
                  <button
                    key={z.id}
                    className={`gs-pay-tab ${zahlungsart === z.id ? 'active' : ''}`}
                    onClick={() => { setZahlungsart(z.id); setIntentData(null); setStripePromise(null); }}
                  >
                    {z.label}
                  </button>
                ))}
              </div>
            )}

            {payError && (
              <div className="gs-error-msg gs-error-box">
                <AlertCircle size={16} /> {payError}
              </div>
            )}

            {/* PayPal */}
            {zahlungsart === 'paypal' && paypalConfig && (
              <div className="gs-paypal-wrap">
                {payProcessing
                  ? <div className="gs-centered"><Loader2 size={28} className="gs-spin" /></div>
                  : (
                    <PayPalScriptProvider options={{
                      'client-id': paypalConfig.client_id,
                      currency:    'EUR',
                      intent:      'capture',
                      locale:      'de_DE',
                    }}>
                      <PayPalButtons
                        style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay', height: 48 }}
                        createOrder={paypalCreateOrder}
                        onApprove={paypalOnApprove}
                        onError={e => setPayError('PayPal-Fehler: ' + (e.message || 'unbekannt'))}
                        forceReRender={[effectiveWert]}
                      />
                      {paypalConfig.sandbox && (
                        <p className="gs-sandbox-note">Testmodus aktiv</p>
                      )}
                    </PayPalScriptProvider>
                  )
                }
              </div>
            )}

            {/* Stripe */}
            {zahlungsart === 'stripe' && (
              <div className="gs-stripe-wrap">
                {!intentData && (
                  <button
                    className="gs-btn-primary"
                    disabled={payProcessing}
                    onClick={initStripeIntent}
                  >
                    {payProcessing
                      ? <><Loader2 size={16} className="gs-spin" /> Wird vorbereitet…</>
                      : 'Mit Kreditkarte bezahlen'
                    }
                  </button>
                )}
                {intentData && stripePromise && (
                  <Elements stripe={stripePromise} options={{ clientSecret: intentData.client_secret }}>
                    <StripeCardForm
                      clientSecret={intentData.client_secret}
                      onSuccess={onStripeSuccess}
                      onError={msg => setPayError(msg)}
                      loading={payProcessing}
                    />
                  </Elements>
                )}
              </div>
            )}

            {/* Keine Zahlungsart */}
            {info.zahlungsarten.length === 0 && (
              <div className="gs-info-box">
                Bitte kontaktieren Sie uns direkt für die Zahlung.
              </div>
            )}

            <div className="gs-nav" style={{ marginTop: '1.5rem' }}>
              <button className="gs-btn-secondary" onClick={() => setStep(2)}>
                <ChevronLeft size={16} /> Zurück
              </button>
            </div>
          </div>
        )}

        {/* ── Schritt 4: Erfolg ───────────────────────────────────────────── */}
        {step === 4 && result && (
          <div className="gs-section gs-success-section">
            <div className="gs-success-icon"><Check size={32} /></div>
            <h2 className="gs-success-title">Gutschein erfolgreich gekauft!</h2>
            <p className="gs-success-sub">
              Ihr Gutschein wurde erstellt und steht zum Download bereit.
            </p>

            <div className="gs-code-box">
              <div className="gs-code-label">Gutschein-Code</div>
              <div className="gs-code-value">{result.code}</div>
              <button className="gs-copy-btn" onClick={copyCode}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Kopiert!' : 'Code kopieren'}
              </button>
            </div>

            <a
              href={`/api/gutscheine/pdf/${result.pdf_token}`}
              download={`gutschein-${result.code}.pdf`}
              className="gs-download-btn"
            >
              <Download size={18} /> PDF herunterladen
            </a>

            <p className="gs-success-hint">
              <Star size={12} /> Der PDF-Gutschein kann ausgedruckt oder digital weitergegeben werden.
            </p>
          </div>
        )}

      </main>

      <footer className="gs-footer">
        <p>© {info?.dojo?.name} · Alle Preise inkl. MwSt.</p>
      </footer>
    </div>
  );
}
