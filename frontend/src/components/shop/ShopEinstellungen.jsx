import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function ShopEinstellungen({ dojoParam = '' }) {
  const [form, setForm] = useState({
    shop_aktiv: false,
    shop_name: '',
    shop_beschreibung: '',
    shop_logo_url: '',
    stripe_publishable_key: '',
    stripe_secret_key: '',
    stripe_webhook_secret: '',
    versandkostenfrei_ab_cent: 5000,
    standard_versandkosten_cent: 495,
    rechnung_erlaubt: true,
    impressum_zusatz: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showSecretKey, setShowSecretKey] = useState(false);

  useEffect(() => { loadEinstellungen(); }, [dojoParam]);

  const loadEinstellungen = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`/shop/admin/einstellungen${dojoParam}`);
      setForm(prev => ({
        ...prev,
        ...data,
        // Maskierten Key als Platzhalter anzeigen
        stripe_secret_key: data.stripe_secret_key_masked ? data.stripe_secret_key_masked : (data.stripe_secret_key || ''),
      }));
    } catch (err) {
      setError('Fehler beim Laden der Einstellungen');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      await axios.put(`/shop/admin/einstellungen${dojoParam}`, form);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      loadEinstellungen();
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const shopUrl = `/shop/tda`;

  if (loading) return <div className="shop-loading">Lade Einstellungen...</div>;

  return (
    <div className="shop-admin-content">
      <div className="shop-admin-header">
        <h2>Shop-Einstellungen</h2>
        <a href={shopUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">
          🔗 Shop-Vorschau öffnen
        </a>
      </div>

      {error && <div className="shop-error">{error}</div>}
      {success && <div className="shop-success">✅ Einstellungen gespeichert</div>}

      <div className="shop-settings-grid">
        {/* Allgemein */}
        <section className="shop-settings-section">
          <h3>Allgemein</h3>
          <div className="shop-form-group">
            <label>
              <input
                type="checkbox"
                checked={form.shop_aktiv}
                onChange={e => setForm(f => ({ ...f, shop_aktiv: e.target.checked }))}
              />
              {' '}Shop aktiv (öffentlich zugänglich)
            </label>
          </div>
          <div className="shop-form-group">
            <label>Shop-Name</label>
            <input
              value={form.shop_name || ''}
              onChange={e => setForm(f => ({ ...f, shop_name: e.target.value }))}
              placeholder="TDA Shop"
            />
          </div>
          <div className="shop-form-group">
            <label>Beschreibung</label>
            <textarea
              rows={2}
              value={form.shop_beschreibung || ''}
              onChange={e => setForm(f => ({ ...f, shop_beschreibung: e.target.value }))}
              placeholder="Kurze Beschreibung des Shops"
            />
          </div>
          <div className="shop-form-group">
            <label>Logo-URL</label>
            <input
              value={form.shop_logo_url || ''}
              onChange={e => setForm(f => ({ ...f, shop_logo_url: e.target.value }))}
              placeholder="https://..."
            />
            {form.shop_logo_url && (
              <img src={form.shop_logo_url} alt="Logo-Vorschau" style={{ marginTop: 8, height: 48, borderRadius: 4 }} />
            )}
          </div>
        </section>

        {/* Versand */}
        <section className="shop-settings-section">
          <h3>Versandkosten</h3>
          <div className="shop-form-group">
            <label>Kostenloser Versand ab (€)</label>
            <input
              type="number"
              step="0.01"
              value={(form.versandkostenfrei_ab_cent / 100).toFixed(2)}
              onChange={e => setForm(f => ({ ...f, versandkostenfrei_ab_cent: Math.round(parseFloat(e.target.value) * 100) }))}
            />
          </div>
          <div className="shop-form-group">
            <label>Standard-Versandkosten (€)</label>
            <input
              type="number"
              step="0.01"
              value={(form.standard_versandkosten_cent / 100).toFixed(2)}
              onChange={e => setForm(f => ({ ...f, standard_versandkosten_cent: Math.round(parseFloat(e.target.value) * 100) }))}
            />
          </div>
          <div className="shop-form-group">
            <label>
              <input
                type="checkbox"
                checked={form.rechnung_erlaubt}
                onChange={e => setForm(f => ({ ...f, rechnung_erlaubt: e.target.checked }))}
              />
              {' '}Kauf auf Rechnung erlauben
            </label>
          </div>
        </section>

        {/* Stripe */}
        <section className="shop-settings-section">
          <h3>Stripe-Zahlungen</h3>
          <p className="shop-settings-hint">
            Stripe-Keys findest du im{' '}
            <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer">
              Stripe Dashboard
            </a>
          </p>
          <div className="shop-form-group">
            <label>Publishable Key (pk_...)</label>
            <input
              value={form.stripe_publishable_key || ''}
              onChange={e => setForm(f => ({ ...f, stripe_publishable_key: e.target.value }))}
              placeholder="pk_live_..."
            />
          </div>
          <div className="shop-form-group">
            <label>
              Secret Key (sk_...)
              <button
                type="button"
                className="btn-sm"
                style={{ marginLeft: 8 }}
                onClick={() => setShowSecretKey(!showSecretKey)}
              >
                {showSecretKey ? '🙈 Verbergen' : '👁 Zeigen'}
              </button>
            </label>
            <input
              type={showSecretKey ? 'text' : 'password'}
              value={form.stripe_secret_key || ''}
              onChange={e => setForm(f => ({ ...f, stripe_secret_key: e.target.value }))}
              placeholder="sk_live_... (leer lassen um nicht zu ändern)"
            />
            <small style={{ color: 'var(--text-muted)' }}>
              Nur ausfüllen wenn du den Key ändern möchtest. Leer lassen = aktueller Key bleibt.
            </small>
          </div>
          <div className="shop-form-group">
            <label>Webhook-Secret (whsec_...)</label>
            <input
              type="password"
              value={form.stripe_webhook_secret || ''}
              onChange={e => setForm(f => ({ ...f, stripe_webhook_secret: e.target.value }))}
              placeholder="whsec_... (optional)"
            />
          </div>
        </section>

        {/* Rechtliches */}
        <section className="shop-settings-section">
          <h3>Rechtliches</h3>
          <div className="shop-form-group">
            <label>Impressum-Zusatz (wird im Shop-Footer angezeigt)</label>
            <textarea
              rows={4}
              value={form.impressum_zusatz || ''}
              onChange={e => setForm(f => ({ ...f, impressum_zusatz: e.target.value }))}
              placeholder="Zusätzliche Angaben für das Impressum..."
            />
          </div>
        </section>
      </div>

      <div className="shop-settings-footer">
        <button className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Speichert...' : '💾 Einstellungen speichern'}
        </button>
      </div>
    </div>
  );
}
