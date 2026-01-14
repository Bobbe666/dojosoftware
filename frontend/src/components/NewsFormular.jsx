import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import config from '../config/config.js';
import '../styles/News.css';

function NewsFormular({ mode = 'create' }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { token } = useAuth();

  const [formData, setFormData] = useState({
    titel: '',
    kurzbeschreibung: '',
    inhalt: '',
    zielgruppe: 'alle_dojos',
    status: 'entwurf'
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Prüfe ob User Haupt-Admin ist
  const isMainAdmin = () => {
    try {
      if (token) {
        const decoded = jwtDecode(token);
        return decoded.id === 1 || decoded.user_id === 1 || decoded.username === 'admin';
      }
    } catch (error) {
      console.error('Token decode error:', error);
    }
    return false;
  };

  // News laden wenn Bearbeiten-Modus
  useEffect(() => {
    if (!isMainAdmin()) {
      navigate('/dashboard');
      return;
    }

    if (mode === 'edit' && id) {
      loadNews();
    }
  }, [mode, id, token]);

  const loadNews = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(
        `${config.apiBaseUrl}/news/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const newsData = response.data;
      setFormData({
        titel: newsData.titel || '',
        kurzbeschreibung: newsData.kurzbeschreibung || '',
        inhalt: newsData.inhalt || '',
        zielgruppe: newsData.zielgruppe || 'alle_dojos',
        status: newsData.status || 'entwurf'
      });
    } catch (err) {
      console.error('Fehler beim Laden der News:', err);
      setError('Fehler beim Laden der News: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Form-Änderungen
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Speichern
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (!formData.titel.trim()) {
        throw new Error('Titel ist erforderlich');
      }
      if (!formData.inhalt.trim()) {
        throw new Error('Inhalt ist erforderlich');
      }

      if (mode === 'edit' && id) {
        await axios.put(
          `${config.apiBaseUrl}/news/${id}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSuccess('News erfolgreich aktualisiert!');
      } else {
        await axios.post(
          `${config.apiBaseUrl}/news`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSuccess('News erfolgreich erstellt!');
      }

      // Nach Erfolg zurück zur Liste
      setTimeout(() => {
        navigate('/dashboard/news');
      }, 1500);

    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      setError(err.response?.data?.error || err.message || 'Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  if (!isMainAdmin()) {
    return null;
  }

  if (loading) {
    return (
      <div className="news-formular">
        <div className="news-loading">Lädt News...</div>
      </div>
    );
  }

  return (
    <div className="news-formular">
      <div className="news-header">
        <div className="news-header-left">
          <button className="btn-back" onClick={() => navigate('/dashboard/news')}>
            ← Zurück
          </button>
          <h1>{mode === 'edit' ? 'News bearbeiten' : 'Neue News erstellen'}</h1>
        </div>
      </div>

      {error && <div className="news-error">{error}</div>}
      {success && <div className="news-success">{success}</div>}

      <form onSubmit={handleSubmit} className="news-form">
        {/* Titel */}
        <div className="form-group">
          <label htmlFor="titel">Titel *</label>
          <input
            type="text"
            id="titel"
            name="titel"
            value={formData.titel}
            onChange={handleChange}
            placeholder="Titel der News"
            required
            className="form-input"
          />
        </div>

        {/* Kurzbeschreibung */}
        <div className="form-group">
          <label htmlFor="kurzbeschreibung">
            Kurzbeschreibung
            <span className="char-count">({formData.kurzbeschreibung.length}/500)</span>
          </label>
          <textarea
            id="kurzbeschreibung"
            name="kurzbeschreibung"
            value={formData.kurzbeschreibung}
            onChange={handleChange}
            placeholder="Kurze Zusammenfassung für die Vorschau..."
            maxLength={500}
            rows={3}
            className="form-textarea"
          />
        </div>

        {/* Inhalt */}
        <div className="form-group">
          <label htmlFor="inhalt">Inhalt *</label>
          <textarea
            id="inhalt"
            name="inhalt"
            value={formData.inhalt}
            onChange={handleChange}
            placeholder="Der vollständige News-Artikel..."
            required
            rows={12}
            className="form-textarea form-textarea-large"
          />
        </div>

        {/* Zielgruppe */}
        <div className="form-group">
          <label>Zielgruppe</label>
          <div className="radio-group">
            <label className="radio-label">
              <input
                type="radio"
                name="zielgruppe"
                value="alle_dojos"
                checked={formData.zielgruppe === 'alle_dojos'}
                onChange={handleChange}
              />
              <span className="radio-text">
                <strong>Alle Dojos</strong>
                <small>Wird allen Dojos im System angezeigt</small>
              </span>
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="zielgruppe"
                value="homepage"
                checked={formData.zielgruppe === 'homepage'}
                onChange={handleChange}
              />
              <span className="radio-text">
                <strong>Nur Homepage (TDA-VIB)</strong>
                <small>Wird nur auf der TDA-VIB Homepage angezeigt</small>
              </span>
            </label>
          </div>
        </div>

        {/* Status */}
        <div className="form-group">
          <label htmlFor="status">Status</label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="form-select"
          >
            <option value="entwurf">Entwurf</option>
            <option value="veroeffentlicht">Veröffentlicht</option>
            <option value="archiviert">Archiviert</option>
          </select>
          {formData.status === 'veroeffentlicht' && (
            <small className="form-hint">
              Die News wird sofort für die Zielgruppe sichtbar sein.
            </small>
          )}
        </div>

        {/* Buttons */}
        <div className="form-actions">
          <button
            type="button"
            className="btn-cancel"
            onClick={() => navigate('/dashboard/news')}
          >
            Abbrechen
          </button>
          <button
            type="submit"
            className="btn-save"
            disabled={saving}
          >
            {saving ? 'Speichert...' : (mode === 'edit' ? 'Speichern' : 'Erstellen')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default NewsFormular;
