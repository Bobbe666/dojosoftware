// ============================================================================
// MESSENGER KONFIGURATION
// Wiederverwendbare Komponente für Facebook Messenger Integration
// Verwendet in: DojoEdit (Admin) + IntegrationsEinstellungen (Dojo-Admin)
// ============================================================================

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, Eye, EyeOff, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import '../styles/IntegrationsEinstellungen.css';

export default function MessengerKonfiguration({ dojoId }) {
  const [config, setConfig] = useState({
    page_id: '',
    page_token: '',
    app_secret: '',
    verify_token: '',
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
      const res = await axios.get(`/messenger/config${params}`);
      setConfig(prev => ({ ...prev, ...res.data }));
    } catch (err) {
      if (err.response?.status !== 403) console.error('Messenger config Fehler:', err);
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    try {
      setSaving(true);
      const payload = {
        page_id: config.page_id,
        page_token: config.page_token,
        app_secret: config.app_secret,
        is_active: config.is_active
      };
      const res = await axios.put(`/messenger/config${params}`, payload);
      if (res.data.success) {
        setConfig(prev => ({ ...prev, verify_token: res.data.verify_token }));
        alert('Messenger-Konfiguration gespeichert!');
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
      const res = await axios.get(`/messenger/test-token${params}`);
      setTestResult({
        success: res.data.valid,
        message: res.data.valid
          ? `✓ Verbunden mit "${res.data.page_name}" (ID: ${res.data.page_id})`
          : res.data.error || 'Token ungültig'
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err.response?.data?.error || 'Verbindung fehlgeschlagen'
      });
    }
  };

  if (loading) return <div className="ie-loading">Lade Messenger-Konfiguration…</div>;

  return (
    <div>
      <div className="ie-info-box">
        <p>
          Verbinde deine Facebook-Seite mit Dojosoftware. Eingehende Messenger-Nachrichten
          erscheinen im Chat-Dashboard unter dem Tab <strong>📘 Messenger</strong>.
        </p>
        <p style={{ marginTop: 8 }}>
          <strong>Webhook-URL:</strong>{' '}
          <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>
            https://dojo.tda-intl.org/api/messenger/webhook
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
          <label className="ie-label">Facebook Page ID</label>
          <input
            type="text"
            value={config.page_id || ''}
            onChange={e => setConfig(prev => ({ ...prev, page_id: e.target.value }))}
            className="ie-input"
            placeholder="123456789012345"
          />
          <span className="ie-hint">Die numerische ID deiner Facebook-Seite</span>
        </div>
        <div className="ie-form-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 24 }}>
            <input
              type="checkbox"
              id="messenger-aktiv"
              checked={!!config.is_active}
              onChange={e => setConfig(prev => ({ ...prev, is_active: e.target.checked }))}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <label htmlFor="messenger-aktiv" className="ie-label" style={{ margin: 0, cursor: 'pointer' }}>
              Integration aktiv
            </label>
          </div>
        </div>
      </div>

      <div className="ie-form-row">
        <div className="ie-form-group">
          <label className="ie-label">Page Access Token</label>
          <div className="ie-secret-input">
            <input
              type={showSecrets.page_token ? 'text' : 'password'}
              value={config.page_token || ''}
              onChange={e => setConfig(prev => ({ ...prev, page_token: e.target.value }))}
              className="ie-input"
              placeholder="EAAxxxx…"
            />
            <button
              className="ie-eye-button"
              onClick={() => setShowSecrets(p => ({ ...p, page_token: !p.page_token }))}
            >
              {showSecrets.page_token ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
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
        </div>
      </div>

      <div className="ie-test-section" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginTop: 16 }}>
        <button className="ie-save-button" onClick={save} disabled={saving} style={{ marginTop: 0 }}>
          {saving
            ? <><RefreshCw size={16} className="spinning" /> Speichern…</>
            : <><Save size={16} /> Messenger speichern</>
          }
        </button>
        {config.page_token && !config.page_token.includes('...') && (
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
