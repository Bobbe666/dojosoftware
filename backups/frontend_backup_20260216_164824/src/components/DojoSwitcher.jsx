import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronDown, Search, Settings, LayoutGrid, Shield, Headphones, Globe } from 'lucide-react';
import { useDojoContext } from '../context/DojoContext';
import { useAuth } from '../context/AuthContext';
import '../styles/DojoSwitcher.css';

const DojoSwitcher = () => {
  const { dojos, activeDojo, switchDojo, loading, filter, setFilter } = useDojoContext();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const searchInputRef = useRef(null);
  const showAllDojos = filter === 'all';

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
    if (isOpen) {
      calculateDropdownPosition();
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (loading) {
    return (
      <div className="dojo-switcher loading">
        <div className="spinner-small"></div>
      </div>
    );
  }

  if (!activeDojo) {
    return (
      <div className="dojo-switcher loading">
        <div style={{ color: '#ff6b35', fontSize: '0.85rem', padding: '10px' }}>
          Kein Dojo gefunden
        </div>
      </div>
    );
  }

  if (!dojos || dojos.length === 0) {
    return (
      <div className="dojo-switcher loading">
        <div style={{ color: '#ff6b35', fontSize: '0.85rem', padding: '10px' }}>
          Keine Dojos verfügbar
        </div>
      </div>
    );
  }

  const handleSwitchDojo = (dojo) => {
    switchDojo(dojo);
    setFilter('current');
    setIsOpen(false);
    setSearchQuery('');
    navigate('/dashboard', { replace: true });
  };

  const handleSwitchToSuperAdmin = () => {
    switchDojo('super-admin');
    setFilter('current');
    setIsOpen(false);
    setSearchQuery('');
    navigate('/dashboard', { replace: true });
  };

  const handleSwitchToVerband = () => {
    switchDojo('verband');
    setFilter('current');
    setIsOpen(false);
    setSearchQuery('');
    navigate('/dashboard', { replace: true });
  };

  const handleSwitchToSupport = () => {
    switchDojo('support');
    setFilter('current');
    setIsOpen(false);
    setSearchQuery('');
    navigate('/dashboard', { replace: true });
  };

  const handleShowAll = () => {
    if (dojos.length > 0) {
      const hauptDojo = dojos.find(d => d.ist_hauptdojo) || dojos[0];
      switchDojo(hauptDojo);
    }
    setFilter('all');
    setIsOpen(false);
    setSearchQuery('');
    navigate('/dashboard', { replace: true });
  };

  const isSuperAdmin = (user?.rolle === 'admin' || user?.role === 'admin') && user?.dojo_id === null;
  const isInSuperAdminMode = activeDojo === 'super-admin';
  const isInVerbandMode = activeDojo === 'verband';
  const isInSupportMode = activeDojo === 'support';
  const isInLizenzenMode = window.location.pathname === '/dashboard/lizenzen';

  // Filter dojos by search query
  const filteredDojos = Array.isArray(dojos)
    ? dojos.filter(d => d.dojoname?.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const calculateDropdownPosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 8,
        left: rect.left
      });
    }
  };

  const handleToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
    if (!isOpen) setSearchQuery('');
  };

  // Get current mode display info
  const getCurrentModeInfo = () => {
    if (isInLizenzenMode) return { icon: '📋', label: 'Lizenzverwaltung', color: '#8B5CF6' };
    if (isInSupportMode) return { icon: '🎫', label: 'Support Center', color: '#10b981' };
    if (isInVerbandMode) return { icon: '🌐', label: 'TDA Verband', color: '#3B82F6' };
    if (isInSuperAdminMode) return { icon: '🏢', label: 'TDA Int\'l Org', color: '#DAA520' };
    if (showAllDojos) return { icon: '📊', label: 'Alle Dojos', color: '#FF6B35' };
    return { icon: '🥋', label: activeDojo?.dojoname || 'Dojo', color: activeDojo?.farbe || '#FFD700' };
  };

  const modeInfo = getCurrentModeInfo();

  // Helper: Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  };

  // Helper: Get dojo info line
  const getDojoInfo = (dojo) => {
    if (dojo.steuer_status === 'kleinunternehmer') {
      const umsatz = dojo.jahresumsatz_aktuell || 0;
      const grenze = dojo.kleinunternehmer_grenze || 22000;
      const prozent = Math.round((umsatz / grenze) * 100);
      return {
        text: `${formatCurrency(umsatz)} / ${formatCurrency(grenze)}`,
        percent: prozent,
        color: prozent >= 90 ? '#ef4444' : prozent >= 75 ? '#f59e0b' : '#22c55e'
      };
    }
    return { text: 'Regelbesteuert', percent: null, color: '#6b7280' };
  };

  return (
    <div className="dojo-switcher">
      <button
        ref={triggerRef}
        className="dojo-switcher-trigger"
        onClick={handleToggle}
        title="Workspace wechseln"
        type="button"
      >
        <div className="dojo-switcher-indicator" style={{ borderColor: modeInfo.color }} />
        <span className="dojo-switcher-name">{modeInfo.icon} {modeInfo.label}</span>
        <ChevronDown size={14} className={`chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && createPortal(
        <>
          <div
            className="dojo-switcher-overlay"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(false);
            }}
          />
          <div
            className="dojo-switcher-dropdown"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`
            }}
          >
            {/* Search */}
            <div className="dropdown-search">
              <Search size={14} className="search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Suchen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <div className="dropdown-list">
              {/* Admin Section */}
              {isSuperAdmin && !searchQuery && (
                <>
                  <div className="dropdown-section-header">
                    <Shield size={12} />
                    Administration
                  </div>

                  {/* TDA Int'l Org */}
                  <button
                    type="button"
                    className={`dropdown-item compact ${isInSuperAdminMode ? 'active' : ''}`}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSwitchToSuperAdmin(); }}
                    style={{ '--accent-color': '#DAA520' }}
                  >
                    <span className="item-icon">🏢</span>
                    <span className="item-name">TDA Int'l Org</span>
                    <span className="item-badge gold">Admin</span>
                  </button>

                  {/* Lizenzverwaltung */}
                  <button
                    type="button"
                    className={`dropdown-item compact ${window.location.pathname === '/dashboard/lizenzen' ? 'active' : ''}`}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); navigate('/dashboard/lizenzen'); }}
                    style={{ '--accent-color': '#8B5CF6' }}
                  >
                    <span className="item-icon">📋</span>
                    <span className="item-name">Lizenzverwaltung</span>
                    <span className="item-badge purple">SaaS</span>
                  </button>

                  {/* TDA Verband */}
                  <button
                    type="button"
                    className={`dropdown-item compact ${isInVerbandMode ? 'active' : ''}`}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSwitchToVerband(); }}
                    style={{ '--accent-color': '#3B82F6' }}
                  >
                    <span className="item-icon">🌐</span>
                    <span className="item-name">TDA Verband</span>
                    <span className="item-badge blue">Verband</span>
                  </button>

                  {/* Support Center */}
                  <button
                    type="button"
                    className={`dropdown-item compact ${isInSupportMode ? 'active' : ''}`}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSwitchToSupport(); }}
                    style={{ '--accent-color': '#10b981' }}
                  >
                    <span className="item-icon">🎫</span>
                    <span className="item-name">Support Center</span>
                    <span className="item-badge green">Support</span>
                  </button>

                  {/* Alle Dojos */}
                  <button
                    type="button"
                    className={`dropdown-item compact ${showAllDojos ? 'active' : ''}`}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleShowAll(); }}
                    style={{ '--accent-color': '#FF6B35' }}
                  >
                    <span className="item-icon">📊</span>
                    <span className="item-name">Alle Dojos</span>
                    <span className="item-badge orange">Gesamt</span>
                  </button>
                </>
              )}

              {/* Dojos Section */}
              {filteredDojos.length > 0 && (
                <>
                  {!searchQuery && (
                    <div className="dropdown-section-header">
                      <Building2 size={12} />
                      Dojos
                    </div>
                  )}

                  {filteredDojos.map(dojo => {
                    const info = getDojoInfo(dojo);
                    return (
                      <button
                        key={dojo.id}
                        type="button"
                        className={`dropdown-item with-info ${!showAllDojos && activeDojo?.id === dojo.id ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSwitchDojo(dojo); }}
                        style={{ '--accent-color': dojo.farbe || '#FFD700' }}
                      >
                        <span className="item-icon">🥋</span>
                        <div className="item-content">
                          <div className="item-row">
                            <span className="item-name">{dojo.dojoname}</span>
                            {!!dojo.ist_hauptdojo && <span className="item-badge primary">Haupt</span>}
                          </div>
                          <div className="item-info" style={{ color: info.color }}>
                            {info.text}
                            {info.percent !== null && (
                              <span className="item-percent">({info.percent}%)</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </>
              )}

              {/* No results */}
              {searchQuery && filteredDojos.length === 0 && (
                <div className="dropdown-empty">
                  Keine Ergebnisse für "{searchQuery}"
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="dropdown-footer">
              <a href="/dashboard/dojos" className="footer-link" onClick={() => setIsOpen(false)}>
                <Settings size={12} />
                Dojos verwalten
              </a>
              <span className="footer-hint">ESC zum Schließen</span>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default DojoSwitcher;
