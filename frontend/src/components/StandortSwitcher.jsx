import React, { useState, useRef, useEffect } from 'react';
import { MapPin, ChevronDown, Check, Building2 } from 'lucide-react';
import { useStandortContext } from '../context/StandortContext';
import '../styles/StandortSwitcher.css';

const StandortSwitcher = () => {
  const { standorte, activeStandort, currentStandort, switchStandort, loading, hasMultipleLocations } = useStandortContext();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);

  // Don't render if only one or no locations
  if (!hasMultipleLocations) {
    return null;
  }

  // Recalculate position when dropdown opens
  useEffect(() => {
    if (isOpen) {
      calculateDropdownPosition();
    }
  }, [isOpen]);

  if (loading) {
    return (
      <div className="standort-switcher loading">
        <div className="spinner-small"></div>
      </div>
    );
  }

  if (!standorte || standorte.length === 0) {
    return null;
  }

  const handleSwitch = (standortId) => {
    switchStandort(standortId);
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
    }
  };

  const handleToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (triggerRef.current && !triggerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="standort-switcher">
      <button
        ref={triggerRef}
        className="standort-switcher-trigger"
        onClick={handleToggle}
        title="Zwischen Standorten wechseln"
        type="button"
      >
        {activeStandort === 'all' ? (
          <>
            <div className="standort-color-indicator" style={{
              background: 'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)'
            }} />
            <div className="standort-switcher-content">
              <div className="standort-switcher-label">Standort:</div>
              <div className="standort-switcher-name">Alle Standorte</div>
            </div>
          </>
        ) : (
          <>
            <div className="standort-color-indicator" style={{
              background: currentStandort?.farbe || '#4F46E5'
            }} />
            <div className="standort-switcher-content">
              <div className="standort-switcher-label">Standort:</div>
              <div className="standort-switcher-name">
                {currentStandort?.name || 'Unbekannt'}
                {currentStandort?.ist_hauptstandort && (
                  <span className="standort-badge">Haupt</span>
                )}
              </div>
            </div>
          </>
        )}
        <ChevronDown
          size={16}
          className={`chevron ${isOpen ? 'open' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          className="standort-switcher-dropdown"
          style={{
            position: 'fixed',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            zIndex: 10000
          }}
        >
          <div className="dropdown-header">
            <MapPin size={14} />
            <span>Standorte</span>
          </div>

          {/* Option: Alle Standorte */}
          <button
            className={`standort-option ${activeStandort === 'all' ? 'active' : ''}`}
            onClick={() => handleSwitch('all')}
          >
            <div className="standort-option-indicator" style={{
              background: 'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)'
            }} />
            <div className="standort-option-content">
              <div className="standort-option-name">
                <Building2 size={14} style={{ marginRight: '6px' }} />
                Alle Standorte
              </div>
              <div className="standort-option-stats">
                {standorte.length} Standort{standorte.length !== 1 ? 'e' : ''}
              </div>
            </div>
            {activeStandort === 'all' && (
              <Check size={16} className="check-icon" />
            )}
          </button>

          <div className="dropdown-divider" />

          {/* Individual Standorte */}
          {standorte
            .sort((a, b) => {
              // Sort: Hauptstandort first, then by sortierung, then by name
              if (a.ist_hauptstandort && !b.ist_hauptstandort) return -1;
              if (!a.ist_hauptstandort && b.ist_hauptstandort) return 1;
              if (a.sortierung !== b.sortierung) return a.sortierung - b.sortierung;
              return (a.name || '').localeCompare(b.name || '');
            })
            .map((standort) => (
              <button
                key={standort.standort_id}
                className={`standort-option ${activeStandort === standort.standort_id ? 'active' : ''}`}
                onClick={() => handleSwitch(standort.standort_id)}
              >
                <div className="standort-option-indicator" style={{
                  background: standort.farbe || '#4F46E5'
                }} />
                <div className="standort-option-content">
                  <div className="standort-option-name">
                    <MapPin size={14} style={{ marginRight: '6px' }} />
                    {standort.name}
                    {standort.ist_hauptstandort && (
                      <span className="standort-badge-small">Haupt</span>
                    )}
                  </div>
                  <div className="standort-option-stats">
                    {standort.anzahl_kurse || 0} Kurse · {standort.anzahl_raeume || 0} Räume
                  </div>
                </div>
                {activeStandort === standort.standort_id && (
                  <Check size={16} className="check-icon" />
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
};

export default StandortSwitcher;
