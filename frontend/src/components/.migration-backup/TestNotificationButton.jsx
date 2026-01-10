import React, { useState } from 'react';
import config from '../config/config.js';

const TestNotificationButton = () => {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const createTestNotification = async () => {
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${config.apiBaseUrl}/notifications/admin/test-registration`, {
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
      const response = await fetch(`${config.apiBaseUrl}/notifications/admin/debug`);
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
      const response = await fetch(`${config.apiBaseUrl}/notifications/admin/migrate`, {
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
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      background: '#1e1e2d',
      border: '2px solid #ffd700',
      borderRadius: '12px',
      padding: '1.5rem',
      zIndex: 9999,
      minWidth: '300px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
    }}>
      <h3 style={{ color: '#ffd700', margin: '0 0 1rem 0', fontSize: '1.1rem' }}>
        🧪 Test-Benachrichtigung
      </h3>

      <button
        onClick={createTestNotification}
        disabled={loading}
        style={{
          width: '100%',
          padding: '0.8rem',
          background: '#ffd700',
          border: 'none',
          borderRadius: '8px',
          color: '#1e1e2d',
          fontWeight: '600',
          fontSize: '1rem',
          cursor: loading ? 'not-allowed' : 'pointer',
          marginBottom: '0.5rem',
          opacity: loading ? 0.6 : 1
        }}
      >
        {loading ? 'Erstelle...' : 'Test-Benachrichtigung erstellen'}
      </button>

      <button
        onClick={runMigration}
        disabled={loading}
        style={{
          width: '100%',
          padding: '0.8rem',
          background: '#F59E0B',
          border: 'none',
          borderRadius: '8px',
          color: '#fff',
          fontWeight: '600',
          fontSize: '1rem',
          cursor: loading ? 'not-allowed' : 'pointer',
          marginBottom: '0.5rem',
          opacity: loading ? 0.6 : 1
        }}
      >
        {loading ? 'Führe aus...' : '🔧 Tabelle migrieren'}
      </button>

      <button
        onClick={checkDebugInfo}
        disabled={loading}
        style={{
          width: '100%',
          padding: '0.8rem',
          background: '#3B82F6',
          border: 'none',
          borderRadius: '8px',
          color: '#fff',
          fontWeight: '600',
          fontSize: '1rem',
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1
        }}
      >
        {loading ? 'Lade...' : 'Debug-Info anzeigen'}
      </button>

      {message && (
        <div style={{
          marginTop: '1rem',
          padding: '0.8rem',
          background: message.startsWith('✅') ? '#1a3d2e' : '#3d1a1a',
          border: `2px solid ${message.startsWith('✅') ? '#22c55e' : '#ff4545'}`,
          borderRadius: '8px',
          color: message.startsWith('✅') ? '#4ade80' : '#ff6b6b',
          fontSize: '0.9rem',
          whiteSpace: 'pre-wrap'
        }}>
          {message}
        </div>
      )}
    </div>
  );
};

export default TestNotificationButton;
