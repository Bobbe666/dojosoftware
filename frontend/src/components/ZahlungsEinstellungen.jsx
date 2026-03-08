import React, { useState, useEffect } from 'react';
import config from '../config/config.js';
import '../styles/themes.css';
import '../styles/components.css';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import '../styles/ZahlungsEinstellungen.css';


const ZahlungsEinstellungen = () => {
  const [paymentProvider, setPaymentProvider] = useState('manual_sepa');
  const [providerStatus, setProviderStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [stripeConfig, setStripeConfig] = useState({
    stripe_secret_key: '',
    stripe_publishable_key: ''
  });

  const [datevConfig, setDatevConfig] = useState({
    datev_api_key: '',
    datev_consultant_number: '',
    datev_client_number: ''
  });

  useEffect(() => {
    loadCurrentSettings();
  }, []);

  const loadCurrentSettings = async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth(`${config.apiBaseUrl}/payment-provider/status`);

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Einstellungen');
      }

      const data = await response.json();
      setProviderStatus(data);
      setPaymentProvider(data.current_provider);

      // Load configuration if available
      if (data.current_provider === 'stripe_datev') {
        // Don't load sensitive keys for security reasons
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

    } catch (error) {
      console.error('Fehler beim Laden der Einstellungen:', error);
      setError('Fehler beim Laden der aktuellen Einstellungen');
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (newProvider) => {
    setPaymentProvider(newProvider);
    setError('');
    setSuccess('');
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const configData = {
        payment_provider: paymentProvider,
        ...stripeConfig,
        ...datevConfig
      };

      const response = await fetchWithAuth(`${config.apiBaseUrl}/payment-provider/configure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(configData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Fehler beim Speichern der Konfiguration');
      }

      setSuccess('Zahlungssystem erfolgreich konfiguriert!');
      await loadCurrentSettings(); // Reload to get updated status

    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Lade Zahlungseinstellungen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="page-header">
        <h2 className="page-title">💳 Zahlungssystem-Konfiguration</h2>
        <p className="page-subtitle">Wählen Sie Ihr bevorzugtes Zahlungssystem</p>
      </div>

      {error && (
        <div className="alert error mb-2rem">
          ❌ {error}
        </div>
      )}

      {success && (
        <div className="alert success mb-2rem">
          ✅ {success}
        </div>
      )}

      {/* Current Status */}
      {providerStatus && (
        <div className="standard-card mb-2rem">
          <div className="standard-card-content">
            <h3 className="standard-card-title">Aktueller Status</h3>
            <div className="provider-status">
              <p><strong>System:</strong> {providerStatus.provider_name}</p>
              <p><strong>Status:</strong>
                <span className={`status-badge ${providerStatus.is_configured ? 'success' : 'warning'}`}>
                  {providerStatus.is_configured ? '✅ Konfiguriert' : '⚠️ Nicht vollständig konfiguriert'}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Provider Selection */}
      <div className="provider-selection mb-2rem">
        <div className="payment-options">

          {/* Manual SEPA Option */}
          <div className={`provider-option ${paymentProvider === 'manual_sepa' ? 'selected' : ''}`}>
            <label>
              <input
                type="radio"
                value="manual_sepa"
                checked={paymentProvider === 'manual_sepa'}
                onChange={(e) => handleProviderChange(e.target.value)}
              />
              <div className="option-content">
                <div className="option-header">
                  <h3>🏪 Manuelle SEPA-Abwicklung</h3>
                  <div className="option-badge current">Aktuell verfügbar</div>
                </div>
                <p className="option-description">
                  Bestehende manuelle Lastschrift-Verwaltung mit SEPA-Mandaten
                </p>
                <div className="pros-cons">
                  <div className="pros">
                    <h4>✅ Vorteile:</h4>
                    <ul>
                      <li>Bereits vollständig implementiert</li>
                      <li>Keine externen Transaktionskosten</li>
                      <li>Vollständige Kontrolle über den Prozess</li>
                      <li>SEPA-konforme PDF-Generation</li>
                    </ul>
                  </div>
                  <div className="cons">
                    <h4>❌ Nachteile:</h4>
                    <ul>
                      <li>Manuelle Buchhaltungsarbeit erforderlich</li>
                      <li>Zeitaufwand für Zahlungsabwicklung</li>
                      <li>Keine automatische DATEV-Integration</li>
                    </ul>
                  </div>
                </div>
              </div>
            </label>
          </div>

          {/* Stripe + DATEV Option */}
          <div className={`provider-option ${paymentProvider === 'stripe_datev' ? 'selected' : ''}`}>
            <label>
              <input
                type="radio"
                value="stripe_datev"
                checked={paymentProvider === 'stripe_datev'}
                onChange={(e) => handleProviderChange(e.target.value)}
              />
              <div className="option-content">
                <div className="option-header">
                  <h3>💳 Stripe + DATEV Integration</h3>
                  <div className="option-badge new">Neu & Professionell</div>
                </div>
                <p className="option-description">
                  Professionelle Zahlungsabwicklung mit automatischer Buchhaltung
                </p>
                <div className="pros-cons">
                  <div className="pros">
                    <h4>✅ Vorteile:</h4>
                    <ul>
                      <li>Automatische DATEV-Übertragung</li>
                      <li>Professionelle Zahlungsabwicklung</li>
                      <li>Zeitersparnis durch Automatisierung</li>
                      <li>Bessere Nachverfolgung und Reporting</li>
                      <li>Steuerberater hat sofort alle Daten</li>
                    </ul>
                  </div>
                  <div className="cons">
                    <h4>❌ Nachteile:</h4>
                    <ul>
                      <li>Stripe-Gebühren: 0,35€ + 1,4% pro Transaktion</li>
                      <li>Konfiguration von API-Schlüsseln erforderlich</li>
                      <li>Abhängigkeit von externen Diensten</li>
                    </ul>
                  </div>
                </div>
              </div>
            </label>
          </div>

        </div>
      </div>

      {/* Configuration Forms */}
      {paymentProvider === 'stripe_datev' && (
        <div className="configuration-forms">

          {/* Stripe Configuration */}
          <div className="standard-card mb-1rem">
            <div className="standard-card-content">
              <h3 className="standard-card-title">🔑 Stripe Konfiguration</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="stripe_secret_key">Secret Key (sk_...)</label>
                  <input
                    type="password"
                    id="stripe_secret_key"
                    value={stripeConfig.stripe_secret_key}
                    onChange={(e) => setStripeConfig({...stripeConfig, stripe_secret_key: e.target.value})}
                    placeholder="sk_test_... oder sk_live_..."
                  />
                  <small>Geheimer Schlüssel für Server-side API Aufrufe</small>
                </div>
                <div className="form-group">
                  <label htmlFor="stripe_publishable_key">Publishable Key (pk_...)</label>
                  <input
                    type="text"
                    id="stripe_publishable_key"
                    value={stripeConfig.stripe_publishable_key}
                    onChange={(e) => setStripeConfig({...stripeConfig, stripe_publishable_key: e.target.value})}
                    placeholder="pk_test_... oder pk_live_..."
                  />
                  <small>Öffentlicher Schlüssel für Frontend-Integration</small>
                </div>
              </div>
            </div>
          </div>

          {/* DATEV Configuration */}
          <div className="standard-card mb-1rem">
            <div className="standard-card-content">
              <h3 className="standard-card-title">📊 DATEV Konfiguration</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="datev_api_key">DATEV API Key</label>
                  <input
                    type="password"
                    id="datev_api_key"
                    value={datevConfig.datev_api_key}
                    onChange={(e) => setDatevConfig({...datevConfig, datev_api_key: e.target.value})}
                    placeholder="DATEV API Schlüssel"
                  />
                  <small>API-Schlüssel für DATEV-Integration</small>
                </div>
                <div className="form-group">
                  <label htmlFor="datev_consultant_number">Beraternummer</label>
                  <input
                    type="text"
                    id="datev_consultant_number"
                    value={datevConfig.datev_consultant_number}
                    onChange={(e) => setDatevConfig({...datevConfig, datev_consultant_number: e.target.value})}
                    placeholder="12345"
                  />
                  <small>DATEV Beraternummer</small>
                </div>
                <div className="form-group">
                  <label htmlFor="datev_client_number">Mandantennummer</label>
                  <input
                    type="text"
                    id="datev_client_number"
                    value={datevConfig.datev_client_number}
                    onChange={(e) => setDatevConfig({...datevConfig, datev_client_number: e.target.value})}
                    placeholder="123"
                  />
                  <small>DATEV Mandantennummer</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cost Comparison */}
      <div className="standard-card mb-2rem">
        <div className="standard-card-content">
          <h3 className="standard-card-title">💰 Kostenvergleich</h3>
          <div className="cost-comparison">
            <div className="cost-option">
              <h4>Manual SEPA</h4>
              <div className="cost-details">
                <p><strong>Transaktionsgebühren:</strong> 0€</p>
                <p><strong>Zeitaufwand:</strong> ~2h/Monat</p>
                <p><strong>Buchhaltung:</strong> Manuell</p>
              </div>
            </div>
            <div className="cost-option">
              <h4>Stripe + DATEV</h4>
              <div className="cost-details">
                <p><strong>Transaktionsgebühren:</strong> 0,35€ + 1,4%</p>
                <p><strong>Zeitaufwand:</strong> ~0h/Monat</p>
                <p><strong>Buchhaltung:</strong> Vollautomatisch</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="action-buttons">
        <button
          className="btn btn-primary"
          onClick={handleSaveSettings}
          disabled={saving}
        >
          {saving ? (
            <>
              <div className="loading-spinner small"></div>
              Speichere...
            </>
          ) : (
            <>
              💾 Konfiguration speichern
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ZahlungsEinstellungen;