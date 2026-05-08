// ============================================================================
// INTEGRATIONS-EINSTELLUNGEN
// Frontend/src/components/IntegrationsEinstellungen.jsx
// Admin-Komponente für PayPal, SumUp, LexOffice, DATEV Konfiguration
// ============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Settings, CreditCard, FileText, Calculator, Save, Eye, EyeOff,
  CheckCircle, AlertCircle, RefreshCw, ExternalLink, Smartphone, Copy, Link2
} from 'lucide-react';
import { useDojoContext } from '../context/DojoContext';
import { useSubscription } from '../context/SubscriptionContext';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import configModule from '../config/config.js';
import StripeConnectSetup from './StripeConnectSetup';
import MessengerKonfiguration from './MessengerKonfiguration';
import '../styles/IntegrationsEinstellungen.css';

const IntegrationsEinstellungen = () => {
  const { activeDojo } = useDojoContext();
  const { hasFeature } = useSubscription();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [showSecrets, setShowSecrets] = useState({});
  const [testResults, setTestResults] = useState({});
  const [sumupPartnerUrl, setSumupPartnerUrl] = useState(null);
  const [copiedPartner, setCopiedPartner] = useState(false);

  // --- Zahlungsanbieter state ---
  const [paymentProvider, setPaymentProvider] = useState('manual_sepa');
  const [providerStatus, setProviderStatus] = useState(null);
  const [paymentProviderLoading, setPaymentProviderLoading] = useState(true);
  const [paymentProviderSaving, setPaymentProviderSaving] = useState(false);
  const [paymentProviderError, setPaymentProviderError] = useState('');
  const [paymentProviderSuccess, setPaymentProviderSuccess] = useState('');
  const [stripeConfig, setStripeConfig] = useState({
    stripe_secret_key: '',
    stripe_publishable_key: ''
  });
  const [datevConfig, setDatevConfig] = useState({
    datev_api_key: '',
    datev_consultant_number: '',
    datev_client_number: ''
  });

  const [config, setConfig] = useState({
    // Stripe
    stripe_publishable_key: '',
    stripe_secret_key: '',
    // PayPal
    paypal_client_id: '',
    paypal_client_secret: '',
    paypal_sandbox: true,
    // SumUp
    sumup_api_key: '',
    sumup_merchant_code: '',
    sumup_client_id: '',
    sumup_client_secret: '',
    sumup_aktiv: false,
    // LexOffice
    lexoffice_api_key: '',
    // DATEV
    datev_consultant_number: '',
    datev_client_number: ''
  });

  const dojoId = activeDojo?.id || activeDojo;

  // Subdomain-Check für Messenger (verfügbar wenn Dojo eine Subdomain hat)
  const hasMessenger = !!(activeDojo && activeDojo !== 'super-admin' && activeDojo.subdomain);

  const loadSumupPartnerUrl = useCallback(async () => {
    try {
      const response = await axios.get('/integrations/sumup-partner');
      setSumupPartnerUrl(response.data.partner_url || null);
    } catch (err) {
      console.error('Fehler beim Laden der SumUp Partner-URL:', err);
    }
  }, []);

  const loadPaymentProvider = useCallback(async () => {
    try {
      setPaymentProviderLoading(true);
      const response = await fetchWithAuth(`${configModule.apiBaseUrl}/payment-provider/status`);
      if (!response.ok) throw new Error('Fehler beim Laden der Einstellungen');
      const data = await response.json();
      setProviderStatus(data);
      setPaymentProvider(data.current_provider);
      if (data.current_provider === 'stripe_datev') {
        setStripeConfig({
          stripe_secret_key: '••••••••••••••••',
          stripe_publishable_key: data.stripe_publishable_key || ''
        });
        setDatevConfig({
          datev_api_key: '••••••••••••••••',
          datev_consultant_number: data.datev_consultant_number || '',
          datev_client_number: data.datev_client_number || ''
        });
      }
    } catch (err) {
      console.error('Fehler beim Laden der Zahlungseinstellungen:', err);
      setPaymentProviderError('Fehler beim Laden der aktuellen Zahlungseinstellungen');
    } finally {
      setPaymentProviderLoading(false);
    }
  }, []);

  const savePaymentProvider = async () => {
    try {
      setPaymentProviderSaving(true);
      setPaymentProviderError('');
      setPaymentProviderSuccess('');
      const configData = {
        payment_provider: paymentProvider,
        ...stripeConfig,
        ...datevConfig
      };
      const response = await fetchWithAuth(`${configModule.apiBaseUrl}/payment-provider/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configData)
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Fehler beim Speichern der Konfiguration');
      }
      setPaymentProviderSuccess('Zahlungssystem erfolgreich konfiguriert!');
      await loadPaymentProvider();
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      setPaymentProviderError(err.message);
    } finally {
      setPaymentProviderSaving(false);
    }
  };

  useEffect(() => {
    loadPaymentProvider();
  }, [loadPaymentProvider]);

  useEffect(() => {
    if (dojoId && dojoId !== 'super-admin') {
      loadConfig();
      loadStatus();
      loadSumupPartnerUrl();
    }
  }, [dojoId, loadSumupPartnerUrl]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/integrations/config?dojo_id=${dojoId}`);
      if (response.data) {
        setConfig(prev => ({
          ...prev,
          ...response.data
        }));
      }
    } catch (err) {
      console.error('Fehler beim Laden der Konfiguration:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStatus = async () => {
    try {
      const response = await axios.get(`/integrations/status?dojo_id=${dojoId}`);
      setStatus(response.data);
    } catch (err) {
      console.error('Fehler beim Laden des Status:', err);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await axios.put(`/integrations/config`, { ...config, dojo_id: dojoId });
      alert('Einstellungen gespeichert!');
      loadStatus();
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      alert(err.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async (service) => {
    try {
      setTestResults(prev => ({ ...prev, [service]: { loading: true } }));
      const response = await axios.post(`/integrations/${service}/test?dojo_id=${dojoId}`);
      setTestResults(prev => ({
        ...prev,
        [service]: { success: response.data.success, message: response.data.message }
      }));
    } catch (err) {
      setTestResults(prev => ({
        ...prev,
        [service]: { success: false, message: err.response?.data?.error || 'Verbindung fehlgeschlagen' }
      }));
    }
  };

  const toggleSecret = (key) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const copyPartnerUrl = () => {
    if (!sumupPartnerUrl) return;
    navigator.clipboard.writeText(sumupPartnerUrl).then(() => {
      setCopiedPartner(true);
      setTimeout(() => setCopiedPartner(false), 2000);
    }).catch(() => {
      // Fallback für ältere Browser
      const el = document.createElement('textarea');
      el.value = sumupPartnerUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedPartner(true);
      setTimeout(() => setCopiedPartner(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="ie-container">
        <div className="ie-loading">Lade Einstellungen...</div>
      </div>
    );
  }

  return (
    <div className="ie-container">
      {/* Header */}
      <div className="ie-header">
        <Settings size={32} color="#ffd700" />
        <div>
          <h2 className="ie-title">Integration-Einstellungen</h2>
          <p className="ie-subtitle">Konfiguriere PayPal, SumUp, LexOffice und DATEV</p>
        </div>
      </div>

      {/* Status Overview */}
      {status && (
        <div className="ie-status-grid">
          <StatusCard
            title="Stripe"
            icon={<CreditCard size={24} />}
            configured={status.stripe?.configured}
            mode="Kreditkarte & SEPA"
          />
          <StatusCard
            title="PayPal"
            icon={<CreditCard size={24} />}
            configured={status.paypal?.configured}
            mode={status.paypal?.sandbox ? 'Sandbox' : 'Live'}
          />
          <StatusCard
            title="SumUp"
            icon={<Smartphone size={24} />}
            configured={status.sumup?.configured}
            mode={status.sumup?.active ? 'Aktiv' : 'Inaktiv'}
          />
          <StatusCard
            title="LexOffice"
            icon={<FileText size={24} />}
            configured={status.lexoffice?.configured}
          />
          <StatusCard
            title="DATEV"
            icon={<Calculator size={24} />}
            configured={status.datev?.configured}
          />
        </div>
      )}

      {/* Zahlungsanbieter Section */}
      <div className="ie-section">
        <div className="ie-section-header">
          <span style={{ fontSize: 24 }}>💳</span>
          <h3 className="ie-section-title">Zahlungsanbieter</h3>
        </div>

        <div className="ie-info-box">
          <p>Wählen Sie das bevorzugte Zahlungssystem für Mitgliedsbeiträge und Rechnungen.</p>
        </div>

        {paymentProviderError && (
          <div className="ie-info-box" style={{ borderColor: '#ef4444', color: '#ef4444' }}>
            <AlertCircle size={16} /> {paymentProviderError}
          </div>
        )}
        {paymentProviderSuccess && (
          <div className="ie-info-box" style={{ borderColor: '#22c55e', color: '#22c55e' }}>
            <CheckCircle size={16} /> {paymentProviderSuccess}
          </div>
        )}

        {providerStatus && (
          <div className="ie-info-box" style={{ marginBottom: '1rem' }}>
            <strong>Aktuelles System:</strong> {providerStatus.provider_name} &nbsp;
            <span style={{ color: providerStatus.is_configured ? '#22c55e' : '#f59e0b' }}>
              {providerStatus.is_configured ? '✅ Konfiguriert' : '⚠️ Nicht vollständig konfiguriert'}
            </span>
          </div>
        )}

        {/* Provider Selection */}
        <div className="ie-form-row" style={{ flexDirection: 'column', gap: '0.75rem' }}>
          <label className="ie-checkbox-label" style={{ alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
            <input
              type="radio"
              value="manual_sepa"
              checked={paymentProvider === 'manual_sepa'}
              onChange={(e) => { setPaymentProvider(e.target.value); setPaymentProviderError(''); setPaymentProviderSuccess(''); }}
              style={{ marginTop: '0.2rem' }}
            />
            <div>
              <strong>🏪 Manuelle SEPA-Abwicklung</strong>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)' }}>
                Bestehende manuelle Lastschrift-Verwaltung mit SEPA-Mandaten. Keine Transaktionskosten, aber manueller Zeitaufwand.
              </p>
            </div>
          </label>
          <label className="ie-checkbox-label" style={{ alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
            <input
              type="radio"
              value="stripe_datev"
              checked={paymentProvider === 'stripe_datev'}
              onChange={(e) => { setPaymentProvider(e.target.value); setPaymentProviderError(''); setPaymentProviderSuccess(''); }}
              style={{ marginTop: '0.2rem' }}
            />
            <div>
              <strong>💳 Stripe + DATEV Integration</strong>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted, #94a3b8)' }}>
                Professionelle Zahlungsabwicklung mit automatischer DATEV-Buchhaltung. Gebühren: 0,35€ + 1,4% pro Transaktion.
              </p>
            </div>
          </label>
        </div>

        {/* Stripe + DATEV config fields */}
        {paymentProvider === 'stripe_datev' && (
          <>
            <div style={{ marginTop: '1.25rem' }}>
              <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: 'var(--text-primary, #f1f5f9)' }}>
                🔑 Stripe Konfiguration
              </h4>
              <div className="ie-form-row">
                <div className="ie-form-group">
                  <label className="ie-label">Secret Key (sk_...)</label>
                  <div className="ie-secret-input">
                    <input
                      type={showSecrets.zp_stripe_secret ? 'text' : 'password'}
                      value={stripeConfig.stripe_secret_key}
                      onChange={(e) => setStripeConfig({ ...stripeConfig, stripe_secret_key: e.target.value })}
                      className="ie-input"
                      placeholder="sk_test_... oder sk_live_..."
                    />
                    <button className="ie-eye-button" onClick={() => toggleSecret('zp_stripe_secret')}>
                      {showSecrets.zp_stripe_secret ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <small style={{ color: 'var(--text-muted, #94a3b8)' }}>Geheimer Schlüssel für Server-side API Aufrufe</small>
                </div>
                <div className="ie-form-group">
                  <label className="ie-label">Publishable Key (pk_...)</label>
                  <input
                    type="text"
                    value={stripeConfig.stripe_publishable_key}
                    onChange={(e) => setStripeConfig({ ...stripeConfig, stripe_publishable_key: e.target.value })}
                    className="ie-input"
                    placeholder="pk_test_... oder pk_live_..."
                  />
                  <small style={{ color: 'var(--text-muted, #94a3b8)' }}>Öffentlicher Schlüssel für Frontend-Integration</small>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1.25rem' }}>
              <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', color: 'var(--text-primary, #f1f5f9)' }}>
                📊 DATEV Konfiguration
              </h4>
              <div className="ie-form-row">
                <div className="ie-form-group">
                  <label className="ie-label">DATEV API Key</label>
                  <div className="ie-secret-input">
                    <input
                      type={showSecrets.zp_datev_api ? 'text' : 'password'}
                      value={datevConfig.datev_api_key}
                      onChange={(e) => setDatevConfig({ ...datevConfig, datev_api_key: e.target.value })}
                      className="ie-input"
                      placeholder="DATEV API Schlüssel"
                    />
                    <button className="ie-eye-button" onClick={() => toggleSecret('zp_datev_api')}>
                      {showSecrets.zp_datev_api ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <small style={{ color: 'var(--text-muted, #94a3b8)' }}>API-Schlüssel für DATEV-Integration</small>
                </div>
                <div className="ie-form-group">
                  <label className="ie-label">Beraternummer</label>
                  <input
                    type="text"
                    value={datevConfig.datev_consultant_number}
                    onChange={(e) => setDatevConfig({ ...datevConfig, datev_consultant_number: e.target.value })}
                    className="ie-input"
                    placeholder="12345"
                  />
                  <small style={{ color: 'var(--text-muted, #94a3b8)' }}>DATEV Beraternummer</small>
                </div>
                <div className="ie-form-group">
                  <label className="ie-label">Mandantennummer</label>
                  <input
                    type="text"
                    value={datevConfig.datev_client_number}
                    onChange={(e) => setDatevConfig({ ...datevConfig, datev_client_number: e.target.value })}
                    className="ie-input"
                    placeholder="123"
                  />
                  <small style={{ color: 'var(--text-muted, #94a3b8)' }}>DATEV Mandantennummer</small>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="ie-test-section" style={{ marginTop: '1.25rem' }}>
          <button
            className="ie-save-button"
            onClick={savePaymentProvider}
            disabled={paymentProviderSaving || paymentProviderLoading}
            style={{ width: 'auto' }}
          >
            {paymentProviderSaving ? (
              <><RefreshCw size={18} className="spinning" /> Speichere...</>
            ) : (
              <><Save size={18} /> Zahlungsanbieter speichern</>
            )}
          </button>
        </div>
      </div>

      {/* Stripe Section */}
      <div className="ie-section">
        <div className="ie-section-header">
          <CreditCard size={24} color="#635bff" />
          <h3 className="ie-section-title">Stripe</h3>
          <a
            href="https://dashboard.stripe.com/apikeys"
            target="_blank"
            rel="noopener noreferrer"
            className="ie-help-link"
          >
            <ExternalLink size={14} /> API-Keys Dashboard
          </a>
        </div>

        <div className="ie-info-box">
          <p>
            Stripe ermöglicht Kreditkarten- und SEPA-Lastschrift-Zahlungen. Die API-Keys findest du
            im Stripe Dashboard unter Developers → API Keys.
          </p>
        </div>

        <div className="ie-form-row">
          <div className="ie-form-group">
            <label className="ie-label">Publishable Key (öffentlich)</label>
            <input
              type="text"
              value={config.stripe_publishable_key || ''}
              onChange={e => setConfig({ ...config, stripe_publishable_key: e.target.value })}
              className="ie-input"
              placeholder="pk_live_... oder pk_test_..."
            />
          </div>
        </div>

        <div className="ie-form-row">
          <div className="ie-form-group">
            <label className="ie-label">Secret Key (geheim)</label>
            <div className="ie-secret-input">
              <input
                type={showSecrets.stripe ? 'text' : 'password'}
                value={config.stripe_secret_key || ''}
                onChange={e => setConfig({ ...config, stripe_secret_key: e.target.value })}
                className="ie-input"
                placeholder="sk_live_... oder sk_test_..."
              />
              <button className="ie-eye-button" onClick={() => toggleSecret('stripe')}>
                {showSecrets.stripe ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        </div>

        <div className="ie-info-box ie-info-box--stripe-connect">
          <p>
            <strong>Hinweis:</strong> Verwende für Tests die Test-Keys (pk_test_... / sk_test_...).
            Für Live-Zahlungen benötigst du die Live-Keys (pk_live_... / sk_live_...).
          </p>
        </div>
      </div>

      {/* Stripe Connect Section */}
      <StripeConnectSetup />

      {/* PayPal Section */}
      <div className="ie-section">
        <div className="ie-section-header">
          <CreditCard size={24} color="#0070ba" />
          <h3 className="ie-section-title">PayPal</h3>
          <a
            href="https://developer.paypal.com/dashboard/applications"
            target="_blank"
            rel="noopener noreferrer"
            className="ie-help-link"
          >
            <ExternalLink size={14} /> Entwickler-Dashboard
          </a>
        </div>

        <div className="ie-info-box">
          <p>
            Um PayPal zu nutzen, erstelle eine App im PayPal Developer Dashboard und kopiere
            die Client ID und das Secret hierher.
          </p>
        </div>

        <div className="ie-form-row">
          <div className="ie-form-group">
            <label className="ie-label">Client ID</label>
            <input
              type="text"
              value={config.paypal_client_id || ''}
              onChange={e => setConfig({ ...config, paypal_client_id: e.target.value })}
              className="ie-input"
              placeholder="AV9b8ND..."
            />
          </div>
        </div>

        <div className="ie-form-row">
          <div className="ie-form-group">
            <label className="ie-label">Client Secret</label>
            <div className="ie-secret-input">
              <input
                type={showSecrets.paypal ? 'text' : 'password'}
                value={config.paypal_client_secret || ''}
                onChange={e => setConfig({ ...config, paypal_client_secret: e.target.value })}
                className="ie-input"
                placeholder="EK3qE9N..."
              />
              <button className="ie-eye-button" onClick={() => toggleSecret('paypal')}>
                {showSecrets.paypal ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        </div>

        <div className="ie-form-row">
          <label className="ie-checkbox-label">
            <input
              type="checkbox"
              checked={config.paypal_sandbox}
              onChange={e => setConfig({ ...config, paypal_sandbox: e.target.checked })}
            />
            <span>Sandbox-Modus (Test-Umgebung)</span>
          </label>
        </div>

        <TestButton
          service="paypal"
          onTest={() => testConnection('paypal')}
          result={testResults.paypal}
          disabled={!config.paypal_client_id || !config.paypal_client_secret}
        />
      </div>

      {/* SumUp Section */}
      <div className="ie-section">
        <div className="ie-section-header">
          <Smartphone size={24} color="#00b5ad" />
          <h3 className="ie-section-title">SumUp Kartenterminal</h3>
          <a
            href="https://developer.sumup.com/docs/api/getting-started/"
            target="_blank"
            rel="noopener noreferrer"
            className="ie-help-link"
          >
            <ExternalLink size={14} /> Entwickler-Dokumentation
          </a>
        </div>

        <div className="ie-info-box">
          <p>
            SumUp ermöglicht Kartenzahlungen über das Kartenterminal (Solo, Air).
            Du kannst entweder einen API-Key oder OAuth-Credentials verwenden.
            Die Zugangsdaten findest du im SumUp Business-Portal unter Entwickleroptionen.
          </p>
        </div>

        <div className="ie-form-row">
          <label className="ie-checkbox-label">
            <input
              type="checkbox"
              checked={config.sumup_aktiv}
              onChange={e => setConfig({ ...config, sumup_aktiv: e.target.checked })}
            />
            <span>SumUp aktivieren</span>
          </label>
        </div>

        <div className="ie-form-row">
          <div className="ie-form-group">
            <label className="ie-label">Merchant Code</label>
            <input
              type="text"
              value={config.sumup_merchant_code || ''}
              onChange={e => setConfig({ ...config, sumup_merchant_code: e.target.value })}
              className="ie-input"
              placeholder="MER1234..."
            />
          </div>
        </div>

        <div className="ie-form-row">
          <div className="ie-form-group">
            <label className="ie-label">API Key</label>
            <div className="ie-secret-input">
              <input
                type={showSecrets.sumup_api ? 'text' : 'password'}
                value={config.sumup_api_key || ''}
                onChange={e => setConfig({ ...config, sumup_api_key: e.target.value })}
                className="ie-input"
                placeholder="sup_sk_..."
              />
              <button className="ie-eye-button" onClick={() => toggleSecret('sumup_api')}>
                {showSecrets.sumup_api ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        </div>

        <div className="ie-info-box ie-info-box--sumup-oauth">
          <p>
            <strong>Optional: OAuth-Credentials</strong> (nur wenn kein API-Key verwendet wird)
          </p>
        </div>

        <div className="ie-form-row">
          <div className="ie-form-group">
            <label className="ie-label">Client ID (optional)</label>
            <input
              type="text"
              value={config.sumup_client_id || ''}
              onChange={e => setConfig({ ...config, sumup_client_id: e.target.value })}
              className="ie-input"
              placeholder="OAuth Client ID..."
            />
          </div>
        </div>

        <div className="ie-form-row">
          <div className="ie-form-group">
            <label className="ie-label">Client Secret (optional)</label>
            <div className="ie-secret-input">
              <input
                type={showSecrets.sumup_secret ? 'text' : 'password'}
                value={config.sumup_client_secret || ''}
                onChange={e => setConfig({ ...config, sumup_client_secret: e.target.value })}
                className="ie-input"
                placeholder="OAuth Client Secret..."
              />
              <button className="ie-eye-button" onClick={() => toggleSecret('sumup_secret')}>
                {showSecrets.sumup_secret ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        </div>

        <TestButton
          service="sumup"
          onTest={() => testConnection('sumup')}
          result={testResults.sumup}
          disabled={!config.sumup_api_key && (!config.sumup_client_id || !config.sumup_client_secret)}
        />

        {/* SumUp Partner-Programm */}
        <div className="ie-partner-section">
          <div className="ie-section-header" style={{ marginTop: '1.25rem' }}>
            <Link2 size={20} color="#00b5ad" />
            <h4 className="ie-section-title" style={{ fontSize: '1rem' }}>Partner-Programm</h4>
          </div>
          <div className="ie-info-box">
            <p>
              Teile diesen Link mit neuen Dojos — sie erhalten Vorteile beim SumUp-Einstieg
              und du profitierst als Partner.
            </p>
          </div>
          {sumupPartnerUrl ? (
            <div className="ie-partner-url-row" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={sumupPartnerUrl}
                readOnly
                className="ie-input"
                style={{ flex: 1, minWidth: 220, background: 'rgba(0,181,173,0.06)', cursor: 'text' }}
              />
              <button
                className="ie-test-button"
                onClick={copyPartnerUrl}
                style={{ whiteSpace: 'nowrap' }}
              >
                {copiedPartner
                  ? <><CheckCircle size={16} color="#22c55e" /> Kopiert!</>
                  : <><Copy size={16} /> Link kopieren</>
                }
              </button>
            </div>
          ) : (
            <div className="ie-info-box" style={{ color: '#64748b' }}>
              <p>
                Kein Partner-Code konfiguriert. Bitte SUMUP_PARTNER_CODE in der Server-.env setzen.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* LexOffice Section */}
      <div className="ie-section">
        <div className="ie-section-header">
          <FileText size={24} color="#0066cc" />
          <h3 className="ie-section-title">LexOffice</h3>
          <a
            href="https://app.lexoffice.de/addons/public-api"
            target="_blank"
            rel="noopener noreferrer"
            className="ie-help-link"
          >
            <ExternalLink size={14} /> API-Schlüssel generieren
          </a>
        </div>

        <div className="ie-info-box">
          <p>
            Der API-Schlüssel wird in LexOffice unter Einstellungen → Erweiterungen → Public API generiert.
          </p>
        </div>

        <div className="ie-form-row">
          <div className="ie-form-group">
            <label className="ie-label">API-Schlüssel</label>
            <div className="ie-secret-input">
              <input
                type={showSecrets.lexoffice ? 'text' : 'password'}
                value={config.lexoffice_api_key || ''}
                onChange={e => setConfig({ ...config, lexoffice_api_key: e.target.value })}
                className="ie-input"
                placeholder="a1b2c3d4-e5f6-..."
              />
              <button className="ie-eye-button" onClick={() => toggleSecret('lexoffice')}>
                {showSecrets.lexoffice ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        </div>

        <TestButton
          service="lexoffice"
          onTest={() => testConnection('lexoffice')}
          result={testResults.lexoffice}
          disabled={!config.lexoffice_api_key}
        />
      </div>

      {/* DATEV Section */}
      <div className="ie-section">
        <div className="ie-section-header">
          <Calculator size={24} color="#006633" />
          <h3 className="ie-section-title">DATEV</h3>
        </div>

        <div className="ie-info-box">
          <p>
            Die Beraternummer und Mandantennummer werden vom Steuerberater bereitgestellt
            und sind für den DATEV-Export erforderlich.
          </p>
        </div>

        <div className="ie-form-row">
          <div className="ie-form-group">
            <label className="ie-label">Beraternummer</label>
            <input
              type="text"
              value={config.datev_consultant_number || ''}
              onChange={e => setConfig({ ...config, datev_consultant_number: e.target.value })}
              className="ie-input"
              placeholder="12345"
              maxLength={7}
            />
          </div>
          <div className="ie-form-group">
            <label className="ie-label">Mandantennummer</label>
            <input
              type="text"
              value={config.datev_client_number || ''}
              onChange={e => setConfig({ ...config, datev_client_number: e.target.value })}
              className="ie-input"
              placeholder="10001"
              maxLength={5}
            />
          </div>
        </div>

        <div className="ie-datev-info">
          <h4>DATEV-Export Formate:</h4>
          <ul>
            <li>Buchungsstapel (Rechnungen) - EXTF Format</li>
            <li>Zahlungen - EXTF Format</li>
            <li>Debitoren-Stammdaten - ASCII Format</li>
          </ul>
        </div>

        <a
          href="/datev-export"
          className="ie-datev-export-link"
        >
          <Calculator size={16} />
          Zum DATEV Export
          <ExternalLink size={14} />
        </a>
      </div>

      {/* Facebook Messenger Section */}
      <div className="ie-section">
        <div className="ie-section-header">
          <span style={{ fontSize: 24 }}>📘</span>
          <h3 className="ie-section-title">Facebook Messenger</h3>
        </div>

        {!hasMessenger ? (
          <div className="ie-upgrade-hint">
            <AlertCircle size={18} />
            <span>
              Facebook Messenger Integration ist für Dojos mit eigener Subdomain verfügbar.
              Bitte wende dich an den Administrator.
            </span>
          </div>
        ) : (
          <MessengerKonfiguration dojoId={dojoId} />
        )}
      </div>

      {/* Save Button */}
      <div className="ie-footer">
        <button
          className="ie-save-button"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <><RefreshCw size={18} className="spinning" /> Speichern...</>
          ) : (
            <><Save size={18} /> Einstellungen speichern</>
          )}
        </button>
      </div>
    </div>
  );
};

// Status Card Component
const StatusCard = ({ title, icon, configured, mode }) => (
  <div className={`ie-status-card${configured ? ' ie-status-card--ok' : ''}`}>
    <div className="ie-status-icon">{icon}</div>
    <div className="ie-status-info">
      <strong>{title}</strong>
      <span className={`ie-status-label${configured ? ' ie-status-label--ok' : ' ie-status-label--error'}`}>
        {configured ? 'Konfiguriert' : 'Nicht konfiguriert'}
        {mode && configured && ` (${mode})`}
      </span>
    </div>
    {configured ? (
      <CheckCircle size={20} color="#22c55e" />
    ) : (
      <AlertCircle size={20} color="#666" />
    )}
  </div>
);

// Test Button Component
const TestButton = ({ service, onTest, result, disabled }) => (
  <div className="ie-test-section">
    <button
      className="ie-test-button"
      onClick={onTest}
      disabled={disabled || result?.loading}
    >
      {result?.loading ? (
        <><RefreshCw size={16} className="spinning" /> Teste...</>
      ) : (
        <><Link2 size={16} /> Verbindung testen</>
      )}
    </button>

    {result && !result.loading && (
      <div className={`ie-test-result${result.success ? ' ie-test-result--ok' : ' ie-test-result--error'}`}>
        {result.success ? (
          <CheckCircle size={16} color="#22c55e" />
        ) : (
          <AlertCircle size={16} color="#ef4444" />
        )}
        <span>{result.message}</span>
      </div>
    )}
  </div>
);


export default IntegrationsEinstellungen;
