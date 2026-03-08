import React, { useState, useEffect } from 'react';
import { ThumbsUp, Plus, Filter, MessageSquare, CheckCircle, Clock, Lightbulb, X, Edit3, Trash2, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import '../styles/FeatureBoard.css';
import config from '../config/config';

const FeatureBoard = ({ compact = false, adminMode = false }) => {
  const { token, user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [filter, setFilter] = useState({ status: 'alle', kategorie: 'alle', sortBy: 'votes' });

  // Neuer Request Form
  const [newRequest, setNewRequest] = useState({ titel: '', beschreibung: '', kategorie: 'funktion' });
  const [submitting, setSubmitting] = useState(false);

  // Admin Edit State
  const [editingId, setEditingId] = useState(null);
  const [editStatus, setEditStatus] = useState('');
  const [editComment, setEditComment] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchWithAuth = async (url, options = {}) => {
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers };
    return fetch(url, { ...options, headers });
  };

  const loadRequests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        status: filter.status,
        kategorie: filter.kategorie,
        sortBy: filter.sortBy,
        limit: compact ? '5' : '50'
      });

      const response = await fetchWithAuth(`${config.apiBaseUrl}/feature-requests?${params}`);
      const data = await response.json();

      if (data.success) {
        setRequests(data.data);
        setStats(data.stats);
      }
    } catch (err) {
      setError('Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) loadRequests();
  }, [token, filter]);

  const handleVote = async (id) => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/feature-requests/${id}/vote`, { method: 'POST' });
      const data = await response.json();

      if (data.success) {
        setRequests(prev => prev.map(r =>
          r.id === id ? { ...r, user_voted: data.voted ? 1 : 0, votes_count: r.votes_count + (data.voted ? 1 : -1) } : r
        ));
      }
    } catch (err) {
      console.error('Vote error:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newRequest.titel.trim() || newRequest.titel.length < 5) {
      setError('Titel muss mindestens 5 Zeichen haben');
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetchWithAuth(`${config.apiBaseUrl}/feature-requests`, {
        method: 'POST',
        body: JSON.stringify(newRequest)
      });

      const data = await response.json();

      if (data.success) {
        setNewRequest({ titel: '', beschreibung: '', kategorie: 'funktion' });
        setShowNewForm(false);
        loadRequests();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Fehler beim Einreichen');
    } finally {
      setSubmitting(false);
    }
  };

  // Admin: Status aendern
  const handleStatusChange = async (id) => {
    if (!editStatus) return;

    try {
      setSaving(true);
      const response = await fetchWithAuth(`${config.apiBaseUrl}/feature-requests/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: editStatus, admin_kommentar: editComment || null })
      });

      const data = await response.json();

      if (data.success) {
        setEditingId(null);
        setEditStatus('');
        setEditComment('');
        loadRequests();
      } else {
        setError(data.error || 'Fehler beim Speichern');
      }
    } catch (err) {
      setError('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  // Admin: Loeschen
  const handleDelete = async (id, titel) => {
    if (!window.confirm(`Feature-Wunsch "${titel}" wirklich loeschen?`)) return;

    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/feature-requests/${id}`, { method: 'DELETE' });
      const data = await response.json();

      if (data.success) {
        loadRequests();
      } else {
        setError(data.error || 'Fehler beim Loeschen');
      }
    } catch (err) {
      setError('Fehler beim Loeschen');
    }
  };

  // Admin: Bearbeitung starten
  const startEditing = (req) => {
    setEditingId(req.id);
    setEditStatus(req.status);
    setEditComment(req.admin_kommentar || '');
  };

  const statusConfig = {
    neu: { color: 'var(--warning)', bg: 'rgba(245, 158, 11, 0.15)', label: 'Neu', icon: Lightbulb },
    geprueft: { color: 'var(--info)', bg: 'rgba(59, 130, 246, 0.15)', label: 'Geprueft', icon: CheckCircle },
    geplant: { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', label: 'Geplant', icon: Clock },
    in_arbeit: { color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)', label: 'In Arbeit', icon: Clock },
    umgesetzt: { color: 'var(--success)', bg: 'rgba(16, 185, 129, 0.15)', label: 'Umgesetzt', icon: CheckCircle },
    abgelehnt: { color: 'var(--text-muted)', bg: 'rgba(107, 114, 128, 0.15)', label: 'Abgelehnt', icon: X }
  };

  const kategorieLabels = {
    funktion: 'Neue Funktion',
    verbesserung: 'Verbesserung',
    integration: 'Integration',
    design: 'Design',
    sonstiges: 'Sonstiges'
  };

  if (compact) {
    return (
      <div className="fb-compact-card">
        <div className="fb-compact-header">
          <h3 className="fb-compact-title">
            <Lightbulb size={20} /> Feature-Wuensche
          </h3>
          <button
            onClick={() => setShowNewForm(true)}
            className="fb-btn-add-compact"
          >
            <Plus size={16} /> Idee
          </button>
        </div>

        {loading ? (
          <div className="fb-loading-text">Laden...</div>
        ) : requests.length === 0 ? (
          <div className="fb-loading-text">
            Noch keine Wuensche - sei der Erste!
          </div>
        ) : (
          <div className="u-flex-col-md">
            {requests.slice(0, 5).map(req => (
              <div key={req.id} className="fb-compact-item">
                <button
                  onClick={() => handleVote(req.id)}
                  className={`fb-vote-btn-compact${req.user_voted ? ' fb-vote-btn-compact--voted' : ''}`}
                >
                  <ThumbsUp size={16} />
                  <span className="fb-vote-count-sm">{req.votes_count}</span>
                </button>
                <div className="u-flex-1-min0">
                  <div className="fb-item-title">
                    {req.titel}
                  </div>
                  <div className={`fb-status-badge-sm fb-status-badge-sm--${req.status}`}>
                    {statusConfig[req.status]?.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Neuer Request Modal */}
        {showNewForm && (
          <div className="fb-modal-overlay">
            <div className="fb-modal-box">
              <h3 className="fb-modal-title">Neuer Feature-Wunsch</h3>
              <form onSubmit={handleSubmit}>
                <div className="fb-mb-1">
                  <label className="u-form-label-secondary">Titel *</label>
                  <input
                    type="text"
                    value={newRequest.titel}
                    onChange={(e) => setNewRequest({ ...newRequest, titel: e.target.value })}
                    placeholder="Was wuenschst du dir?"
                    className="fb-form-input"
                  />
                </div>
                <div className="fb-mb-1">
                  <label className="u-form-label-secondary">Kategorie</label>
                  <select
                    value={newRequest.kategorie}
                    onChange={(e) => setNewRequest({ ...newRequest, kategorie: e.target.value })}
                    className="fb-form-input"
                  >
                    <option value="funktion">Neue Funktion</option>
                    <option value="verbesserung">Verbesserung</option>
                    <option value="integration">Integration</option>
                    <option value="design">Design</option>
                    <option value="sonstiges">Sonstiges</option>
                  </select>
                </div>
                <div className="fb-mb-15">
                  <label className="u-form-label-secondary">Beschreibung</label>
                  <textarea
                    value={newRequest.beschreibung}
                    onChange={(e) => setNewRequest({ ...newRequest, beschreibung: e.target.value })}
                    placeholder="Beschreibe deinen Wunsch genauer..."
                    rows={4}
                    className="fb-form-textarea"
                  />
                </div>
                {error && <div className="fb-error-msg">{error}</div>}
                <div className="fb-flex-gap">
                  <button
                    type="button"
                    onClick={() => { setShowNewForm(false); setError(''); }}
                    className="fb-btn-cancel"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="fb-btn-submit"
                  >
                    {submitting ? 'Wird eingereicht...' : 'Einreichen'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Vollansicht
  return (
    <div className="fb-page-wrapper">
      {/* Header */}
      <div className="fb-page-header">
        <div>
          <h2
            className={`fb-page-title${adminMode ? ' fb-page-title--admin' : ''}`}
          >
            <Lightbulb size={28} /> Feature-Wuensche
            {adminMode && (
              <span className="fb-admin-badge">
                Admin-Modus
              </span>
            )}
          </h2>
          <p className="fb-page-subtitle">
            {adminMode
              ? 'Bearbeite Feature-Wuensche der Kunden - Status aendern und kommentieren'
              : 'Stimme fuer Features ab oder reiche eigene Wuensche ein'}
          </p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="fb-btn-add-primary"
        >
          <Plus size={20} /> Neue Idee einreichen
        </button>
      </div>

      {/* Stats */}
      <div className="fb-stats-grid">
        {[
          { label: 'Gesamt', value: stats.gesamt || 0, color: 'var(--text-primary)' },
          { label: 'Neu', value: stats.neu || 0, color: 'var(--warning)' },
          { label: 'Geplant', value: stats.geplant || 0, color: '#8b5cf6' },
          { label: 'In Arbeit', value: stats.in_arbeit || 0, color: '#ec4899' },
          { label: 'Umgesetzt', value: stats.umgesetzt || 0, color: 'var(--success)' }
        ].map(stat => (
          <div key={stat.label} className="fb-stat-card" style={{ '--stat-color': stat.color }}>
            <div className="fb-stat-value">{stat.value}</div>
            <div className="u-text-secondary-sm">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="fb-filter-bar">
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="fb-filter-select"
        >
          <option value="alle">Alle Status</option>
          <option value="neu">Neu</option>
          <option value="geprueft">Geprueft</option>
          <option value="geplant">Geplant</option>
          <option value="in_arbeit">In Arbeit</option>
          <option value="umgesetzt">Umgesetzt</option>
          <option value="abgelehnt">Abgelehnt</option>
        </select>
        <select
          value={filter.kategorie}
          onChange={(e) => setFilter({ ...filter, kategorie: e.target.value })}
          className="fb-filter-select"
        >
          <option value="alle">Alle Kategorien</option>
          <option value="funktion">Neue Funktion</option>
          <option value="verbesserung">Verbesserung</option>
          <option value="integration">Integration</option>
          <option value="design">Design</option>
          <option value="sonstiges">Sonstiges</option>
        </select>
        <select
          value={filter.sortBy}
          onChange={(e) => setFilter({ ...filter, sortBy: e.target.value })}
          className="fb-filter-select"
        >
          <option value="votes">Meiste Stimmen</option>
          <option value="newest">Neueste</option>
          <option value="status">Nach Status</option>
        </select>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="fb-loading-full">Laden...</div>
      ) : requests.length === 0 ? (
        <div className="fb-empty-card">
          Keine Feature-Wuensche gefunden. Sei der Erste und reiche eine Idee ein!
        </div>
      ) : (
        <div className="fb-request-list">
          {requests.map(req => {
            const StatusIcon = statusConfig[req.status]?.icon || Lightbulb;
            return (
              <div key={req.id} className="fb-request-card">
                {/* Vote Button */}
                <button
                  onClick={() => handleVote(req.id)}
                  className={`fb-vote-btn${req.user_voted ? ' fb-vote-btn--voted' : ''}`}
                >
                  <ThumbsUp size={24} fill={req.user_voted ? '#ffd700' : 'none'} />
                  <span className="fb-vote-count">{req.votes_count}</span>
                </button>

                {/* Content */}
                <div className="u-flex-1">
                  <div className="fb-title-row">
                    <h4 className="fb-request-title">{req.titel}</h4>
                    <span className={`fb-status-badge fb-status-badge--${req.status}`}>
                      <StatusIcon size={14} />
                      {statusConfig[req.status]?.label}
                    </span>
                    <span className="fb-category-badge">
                      {kategorieLabels[req.kategorie] || req.kategorie}
                    </span>
                  </div>
                  {req.beschreibung && (
                    <p className="fb-description">
                      {req.beschreibung}
                    </p>
                  )}
                  {req.admin_kommentar && editingId !== req.id && (
                    <div className="fb-admin-comment-box">
                      <div className="fb-admin-comment-label">Admin-Kommentar:</div>
                      <div className="fb-admin-comment-text">{req.admin_kommentar}</div>
                    </div>
                  )}

                  {/* Admin Edit Form */}
                  {adminMode && editingId === req.id && (
                    <div className="fb-admin-edit-panel">
                      <div className="fb-admin-edit-row">
                        <div className="fb-admin-edit-field">
                          <label className="fb-field-label">Status</label>
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value)}
                            className="fb-admin-input"
                          >
                            <option value="neu">Neu</option>
                            <option value="geprueft">Geprueft</option>
                            <option value="geplant">Geplant</option>
                            <option value="in_arbeit">In Arbeit</option>
                            <option value="umgesetzt">Umgesetzt</option>
                            <option value="abgelehnt">Abgelehnt</option>
                          </select>
                        </div>
                      </div>
                      <div className="fb-mb-1">
                        <label className="fb-field-label">Admin-Kommentar</label>
                        <textarea
                          value={editComment}
                          onChange={(e) => setEditComment(e.target.value)}
                          placeholder="Kommentar fuer den Kunden..."
                          rows={2}
                          className="fb-admin-textarea"
                        />
                      </div>
                      <div className="u-flex-gap-sm">
                        <button
                          onClick={() => handleStatusChange(req.id)}
                          disabled={saving}
                          className="fb-btn-save"
                        >
                          <Save size={16} /> {saving ? 'Speichern...' : 'Speichern'}
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setEditStatus(''); setEditComment(''); }}
                          className="fb-btn-cancel-sm"
                        >
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="fb-footer-row">
                    <div className="fb-meta-text">
                      von {req.ersteller_name} &bull; {new Date(req.created_at).toLocaleDateString('de-DE')}
                      {req.dojo_id && <span> &bull; Dojo #{req.dojo_id}</span>}
                    </div>

                    {/* Admin Actions */}
                    {adminMode && editingId !== req.id && (
                      <div className="u-flex-gap-sm">
                        <button
                          onClick={() => startEditing(req)}
                          className="fb-btn-edit"
                        >
                          <Edit3 size={14} /> Bearbeiten
                        </button>
                        <button
                          onClick={() => handleDelete(req.id, req.titel)}
                          className="fb-btn-delete"
                        >
                          <Trash2 size={14} /> Loeschen
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Neuer Request Modal */}
      {showNewForm && (
        <div className="fb-modal-overlay">
          <div className="fb-modal-box">
            <h3 className="fb-modal-title-flex">
              <Lightbulb size={24} /> Neuer Feature-Wunsch
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="fb-mb-1">
                <label className="u-form-label-secondary">Titel *</label>
                <input
                  type="text"
                  value={newRequest.titel}
                  onChange={(e) => setNewRequest({ ...newRequest, titel: e.target.value })}
                  placeholder="Was wuenschst du dir?"
                  className="fb-form-input"
                />
              </div>
              <div className="fb-mb-1">
                <label className="u-form-label-secondary">Kategorie</label>
                <select
                  value={newRequest.kategorie}
                  onChange={(e) => setNewRequest({ ...newRequest, kategorie: e.target.value })}
                  className="fb-form-input"
                >
                  <option value="funktion">Neue Funktion</option>
                  <option value="verbesserung">Verbesserung</option>
                  <option value="integration">Integration</option>
                  <option value="design">Design</option>
                  <option value="sonstiges">Sonstiges</option>
                </select>
              </div>
              <div className="fb-mb-15">
                <label className="u-form-label-secondary">Beschreibung</label>
                <textarea
                  value={newRequest.beschreibung}
                  onChange={(e) => setNewRequest({ ...newRequest, beschreibung: e.target.value })}
                  placeholder="Beschreibe deinen Wunsch genauer..."
                  rows={4}
                  className="fb-form-textarea"
                />
              </div>
              {error && <div className="fb-error-msg">{error}</div>}
              <div className="fb-flex-gap">
                <button
                  type="button"
                  onClick={() => { setShowNewForm(false); setError(''); }}
                  className="fb-btn-cancel"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="fb-btn-submit"
                >
                  {submitting ? 'Wird eingereicht...' : 'Einreichen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeatureBoard;
