import React, { useState, useEffect, useRef } from 'react';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import './FinanzamtSelector.css';

const FinanzamtSelector = ({
  value,
  onChange,
  placeholder = 'Finanzamt suchen...',
}) => {
  const [finanzaemter, setFinanzaemter] = useState([]);
  const [filteredList, setFilteredList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bundeslaender, setBundeslaender] = useState([]);
  const [selectedBundesland, setSelectedBundesland] = useState('');

  const rootRef = useRef(null);

  // Load data once on mount
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [listRes, blRes] = await Promise.all([
          fetchWithAuth('/api/finanzaemter'),
          fetchWithAuth('/api/finanzaemter/bundeslaender'),
        ]);
        if (listRes.ok) setFinanzaemter(await listRes.json());
        if (blRes.ok) setBundeslaender(await blRes.json());
      } catch (err) {
        console.error('Fehler beim Laden der Finanzämter:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Sync display value when parent changes value
  useEffect(() => {
    if (typeof value === 'string') {
      setSearchTerm(value);
    } else if (value && typeof value === 'object') {
      setSearchTerm(`${value.name}, ${value.ort}`);
    }
  }, [value]);

  // Filter list whenever search term or bundesland changes
  useEffect(() => {
    let list = finanzaemter;
    if (selectedBundesland) {
      list = list.filter(f => f.bundesland === selectedBundesland);
    }
    if (searchTerm) {
      const ql = searchTerm.toLowerCase();
      list = list.filter(
        f =>
          f.name.toLowerCase().includes(ql) ||
          f.ort.toLowerCase().includes(ql) ||
          f.bundesland.toLowerCase().includes(ql)
      );
    }
    setFilteredList(list.slice(0, 60));
  }, [searchTerm, selectedBundesland, finanzaemter]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
    if (!e.target.value) {
      onChange('');
    }
  };

  const handleSelect = (finanzamt) => {
    const displayName = `${finanzamt.name}, ${finanzamt.ort}`;
    setSearchTerm(displayName);
    onChange(displayName);
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') setIsOpen(false);
  };

  return (
    <div className="finanzamt-selector" ref={rootRef}>
      <input
        type="text"
        className="finanzamt-input"
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
      />

      {isOpen && (
        <div className="finanzamt-dropdown">
          <div className="finanzamt-dropdown-filter">
            <select
              className="finanzamt-bl-select"
              value={selectedBundesland}
              onChange={(e) => setSelectedBundesland(e.target.value)}
            >
              <option value="">Alle Bundesländer</option>
              {bundeslaender.map(bl => (
                <option key={bl} value={bl}>{bl}</option>
              ))}
            </select>
          </div>

          <div className="finanzamt-list">
            {loading ? (
              <div className="finanzamt-loading">Lade Finanzämter…</div>
            ) : filteredList.length === 0 ? (
              <div className="finanzamt-empty">Keine Finanzämter gefunden</div>
            ) : (
              filteredList.map(f => (
                <div
                  key={f.id}
                  className="finanzamt-item"
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(f); }}
                >
                  <span className="finanzamt-item-name">{f.name}</span>
                  <span className="finanzamt-item-detail">{f.ort} · {f.bundesland}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanzamtSelector;
