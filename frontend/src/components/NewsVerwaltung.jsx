import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import axios from 'axios';
import '../styles/News.css';

function NewsVerwaltung({ embedded = false }) {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('alle');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // News laden
  const loadNews = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filter !== 'alle') {
        params.append('status', filter);
      }

      const response = await axios.get(
        `/news?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setNews(response.data.news || []);
    } catch (err) {
      console.error('Fehler beim Laden der News:', err);
      setError('Fehler beim Laden der News: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNews();
  }, [token, filter]);

  // News löschen
  const handleDelete = async (id) => {
    try {
      await axios.delete(
        `/news/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNews(news.filter(n => n.id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Fehler beim Löschen:', err);
      setError('Fehler beim Löschen: ' + (err.response?.data?.error || err.message));
    }
  };

  // Status Badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'veroeffentlicht': return <span className="news-status-badge published">Veröffentlicht</span>;
      case 'entwurf':         return <span className="news-status-badge draft">Entwurf</span>;
      case 'archiviert':      return <span className="news-status-badge archived">Archiviert</span>;
      case 'geplant':         return <span className="news-status-badge scheduled">Geplant</span>;
      default:                return <span className="news-status-badge">{status}</span>;
    }
  };

  const KATEGORIEN_LABEL = {
    allgemein: '📰 Allgemein', turniere: '🏆 Turniere', events: '🎯 Events',
    pruefungen: '🥋 Prüfungen', training: '💪 Training', verband: '🏛️ Verband',
  };

  // Zielgruppen Badge
  const getZielgruppeBadge = (zielgruppe) => {
    if (zielgruppe === 'homepage') {
      return <span className="news-zielgruppe-badge homepage">TDA-Websites</span>;
    }
    return <span className="news-zielgruppe-badge all-dojos">Alle Dojos</span>;
  };

  // Datum formatieren
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`news-verwaltung ${embedded ? 'embedded' : ''}`}>
      <div className="news-header">
        <div className="news-header-left">
          {!embedded && (
            <button className="btn-back" onClick={() => navigate('/dashboard')}>
              ← Zurück
            </button>
          )}
          <h1>📰 News verwalten</h1>
        </div>
        <button
          className="btn-create-news"
          onClick={() => navigate('/dashboard/news/neu')}
        >
          + Neue News erstellen
        </button>
      </div>

      {error && <div className="news-error">{error}</div>}

      {/* Filter */}
      <div className="news-filter">
        <button
          className={`filter-btn ${filter === 'alle' ? 'active' : ''}`}
          onClick={() => setFilter('alle')}
        >
          Alle
        </button>
        <button
          className={`filter-btn ${filter === 'entwurf' ? 'active' : ''}`}
          onClick={() => setFilter('entwurf')}
        >
          Entwürfe
        </button>
        <button
          className={`filter-btn ${filter === 'veroeffentlicht' ? 'active' : ''}`}
          onClick={() => setFilter('veroeffentlicht')}
        >
          Veröffentlicht
        </button>
        <button
          className={`filter-btn ${filter === 'geplant' ? 'active' : ''}`}
          onClick={() => setFilter('geplant')}
        >
          🕐 Geplant
        </button>
        <button
          className={`filter-btn ${filter === 'archiviert' ? 'active' : ''}`}
          onClick={() => setFilter('archiviert')}
        >
          Archiviert
        </button>
      </div>

      {/* News Liste */}
      {loading ? (
        <div className="news-loading">Lädt News...</div>
      ) : news.length === 0 ? (
        <div className="news-empty">
          <p>Keine News vorhanden.</p>
          <button
            className="btn-create-news"
            onClick={() => navigate('/dashboard/news/neu')}
          >
            Erste News erstellen
          </button>
        </div>
      ) : (
        <div className="news-list">
          {news.map((item) => (
            <div key={item.id} className="news-card">
              <div className="news-card-header">
                <h3 className="news-title">{item.titel}</h3>
                <div className="news-badges">
                  {getStatusBadge(item.status)}
                  {item.featured ? <span className="news-featured-badge">⭐ Featured</span> : null}
                  {item.kategorie && item.kategorie !== 'allgemein' && (
                    <span className="news-kategorie-badge">{KATEGORIEN_LABEL[item.kategorie] || item.kategorie}</span>
                  )}
                  {getZielgruppeBadge(item.zielgruppe)}
                </div>
              </div>

              {item.kurzbeschreibung && (
                <p className="news-description">{item.kurzbeschreibung}</p>
              )}

              <div className="news-card-footer">
                <div className="news-meta">
                  <span className="news-date">
                    Erstellt: {formatDate(item.created_at)}
                  </span>
                  {item.veroeffentlicht_am && (
                    <span className="news-date">
                      Veröffentlicht: {formatDate(item.veroeffentlicht_am)}
                    </span>
                  )}
                  {item.status === 'geplant' && item.geplant_am && (
                    <span className="news-date" style={{ color: '#63b3ed' }}>
                      🕐 Geplant für: {formatDate(item.geplant_am)}
                    </span>
                  )}
                  {item.ablauf_am && (
                    <span className="news-date" style={{ color: 'var(--status-warning)' }}>
                      ⚠️ Läuft ab: {formatDate(item.ablauf_am)}
                    </span>
                  )}
                </div>

                <div className="news-actions">
                  <button
                    className="btn-edit"
                    onClick={() => navigate(`/dashboard/news/bearbeiten/${item.id}`)}
                  >
                    Bearbeiten
                  </button>
                  {deleteConfirm === item.id ? (
                    <>
                      <button
                        className="btn-delete-confirm"
                        onClick={() => handleDelete(item.id)}
                      >
                        Bestätigen
                      </button>
                      <button
                        className="btn-cancel"
                        onClick={() => setDeleteConfirm(null)}
                      >
                        Abbrechen
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn-delete"
                      onClick={() => setDeleteConfirm(item.id)}
                    >
                      Löschen
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default NewsVerwaltung;
