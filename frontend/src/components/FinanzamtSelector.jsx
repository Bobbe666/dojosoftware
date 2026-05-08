import React, { useState, useEffect } from 'react';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import './FinanzamtSelector.css';

const FinanzamtSelector = ({ value, onChange }) => {
  const [finanzaemter, setFinanzaemter] = useState([]);
  const [bundeslaender, setBundeslaender] = useState([]);
  const [selectedBundesland, setSelectedBundesland] = useState('');
  const [selectedValue, setSelectedValue] = useState('');
  const [loading, setLoading] = useState(false);

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

  // When finanzaemter loaded and a saved value exists, restore Bundesland
  useEffect(() => {
    if (!value || finanzaemter.length === 0) return;
    const match = finanzaemter.find(f => `${f.name}, ${f.ort}` === value || f.name === value);
    if (match && !selectedBundesland) {
      setSelectedBundesland(match.bundesland);
      setSelectedValue(`${match.name}, ${match.ort}`);
    } else if (!selectedBundesland) {
      setSelectedValue(value);
    }
  }, [value, finanzaemter]);

  const filteredFinanzaemter = selectedBundesland
    ? finanzaemter.filter(f => f.bundesland === selectedBundesland)
    : [];

  const handleBundeslandChange = (bl) => {
    setSelectedBundesland(bl);
    setSelectedValue('');
    onChange('');
  };

  const handleFinanzamtChange = (val) => {
    setSelectedValue(val);
    onChange(val);
  };

  return (
    <div className="finanzamt-selector">
      <select
        className="fa-select"
        value={selectedBundesland}
        onChange={(e) => handleBundeslandChange(e.target.value)}
        disabled={loading}
      >
        <option value="">{loading ? 'Lädt…' : '— Bundesland wählen —'}</option>
        {bundeslaender.map(bl => (
          <option key={bl} value={bl}>{bl}</option>
        ))}
      </select>

      <select
        className="fa-select"
        value={selectedValue}
        onChange={(e) => handleFinanzamtChange(e.target.value)}
        disabled={!selectedBundesland || loading}
      >
        <option value="">
          {!selectedBundesland ? '— Erst Bundesland wählen —' : '— Finanzamt wählen —'}
        </option>
        {filteredFinanzaemter.map(f => (
          <option key={f.id} value={`${f.name}, ${f.ort}`}>{f.name}</option>
        ))}
      </select>
    </div>
  );
};

export default FinanzamtSelector;
