import React, { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, Check, AlertTriangle, TrendingUp } from 'lucide-react';
import { useDojoContext } from '../context/DojoContext';
import '../styles/DojoSwitcher.css';

const DojoSwitcher = () => {
  const { dojos, activeDojo, switchDojo, loading, filter, setFilter } = useDojoContext();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const showAllDojos = filter === 'all';

  // Debug logging

  // Recalculate position when dropdown opens
  useEffect(() => {
    if (isOpen) {
      calculateDropdownPosition();
    }
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

  const getStatusIcon = (dojo) => {
    if (dojo.steuer_status === 'kleinunternehmer') {
      const prozent = (dojo.jahresumsatz_aktuell / dojo.kleinunternehmer_grenze) * 100;
      if (prozent >= 100) {
        return <AlertTriangle size={14} className="status-icon warning" />;
      } else if (prozent >= 80) {
        return <TrendingUp size={14} className="status-icon caution" />;
      } else {
        return <Check size={14} className="status-icon success" />;
      }
    } else {
      return <Building2 size={14} className="status-icon info" />;
    }
  };

  const getStatusText = (dojo) => {
    if (dojo.steuer_status === 'kleinunternehmer') {
      const prozent = (dojo.jahresumsatz_aktuell / dojo.kleinunternehmer_grenze) * 100;
      return `${prozent.toFixed(0)}% der Grenze`;
    } else {
      return `USt-pflichtig (${dojo.ust_satz}%)`;
    }
  };

  const handleSwitchDojo = (dojo) => {
    switchDojo(dojo);
    setFilter('current');
    setIsOpen(false);
  };

  const handleShowAll = () => {
    setFilter('all');
    setIsOpen(false);
  };

  const calculateDropdownPosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const newPosition = {
        top: rect.bottom + 8,
        left: rect.left
      };
      setDropdownPosition(newPosition);
    } else {
    }
  };

  const handleToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <div className="dojo-switcher">
      <button
        ref={triggerRef}
        className="dojo-switcher-trigger"
        onClick={handleToggle}
        title="Zwischen Dojos wechseln"
        type="button"
      >
        {showAllDojos ? (
          <>
            <div className="dojo-color-indicator" style={{
              background: 'linear-gradient(135deg, #FFD700 0%, #FF6B35 50%, #3B82F6 100%)'
            }} />
            <div className="dojo-switcher-content">
              <div className="dojo-switcher-label">Ansicht:</div>
              <div className="dojo-switcher-name">Alle Dojos</div>
            </div>
            <Building2 size={18} className="status-icon info" />
          </>
        ) : (
          <>
            <div
              className="dojo-color-indicator"
              style={{ backgroundColor: activeDojo.farbe }}
            />
            <div className="dojo-switcher-content">
              <div className="dojo-switcher-label">Aktives Dojo:</div>
              <div className="dojo-switcher-name">{activeDojo.dojoname}</div>
            </div>
            {getStatusIcon(activeDojo)}
          </>
        )}
        <ChevronDown size={20} className={`chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
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
            <div className="dropdown-header">
              <h3>Dojo wechseln</h3>
              <p>Wählen Sie das aktive Dojo aus</p>
            </div>

            <div className="dropdown-list">
              {/* Alle Dojos Option */}
              <button
                type="button"
                className={`dropdown-item ${showAllDojos ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleShowAll();
                }}
              >
                <div className="dojo-color-indicator" style={{
                  background: 'linear-gradient(135deg, #FFD700 0%, #FF6B35 50%, #3B82F6 100%)'
                }} />
                <div className="dropdown-item-content">
                  <div className="dropdown-item-header">
                    <span className="dropdown-item-name">Alle Dojos</span>
                    <span className="badge badge-primary">Gesamt</span>
                    {showAllDojos && (
                      <Check size={16} className="check-icon" />
                    )}
                  </div>
                  <div className="dropdown-item-info">
                    <span className="dropdown-item-inhaber">Kombinierte Ansicht aller Dojos</span>
                  </div>
                  <div className="dropdown-item-umsatz">
                    Gesamtumsatz {new Date().getFullYear()}: {parseFloat(dojos.reduce((sum, d) => sum + (d.jahresumsatz_aktuell || 0), 0)).toLocaleString('de-DE')} €
                  </div>
                </div>
              </button>

              {/* Einzelne Dojos */}
              {dojos.map(dojo => (
                <button
                  key={dojo.id}
                  type="button"
                  className={`dropdown-item ${!showAllDojos && activeDojo.id === dojo.id ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSwitchDojo(dojo);
                  }}
                >
                  <div
                    className="dojo-color-indicator"
                    style={{ backgroundColor: dojo.farbe }}
                  />
                  <div className="dropdown-item-content">
                    <div className="dropdown-item-header">
                      <span className="dropdown-item-name">{dojo.dojoname}</span>
                      {dojo.ist_hauptdojo && (
                        <span className="badge badge-primary">Haupt</span>
                      )}
                      {!showAllDojos && activeDojo.id === dojo.id && (
                        <Check size={16} className="check-icon" />
                      )}
                    </div>
                    <div className="dropdown-item-info">
                      <span className="dropdown-item-inhaber">{dojo.inhaber}</span>
                      <span className="dropdown-item-status">
                        {getStatusIcon(dojo)}
                        {getStatusText(dojo)}
                      </span>
                    </div>
                    <div className="dropdown-item-umsatz">
                      Umsatz {new Date().getFullYear()}: {parseFloat(dojo.jahresumsatz_aktuell || 0).toLocaleString('de-DE')} €
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="dropdown-footer">
              <a href="/dashboard/dojos" className="link-manage-dojos">
                <Building2 size={16} />
                Dojos verwalten
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DojoSwitcher;
