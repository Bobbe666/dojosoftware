import React, { useState } from 'react';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import '../styles/TestNotificationButton.css';


const TestNotificationButton = () => {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const createTestNotification = async () => {
    setLoading(true);
    setMessage('');

    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/notifications/admin/test-registration`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setMessage('✅ ' + data.message);
      } else {
        setMessage('❌ ' + (data.message || 'Fehler beim Erstellen der Benachrichtigung'));
      }
    } catch (error) {
      setMessage('❌ Fehler: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const checkDebugInfo = async () => {
    setLoading(true);
    setMessage('');

    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/notifications/admin/debug`);
      const data = await response.json();

      console.log('🔍 Debug Info:', data);

      if (data.success) {
        setMessage(`✅ Tabelle existiert: ${data.tableExists}\n📊 Benachrichtigungen: ${data.totalCount}\n💾 Siehe Console für Details`);
      } else {
        setMessage('❌ ' + data.message);
      }
    } catch (error) {
      setMessage('❌ Fehler: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const runMigration = async () => {
    setLoading(true);
    setMessage('');

    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/notifications/admin/migrate`, {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        setMessage('✅ ' + data.message);
      } else {
        setMessage('❌ ' + (data.message || 'Fehler bei der Migration'));
      }
    } catch (error) {
      setMessage('❌ Fehler: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="test-notification-panel">
      <h3 className="test-notification-title">
        🧪 Test-Benachrichtigung
      </h3>

      <button className="tnb-btn tnb-btn--gold" onClick={createTestNotification} disabled={loading}>
        {loading ? 'Erstelle...' : 'Test-Benachrichtigung erstellen'}
      </button>

      <button className="tnb-btn tnb-btn--amber" onClick={runMigration} disabled={loading}>
        {loading ? 'Führe aus...' : '🔧 Tabelle migrieren'}
      </button>

      <button className="tnb-btn tnb-btn--blue" onClick={checkDebugInfo} disabled={loading}>
        {loading ? 'Lade...' : 'Debug-Info anzeigen'}
      </button>

      {message && (
        <div className={`tnb-message${message.startsWith('✅') ? ' tnb-message--ok' : ' tnb-message--error'}`}>
          {message}
        </div>
      )}
    </div>
  );
};

export default TestNotificationButton;
