// =============================================================================
// MARKETING-AKTIONEN KOMPONENTE
// =============================================================================
// Social Media Integration für Facebook und Instagram Posts
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';
import {
  Facebook,
  Instagram,
  Link2,
  Unlink,
  Send,
  Image,
  Video,
  Clock,
  Trash2,
  Edit3,
  CheckCircle,
  AlertCircle,
  Plus,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import '../styles/MarketingAktionen.css';

const MarketingAktionen = () => {
  const { activeDojo } = useDojoContext();

  // State Management
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [posts, setPosts] = useState([]);
  const [apiConfigured, setApiConfigured] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Post Creation State
  const [showPostForm, setShowPostForm] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedMedia, setSelectedMedia] = useState([]);
  const [scheduledDate, setScheduledDate] = useState('');
  const [publishing, setPublishing] = useState(false);

  const fileInputRef = useRef(null);

  // ==========================================================================
  // DATA LOADING
  // ==========================================================================

  useEffect(() => {
    loadData();
  }, [activeDojo]);

  const loadData = async () => {
    if (!activeDojo) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // API Status prüfen
      const statusRes = await axios.get(`/marketing-aktionen/status?dojo_id=${activeDojo}`);
      setApiConfigured(statusRes.data.configured);

      // Accounts laden
      const accountsRes = await axios.get(`/marketing-aktionen/accounts?dojo_id=${activeDojo}`);
      setAccounts(accountsRes.data);

      // Posts laden
      const postsRes = await axios.get(`/marketing-aktionen/posts?dojo_id=${activeDojo}`);
      setPosts(postsRes.data);

    } catch (error) {
      console.error('Fehler beim Laden:', error);
      if (error.response?.status !== 401) {
        showMessage('error', 'Fehler beim Laden der Daten');
      }
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================================
  // ACCOUNT MANAGEMENT
  // ==========================================================================

  const connectAccount = async () => {
    if (!activeDojo) {
      showMessage('error', 'Kein Dojo ausgewählt');
      return;
    }

    try {
      const response = await axios.get(`/marketing-aktionen/accounts/connect?dojo_id=${activeDojo}`);
      if (response.data.authUrl) {
        const allowedDomains = ['facebook.com', 'instagram.com', 'graph.instagram.com', 'www.facebook.com', 'api.instagram.com'];
        try {
          const urlObj = new URL(response.data.authUrl);
          if (allowedDomains.some(d => urlObj.hostname === d || urlObj.hostname.endsWith('.' + d))) {
            window.location.href = response.data.authUrl;
          } else {
            console.error('Ungültige Redirect-URL:', response.data.authUrl);
          }
        } catch {
          console.error('Ungültige URL:', response.data.authUrl);
        }
      }
    } catch (error) {
      console.error('Fehler beim Verbinden:', error);
      showMessage('error', error.response?.data?.message || 'Fehler beim Verbinden');
    }
  };

  const disconnectAccount = async (accountId) => {
    if (!window.confirm('Möchtest du diesen Account wirklich trennen?')) return;
    if (!activeDojo) return;

    try {
      await axios.delete(`/marketing-aktionen/accounts/${accountId}?dojo_id=${activeDojo}`);
      showMessage('success', 'Account erfolgreich getrennt');
      loadData();
    } catch (error) {
      console.error('Fehler beim Trennen:', error);
      showMessage('error', 'Fehler beim Trennen des Accounts');
    }
  };

  // ==========================================================================
  // POST MANAGEMENT
  // ==========================================================================

  const handleMediaSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + selectedMedia.length > 10) {
      showMessage('error', 'Maximal 10 Dateien erlaubt');
      return;
    }
    setSelectedMedia([...selectedMedia, ...files]);
  };

  const removeMedia = (index) => {
    setSelectedMedia(selectedMedia.filter((_, i) => i !== index));
  };

  const createPost = async (publishNow = false) => {
    if (!postContent.trim()) {
      showMessage('error', 'Bitte gib einen Text ein');
      return;
    }

    if (!selectedAccount) {
      showMessage('error', 'Bitte wähle einen Account aus');
      return;
    }

    // Instagram check
    const account = accounts.find(a => a.id === parseInt(selectedAccount));
    if (account?.platform === 'instagram' && selectedMedia.length === 0) {
      showMessage('error', 'Instagram Posts benötigen mindestens ein Bild');
      return;
    }

    if (!activeDojo) {
      showMessage('error', 'Kein Dojo ausgewählt');
      return;
    }

    try {
      setPublishing(true);

      const formData = new FormData();
      formData.append('content', postContent);
      formData.append('social_account_id', selectedAccount);
      formData.append('dojo_id', activeDojo);

      if (scheduledDate) {
        formData.append('scheduled_at', scheduledDate);
      }

      selectedMedia.forEach(file => {
        formData.append('media', file);
      });

      formData.append('post_type', selectedMedia.length > 0 ? 'image' : 'text');

      const response = await axios.post(`/marketing-aktionen/posts?dojo_id=${activeDojo}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Sofort veröffentlichen wenn gewünscht
      if (publishNow) {
        await axios.post(`/marketing-aktionen/posts/${response.data.postId}/publish?dojo_id=${activeDojo}`);
        showMessage('success', 'Post erfolgreich veröffentlicht!');
      } else {
        showMessage('success', scheduledDate ? 'Post geplant!' : 'Post als Entwurf gespeichert');
      }

      // Reset form
      setPostContent('');
      setSelectedAccount('');
      setSelectedMedia([]);
      setScheduledDate('');
      setShowPostForm(false);

      loadData();
    } catch (error) {
      console.error('Fehler beim Erstellen:', error);
      showMessage('error', error.response?.data?.details || 'Fehler beim Erstellen des Posts');
    } finally {
      setPublishing(false);
    }
  };

  const publishPost = async (postId) => {
    if (!activeDojo) return;

    try {
      setPublishing(true);
      await axios.post(`/marketing-aktionen/posts/${postId}/publish?dojo_id=${activeDojo}`);
      showMessage('success', 'Post erfolgreich veröffentlicht!');
      loadData();
    } catch (error) {
      console.error('Fehler beim Veröffentlichen:', error);
      showMessage('error', error.response?.data?.details || 'Fehler beim Veröffentlichen');
    } finally {
      setPublishing(false);
    }
  };

  const deletePost = async (postId) => {
    if (!window.confirm('Post wirklich löschen?')) return;
    if (!activeDojo) return;

    try {
      await axios.delete(`/marketing-aktionen/posts/${postId}?dojo_id=${activeDojo}`);
      showMessage('success', 'Post gelöscht');
      loadData();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      showMessage('error', 'Fehler beim Löschen');
    }
  };

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const getPlatformIcon = (platform) => {
    return platform === 'facebook' ? <Facebook size={18} /> : <Instagram size={18} />;
  };

  const getStatusBadge = (status) => {
    const config = {
      draft: { class: 'status-draft', text: 'Entwurf' },
      scheduled: { class: 'status-scheduled', text: 'Geplant' },
      published: { class: 'status-published', text: 'Veröffentlicht' },
      failed: { class: 'status-failed', text: 'Fehlgeschlagen' }
    };
    const c = config[status] || { class: '', text: status };
    return <span className={`post-status-badge ${c.class}`}>{c.text}</span>;
  };

  // URL Parameter prüfen (nach OAuth Redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');

    if (success === 'connected') {
      showMessage('success', 'Social Media Account erfolgreich verbunden!');
      // URL bereinigen
      window.history.replaceState({}, '', window.location.pathname);
    } else if (error) {
      const errorMessages = {
        oauth_denied: 'Autorisierung wurde abgelehnt',
        invalid_callback: 'Ungültiger Callback',
        invalid_state: 'Ungültiger State Token',
        connection_failed: 'Verbindung fehlgeschlagen'
      };
      showMessage('error', errorMessages[error] || 'Ein Fehler ist aufgetreten');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // ==========================================================================
  // RENDER
  // ==========================================================================

  if (loading) {
    return (
      <div className="marketing-loading">
        <div className="spinner"></div>
        <p>Wird geladen...</p>
      </div>
    );
  }

  return (
    <div className="marketing-aktionen">
      {/* Message Banner */}
      {message.text && (
        <div className={`marketing-message ${message.type}`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* API Not Configured Warning */}
      {!apiConfigured && (
        <div className="marketing-warning">
          <AlertCircle size={24} />
          <div>
            <strong>Meta API nicht konfiguriert</strong>
            <p>Um Social Media Funktionen zu nutzen, müssen META_APP_ID, META_APP_SECRET und META_REDIRECT_URI in der .env Datei gesetzt werden.</p>
            <a href="https://developers.facebook.com/" target="_blank" rel="noopener noreferrer">
              Meta Developer Portal <ExternalLink size={14} />
            </a>
          </div>
        </div>
      )}

      {/* Connected Accounts Section */}
      <div className="marketing-section">
        <div className="section-header">
          <h3><Link2 size={20} /> Verbundene Accounts</h3>
          {apiConfigured && (
            <button className="btn btn-primary btn-sm" onClick={connectAccount}>
              <Plus size={16} /> Account verbinden
            </button>
          )}
        </div>

        {accounts.length === 0 ? (
          <div className="empty-accounts">
            <p>Keine Social Media Accounts verbunden.</p>
            {apiConfigured && (
              <button className="btn btn-primary" onClick={connectAccount}>
                <Facebook size={18} /> Facebook / Instagram verbinden
              </button>
            )}
          </div>
        ) : (
          <div className="accounts-grid">
            {accounts.map(account => (
              <div key={account.id} className={`account-card ${account.platform}`}>
                <div className="account-icon">
                  {getPlatformIcon(account.platform)}
                </div>
                <div className="account-info">
                  <strong>{account.account_name}</strong>
                  {account.page_name && <span className="page-name">{account.page_name}</span>}
                  <span className={`token-status ${account.token_valid ? 'valid' : 'expired'}`}>
                    {account.token_valid
                      ? (account.token_expires_soon ? 'Token läuft bald ab' : 'Verbunden')
                      : 'Token abgelaufen'}
                  </span>
                </div>
                <button
                  className="btn btn-icon btn-danger"
                  onClick={() => disconnectAccount(account.id)}
                  title="Trennen"
                >
                  <Unlink size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Post Section */}
      {accounts.length > 0 && (
        <div className="marketing-section">
          <div className="section-header">
            <h3><Edit3 size={20} /> Neuer Post</h3>
            {!showPostForm && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowPostForm(true)}>
                <Plus size={16} /> Post erstellen
              </button>
            )}
          </div>

          {showPostForm && (
            <div className="post-form">
              <div className="form-group">
                <label>Account auswählen</label>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="form-select"
                >
                  <option value="">-- Account wählen --</option>
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.platform === 'facebook' ? '📘' : '📸'} {account.account_name}
                      {account.page_name ? ` (${account.page_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Inhalt</label>
                <textarea
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder="Was möchtest du teilen?"
                  rows={4}
                  className="form-textarea"
                  maxLength={2200}
                />
                <span className="char-count">{postContent.length} / 2200</span>
              </div>

              <div className="form-group">
                <label>Medien (optional für Facebook, erforderlich für Instagram)</label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleMediaSelect}
                  accept="image/jpeg,image/png,image/gif,image/webp,video/mp4"
                  multiple
                  className="u-hidden"
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Image size={16} /> Bild/Video hinzufügen
                </button>

                {selectedMedia.length > 0 && (
                  <div className="media-preview">
                    {selectedMedia.map((file, index) => (
                      <div key={index} className="media-item">
                        {file.type.startsWith('video') ? (
                          <Video size={24} />
                        ) : (
                          <img src={URL.createObjectURL(file)} alt="" />
                        )}
                        <button
                          className="remove-media"
                          onClick={() => removeMedia(index)}
                        >
                          <Trash2 size={14} />
                        </button>
                        <span className="media-name">{file.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Zeitplanung (optional)</label>
                <input
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="form-input"
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>

              <div className="form-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowPostForm(false);
                    setPostContent('');
                    setSelectedAccount('');
                    setSelectedMedia([]);
                    setScheduledDate('');
                  }}
                >
                  Abbrechen
                </button>
                <button
                  className="btn btn-outline"
                  onClick={() => createPost(false)}
                  disabled={publishing}
                >
                  {scheduledDate ? <Clock size={16} /> : <Edit3 size={16} />}
                  {scheduledDate ? 'Planen' : 'Als Entwurf speichern'}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => createPost(true)}
                  disabled={publishing}
                >
                  {publishing ? <RefreshCw size={16} className="spinning" /> : <Send size={16} />}
                  Jetzt veröffentlichen
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Posts List Section */}
      <div className="marketing-section">
        <div className="section-header">
          <h3><Send size={20} /> Posts ({posts.length})</h3>
          <button className="btn btn-icon" onClick={loadData} title="Aktualisieren">
            <RefreshCw size={16} />
          </button>
        </div>

        {posts.length === 0 ? (
          <div className="empty-posts">
            <p>Noch keine Posts erstellt.</p>
          </div>
        ) : (
          <div className="posts-list">
            {posts.map(post => (
              <div key={post.id} className={`post-card ${post.status}`}>
                <div className="post-header">
                  <div className="post-platform">
                    {getPlatformIcon(post.platform)}
                    <span>{post.account_name}</span>
                  </div>
                  {getStatusBadge(post.status)}
                </div>

                <div className="post-content">
                  <p>{post.content}</p>
                  {post.media_urls && JSON.parse(post.media_urls).length > 0 && (
                    <div className="post-media-count">
                      <Image size={14} />
                      <span>{JSON.parse(post.media_urls).length} Medien</span>
                    </div>
                  )}
                </div>

                {post.error_message && (
                  <div className="post-error">
                    <AlertCircle size={14} />
                    <span>{post.error_message}</span>
                  </div>
                )}

                <div className="post-footer">
                  <span className="post-date">
                    {post.published_at
                      ? `Veröffentlicht: ${new Date(post.published_at).toLocaleString('de-DE')}`
                      : post.scheduled_at
                        ? `Geplant: ${new Date(post.scheduled_at).toLocaleString('de-DE')}`
                        : `Erstellt: ${new Date(post.created_at).toLocaleString('de-DE')}`}
                  </span>

                  <div className="post-actions">
                    {(post.status === 'draft' || post.status === 'failed') && (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => publishPost(post.id)}
                        disabled={publishing}
                      >
                        <Send size={14} /> Veröffentlichen
                      </button>
                    )}
                    {post.status !== 'published' && (
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => deletePost(post.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    {post.status === 'published' && post.external_post_id && (
                      <a
                        href={post.platform === 'facebook'
                          ? `https://facebook.com/${post.external_post_id}`
                          : `https://instagram.com/p/${post.external_post_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-sm btn-outline"
                      >
                        <ExternalLink size={14} /> Ansehen
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketingAktionen;
