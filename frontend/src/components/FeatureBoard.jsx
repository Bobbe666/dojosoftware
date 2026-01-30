import React, { useState, useEffect } from 'react';
import { ThumbsUp, Plus, Filter, MessageSquare, CheckCircle, Clock, Lightbulb, X, Edit3, Trash2, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
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
    neu: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', label: 'Neu', icon: Lightbulb },
    geprueft: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', label: 'Geprueft', icon: CheckCircle },
    geplant: { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', label: 'Geplant', icon: Clock },
    in_arbeit: { color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)', label: 'In Arbeit', icon: Clock },
    umgesetzt: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', label: 'Umgesetzt', icon: CheckCircle },
    abgelehnt: { color: '#6b7280', bg: 'rgba(107, 114, 128, 0.15)', label: 'Abgelehnt', icon: X }
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
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '16px',
        padding: '1.5rem',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ color: '#ffd700', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Lightbulb size={20} /> Feature-Wuensche
          </h3>
          <button
            onClick={() => setShowNewForm(true)}
            style={{
              padding: '0.5rem 1rem',
              background: '#ffd700',
              border: 'none',
              borderRadius: '8px',
              color: '#000',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.85rem'
            }}
          >
            <Plus size={16} /> Idee
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '1rem', color: 'rgba(255,255,255,0.5)' }}>Laden...</div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1rem', color: 'rgba(255,255,255,0.5)' }}>
            Noch keine Wuensche - sei der Erste!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {requests.slice(0, 5).map(req => (
              <div key={req.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '8px'
              }}>
                <button
                  onClick={() => handleVote(req.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '0.5rem',
                    background: req.user_voted ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255,255,255,0.05)',
                    border: req.user_voted ? '1px solid #ffd700' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: req.user_voted ? '#ffd700' : 'rgba(255,255,255,0.7)',
                    cursor: 'pointer',
                    minWidth: '50px'
                  }}
                >
                  <ThumbsUp size={16} />
                  <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{req.votes_count}</span>
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#fff', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {req.titel}
                  </div>
                  <div style={{
                    display: 'inline-block',
                    padding: '0.15rem 0.5rem',
                    background: statusConfig[req.status]?.bg,
                    color: statusConfig[req.status]?.color,
                    borderRadius: '4px',
                    fontSize: '0.7rem',
                    marginTop: '0.25rem'
                  }}>
                    {statusConfig[req.status]?.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Neuer Request Modal */}
        {showNewForm && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}>
            <div style={{
              background: '#1a1a2e',
              borderRadius: '16px',
              padding: '2rem',
              width: '90%',
              maxWidth: '500px',
              border: '1px solid rgba(255,215,0,0.3)'
            }}>
              <h3 style={{ color: '#ffd700', marginTop: 0 }}>Neuer Feature-Wunsch</h3>
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.8)' }}>Titel *</label>
                  <input
                    type="text"
                    value={newRequest.titel}
                    onChange={(e) => setNewRequest({ ...newRequest, titel: e.target.value })}
                    placeholder="Was wuenschst du dir?"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.8)' }}>Kategorie</label>
                  <select
                    value={newRequest.kategorie}
                    onChange={(e) => setNewRequest({ ...newRequest, kategorie: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  >
                    <option value="funktion">Neue Funktion</option>
                    <option value="verbesserung">Verbesserung</option>
                    <option value="integration">Integration</option>
                    <option value="design">Design</option>
                    <option value="sonstiges">Sonstiges</option>
                  </select>
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.8)' }}>Beschreibung</label>
                  <textarea
                    value={newRequest.beschreibung}
                    onChange={(e) => setNewRequest({ ...newRequest, beschreibung: e.target.value })}
                    placeholder="Beschreibe deinen Wunsch genauer..."
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      color: '#fff',
                      resize: 'vertical'
                    }}
                  />
                </div>
                {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => { setShowNewForm(false); setError(''); }}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      color: '#fff',
                      cursor: 'pointer'
                    }}
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      background: '#ffd700',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#000',
                      fontWeight: '600',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      opacity: submitting ? 0.7 : 1
                    }}
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
    <div style={{ padding: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ color: adminMode ? '#a5b4fc' : '#ffd700', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Lightbulb size={28} /> Feature-Wuensche
            {adminMode && (
              <span style={{
                padding: '0.25rem 0.75rem',
                background: 'rgba(99, 102, 241, 0.2)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                borderRadius: '20px',
                fontSize: '0.75rem',
                color: '#a5b4fc',
                fontWeight: '500'
              }}>
                Admin-Modus
              </span>
            )}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', margin: '0.5rem 0 0' }}>
            {adminMode
              ? 'Bearbeite Feature-Wuensche der Kunden - Status aendern und kommentieren'
              : 'Stimme fuer Features ab oder reiche eigene Wuensche ein'}
          </p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#ffd700',
            border: 'none',
            borderRadius: '8px',
            color: '#000',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <Plus size={20} /> Neue Idee einreichen
        </button>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        {[
          { label: 'Gesamt', value: stats.gesamt || 0, color: '#fff' },
          { label: 'Neu', value: stats.neu || 0, color: '#f59e0b' },
          { label: 'Geplant', value: stats.geplant || 0, color: '#8b5cf6' },
          { label: 'In Arbeit', value: stats.in_arbeit || 0, color: '#ec4899' },
          { label: 'Umgesetzt', value: stats.umgesetzt || 0, color: '#10b981' }
        ].map(stat => (
          <div key={stat.label} style={{
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '12px',
            padding: '1rem',
            textAlign: 'center',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ fontSize: '1.75rem', fontWeight: '700', color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{
        display: 'flex',
        gap: '1rem',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        padding: '1rem',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '12px'
      }}>
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          style={{
            padding: '0.5rem 1rem',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            color: '#fff'
          }}
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
          style={{
            padding: '0.5rem 1rem',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            color: '#fff'
          }}
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
          style={{
            padding: '0.5rem 1rem',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '8px',
            color: '#fff'
          }}
        >
          <option value="votes">Meiste Stimmen</option>
          <option value="newest">Neueste</option>
          <option value="status">Nach Status</option>
        </select>
      </div>

      {/* Liste */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,0.5)' }}>Laden...</div>
      ) : requests.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '12px',
          color: 'rgba(255,255,255,0.5)'
        }}>
          Keine Feature-Wuensche gefunden. Sei der Erste und reiche eine Idee ein!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {requests.map(req => {
            const StatusIcon = statusConfig[req.status]?.icon || Lightbulb;
            return (
              <div key={req.id} style={{
                display: 'flex',
                gap: '1rem',
                padding: '1.25rem',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                {/* Vote Button */}
                <button
                  onClick={() => handleVote(req.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.75rem',
                    background: req.user_voted ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255,255,255,0.05)',
                    border: req.user_voted ? '2px solid #ffd700' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    color: req.user_voted ? '#ffd700' : 'rgba(255,255,255,0.7)',
                    cursor: 'pointer',
                    minWidth: '70px',
                    transition: 'all 0.2s'
                  }}
                >
                  <ThumbsUp size={24} fill={req.user_voted ? '#ffd700' : 'none'} />
                  <span style={{ fontSize: '1.25rem', fontWeight: '700', marginTop: '0.25rem' }}>{req.votes_count}</span>
                </button>

                {/* Content */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <h4 style={{ color: '#fff', margin: 0, fontSize: '1.1rem' }}>{req.titel}</h4>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.25rem 0.75rem',
                      background: statusConfig[req.status]?.bg,
                      color: statusConfig[req.status]?.color,
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: '500'
                    }}>
                      <StatusIcon size={14} />
                      {statusConfig[req.status]?.label}
                    </span>
                    <span style={{
                      padding: '0.2rem 0.5rem',
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      color: 'rgba(255,255,255,0.6)'
                    }}>
                      {kategorieLabels[req.kategorie] || req.kategorie}
                    </span>
                  </div>
                  {req.beschreibung && (
                    <p style={{ color: 'rgba(255,255,255,0.7)', margin: '0.5rem 0', fontSize: '0.95rem', lineHeight: 1.5 }}>
                      {req.beschreibung}
                    </p>
                  )}
                  {req.admin_kommentar && editingId !== req.id && (
                    <div style={{
                      marginTop: '0.75rem',
                      padding: '0.75rem',
                      background: 'rgba(59, 130, 246, 0.1)',
                      borderRadius: '8px',
                      borderLeft: '3px solid #3b82f6'
                    }}>
                      <div style={{ fontSize: '0.8rem', color: '#60a5fa', marginBottom: '0.25rem' }}>Admin-Kommentar:</div>
                      <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem' }}>{req.admin_kommentar}</div>
                    </div>
                  )}

                  {/* Admin Edit Form */}
                  {adminMode && editingId === req.id && (
                    <div style={{
                      marginTop: '1rem',
                      padding: '1rem',
                      background: 'rgba(99, 102, 241, 0.1)',
                      borderRadius: '8px',
                      border: '1px solid rgba(99, 102, 241, 0.3)'
                    }}>
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                        <div style={{ flex: 1, minWidth: '150px' }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a5b4fc', fontSize: '0.85rem' }}>Status</label>
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              background: 'rgba(255,255,255,0.1)',
                              border: '1px solid rgba(255,255,255,0.2)',
                              borderRadius: '6px',
                              color: '#fff'
                            }}
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
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a5b4fc', fontSize: '0.85rem' }}>Admin-Kommentar</label>
                        <textarea
                          value={editComment}
                          onChange={(e) => setEditComment(e.target.value)}
                          placeholder="Kommentar fuer den Kunden..."
                          rows={2}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '6px',
                            color: '#fff',
                            resize: 'vertical'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleStatusChange(req.id)}
                          disabled={saving}
                          style={{
                            padding: '0.5rem 1rem',
                            background: '#6366f1',
                            border: 'none',
                            borderRadius: '6px',
                            color: '#fff',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.85rem'
                          }}
                        >
                          <Save size={16} /> {saving ? 'Speichern...' : 'Speichern'}
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setEditStatus(''); setEditComment(''); }}
                          style={{
                            padding: '0.5rem 1rem',
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            borderRadius: '6px',
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                          }}
                        >
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
                      von {req.ersteller_name} • {new Date(req.created_at).toLocaleDateString('de-DE')}
                      {req.dojo_id && <span> • Dojo #{req.dojo_id}</span>}
                    </div>

                    {/* Admin Actions */}
                    {adminMode && editingId !== req.id && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => startEditing(req)}
                          style={{
                            padding: '0.4rem 0.75rem',
                            background: 'rgba(99, 102, 241, 0.2)',
                            border: '1px solid rgba(99, 102, 241, 0.4)',
                            borderRadius: '6px',
                            color: '#a5b4fc',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.8rem'
                          }}
                        >
                          <Edit3 size={14} /> Bearbeiten
                        </button>
                        <button
                          onClick={() => handleDelete(req.id, req.titel)}
                          style={{
                            padding: '0.4rem 0.75rem',
                            background: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            borderRadius: '6px',
                            color: '#f87171',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.8rem'
                          }}
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
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: '#1a1a2e',
            borderRadius: '16px',
            padding: '2rem',
            width: '90%',
            maxWidth: '500px',
            border: '1px solid rgba(255,215,0,0.3)'
          }}>
            <h3 style={{ color: '#ffd700', marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Lightbulb size={24} /> Neuer Feature-Wunsch
            </h3>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.8)' }}>Titel *</label>
                <input
                  type="text"
                  value={newRequest.titel}
                  onChange={(e) => setNewRequest({ ...newRequest, titel: e.target.value })}
                  placeholder="Was wuenschst du dir?"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.8)' }}>Kategorie</label>
                <select
                  value={newRequest.kategorie}
                  onChange={(e) => setNewRequest({ ...newRequest, kategorie: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                >
                  <option value="funktion">Neue Funktion</option>
                  <option value="verbesserung">Verbesserung</option>
                  <option value="integration">Integration</option>
                  <option value="design">Design</option>
                  <option value="sonstiges">Sonstiges</option>
                </select>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.8)' }}>Beschreibung</label>
                <textarea
                  value={newRequest.beschreibung}
                  onChange={(e) => setNewRequest({ ...newRequest, beschreibung: e.target.value })}
                  placeholder="Beschreibe deinen Wunsch genauer..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    color: '#fff',
                    resize: 'vertical'
                  }}
                />
              </div>
              {error && <div style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="button"
                  onClick={() => { setShowNewForm(false); setError(''); }}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: '#ffd700',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#000',
                    fontWeight: '600',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    opacity: submitting ? 0.7 : 1
                  }}
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
