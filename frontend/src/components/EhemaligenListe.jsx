import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useDojoContext } from '../context/DojoContext.jsx';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, Users } from 'lucide-react';
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/EhemaligenListe.css";

const EhemaligenListe = () => {
  const { getDojoFilterParam } = useDojoContext();
  const [ehemalige, setEhemalige] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
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

  const loadEhemalige = useCallback(async () => {
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

      const response = await axios.get(`/ehemalige?${params.toString()}`);

      // Handle both old format (array) and new format (with pagination)
      if (response.data.data) {
        setEhemalige(response.data.data);
        setPagination(prev => ({
          ...prev,
          ...response.data.pagination
        }));
      } else {
        setEhemalige(response.data);
        setPagination(prev => ({
          ...prev,
          total: response.data.length,
          totalPages: 1
        }));
      }
      setLoading(false);
    } catch (err) {
      console.error("Fehler beim Laden der ehemaligen Mitglieder:", err);
      setError("Fehler beim Laden der Daten");
      setLoading(false);
    }
  }, [getDojoFilterParam, pagination.page, pagination.limit, searchTerm]);

  useEffect(() => {
    loadEhemalige();
  }, [loadEhemalige]);

  const goToPage = (page) => {
    if (page >= 1 && page <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page }));
    }
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
      <div className="el-pagination">
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
      <div className="el-header">
        <h1 className="el-header-h1">
          <Users size={28} />
          Ehemalige Mitglieder
        </h1>
        <button
          className="primary-button"
          onClick={() => navigate('/dashboard/mitglieder')}
        >
          Zurück zu Mitgliedern
        </button>
      </div>

      <div className="el-toolbar">
        <div className="el-search-wrap">
          <Search size={18} className="el-search-icon" />
          <input
            type="text"
            placeholder="Suchen nach Name, Email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="el-search-input"
          />
        </div>
        <div className="el-count-badge">
          {loading ? '...' : `${pagination.total} Ehemalige`}
          {pagination.totalPages > 1 && ` | Seite ${pagination.page}/${pagination.totalPages}`}
        </div>
      </div>

      {loading ? (
        <div className="el-loading">
          Lade ehemalige Mitglieder...
        </div>
      ) : (
        <>
          <div className="el-grid">
            {ehemalige.length > 0 ? (
              ehemalige.map((ehemaliger) => (
                <div
                  key={ehemaliger.id}
                  className="stat-card el-card"
                >
                  <h3 className="el-card-name">
                    {ehemaliger.nachname}, {ehemaliger.vorname}
                  </h3>
                  <div className="el-card-details">
                    {ehemaliger.austrittsdatum && (
                      <p className="el-card-detail-row">
                        <strong>Austritt:</strong> {new Date(ehemaliger.austrittsdatum).toLocaleDateString('de-DE')}
                      </p>
                    )}
                    {ehemaliger.email && (
                      <p className="el-card-detail-row">
                        <strong>Email:</strong> {ehemaliger.email}
                      </p>
                    )}
                    {ehemaliger.letzter_guertel && (
                      <p className="el-card-detail-row">
                        <strong>Letzter Gürtel:</strong> {ehemaliger.letzter_guertel}
                      </p>
                    )}
                    {ehemaliger.austrittsgrund && (
                      <p className="el-card-detail-row">
                        <strong>Grund:</strong> {ehemaliger.austrittsgrund}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="stat-card el-empty">
                <h3>Keine ehemaligen Mitglieder gefunden</h3>
                <p className="u-text-secondary">
                  {searchTerm ? 'Keine Treffer für die Suche.' : 'Es sind noch keine ehemaligen Mitglieder im System erfasst.'}
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

export default EhemaligenListe;
