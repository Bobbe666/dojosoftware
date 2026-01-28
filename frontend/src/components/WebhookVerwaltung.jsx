// ============================================================================
// WEBHOOK-VERWALTUNG
// Frontend/src/components/WebhookVerwaltung.jsx
// Admin-Komponente für Webhook/Zapier-Management
// ============================================================================

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Webhook, Plus, Trash2, Edit2, Play, Eye, EyeOff, Copy, Check,
  AlertCircle, CheckCircle, Clock, RefreshCw, X, Zap
} from 'lucide-react';
import { useDojoContext } from '../context/DojoContext';

const WebhookVerwaltung = () => {
  const { activeDojo } = useDojoContext();
  const [webhooks, setWebhooks] = useState([]);
  const [availableEvents, setAvailableEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState(null);
  const [showSecret, setShowSecret] = useState({});
  const [copiedSecret, setCopiedSecret] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [showDeliveries, setShowDeliveries] = useState(null);
  const [deliveries, setDeliveries] = useState([]);

  const [formData, setFormData] = useState({
    name: '',
    url: '',
    events: [],
    active: true
  });

  const dojoId = activeDojo?.id || activeDojo;

  useEffect(() => {
    if (dojoId && dojoId !== 'super-admin') {
      loadWebhooks();
      loadAvailableEvents();
    }
  }, [dojoId]);

  const loadWebhooks = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/webhooks?dojo_id=${dojoId}`);
      setWebhooks(response.data);
    } catch (err) {
      console.error('Fehler beim Laden der Webhooks:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableEvents = async () => {
    try {
      const response = await axios.get('/webhooks/events');
      setAvailableEvents(response.data.events || []);
    } catch (err) {
      console.error('Fehler beim Laden der Events:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (editingWebhook) {
        await axios.put(`/webhooks/${editingWebhook.id}?dojo_id=${dojoId}`, formData);
      } else {
        const response = await axios.post('/webhooks', { ...formData, dojo_id: dojoId });
        // Bei neuen Webhooks das Secret anzeigen
        if (response.data.webhook?.secret) {
          alert(`Webhook erstellt!\n\nSecret (nur einmal sichtbar):\n${response.data.webhook.secret}\n\nBitte speichern Sie dieses Secret sicher!`);
        }
      }

      setShowModal(false);
      setEditingWebhook(null);
      setFormData({ name: '', url: '', events: [], active: true });
      loadWebhooks();
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      alert(err.response?.data?.error || 'Fehler beim Speichern');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Webhook wirklich löschen?')) return;

    try {
      await axios.delete(`/webhooks/${id}?dojo_id=${dojoId}`);
      loadWebhooks();
    } catch (err) {
      console.error('Fehler beim Löschen:', err);
    }
  };

  const handleTest = async (id) => {
    try {
      setTestResult({ id, loading: true });
      const response = await axios.post(`/webhooks/${id}/test?dojo_id=${dojoId}`);
      setTestResult({ id, ...response.data });
      setTimeout(() => setTestResult(null), 5000);
    } catch (err) {
      setTestResult({ id, success: false, error: err.message });
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  const handleRegenerateSecret = async (id) => {
    if (!confirm('Neues Secret generieren? Das alte Secret wird ungültig!')) return;

    try {
      const response = await axios.post(`/webhooks/${id}/regenerate-secret?dojo_id=${dojoId}`);
      alert(`Neues Secret:\n${response.data.secret}\n\nBitte speichern Sie dieses Secret sicher!`);
      loadWebhooks();
    } catch (err) {
      console.error('Fehler:', err);
    }
  };

  const loadDeliveries = async (webhookId) => {
    try {
      const response = await axios.get(`/webhooks/${webhookId}/deliveries?dojo_id=${dojoId}`);
      setDeliveries(response.data.deliveries || []);
      setShowDeliveries(webhookId);
    } catch (err) {
      console.error('Fehler beim Laden der Deliveries:', err);
    }
  };

  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSecret(id);
      setTimeout(() => setCopiedSecret(null), 2000);
    } catch (err) {
      console.error('Kopieren fehlgeschlagen:', err);
    }
  };

  const openEditModal = (webhook) => {
    setEditingWebhook(webhook);
    setFormData({
      name: webhook.name,
      url: webhook.url,
      events: webhook.events || [],
      active: webhook.active
    });
    setShowModal(true);
  };

  const toggleEvent = (eventKey) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(eventKey)
        ? prev.events.filter(e => e !== eventKey)
        : [...prev.events, eventKey]
    }));
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Lade Webhooks...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <Webhook size={32} color="#ffd700" />
          <div>
            <h2 style={styles.title}>Webhooks & Zapier</h2>
            <p style={styles.subtitle}>Automatisiere dein Dojo mit externen Services</p>
          </div>
        </div>
        <button style={styles.addButton} onClick={() => setShowModal(true)}>
          <Plus size={20} />
          Webhook erstellen
        </button>
      </div>

      {/* Zapier Info */}
      <div style={styles.zapierCard}>
        <Zap size={24} color="#ff4a00" />
        <div>
          <strong style={{ color: '#ff4a00' }}>Zapier Integration</strong>
          <p style={{ margin: '4px 0 0 0', color: '#aaa', fontSize: '14px' }}>
            Verbinde dein Dojo mit über 5.000 Apps wie Slack, Google Sheets, Mailchimp und mehr.
            Erstelle einen Webhook und nutze die URL in deinem Zapier Zap.
          </p>
        </div>
      </div>

      {/* Webhook Liste */}
      {webhooks.length === 0 ? (
        <div style={styles.emptyState}>
          <Webhook size={48} color="#666" />
          <p>Noch keine Webhooks konfiguriert</p>
          <button style={styles.addButton} onClick={() => setShowModal(true)}>
            Ersten Webhook erstellen
          </button>
        </div>
      ) : (
        <div style={styles.webhookList}>
          {webhooks.map(webhook => (
            <div key={webhook.id} style={styles.webhookCard}>
              <div style={styles.webhookHeader}>
                <div style={styles.webhookInfo}>
                  <div style={styles.webhookStatus}>
                    <span style={{
                      ...styles.statusDot,
                      background: webhook.active ? '#22c55e' : '#ef4444'
                    }} />
                    <h3 style={styles.webhookName}>{webhook.name}</h3>
                    {webhook.is_zapier && (
                      <span style={styles.zapierBadge}>
                        <Zap size={12} /> Zapier
                      </span>
                    )}
                  </div>
                  <p style={styles.webhookUrl}>{webhook.url}</p>
                </div>
                <div style={styles.webhookActions}>
                  <button
                    style={styles.iconButton}
                    onClick={() => handleTest(webhook.id)}
                    title="Test senden"
                  >
                    {testResult?.id === webhook.id && testResult.loading ? (
                      <RefreshCw size={18} className="spinning" />
                    ) : (
                      <Play size={18} />
                    )}
                  </button>
                  <button
                    style={styles.iconButton}
                    onClick={() => openEditModal(webhook)}
                    title="Bearbeiten"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    style={styles.iconButton}
                    onClick={() => handleDelete(webhook.id)}
                    title="Löschen"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Test Result */}
              {testResult?.id === webhook.id && !testResult.loading && (
                <div style={{
                  ...styles.testResult,
                  background: testResult.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  borderColor: testResult.success ? '#22c55e' : '#ef4444'
                }}>
                  {testResult.success ? (
                    <><CheckCircle size={16} /> Test erfolgreich (Status: {testResult.status})</>
                  ) : (
                    <><AlertCircle size={16} /> Test fehlgeschlagen: {testResult.error}</>
                  )}
                </div>
              )}

              {/* Events */}
              <div style={styles.eventTags}>
                {(webhook.events || []).map(event => (
                  <span key={event} style={styles.eventTag}>{event}</span>
                ))}
              </div>

              {/* Stats */}
              <div style={styles.webhookStats}>
                <div style={styles.stat}>
                  <CheckCircle size={14} color="#22c55e" />
                  <span>{webhook.success_count || 0} erfolgreich</span>
                </div>
                <div style={styles.stat}>
                  <AlertCircle size={14} color="#ef4444" />
                  <span>{webhook.failed_count || 0} fehlgeschlagen</span>
                </div>
                <div style={styles.stat}>
                  <Clock size={14} color="#aaa" />
                  <span>
                    {webhook.last_triggered
                      ? new Date(webhook.last_triggered).toLocaleString('de-DE')
                      : 'Noch nie'}
                  </span>
                </div>
                <button
                  style={styles.linkButton}
                  onClick={() => loadDeliveries(webhook.id)}
                >
                  Verlauf anzeigen
                </button>
              </div>

              {/* Secret */}
              <div style={styles.secretBox}>
                <span style={{ color: '#888' }}>Secret:</span>
                <code style={styles.secretCode}>
                  {showSecret[webhook.id] ? webhook.secret : '••••••••'}
                </code>
                <button
                  style={styles.tinyButton}
                  onClick={() => setShowSecret(prev => ({ ...prev, [webhook.id]: !prev[webhook.id] }))}
                >
                  {showSecret[webhook.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button
                  style={styles.tinyButton}
                  onClick={() => handleRegenerateSecret(webhook.id)}
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Webhook erstellen/bearbeiten */}
      {showModal && (
        <div style={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3>{editingWebhook ? 'Webhook bearbeiten' : 'Neuer Webhook'}</h3>
              <button style={styles.closeButton} onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={styles.input}
                  placeholder="z.B. Slack Benachrichtigung"
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Webhook URL</label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={e => setFormData({ ...formData, url: e.target.value })}
                  style={styles.input}
                  placeholder="https://hooks.zapier.com/..."
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Events auswählen</label>
                <div style={styles.eventGrid}>
                  {availableEvents.map(({ event, description }) => (
                    <label key={event} style={styles.eventCheckbox}>
                      <input
                        type="checkbox"
                        checked={formData.events.includes(event)}
                        onChange={() => toggleEvent(event)}
                      />
                      <span style={styles.eventLabel}>
                        <strong>{event}</strong>
                        <small>{description}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={e => setFormData({ ...formData, active: e.target.checked })}
                  />
                  Webhook aktiv
                </label>
              </div>

              <div style={styles.modalFooter}>
                <button type="button" style={styles.cancelButton} onClick={() => setShowModal(false)}>
                  Abbrechen
                </button>
                <button type="submit" style={styles.submitButton}>
                  {editingWebhook ? 'Speichern' : 'Erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Delivery Verlauf */}
      {showDeliveries && (
        <div style={styles.modalOverlay} onClick={() => setShowDeliveries(null)}>
          <div style={{ ...styles.modal, maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3>Webhook Verlauf</h3>
              <button style={styles.closeButton} onClick={() => setShowDeliveries(null)}>
                <X size={20} />
              </button>
            </div>

            <div style={styles.deliveryList}>
              {deliveries.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#888' }}>Noch keine Zustellungen</p>
              ) : (
                deliveries.map((d, i) => (
                  <div key={i} style={styles.deliveryItem}>
                    <div style={styles.deliveryStatus}>
                      {d.status === 'success' ? (
                        <CheckCircle size={16} color="#22c55e" />
                      ) : (
                        <AlertCircle size={16} color="#ef4444" />
                      )}
                    </div>
                    <div style={styles.deliveryInfo}>
                      <strong>{d.event_type}</strong>
                      <span style={{ color: '#888', fontSize: '12px' }}>
                        {new Date(d.created_at).toLocaleString('de-DE')}
                      </span>
                    </div>
                    <div style={styles.deliveryHttp}>
                      HTTP {d.http_status || '-'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    maxWidth: '1000px',
    margin: '0 auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
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
  addButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    background: '#ffd700',
    border: 'none',
    borderRadius: '8px',
    color: '#1a1a2e',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  zapierCard: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    background: 'rgba(255, 74, 0, 0.1)',
    border: '1px solid rgba(255, 74, 0, 0.3)',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px'
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#666'
  },
  webhookList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  webhookCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 215, 0, 0.2)',
    borderRadius: '12px',
    padding: '20px'
  },
  webhookHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  webhookInfo: {
    flex: 1
  },
  webhookStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%'
  },
  webhookName: {
    color: '#fff',
    margin: 0,
    fontSize: '16px'
  },
  zapierBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'rgba(255, 74, 0, 0.2)',
    color: '#ff4a00',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px'
  },
  webhookUrl: {
    color: '#888',
    margin: '4px 0 0 0',
    fontSize: '13px',
    fontFamily: 'monospace'
  },
  webhookActions: {
    display: 'flex',
    gap: '8px'
  },
  iconButton: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '6px',
    padding: '8px',
    color: '#fff',
    cursor: 'pointer'
  },
  testResult: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid',
    marginTop: '12px',
    fontSize: '13px'
  },
  eventTags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    marginTop: '12px'
  },
  eventTag: {
    background: 'rgba(59, 130, 246, 0.2)',
    color: '#3b82f6',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px'
  },
  webhookStats: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)'
  },
  stat: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#aaa',
    fontSize: '13px'
  },
  linkButton: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    color: '#ffd700',
    cursor: 'pointer',
    fontSize: '13px',
    textDecoration: 'underline'
  },
  secretBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '12px',
    padding: '8px 12px',
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '6px',
    fontSize: '12px'
  },
  secretCode: {
    color: '#ffd700',
    fontFamily: 'monospace'
  },
  tinyButton: {
    background: 'none',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    padding: '4px'
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999
  },
  modal: {
    background: '#1a1a2e',
    border: '2px solid #ffd700',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '500px',
    maxHeight: '90vh',
    overflow: 'auto'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid rgba(255, 215, 0, 0.2)'
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#fff',
    cursor: 'pointer'
  },
  formGroup: {
    padding: '0 20px',
    marginBottom: '16px'
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
  eventGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
    maxHeight: '200px',
    overflowY: 'auto'
  },
  eventCheckbox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    padding: '8px',
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  eventLabel: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: '12px',
    color: '#fff'
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#fff',
    cursor: 'pointer'
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '20px',
    borderTop: '1px solid rgba(255, 215, 0, 0.2)'
  },
  cancelButton: {
    padding: '10px 20px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer'
  },
  submitButton: {
    padding: '10px 20px',
    background: '#ffd700',
    border: 'none',
    borderRadius: '8px',
    color: '#1a1a2e',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  deliveryList: {
    padding: '20px',
    maxHeight: '400px',
    overflowY: 'auto'
  },
  deliveryItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '8px',
    marginBottom: '8px'
  },
  deliveryStatus: {
    flexShrink: 0
  },
  deliveryInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  deliveryHttp: {
    color: '#888',
    fontSize: '12px',
    fontFamily: 'monospace'
  },
  loading: {
    textAlign: 'center',
    padding: '60px',
    color: '#888'
  }
};

export default WebhookVerwaltung;
