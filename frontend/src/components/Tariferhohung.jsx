import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Users,
  DollarSign,
  Calendar,
  Check
} from "lucide-react";
import { useMitgliederUpdate } from '../context/MitgliederUpdateContext.jsx';
import { useDojoContext } from '../context/DojoContext.jsx';
import config from "../config/config";
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/Tariferhohung.css";
import { fetchWithAuth } from '../utils/fetchWithAuth';

const Tariferhohung = () => {
  const navigate = useNavigate();
  const { triggerUpdate } = useMitgliederUpdate();
  const { getDojoFilterParam } = useDojoContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [customAmounts, setCustomAmounts] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [percentageIncrease, setPercentageIncrease] = useState(5);
  const [fixedIncrease, setFixedIncrease] = useState(5);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const dojoFilterParam = getDojoFilterParam();
      const response = await fetchWithAuth(`${config.apiBaseUrl}/finanzcockpit/tariferhohung?${dojoFilterParam}`);

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setData(result.data);
          // Initialize custom amounts with tariff prices
          const amounts = {};
          result.data.mitglieder.forEach(m => {
            amounts[m.vertragId] = m.tarifPreis;
          });
          setCustomAmounts(amounts);
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
      setErrorMessage('Fehler beim Laden der Daten');
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
  };

  const formatDate = (value) => {
    if (!value) return '-';
    try {
      return new Intl.DateTimeFormat('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(new Date(value));
    } catch (error) {
      return value;
    }
  };

  const toggleSelect = (vertragId) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(vertragId)) {
        newSet.delete(vertragId);
      } else {
        newSet.add(vertragId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    if (data?.mitglieder) {
      setSelectedIds(new Set(data.mitglieder.map(m => m.vertragId)));
    }
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleAmountChange = (vertragId, value) => {
    const numValue = parseFloat(value) || 0;
    setCustomAmounts(prev => ({
      ...prev,
      [vertragId]: numValue
    }));
  };

  const applyIncrease = async (vertragIds) => {
    if (vertragIds.length === 0) return;

    try {
      setSaving(true);
      setSuccessMessage('');
      setErrorMessage('');

      const erhoehungen = vertragIds.map(id => ({
        vertrag_id: id,
        neuer_beitrag: customAmounts[id] || data.mitglieder.find(m => m.vertragId === id)?.tarifPreis || 0
      }));

      const response = await fetchWithAuth(`${config.apiBaseUrl}/finanzcockpit/tariferhohung`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ erhoehungen })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setSuccessMessage(`${result.data.erfolgreiche} Beiträge erfolgreich erhöht!`);
          // Clear selection and reload data
          setSelectedIds(new Set());
          triggerUpdate();
          await loadData();
        } else {
          setErrorMessage(result.error || 'Fehler beim Erhöhen der Beiträge');
        }
      } else {
        setErrorMessage('Fehler beim Erhöhen der Beiträge');
      }
      setSaving(false);
    } catch (error) {
      console.error('Fehler:', error);
      setErrorMessage('Fehler beim Erhöhen der Beiträge');
      setSaving(false);
    }
  };

  const increaseSelected = () => {
    applyIncrease(Array.from(selectedIds));
  };

  const increaseAll = () => {
    if (data?.mitglieder) {
      applyIncrease(data.mitglieder.map(m => m.vertragId));
    }
  };

  const increaseSingle = (vertragId) => {
    applyIncrease([vertragId]);
  };

  // Alle um X% erhöhen (berechnet neuen Betrag und setzt ihn in customAmounts)
  const applyPercentageToAll = () => {
    if (!data?.mitglieder) return;
    const newAmounts = { ...customAmounts };
    data.mitglieder.forEach(m => {
      const currentAmount = m.aktuellerBeitrag;
      const newAmount = Math.round((currentAmount * (1 + percentageIncrease / 100)) * 100) / 100;
      newAmounts[m.vertragId] = newAmount;
    });
    setCustomAmounts(newAmounts);
    setSuccessMessage(`Alle Beträge um ${percentageIncrease}% erhöht (noch nicht gespeichert)`);
  };

  // Alle um X€ erhöhen (berechnet neuen Betrag und setzt ihn in customAmounts)
  const applyFixedToAll = () => {
    if (!data?.mitglieder) return;
    const newAmounts = { ...customAmounts };
    data.mitglieder.forEach(m => {
      const currentAmount = m.aktuellerBeitrag;
      const newAmount = Math.round((currentAmount + fixedIncrease) * 100) / 100;
      newAmounts[m.vertragId] = newAmount;
    });
    setCustomAmounts(newAmounts);
    setSuccessMessage(`Alle Beträge um ${formatCurrency(fixedIncrease)} erhöht (noch nicht gespeichert)`);
  };

  // Auf Tarifpreis setzen für alle
  const setAllToTarifPrice = () => {
    if (!data?.mitglieder) return;
    const newAmounts = { ...customAmounts };
    data.mitglieder.forEach(m => {
      newAmounts[m.vertragId] = m.tarifPreis;
    });
    setCustomAmounts(newAmounts);
    setSuccessMessage('Alle Beträge auf Tarifpreis gesetzt (noch nicht gespeichert)');
  };

  if (loading) {
    return (
      <div className="page-container te-page-pad">
        <div className="te-loading-center">
          <div className="te-spinner" />
          <p className="te-loading-text">Lade Daten...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container te-page-pad">
      {/* Header */}
      <div className="te-header-row">
        <button
          onClick={() => navigate('/dashboard/finanzcockpit')}
          className="te-back-btn"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="te-page-title">
            <TrendingUp size={28} className="te-title-icon" />
            Tariferhöhung
          </h1>
          <p className="te-page-subtitle">
            Mitglieder, die unter dem aktuellen Tarifpreis zahlen
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="te-summary-grid">
          <div className="te-summary-card">
            <div className="te-flex-row-mb">
              <Users size={18} className="te-icon-gold" />
              <span className="te-muted-sm">Betroffene Mitglieder</span>
            </div>
            <span className="te-stat-primary">{data.anzahl}</span>
          </div>

          <div className="te-summary-card">
            <div className="te-flex-row-mb">
              <DollarSign size={18} className="te-icon-bamboo" />
              <span className="te-muted-sm">Monatliches Potential</span>
            </div>
            <span className="te-stat-bamboo">
              {formatCurrency(data.monatlichesPotential)}
            </span>
          </div>

          <div className="te-summary-card">
            <div className="te-flex-row-mb">
              <Calendar size={18} className="te-icon-indigo" />
              <span className="te-muted-sm">Jährliches Potential</span>
            </div>
            <span className="te-stat-indigo">
              {formatCurrency(data.jaehrlichesPotential)}
            </span>
          </div>
        </div>
      )}

      {/* Schnelle Erhöhungsoptionen */}
      {data && data.anzahl > 0 && (
        <div className="te-quick-card">
          <h3 className="te-quick-title">
            Schnelle Erhöhung für alle Mitglieder
          </h3>

          <div className="te-quick-row">
            {/* Prozentuale Erhöhung */}
            <div className="u-flex-col-sm">
              <label className="te-text-muted-sm">
                Prozentuale Erhöhung
              </label>
              <div className="te-flex-gap-sm">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={percentageIncrease}
                  onChange={(e) => setPercentageIncrease(parseFloat(e.target.value) || 0)}
                  className="te-input-number"
                />
                <span className="u-text-secondary">%</span>
                <button
                  onClick={applyPercentageToAll}
                  disabled={saving}
                  className="te-btn-indigo"
                >
                  Alle +{percentageIncrease}%
                </button>
              </div>
            </div>

            {/* Fester Betrag */}
            <div className="u-flex-col-sm">
              <label className="te-text-muted-sm">
                Fester Betrag
              </label>
              <div className="te-flex-gap-sm">
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  value={fixedIncrease}
                  onChange={(e) => setFixedIncrease(parseFloat(e.target.value) || 0)}
                  className="te-input-number"
                />
                <span className="u-text-secondary">EUR</span>
                <button
                  onClick={applyFixedToAll}
                  disabled={saving}
                  className="te-btn-vermillion"
                >
                  Alle +{formatCurrency(fixedIncrease)}
                </button>
              </div>
            </div>

            {/* Auf Tarifpreis */}
            <div className="u-flex-col-sm">
              <label className="te-text-muted-sm">
                Tarifpreis
              </label>
              <button
                onClick={setAllToTarifPrice}
                disabled={saving}
                className="te-btn-bamboo"
              >
                Alle auf Tarifpreis
              </button>
            </div>
          </div>

          <p className="te-quick-hint">
            Die Beträge werden in der Spalte "Neuer Beitrag" vorausgefüllt.
            Klicken Sie dann auf "Alle erhöhen" um die Änderungen zu speichern.
          </p>
        </div>
      )}

      {/* Messages */}
      {successMessage && (
        <div className="te-alert-success">
          <CheckCircle2 size={20} />
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="te-alert-error">
          <AlertCircle size={20} />
          {errorMessage}
        </div>
      )}

      {/* Action Buttons */}
      {data && data.anzahl > 0 && (
        <div className="te-action-row">
          <button
            onClick={selectAll}
            className="te-btn-outline"
          >
            Alle auswählen
          </button>
          <button
            onClick={deselectAll}
            className="te-btn-outline"
          >
            Auswahl aufheben
          </button>

          <div className="u-flex-1" />

          <button
            onClick={increaseSelected}
            disabled={selectedIds.size === 0 || saving}
            style={{
              background: selectedIds.size === 0 ? 'var(--primary-alpha-30, rgba(139, 92, 246, 0.3))' : 'var(--color-vermillion, #8b5cf6)',
              border: 'none',
              color: 'var(--text-primary)',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <TrendingUp size={18} />
            Ausgewählte erhöhen ({selectedIds.size})
          </button>

          <button
            onClick={increaseAll}
            disabled={saving}
            className="te-btn-gold"
          >
            <TrendingUp size={18} />
            Alle erhöhen
          </button>
        </div>
      )}

      {/* Table */}
      {data && data.anzahl > 0 ? (
        <div className="te-table-card">
          <div className="te-table-scroll">
            <table className="te-table">
              <thead>
                <tr className="te-thead-row">
                  <th className="te-th-check">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === data.mitglieder.length && data.mitglieder.length > 0}
                      onChange={(e) => e.target.checked ? selectAll() : deselectAll()}
                      className="te-icon-input"
                    />
                  </th>
                  <th className="te-th-left">Name</th>
                  <th className="te-th-left">Tarif</th>
                  <th className="te-th-right">Aktuell</th>
                  <th className="te-th-right">Tarifpreis</th>
                  <th className="te-th-right">Differenz</th>
                  <th className="te-th-neuer-beitrag">Neuer Beitrag</th>
                  <th className="te-th-aktion">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {data.mitglieder.map((member, index) => (
                  <tr
                    key={member.vertragId}
                    style={{
                      borderTop: '1px solid var(--border-default, rgba(255,255,255,0.05))',
                      background: selectedIds.has(member.vertragId) ? 'var(--primary-alpha-10, rgba(139, 92, 246, 0.1))' : 'transparent'
                    }}
                  >
                    <td className="te-td-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(member.vertragId)}
                        onChange={() => toggleSelect(member.vertragId)}
                        className="te-icon-input"
                      />
                    </td>
                    <td className="te-td-pad">
                      <div className="te-member-name">{member.vorname} {member.nachname}</div>
                      <div className="te-member-email">
                        {member.email}
                      </div>
                    </td>
                    <td className="te-td-pad">
                      <span className="te-tarif-badge">
                        {member.tarifName}
                      </span>
                    </td>
                    <td className="te-td-mono-primary">
                      {formatCurrency(member.aktuellerBeitrag)}
                    </td>
                    <td className="te-td-mono-bamboo">
                      {formatCurrency(member.tarifPreis)}
                    </td>
                    <td className="te-td-mono-vermillion">
                      +{formatCurrency(member.differenz)}
                    </td>
                    <td className="te-td-center">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={customAmounts[member.vertragId] || ''}
                        onChange={(e) => handleAmountChange(member.vertragId, e.target.value)}
                        className="te-input-amount"
                      />
                    </td>
                    <td className="te-td-center">
                      <button
                        onClick={() => increaseSingle(member.vertragId)}
                        disabled={saving}
                        className="te-btn-row-bamboo"
                      >
                        <Check size={16} />
                        Erhöhen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="te-empty-card">
          <CheckCircle2 size={48} className="te-empty-icon" />
          <h3 className="te-empty-title">Keine Abweichungen</h3>
          <p className="te-empty-text">
            Alle Mitglieder zahlen bereits den aktuellen Tarifpreis oder mehr.
          </p>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Tariferhohung;
