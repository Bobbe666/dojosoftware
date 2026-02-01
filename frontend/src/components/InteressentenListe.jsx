import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useDojoContext } from '../context/DojoContext.jsx';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, UserPlus } from 'lucide-react';
import "../styles/themes.css";
import "../styles/components.css";

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
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '0.5rem',
        marginTop: '2rem',
        flexWrap: 'wrap'
      }}>
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

        {startPage > 1 && <span style={{ color: 'rgba(255,255,255,0.5)' }}>...</span>}

        {pages.map(page => (
          <button
            key={page}
            onClick={() => goToPage(page)}
            className={`pagination-btn ${pagination.page === page ? 'active' : ''}`}
          >
            {page}
          </button>
        ))}

        {endPage < pagination.totalPages && <span style={{ color: 'rgba(255,255,255,0.5)' }}>...</span>}

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
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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

      <div style={{
        marginBottom: '1.5rem',
        display: 'flex',
        gap: '1rem',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
          <Search size={18} style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'rgba(255,255,255,0.5)'
          }} />
          <input
            type="text"
            placeholder="Suchen nach Name, Email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 0.75rem 0.75rem 40px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              background: 'rgba(31, 41, 55, 0.6)',
              color: 'white'
            }}
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            padding: '0.75rem',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            background: 'rgba(31, 41, 55, 0.6)',
            color: 'white',
            minWidth: '200px'
          }}
        >
          <option value="" style={{ background: '#1f2937', color: 'white' }}>Alle Status</option>
          <option value="neu" style={{ background: '#1f2937', color: 'white' }}>Neu</option>
          <option value="kontaktiert" style={{ background: '#1f2937', color: 'white' }}>Kontaktiert</option>
          <option value="probetraining_vereinbart" style={{ background: '#1f2937', color: 'white' }}>Probetraining vereinbart</option>
          <option value="probetraining_absolviert" style={{ background: '#1f2937', color: 'white' }}>Probetraining absolviert</option>
          <option value="angebot_gesendet" style={{ background: '#1f2937', color: 'white' }}>Angebot gesendet</option>
          <option value="interessiert" style={{ background: '#1f2937', color: 'white' }}>Interessiert</option>
          <option value="nicht_interessiert" style={{ background: '#1f2937', color: 'white' }}>Nicht interessiert</option>
          <option value="konvertiert" style={{ background: '#1f2937', color: 'white' }}>Konvertiert</option>
        </select>
        <div style={{
          color: 'rgba(255, 255, 255, 0.7)',
          background: 'rgba(31, 41, 55, 0.6)',
          padding: '0.75rem 1rem',
          borderRadius: '6px',
          whiteSpace: 'nowrap'
        }}>
          {loading ? '...' : `${pagination.total} Interessenten`}
          {pagination.totalPages > 1 && ` | Seite ${pagination.page}/${pagination.totalPages}`}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,0.7)' }}>
          Lade Interessenten...
        </div>
      ) : (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1rem'
          }}>
            {interessenten.length > 0 ? (
              interessenten.map((interessent) => (
                <div
                  key={interessent.id}
                  className="stat-card"
                  style={{
                    padding: '1rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    borderLeft: `4px solid ${getStatusColor(interessent.status)}`
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'start',
                    marginBottom: '0.5rem'
                  }}>
                    <h3 style={{
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      margin: 0,
                      color: '#ffd700'
                    }}>
                      {interessent.nachname}, {interessent.vorname}
                    </h3>
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      background: getStatusColor(interessent.status),
                      color: 'white',
                      fontWeight: '500'
                    }}>
                      {getStatusLabel(interessent.status)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.6' }}>
                    {interessent.email && (
                      <p style={{ margin: '0.2rem 0' }}>
                        <strong>Email:</strong> {interessent.email}
                      </p>
                    )}
                    {interessent.telefon && (
                      <p style={{ margin: '0.2rem 0' }}>
                        <strong>Telefon:</strong> {interessent.telefon}
                      </p>
                    )}
                    {interessent.erstkontakt_datum && (
                      <p style={{ margin: '0.2rem 0' }}>
                        <strong>Erstkontakt:</strong> {new Date(interessent.erstkontakt_datum).toLocaleDateString('de-DE')}
                      </p>
                    )}
                    {interessent.interessiert_an && (
                      <p style={{ margin: '0.2rem 0' }}>
                        <strong>Interesse:</strong> {interessent.interessiert_an}
                      </p>
                    )}
                    {interessent.prioritaet && (
                      <p style={{ margin: '0.2rem 0' }}>
                        <strong>Priorität:</strong> {interessent.prioritaet}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="stat-card" style={{
                gridColumn: '1 / -1',
                padding: '2rem',
                textAlign: 'center'
              }}>
                <h3>Keine Interessenten gefunden</h3>
                <p style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
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
