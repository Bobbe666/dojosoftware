import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useDojoContext } from '../context/DojoContext.jsx';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, UserPlus } from 'lucide-react';
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/InteressentenListe.css";

const InteressentenListe = () => {
  const { getDojoFilterParam } = useDojoContext();
  const [interessenten, setInteressenten] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const navigate = useNavigate();

  // Pagination State
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Reset page when status filter changes
  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [filterStatus]);

  const loadInteressenten = useCallback(async () => {
    try {
      setLoading(true);
      const dojoFilterParam = getDojoFilterParam();

      const params = new URLSearchParams();
      if (dojoFilterParam) {
        const [key, value] = dojoFilterParam.split('=');
        params.append(key, value);
      }
      params.append('page', pagination.page);
      params.append('limit', pagination.limit);
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      if (filterStatus) {
        params.append('status', filterStatus);
      }

      const response = await axios.get(`/interessenten?${params.toString()}`);

      // Handle both old format (array) and new format (with pagination)
      if (response.data.data) {
        setInteressenten(response.data.data);
        setPagination(prev => ({
          ...prev,
          ...response.data.pagination
        }));
      } else {
        setInteressenten(response.data);
        setPagination(prev => ({
          ...prev,
          total: response.data.length,
          totalPages: 1
        }));
      }
      setLoading(false);
    } catch (err) {
      console.error("Fehler beim Laden der Interessenten:", err);
      setError("Fehler beim Laden der Daten");
      setLoading(false);
    }
  }, [getDojoFilterParam, pagination.page, pagination.limit, searchTerm, filterStatus]);

  useEffect(() => {
    loadInteressenten();
  }, [loadInteressenten]);

  const goToPage = (page) => {
    if (page >= 1 && page <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page }));
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'neu': '#3b82f6',
      'kontaktiert': '#8b5cf6',
      'probetraining_vereinbart': '#f59e0b',
      'probetraining_absolviert': '#10b981',
      'angebot_gesendet': '#06b6d4',
      'interessiert': '#84cc16',
      'nicht_interessiert': '#6b7280',
      'konvertiert': '#22c55e'
    };
    return colors[status] || '#6b7280';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'neu': 'Neu',
      'kontaktiert': 'Kontaktiert',
      'probetraining_vereinbart': 'Probetraining vereinbart',
      'probetraining_absolviert': 'Probetraining absolviert',
      'angebot_gesendet': 'Angebot gesendet',
      'interessiert': 'Interessiert',
      'nicht_interessiert': 'Nicht interessiert',
      'konvertiert': 'Konvertiert'
    };
    return labels[status] || status;
  };

  // Pagination Component
  const PaginationControls = () => {
    if (pagination.totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, pagination.page - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(pagination.totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <div className="il-pagination-controls">
        <button
          onClick={() => goToPage(1)}
          disabled={pagination.page === 1}
          className="pagination-btn"
          title="Erste Seite"
        >
          <ChevronsLeft size={18} />
        </button>
        <button
          onClick={() => goToPage(pagination.page - 1)}
          disabled={pagination.page === 1}
          className="pagination-btn"
          title="Vorherige Seite"
        >
          <ChevronLeft size={18} />
        </button>

        {startPage > 1 && <span className="u-text-muted">...</span>}

        {pages.map(page => (
          <button
            key={page}
            onClick={() => goToPage(page)}
            className={`pagination-btn ${pagination.page === page ? 'active' : ''}`}
          >
            {page}
          </button>
        ))}

        {endPage < pagination.totalPages && <span className="u-text-muted">...</span>}

        <button
          onClick={() => goToPage(pagination.page + 1)}
          disabled={pagination.page === pagination.totalPages}
          className="pagination-btn"
          title="Nächste Seite"
        >
          <ChevronRight size={18} />
        </button>
        <button
          onClick={() => goToPage(pagination.totalPages)}
          disabled={pagination.page === pagination.totalPages}
          className="pagination-btn"
          title="Letzte Seite"
        >
          <ChevronsRight size={18} />
        </button>
      </div>
    );
  };

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="il-page-header">
        <h1 className="il-page-title">
          <UserPlus size={28} />
          Interessenten
        </h1>
        <button
          className="primary-button"
          onClick={() => navigate('/dashboard/mitglieder')}
        >
          Zurück zu Mitgliedern
        </button>
      </div>

      <div className="il-filter-row">
        <div className="il-search-wrap">
          <Search size={18} className="il-search-icon" />
          <input
            type="text"
            placeholder="Suchen nach Name, Email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="il-search-input"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="il-filter-select"
        >
          <option value="" className="il-select-dark">Alle Status</option>
          <option value="neu" className="il-select-dark">Neu</option>
          <option value="kontaktiert" className="il-select-dark">Kontaktiert</option>
          <option value="probetraining_vereinbart" className="il-select-dark">Probetraining vereinbart</option>
          <option value="probetraining_absolviert" className="il-select-dark">Probetraining absolviert</option>
          <option value="angebot_gesendet" className="il-select-dark">Angebot gesendet</option>
          <option value="interessiert" className="il-select-dark">Interessiert</option>
          <option value="nicht_interessiert" className="il-select-dark">Nicht interessiert</option>
          <option value="konvertiert" className="il-select-dark">Konvertiert</option>
        </select>
        <div className="il-count-badge">
          {loading ? '...' : `${pagination.total} Interessenten`}
          {pagination.totalPages > 1 && ` | Seite ${pagination.page}/${pagination.totalPages}`}
        </div>
      </div>

      {loading ? (
        <div className="il-loading">
          Lade Interessenten...
        </div>
      ) : (
        <>
          <div className="il-card-grid">
            {interessenten.length > 0 ? (
              interessenten.map((interessent) => (
                <div
                  key={interessent.id}
                  className="stat-card il-card-base"
                  style={{ '--status-color': getStatusColor(interessent.status) }}
                >
                  <div className="il-card-header">
                    <h3 className="il-card-name">
                      {interessent.nachname}, {interessent.vorname}
                    </h3>
                    <span className="il-status-badge">
                      {getStatusLabel(interessent.status)}
                    </span>
                  </div>
                  <div className="il-card-info">
                    {interessent.email && (
                      <p className="il-m-02">
                        <strong>Email:</strong> {interessent.email}
                      </p>
                    )}
                    {interessent.telefon && (
                      <p className="il-m-02">
                        <strong>Telefon:</strong> {interessent.telefon}
                      </p>
                    )}
                    {interessent.erstkontakt_datum && (
                      <p className="il-m-02">
                        <strong>Erstkontakt:</strong> {new Date(interessent.erstkontakt_datum).toLocaleDateString('de-DE')}
                      </p>
                    )}
                    {interessent.interessiert_an && (
                      <p className="il-m-02">
                        <strong>Interesse:</strong> {interessent.interessiert_an}
                      </p>
                    )}
                    {interessent.prioritaet && (
                      <p className="il-m-02">
                        <strong>Priorität:</strong> {interessent.prioritaet}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="stat-card il-empty-card">
                <h3>Keine Interessenten gefunden</h3>
                <p className="u-text-secondary">
                  {searchTerm || filterStatus ? 'Keine Treffer für die Suche.' : 'Es sind noch keine Interessenten im System erfasst.'}
                </p>
              </div>
            )}
          </div>

          <PaginationControls />
        </>
      )}

      <style>{`
        .pagination-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 36px;
          height: 36px;
          padding: 0 0.5rem;
          background: rgba(31, 41, 55, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          color: rgba(255, 255, 255, 0.8);
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
        }
        .pagination-btn:hover:not(:disabled) {
          background: rgba(59, 130, 246, 0.3);
          border-color: rgba(59, 130, 246, 0.5);
        }
        .pagination-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .pagination-btn.active {
          background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%);
          border-color: transparent;
          color: white;
        }
      `}</style>
    </div>
  );
};

export default InteressentenListe;
