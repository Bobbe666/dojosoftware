import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { Building2, ChevronDown, Search, Settings, X } from 'lucide-react';
import { useDojoContext } from '../context/DojoContext';
import { useAuth } from '../context/AuthContext';
import '../styles/DojoSwitcher.css';

const DojoSwitcher = () => {
  const { dojos, activeDojo, switchDojo, loading, filter, setFilter } = useDojoContext();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const triggerRef = useRef(null);
  const searchInputRef = useRef(null);
  const showAllDojos = filter === 'all';

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 150);
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
        <div className="dojo-switcher-message">
          Kein Dojo gefunden
        </div>
      </div>
    );
  }

  if (!dojos || dojos.length === 0) {
    return (
      <div className="dojo-switcher loading">
        <div className="dojo-switcher-message">
          Keine Dojos verfügbar
        </div>
      </div>
    );
  }

  // Super-Admin: role='admin' ohne eigene dojo_id ODER explizit 'super_admin'
  const isSuperAdmin = ((user?.rolle === 'admin' || user?.role === 'admin') && user?.dojo_id === null)
    || user?.role === 'super_admin' || user?.rolle === 'super_admin';

  // Für Nicht-Super-Admins mit nur einem Dojo: Switcher komplett ausblenden
  if (!isSuperAdmin && dojos.length <= 1) return null;

  const handleSwitchDojo = (dojo) => {
    switchDojo(dojo);
    setFilter('current');
    setIsOpen(false);
    setSearchQuery('');
    // Auf aktueller Seite bleiben — nur zum Dashboard wenn Seite nicht mehr passt
    if (!location.pathname.startsWith('/dashboard')) {
      navigate('/dashboard', { replace: true });
    }
  };

  const handleSwitchToSuperAdmin = () => {
    switchDojo('super-admin');
    setFilter('current');
    setIsOpen(false);
    setSearchQuery('');
    // Auf aktueller Seite bleiben — nur zum Dashboard wenn Seite nicht mehr passt
    if (!location.pathname.startsWith('/dashboard')) {
      navigate('/dashboard', { replace: true });
    }
  };

  const handleSwitchToVerband = () => {
    switchDojo('verband');
    setFilter('current');
    setIsOpen(false);
    setSearchQuery('');
    // Auf aktueller Seite bleiben — nur zum Dashboard wenn Seite nicht mehr passt
    if (!location.pathname.startsWith('/dashboard')) {
      navigate('/dashboard', { replace: true });
    }
  };

  const handleSwitchToSupport = () => {
    switchDojo('support');
    setFilter('current');
    setIsOpen(false);
    setSearchQuery('');
    // Auf aktueller Seite bleiben — nur zum Dashboard wenn Seite nicht mehr passt
    if (!location.pathname.startsWith('/dashboard')) {
      navigate('/dashboard', { replace: true });
    }
  };

  const handleSwitchToShop = () => {
    switchDojo('shop');
    setFilter('current');
    setIsOpen(false);
    setSearchQuery('');
    // Auf aktueller Seite bleiben — nur zum Dashboard wenn Seite nicht mehr passt
    if (!location.pathname.startsWith('/dashboard')) {
      navigate('/dashboard', { replace: true });
    }
  };

  const handleShowAll = () => {
    if (dojos.length > 0) {
      const hauptDojo = dojos.find(d => d.ist_hauptdojo) || dojos[0];
      switchDojo(hauptDojo);
    }
    setFilter('all');
    setIsOpen(false);
    setSearchQuery('');
    // Auf aktueller Seite bleiben — nur zum Dashboard wenn Seite nicht mehr passt
    if (!location.pathname.startsWith('/dashboard')) {
      navigate('/dashboard', { replace: true });
    }
  };

  const isInSuperAdminMode = activeDojo === 'super-admin';
  const isInVerbandMode = activeDojo === 'verband';
  const isInSupportMode = activeDojo === 'support';
  const isInShopMode = activeDojo === 'shop';
  const isInLizenzenMode = window.location.pathname === '/dashboard/lizenzen';

  // Filter dojos by search query
  const filteredDojos = Array.isArray(dojos)
    ? dojos.filter(d => d.dojoname?.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const handleToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
    if (!isOpen) setSearchQuery('');
  };

  // Get current mode display info
  const getCurrentModeInfo = () => {
    if (isInLizenzenMode) return { icon: '📋', label: 'Lizenzverwaltung', color: '#8B5CF6' };
    if (isInSupportMode) return { icon: '🎫', label: 'Support Center', color: 'var(--success)' };
    if (isInVerbandMode) return { icon: '🌐', label: 'TDA Verband', color: 'var(--info)' };
    if (isInSuperAdminMode) return { icon: '🏢', label: 'TDA Int\'l Org', color: '#DAA520' };
    if (isInShopMode) return { icon: '🛍️', label: 'TDA Shop', color: '#F97316' };
    if (showAllDojos) return { icon: '📊', label: 'Alle Dojos', color: 'var(--secondary)' };
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
    return { text: 'Regelbesteuert', percent: null, color: 'var(--text-muted)' };
  };

  return (
    <div className="dojo-switcher">
      <button
        ref={triggerRef}
        className="dojo-switcher-trigger"
        onClick={handleToggle}
        title="Workspace wechseln"
        type="button"
        style={{ '--mode-color': modeInfo.color }}
      >
        <div className="dojo-switcher-indicator" />
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
          <div className="dojo-switcher-modal">
            {/* Modal Header */}
            <div className="ds-modal-header">
              <div>
                <div className="ds-modal-title">
                  <span className="ds-modal-icon">🏢</span>
                  <span>Workspace wechseln</span>
                </div>
                <div className="ds-modal-current">
                  <span className="ds-modal-current-dot" style={{ background: modeInfo.color }} />
                  <span>{modeInfo.icon} {modeInfo.label}</span>
                </div>
              </div>
              <button
                className="ds-modal-close"
                onClick={() => setIsOpen(false)}
                type="button"
                aria-label="Schließen"
              >
                <X size={16} />
              </button>
            </div>

            {/* Search */}
            <div className="dropdown-search">
              <Search size={14} className="search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Dojo suchen…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <div className="dropdown-list">
              {/* Admin Schnellzugriff – kompaktes 2×2-Grid */}
              {isSuperAdmin && !searchQuery && (
                <>
                  <div className="ds-admin-grid">
                    <button
                      type="button"
                      className={`ds-admin-btn ds-color-gold ${isInSuperAdminMode && !isInLizenzenMode ? 'active' : ''}`}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSwitchToSuperAdmin(); }}
                    >
                      <span className="ds-btn-icon">🏢</span>
                      <span className="ds-btn-label">TDA Org</span>
                    </button>
                    <button
                      type="button"
                      className={`ds-admin-btn ds-color-purple ${isInLizenzenMode ? 'active' : ''}`}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); switchDojo('super-admin'); navigate('/dashboard/lizenzen'); }}
                    >
                      <span className="ds-btn-icon">📋</span>
                      <span className="ds-btn-label">Lizenzen</span>
                    </button>
                    <button
                      type="button"
                      className={`ds-admin-btn ds-color-blue ${isInVerbandMode ? 'active' : ''}`}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSwitchToVerband(); }}
                    >
                      <span className="ds-btn-icon">🌐</span>
                      <span className="ds-btn-label">Verband</span>
                    </button>
                    <button
                      type="button"
                      className={`ds-admin-btn ds-color-green ${isInSupportMode ? 'active' : ''}`}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSwitchToSupport(); }}
                    >
                      <span className="ds-btn-icon">🎫</span>
                      <span className="ds-btn-label">Support</span>
                    </button>
                    <button
                      type="button"
                      className="ds-admin-btn ds-color-amber"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); window.open('https://hof.tda-intl.org', '_blank'); }}
                    >
                      <span className="ds-btn-icon">🏆</span>
                      <span className="ds-btn-label">Hall of Fame</span>
                    </button>
                    <button
                      type="button"
                      className="ds-admin-btn ds-color-red"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); window.open('https://events.tda-intl.org', '_blank'); }}
                    >
                      <span className="ds-btn-icon">🗓️</span>
                      <span className="ds-btn-label">Events</span>
                    </button>
                    <button
                      type="button"
                      className={`ds-admin-btn ds-color-orange ${isInShopMode ? 'active' : ''}`}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSwitchToShop(); }}
                    >
                      <span className="ds-btn-icon">🛍️</span>
                      <span className="ds-btn-label">Shop</span>
                    </button>
                    <button
                      type="button"
                      className="ds-admin-btn ds-color-teal"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); window.open('https://academy.tda-intl.org', '_blank'); }}
                    >
                      <span className="ds-btn-icon">🎓</span>
                      <span className="ds-btn-label">Academy</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    className={`ds-alle-dojos-btn ${showAllDojos ? 'active' : ''}`}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleShowAll(); }}
                  >
                    <span>📊</span>
                    <span>Alle Dojos</span>
                    <span className="ds-alle-badge">Gesamt</span>
                  </button>

                  <div className="ds-divider" />
                </>
              )}

              {/* Dojos-Liste */}
              {filteredDojos.length > 0 && (
                <>
                  {!searchQuery && isSuperAdmin && (
                    <div className="dropdown-section-header">
                      <Building2 size={12} />
                      Dojos
                    </div>
                  )}
                  {filteredDojos.map(dojo => {
                    const info = getDojoInfo(dojo);
                    const isActive = !showAllDojos && activeDojo?.id === dojo.id;
                    return (
                      <button
                        key={dojo.id}
                        type="button"
                        className={`dropdown-item ${isActive ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSwitchDojo(dojo); }}
                        style={{ '--accent-color': dojo.farbe || '#FFD700', '--info-color': info.color }}
                      >
                        <span className="ds-dojo-dot" />
                        <div className="item-content">
                          <div className="item-row">
                            <span className="item-name">{dojo.dojoname}</span>
                            {!!dojo.ist_hauptdojo && <span className="item-badge primary">Haupt</span>}
                          </div>
                          {isSuperAdmin && (
                            <div className="item-info">
                              {info.text}
                              {info.percent !== null && <span className="item-percent"> ({info.percent}%)</span>}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </>
              )}

              {searchQuery && filteredDojos.length === 0 && (
                <div className="dropdown-empty">Keine Ergebnisse für „{searchQuery}"</div>
              )}
            </div>

            {/* Footer */}
            {isSuperAdmin && (
              <div className="dropdown-footer">
                <a href="/dashboard/dojos" className="footer-link" onClick={() => setIsOpen(false)}>
                  <Settings size={12} />
                  Dojos verwalten
                </a>
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default DojoSwitcher;
