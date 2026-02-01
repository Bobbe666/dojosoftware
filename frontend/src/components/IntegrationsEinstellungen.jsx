// ============================================================================
// INTEGRATIONS-EINSTELLUNGEN
// Frontend/src/components/IntegrationsEinstellungen.jsx
// Admin-Komponente für PayPal, LexOffice, DATEV Konfiguration
// ============================================================================

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Settings, CreditCard, FileText, Calculator, Save, Eye, EyeOff,
  CheckCircle, AlertCircle, RefreshCw, ExternalLink, Link2
} from 'lucide-react';
import { useDojoContext } from '../context/DojoContext';

const IntegrationsEinstellungen = () => {
  const { activeDojo } = useDojoContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [showSecrets, setShowSecrets] = useState({});
  const [testResults, setTestResults] = useState({});

  const [config, setConfig] = useState({
    // Stripe
    stripe_publishable_key: '',
    stripe_secret_key: '',
    // PayPal
    paypal_client_id: '',
    paypal_client_secret: '',
    paypal_sandbox: true,
    // LexOffice
    lexoffice_api_key: '',
    // DATEV
    datev_consultant_number: '',
    datev_client_number: ''
  });

  const dojoId = activeDojo?.id || activeDojo;

  useEffect(() => {
    if (dojoId && dojoId !== 'super-admin') {
      loadConfig();
      loadStatus();
    }
  }, [dojoId]);

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

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Lade Einstellungen...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <Settings size={32} color="#ffd700" />
        <div>
          <h2 style={styles.title}>Integration-Einstellungen</h2>
          <p style={styles.subtitle}>Konfiguriere PayPal, LexOffice und DATEV</p>
        </div>
      </div>

      {/* Status Overview */}
      {status && (
        <div style={styles.statusGrid}>
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

      {/* Stripe Section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <CreditCard size={24} color="#635bff" />
          <h3 style={styles.sectionTitle}>Stripe</h3>
          <a
            href="https://dashboard.stripe.com/apikeys"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.helpLink}
          >
            <ExternalLink size={14} /> API-Keys Dashboard
          </a>
        </div>

        <div style={styles.infoBox}>
          <p>
            Stripe ermöglicht Kreditkarten- und SEPA-Lastschrift-Zahlungen. Die API-Keys findest du
            im Stripe Dashboard unter Developers → API Keys.
          </p>
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Publishable Key (öffentlich)</label>
            <input
              type="text"
              value={config.stripe_publishable_key || ''}
              onChange={e => setConfig({ ...config, stripe_publishable_key: e.target.value })}
              style={styles.input}
              placeholder="pk_live_... oder pk_test_..."
            />
          </div>
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Secret Key (geheim)</label>
            <div style={styles.secretInput}>
              <input
                type={showSecrets.stripe ? 'text' : 'password'}
                value={config.stripe_secret_key || ''}
                onChange={e => setConfig({ ...config, stripe_secret_key: e.target.value })}
                style={{ ...styles.input, flex: 1 }}
                placeholder="sk_live_... oder sk_test_..."
              />
              <button style={styles.eyeButton} onClick={() => toggleSecret('stripe')}>
                {showSecrets.stripe ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        </div>

        <div style={{
          ...styles.infoBox,
          background: 'rgba(99, 91, 255, 0.1)',
          borderColor: 'rgba(99, 91, 255, 0.3)'
        }}>
          <p style={{ margin: 0 }}>
            <strong>Hinweis:</strong> Verwende für Tests die Test-Keys (pk_test_... / sk_test_...).
            Für Live-Zahlungen benötigst du die Live-Keys (pk_live_... / sk_live_...).
          </p>
        </div>
      </div>

      {/* PayPal Section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <CreditCard size={24} color="#0070ba" />
          <h3 style={styles.sectionTitle}>PayPal</h3>
          <a
            href="https://developer.paypal.com/dashboard/applications"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.helpLink}
          >
            <ExternalLink size={14} /> Entwickler-Dashboard
          </a>
        </div>

        <div style={styles.infoBox}>
          <p>
            Um PayPal zu nutzen, erstelle eine App im PayPal Developer Dashboard und kopiere
            die Client ID und das Secret hierher.
          </p>
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Client ID</label>
            <input
              type="text"
              value={config.paypal_client_id || ''}
              onChange={e => setConfig({ ...config, paypal_client_id: e.target.value })}
              style={styles.input}
              placeholder="AV9b8ND..."
            />
          </div>
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Client Secret</label>
            <div style={styles.secretInput}>
              <input
                type={showSecrets.paypal ? 'text' : 'password'}
                value={config.paypal_client_secret || ''}
                onChange={e => setConfig({ ...config, paypal_client_secret: e.target.value })}
                style={{ ...styles.input, flex: 1 }}
                placeholder="EK3qE9N..."
              />
              <button style={styles.eyeButton} onClick={() => toggleSecret('paypal')}>
                {showSecrets.paypal ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        </div>

        <div style={styles.formRow}>
          <label style={styles.checkboxLabel}>
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

      {/* LexOffice Section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <FileText size={24} color="#0066cc" />
          <h3 style={styles.sectionTitle}>LexOffice</h3>
          <a
            href="https://app.lexoffice.de/addons/public-api"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.helpLink}
          >
            <ExternalLink size={14} /> API-Schlüssel generieren
          </a>
        </div>

        <div style={styles.infoBox}>
          <p>
            Der API-Schlüssel wird in LexOffice unter Einstellungen → Erweiterungen → Public API generiert.
          </p>
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>API-Schlüssel</label>
            <div style={styles.secretInput}>
              <input
                type={showSecrets.lexoffice ? 'text' : 'password'}
                value={config.lexoffice_api_key || ''}
                onChange={e => setConfig({ ...config, lexoffice_api_key: e.target.value })}
                style={{ ...styles.input, flex: 1 }}
                placeholder="a1b2c3d4-e5f6-..."
              />
              <button style={styles.eyeButton} onClick={() => toggleSecret('lexoffice')}>
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
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <Calculator size={24} color="#006633" />
          <h3 style={styles.sectionTitle}>DATEV</h3>
        </div>

        <div style={styles.infoBox}>
          <p>
            Die Beraternummer und Mandantennummer werden vom Steuerberater bereitgestellt
            und sind für den DATEV-Export erforderlich.
          </p>
        </div>

        <div style={styles.formRow}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Beraternummer</label>
            <input
              type="text"
              value={config.datev_consultant_number || ''}
              onChange={e => setConfig({ ...config, datev_consultant_number: e.target.value })}
              style={styles.input}
              placeholder="12345"
              maxLength={7}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Mandantennummer</label>
            <input
              type="text"
              value={config.datev_client_number || ''}
              onChange={e => setConfig({ ...config, datev_client_number: e.target.value })}
              style={styles.input}
              placeholder="10001"
              maxLength={5}
            />
          </div>
        </div>

        <div style={styles.datevInfo}>
          <h4 style={{ color: '#ffd700', margin: '0 0 8px 0' }}>DATEV-Export Formate:</h4>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#aaa' }}>
            <li>Buchungsstapel (Rechnungen) - EXTF Format</li>
            <li>Zahlungen - EXTF Format</li>
            <li>Debitoren-Stammdaten - ASCII Format</li>
          </ul>
        </div>
      </div>

      {/* Save Button */}
      <div style={styles.footer}>
        <button
          style={styles.saveButton}
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
  <div style={{
    ...styles.statusCard,
    borderColor: configured ? 'rgba(34, 197, 94, 0.5)' : 'rgba(255, 255, 255, 0.1)'
  }}>
    <div style={styles.statusIcon}>{icon}</div>
    <div style={styles.statusInfo}>
      <strong>{title}</strong>
      <span style={{
        color: configured ? '#22c55e' : '#ef4444',
        fontSize: '12px'
      }}>
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
  <div style={styles.testSection}>
    <button
      style={{
        ...styles.testButton,
        opacity: disabled ? 0.5 : 1
      }}
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
      <div style={{
        ...styles.testResult,
        background: result.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
        borderColor: result.success ? '#22c55e' : '#ef4444'
      }}>
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

const styles = {
  container: {
    padding: '24px',
    maxWidth: '900px',
    margin: '0 auto'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '32px'
  },
  title: {
    color: '#ffd700',
    margin: 0,
    fontSize: '24px'
  },
  subtitle: {
    color: '#aaa',
    margin: '4px 0 0 0',
    fontSize: '14px'
  },
  statusGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '32px'
  },
  statusCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid',
    borderRadius: '12px'
  },
  statusIcon: {
    color: '#ffd700'
  },
  statusInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    color: '#fff'
  },
  section: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 215, 0, 0.2)',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '20px'
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px'
  },
  sectionTitle: {
    color: '#fff',
    margin: 0,
    fontSize: '18px',
    flex: 1
  },
  helpLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: '#ffd700',
    textDecoration: 'none',
    fontSize: '13px'
  },
  infoBox: {
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '20px',
    color: '#aaa',
    fontSize: '14px'
  },
  formRow: {
    display: 'flex',
    gap: '16px',
    marginBottom: '16px'
  },
  formGroup: {
    flex: 1
  },
  label: {
    display: 'block',
    color: '#ffd700',
    marginBottom: '8px',
    fontSize: '14px'
  },
  input: {
    width: '100%',
    padding: '12px',
    background: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 215, 0, 0.3)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    boxSizing: 'border-box'
  },
  secretInput: {
    display: 'flex',
    gap: '8px'
  },
  eyeButton: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    padding: '12px',
    color: '#fff',
    cursor: 'pointer'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px'
  },
  testSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)'
  },
  testButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px'
  },
  testResult: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid',
    fontSize: '13px'
  },
  datevInfo: {
    background: 'rgba(0, 102, 51, 0.1)',
    border: '1px solid rgba(0, 102, 51, 0.3)',
    borderRadius: '8px',
    padding: '16px',
    marginTop: '16px'
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '24px'
  },
  saveButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '14px 28px',
    background: '#ffd700',
    border: 'none',
    borderRadius: '8px',
    color: '#1a1a2e',
    fontWeight: 'bold',
    fontSize: '16px',
    cursor: 'pointer'
  },
  loading: {
    textAlign: 'center',
    padding: '60px',
    color: '#888'
  }
};

export default IntegrationsEinstellungen;
