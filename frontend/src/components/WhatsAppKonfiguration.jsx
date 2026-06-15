// ============================================================================
// WHATSAPP KONFIGURATION
// Wiederverwendbare Komponente für die WhatsApp Business Cloud API Integration
// Verwendet in: DojoEdit (Admin) + IntegrationsEinstellungen (Dojo-Admin)
// ============================================================================

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Eye, EyeOff, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import '../styles/IntegrationsEinstellungen.css';

export default function WhatsAppKonfiguration({ dojoId }) {
  const [config, setConfig] = useState({
    phone_number_id: '',
    waba_id: '',
    access_token: '',
    app_secret: '',
    verify_token: '',
    display_number: '',
    is_active: false
  });
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showSecrets, setShowSecrets] = useState({});
  const [loading, setLoading] = useState(true);

  const params = dojoId ? `?dojo_id=${dojoId}` : '';

  useEffect(() => {
    if (dojoId) loadConfig();
  }, [dojoId]);

  const loadConfig = async () => {
    try {
      const res = await axios.get(`/whatsapp/config${params}`);
      setConfig(prev => ({ ...prev, ...res.data }));
    } catch (err) {
      if (err.response?.status !== 403) console.error('WhatsApp config Fehler:', err);
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    try {
      setSaving(true);
      const payload = {
        phone_number_id: config.phone_number_id,
        waba_id: config.waba_id,
        access_token: config.access_token,
        app_secret: config.app_secret,
        display_number: config.display_number,
        is_active: config.is_active
      };
      const res = await axios.put(`/whatsapp/config${params}`, payload);
      if (res.data.success) {
        setConfig(prev => ({ ...prev, verify_token: res.data.verify_token }));
        alert('WhatsApp-Konfiguration gespeichert!');
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  const testToken = async () => {
    try {
      setTestResult({ loading: true });
      const res = await axios.get(`/whatsapp/test-token${params}`);
      setTestResult({
        success: res.data.valid,
        message: res.data.valid
          ? `✓ Verbunden mit "${res.data.info?.verified_name || 'WhatsApp'}" (${res.data.info?.display_phone_number || ''})`
          : res.data.error || 'Token ungültig'
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err.response?.data?.error || 'Verbindung fehlgeschlagen'
      });
    }
  };

  if (loading) return <div className="ie-loading">Lade WhatsApp-Konfiguration…</div>;

  return (
    <div>
      <div className="ie-info-box">
        <p>
          Verbinde deine WhatsApp-Business-Nummer (Meta Cloud API) mit Dojosoftware. Eingehende
          WhatsApp-Nachrichten erscheinen im Chat-Dashboard unter dem Tab <strong>💬 WhatsApp</strong>.
        </p>
        <p style={{ marginTop: 8 }}>
          <strong>Webhook-URL:</strong>{' '}
          <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>
            https://dojo.tda-intl.org/api/whatsapp/webhook
          </code>
        </p>
        {config.verify_token && (
          <p style={{ marginTop: 4 }}>
            <strong>Verify Token:</strong>{' '}
            <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>
              {config.verify_token}
            </code>
          </p>
        )}
      </div>

      <div className="ie-form-row">
        <div className="ie-form-group">
          <label className="ie-label">Phone Number ID</label>
          <input
            type="text"
            value={config.phone_number_id || ''}
            onChange={e => setConfig(prev => ({ ...prev, phone_number_id: e.target.value }))}
            className="ie-input"
            placeholder="123456789012345"
          />
          <span className="ie-hint">Aus dem Meta WhatsApp-Manager (nicht die Telefonnummer)</span>
        </div>
        <div className="ie-form-group">
          <label className="ie-label">WhatsApp Business Account ID (WABA)</label>
          <input
            type="text"
            value={config.waba_id || ''}
            onChange={e => setConfig(prev => ({ ...prev, waba_id: e.target.value }))}
            className="ie-input"
            placeholder="987654321098765"
          />
          <span className="ie-hint">Optional — für spätere Funktionen</span>
        </div>
      </div>

      <div className="ie-form-row">
        <div className="ie-form-group">
          <label className="ie-label">Anzeige-Nummer</label>
          <input
            type="text"
            value={config.display_number || ''}
            onChange={e => setConfig(prev => ({ ...prev, display_number: e.target.value }))}
            className="ie-input"
            placeholder="+49 170 1234567"
          />
          <span className="ie-hint">Nur zur Anzeige im Dashboard</span>
        </div>
        <div className="ie-form-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 }}>
            <input
              type="checkbox"
              id="whatsapp-aktiv"
              checked={!!config.is_active}
              onChange={e => setConfig(prev => ({ ...prev, is_active: e.target.checked }))}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <label htmlFor="whatsapp-aktiv" className="ie-label" style={{ margin: 0, cursor: 'pointer' }}>
              Integration aktiv
            </label>
          </div>
        </div>
      </div>

      <div className="ie-form-row">
        <div className="ie-form-group">
          <label className="ie-label">Access Token</label>
          <div className="ie-secret-input">
            <input
              type={showSecrets.access_token ? 'text' : 'password'}
              value={config.access_token || ''}
              onChange={e => setConfig(prev => ({ ...prev, access_token: e.target.value }))}
              className="ie-input"
              placeholder="EAAxxxx…"
            />
            <button
              className="ie-eye-button"
              onClick={() => setShowSecrets(p => ({ ...p, access_token: !p.access_token }))}
            >
              {showSecrets.access_token ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <span className="ie-hint">Permanenter System-User-Token (Meta Business)</span>
        </div>
        <div className="ie-form-group">
          <label className="ie-label">App Secret</label>
          <div className="ie-secret-input">
            <input
              type={showSecrets.app_secret ? 'text' : 'password'}
              value={config.app_secret || ''}
              onChange={e => setConfig(prev => ({ ...prev, app_secret: e.target.value }))}
              className="ie-input"
              placeholder="abc123…"
            />
            <button
              className="ie-eye-button"
              onClick={() => setShowSecrets(p => ({ ...p, app_secret: !p.app_secret }))}
            >
              {showSecrets.app_secret ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <span className="ie-hint">Für die Webhook-Signaturprüfung (optional, empfohlen)</span>
        </div>
      </div>

      <div className="ie-test-section" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 16 }}>
        <button className="ie-save-button" onClick={save} disabled={saving} style={{ marginTop: 0 }}>
          {saving
            ? <><RefreshCw size={16} className="spinning" /> Speichern…</>
            : <><Save size={16} /> WhatsApp speichern</>
          }
        </button>
        {config.access_token && !config.access_token.includes('…') && (
          <button className="ie-test-button" onClick={testToken} disabled={testResult?.loading}>
            {testResult?.loading
              ? <><RefreshCw size={16} className="spinning" /> Teste…</>
              : 'Token testen'
            }
          </button>
        )}
        {testResult && !testResult.loading && (
          <div className={`ie-test-result ${testResult.success ? 'ie-test-result--success' : 'ie-test-result--error'}`}>
            {testResult.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
            {testResult.message}
          </div>
        )}
      </div>
    </div>
  );
}
