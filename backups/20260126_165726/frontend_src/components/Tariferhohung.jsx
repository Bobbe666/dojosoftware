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
      <div className="page-container" style={{ padding: '2rem' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '300px'
        }}>
          <div className="spinner" style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--border-default, rgba(255,255,255,0.1))',
            borderTop: '3px solid var(--color-gold, #f59e0b)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Lade Daten...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ padding: '2rem' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <button
          onClick={() => navigate('/dashboard/finanzcockpit')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: '0.5rem'
          }}
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-primary)' }}>
            <TrendingUp size={28} style={{ verticalAlign: 'middle', marginRight: '0.5rem', color: 'var(--color-gold, #f59e0b)' }} />
            Tariferhöhung
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: 'var(--text-muted)' }}>
            Mitglieder unter dem Tarifpreis oder mit archivierten (alten) Tarifen
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            padding: '1.5rem',
            border: '1px solid var(--border-default, var(--border-primary))',
            boxShadow: 'var(--shadow-sm, none)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Users size={18} style={{ color: 'var(--color-gold, #f59e0b)' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Betroffene Mitglieder</span>
            </div>
            <span style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--text-primary)' }}>{data.anzahl}</span>
          </div>

          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            padding: '1.5rem',
            border: '1px solid var(--border-default, var(--border-primary))',
            boxShadow: 'var(--shadow-sm, none)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <DollarSign size={18} style={{ color: 'var(--color-bamboo, #10b981)' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Monatliches Potential</span>
            </div>
            <span style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--color-bamboo, #10b981)' }}>
              {formatCurrency(data.monatlichesPotential)}
            </span>
          </div>

          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            padding: '1.5rem',
            border: '1px solid var(--border-default, var(--border-primary))',
            boxShadow: 'var(--shadow-sm, none)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Calendar size={18} style={{ color: 'var(--color-indigo, #8b5cf6)' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Jährliches Potential</span>
            </div>
            <span style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--color-indigo, #8b5cf6)' }}>
              {formatCurrency(data.jaehrlichesPotential)}
            </span>
          </div>
        </div>
      )}

      {/* Schnelle Erhöhungsoptionen */}
      {data && data.anzahl > 0 && (
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          border: '1px solid var(--border-default, var(--border-primary))',
          boxShadow: 'var(--shadow-sm, none)'
        }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', color: 'var(--text-primary)' }}>
            Schnelle Erhöhung für alle Mitglieder
          </h3>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1.5rem',
            alignItems: 'flex-end'
          }}>
            {/* Prozentuale Erhöhung */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Prozentuale Erhöhung
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={percentageIncrease}
                  onChange={(e) => setPercentageIncrease(parseFloat(e.target.value) || 0)}
                  style={{
                    width: '80px',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-default, var(--border-primary))',
                    background: 'var(--input-bg, var(--bg-input))',
                    color: 'var(--text-primary)',
                    textAlign: 'right',
                    fontFamily: 'monospace'
                  }}
                />
                <span style={{ color: 'var(--text-secondary)' }}>%</span>
                <button
                  onClick={applyPercentageToAll}
                  disabled={saving}
                  style={{
                    background: 'var(--color-indigo, #3b82f6)',
                    border: 'none',
                    color: '#fff',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Alle +{percentageIncrease}%
                </button>
              </div>
            </div>

            {/* Fester Betrag */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Fester Betrag
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  value={fixedIncrease}
                  onChange={(e) => setFixedIncrease(parseFloat(e.target.value) || 0)}
                  style={{
                    width: '80px',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-default, var(--border-primary))',
                    background: 'var(--input-bg, var(--bg-input))',
                    color: 'var(--text-primary)',
                    textAlign: 'right',
                    fontFamily: 'monospace'
                  }}
                />
                <span style={{ color: 'var(--text-secondary)' }}>EUR</span>
                <button
                  onClick={applyFixedToAll}
                  disabled={saving}
                  style={{
                    background: 'var(--color-vermillion, #8b5cf6)',
                    border: 'none',
                    color: '#fff',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Alle +{formatCurrency(fixedIncrease)}
                </button>
              </div>
            </div>

            {/* Auf Tarifpreis */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Tarifpreis
              </label>
              <button
                onClick={setAllToTarifPrice}
                disabled={saving}
                style={{
                  background: 'var(--color-bamboo, #10b981)',
                  border: 'none',
                  color: '#fff',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  whiteSpace: 'nowrap'
                }}
              >
                Alle auf Tarifpreis
              </button>
            </div>
          </div>

          <p style={{
            margin: '1rem 0 0',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            fontStyle: 'italic'
          }}>
            Die Beträge werden in der Spalte "Neuer Beitrag" vorausgefüllt.
            Klicken Sie dann auf "Alle erhöhen" um die Änderungen zu speichern.
          </p>
        </div>
      )}

      {/* Warnung bei fehlenden Nachfolger-Tarifen */}
      {data && data.mitglieder.some(m => m.nachfolgerFehlt) && (
        <div style={{
          background: 'var(--alert-warning-bg, rgba(245, 158, 11, 0.15))',
          border: 'var(--alert-warning-border, 1px solid rgba(245, 158, 11, 0.3))',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem',
          color: 'var(--color-warning-text, #92400e)'
        }}>
          <strong>⚠️ Nachfolger-Tarife fehlen!</strong>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem' }}>
            {data.mitglieder.filter(m => m.nachfolgerFehlt).length} Mitglied(er) haben archivierte Tarife ohne Nachfolger-Zuordnung.
            Bitte zuerst in <a href="/dashboard/tarife" style={{ color: 'inherit', textDecoration: 'underline' }}>Tarife & Preise</a> die Nachfolger-Tarife definieren.
          </p>
        </div>
      )}

      {/* Messages */}
      {successMessage && (
        <div style={{
          background: 'var(--alert-success-bg, rgba(16, 185, 129, 0.15))',
          border: 'var(--alert-success-border, 1px solid rgba(16, 185, 129, 0.3))',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: 'var(--color-bamboo, #10b981)'
        }}>
          <CheckCircle2 size={20} />
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div style={{
          background: 'var(--alert-error-bg, rgba(239, 68, 68, 0.15))',
          border: 'var(--alert-error-border, 1px solid rgba(239, 68, 68, 0.3))',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: 'var(--color-vermillion, #ef4444)'
        }}>
          <AlertCircle size={20} />
          {errorMessage}
        </div>
      )}

      {/* Action Buttons */}
      {data && data.anzahl > 0 && (
        <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <button
            onClick={selectAll}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-default, var(--border-primary))',
              color: 'var(--text-primary)',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Alle auswählen
          </button>
          <button
            onClick={deselectAll}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-default, var(--border-primary))',
              color: 'var(--text-primary)',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Auswahl aufheben
          </button>

          <div style={{ flex: 1 }} />

          <button
            onClick={increaseSelected}
            disabled={selectedIds.size === 0 || saving}
            style={{
              background: selectedIds.size === 0 ? 'var(--primary-alpha-30, rgba(139, 92, 246, 0.3))' : 'var(--color-vermillion, #8b5cf6)',
              border: 'none',
              color: '#fff',
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
            style={{
              background: 'var(--color-gold, #f59e0b)',
              border: 'none',
              color: 'var(--color-sumi, #000)',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <TrendingUp size={18} />
            Alle erhöhen
          </button>
        </div>
      )}

      {/* Table */}
      {data && data.anzahl > 0 ? (
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-default, var(--border-primary))',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm, none)'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--table-header-bg, rgba(255,255,255,0.05))' }}>
                  <th style={{ padding: '1rem', textAlign: 'center', width: '50px' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.size === data.mitglieder.length && data.mitglieder.length > 0}
                      onChange={(e) => e.target.checked ? selectAll() : deselectAll()}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
                  <th style={{ padding: '1rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tarif</th>
                  <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Aktuell</th>
                  <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tarifpreis</th>
                  <th style={{ padding: '1rem', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Differenz</th>
                  <th style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '140px' }}>Neuer Beitrag</th>
                  <th style={{ padding: '1rem', textAlign: 'center', width: '100px' }}>Aktion</th>
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
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(member.vertragId)}
                        onChange={() => toggleSelect(member.vertragId)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{member.vorname} {member.nachname}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {member.email}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div>
                        <span style={{
                          background: member.tarifArchiviert
                            ? 'var(--alert-warning-bg, rgba(245, 158, 11, 0.2))'
                            : 'var(--badge-primary-bg, rgba(139, 92, 246, 0.2))',
                          color: member.tarifArchiviert
                            ? 'var(--color-warning-text, #92400e)'
                            : 'var(--badge-primary-text, #a78bfa)',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '999px',
                          fontSize: '0.8rem',
                          fontWeight: '500'
                        }}>
                          {member.tarifName}
                          {member.tarifArchiviert && ' (Alt)'}
                        </span>
                        {member.nachfolgerTarifName && (
                          <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--color-bamboo-text, #047857)' }}>
                            → {member.nachfolgerTarifName}
                          </div>
                        )}
                        {member.nachfolgerFehlt && (
                          <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--color-error-text, #b91c1c)' }}>
                            ⚠️ Nachfolger fehlt!
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                      {formatCurrency(member.aktuellerBeitrag)}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontFamily: 'monospace', color: 'var(--color-bamboo, #10b981)' }}>
                      {formatCurrency(member.tarifPreis)}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', fontFamily: 'monospace', color: 'var(--color-vermillion, #ef4444)' }}>
                      +{formatCurrency(member.differenz)}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={customAmounts[member.vertragId] || ''}
                        onChange={(e) => handleAmountChange(member.vertragId, e.target.value)}
                        style={{
                          width: '100px',
                          padding: '0.5rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-default, var(--border-primary))',
                          background: 'var(--input-bg, var(--bg-input))',
                          color: 'var(--text-primary)',
                          textAlign: 'right',
                          fontFamily: 'monospace'
                        }}
                      />
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <button
                        onClick={() => increaseSingle(member.vertragId)}
                        disabled={saving}
                        style={{
                          background: 'var(--color-bamboo, #10b981)',
                          border: 'none',
                          color: '#fff',
                          padding: '0.5rem 1rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: '500',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
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
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '12px',
          padding: '3rem',
          textAlign: 'center',
          border: '1px solid var(--border-default, var(--border-primary))',
          boxShadow: 'var(--shadow-sm, none)'
        }}>
          <CheckCircle2 size={48} style={{ color: 'var(--color-bamboo, #10b981)', marginBottom: '1rem' }} />
          <h3 style={{ margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>Keine Anpassungen nötig</h3>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            Alle Mitglieder zahlen bereits den aktuellen Tarifpreis oder mehr und haben aktuelle Tarife.
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
