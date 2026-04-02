/**
 * EÜR (Einnahmen-Überschuss-Rechnung) Übersicht
 * =============================================
 * Zeigt die EÜR für ein Dojo oder für TDA (Gesamtübersicht)
 */

import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Area
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Download,
  Building2,
  Users,
  ShoppingCart,
  CreditCard,
  Laptop,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText
} from 'lucide-react';
import { useDojoContext } from '../context/DojoContext.jsx';
import config from '../config/config';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import '../styles/themes.css';
import '../styles/components.css';

const EuerUebersicht = ({ isTDA = false }) => {
  const { activeDojo } = useDojoContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [jahr, setJahr] = useState(new Date().getFullYear());
  const [euerData, setEuerData] = useState(null);
  const [selectedMonat, setSelectedMonat] = useState(null);

  useEffect(() => {
    loadEuerData();
  }, [jahr, activeDojo, isTDA]);

  const loadEuerData = async () => {
    try {
      setLoading(true);
      setError(null);

      const endpoint = isTDA
        ? `${config.apiBaseUrl}/euer/tda?jahr=${jahr}`
        : `${config.apiBaseUrl}/euer/dojo/${activeDojo?.dojo_id || activeDojo?.id}?jahr=${jahr}`;

      const response = await fetchWithAuth(endpoint);

      if (!response.ok) {
        throw new Error('Fehler beim Laden der EÜR-Daten');
      }

      const result = await response.json();

      if (result.success) {
        setEuerData(result);
      } else {
        throw new Error(result.error || 'Unbekannter Fehler');
      }
    } catch (err) {
      console.error('EÜR Fehler:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
  };

  const formatCurrencyShort = (amount) => {
    const abs = Math.abs(amount || 0);
    if (abs >= 1000) {
      return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 1
      }).format(amount / 1000) + 'k';
    }
    return formatCurrency(amount);
  };

  const getMonthName = (monat) => {
    return new Date(2024, monat - 1, 1).toLocaleString('de-DE', { month: 'short' });
  };

  const handleExportCSV = async () => {
    try {
      const endpoint = isTDA
        ? `${config.apiBaseUrl}/euer/export/tda?jahr=${jahr}`
        : `${config.apiBaseUrl}/euer/export/${activeDojo?.dojo_id || activeDojo?.id}?jahr=${jahr}`;

      const response = await fetchWithAuth(endpoint);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `EUER_${isTDA ? 'TDA' : 'Dojo'}_${jahr}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export Fehler:', err);
      alert('Fehler beim Export');
    }
  };

  const handleExportPDF = async () => {
    try {
      const endpoint = isTDA
        ? `${config.apiBaseUrl}/euer/pdf/tda?jahr=${jahr}`
        : `${config.apiBaseUrl}/euer/pdf/dojo/${activeDojo?.dojo_id || activeDojo?.id}?jahr=${jahr}`;

      const response = await fetchWithAuth(endpoint);

      // Prüfe ob Antwort erfolgreich und PDF ist
      const contentType = response.headers.get('content-type');

      if (!response.ok) {
        // Versuche Fehlermeldung aus JSON zu lesen
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || 'PDF-Generierung fehlgeschlagen');
      }

      if (!contentType || !contentType.includes('application/pdf')) {
        throw new Error('Server hat kein PDF zurückgegeben');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `EUER_${isTDA ? 'TDA_International' : activeDojo?.dojoname || 'Dojo'}_${jahr}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF Export Fehler:', err);
      alert('Fehler beim PDF-Export: ' + err.message);
    }
  };

  // Chart Daten vorbereiten
  const chartData = euerData?.monate?.map(m => ({
    name: getMonthName(m.monat),
    monat: m.monat,
    einnahmen: m.einnahmen.gesamt,
    ausgaben: m.ausgaben.gesamt,
    ueberschuss: m.ueberschuss
  })) || [];

  // Einnahmen-Aufschlüsselung für TDA
  const einnahmenBreakdownData = isTDA && euerData?.monate ? euerData.monate.map(m => ({
    name: getMonthName(m.monat),
    mitglieder: m.einnahmen.mitglieder || 0,
    verband: m.einnahmen.verbandsmitgliedschaften || 0,
    software: m.einnahmen.software_lizenzen || 0,
    rechnungen: m.einnahmen.rechnungen || 0,
    verkaeufe: m.einnahmen.verkaeufe || 0
  })) : [];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip" style={{
          backgroundColor: 'var(--bg-modal)',
          border: '1px solid var(--border-primary)',
          borderRadius: '8px',
          padding: '12px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
        }}>
          <p style={{ fontWeight: '600', marginBottom: '8px' }}>{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color, margin: '4px 0' }}>
              {entry.name}: {formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="loading-container" style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="loading-spinner"></div>
        <p>Lade EÜR-Daten...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container" style={{ padding: '2rem', textAlign: 'center', color: 'var(--error)' }}>
        <p>Fehler: {error}</p>
        <button onClick={loadEuerData} className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Erneut versuchen
        </button>
      </div>
    );
  }

  return (
    <div className="euer-uebersicht">
      {/* Header */}
      <div className="euer-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileSpreadsheet size={24} />
            EÜR - Einnahmen-Überschuss-Rechnung
            {isTDA && <span style={{
              backgroundColor: 'var(--primary)',
              color: 'white',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '0.7rem',
              marginLeft: '0.5rem'
            }}>TDA</span>}
          </h2>
          <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-secondary)' }}>
            {isTDA ? 'Tiger & Dragon Association International' : activeDojo?.dojoname || 'Dojo'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Jahr-Auswahl */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setJahr(j => j - 1)}
              className="btn btn-icon"
              title="Vorheriges Jahr"
            >
              <ChevronLeft size={20} />
            </button>
            <span style={{
              fontWeight: '600',
              fontSize: '1.1rem',
              minWidth: '60px',
              textAlign: 'center'
            }}>
              {jahr}
            </span>
            <button
              onClick={() => setJahr(j => j + 1)}
              className="btn btn-icon"
              disabled={jahr >= new Date().getFullYear()}
              title="Nächstes Jahr"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Export Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleExportCSV} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Download size={16} />
              CSV
            </button>
            <button onClick={handleExportPDF} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={16} />
              PDF für Finanzamt
            </button>
          </div>
        </div>
      </div>

      {/* Jahresübersicht Cards */}
      <div className="euer-summary-cards" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        {/* Einnahmen */}
        <div className="stat-card" style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '12px',
          padding: '1.25rem',
          border: '1px solid var(--border-primary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <TrendingUp size={20} color="var(--success)" />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Einnahmen {jahr}</span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--success)' }}>
            {formatCurrency(euerData?.jahresSumme?.einnahmen_gesamt)}
          </div>
        </div>

        {/* Ausgaben */}
        <div className="stat-card" style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '12px',
          padding: '1.25rem',
          border: '1px solid var(--border-primary)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <TrendingDown size={20} color="var(--error)" />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Ausgaben {jahr}</span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--error)' }}>
            {formatCurrency(euerData?.jahresSumme?.ausgaben_gesamt)}
          </div>
        </div>

        {/* Überschuss */}
        <div className="stat-card" style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '12px',
          padding: '1.25rem',
          border: '1px solid var(--border-primary)',
          borderLeft: `4px solid ${(euerData?.jahresSumme?.ueberschuss || 0) >= 0 ? 'var(--success)' : 'var(--error)'}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <DollarSign size={20} />
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Überschuss {jahr}</span>
          </div>
          <div style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: (euerData?.jahresSumme?.ueberschuss || 0) >= 0 ? 'var(--success)' : 'var(--error)'
          }}>
            {formatCurrency(euerData?.jahresSumme?.ueberschuss)}
          </div>
        </div>

        {/* TDA-spezifisch: Verbandsmitglieder */}
        {isTDA && euerData?.statistiken && (
          <div className="stat-card" style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            padding: '1.25rem',
            border: '1px solid var(--border-primary)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Building2 size={20} color="var(--primary)" />
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Verbandsmitglieder</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
              {euerData.statistiken.aktive_verbandsmitglieder.gesamt}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              {euerData.statistiken.aktive_verbandsmitglieder.dojos} Dojos, {euerData.statistiken.aktive_verbandsmitglieder.einzelpersonen} Einzelpersonen
            </div>
          </div>
        )}
      </div>

      {/* Einnahmen-Aufschlüsselung für TDA */}
      {isTDA && (
        <div className="euer-einnahmen-breakdown" style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '12px',
          padding: '1.25rem',
          border: '1px solid var(--border-primary)',
          marginBottom: '2rem'
        }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Einnahmen nach Kategorie</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={18} color="#10b981" />
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Mitgliedsbeiträge</div>
                <div style={{ fontWeight: '600' }}>{formatCurrency(euerData?.jahresSumme?.einnahmen_mitglieder)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building2 size={18} color="#3b82f6" />
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Verbandsmitgliedschaften</div>
                <div style={{ fontWeight: '600' }}>{formatCurrency(euerData?.jahresSumme?.einnahmen_verband)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Laptop size={18} color="#8b5cf6" />
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Software-Lizenzen</div>
                <div style={{ fontWeight: '600' }}>{formatCurrency(euerData?.jahresSumme?.einnahmen_software)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CreditCard size={18} color="#f59e0b" />
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Rechnungen</div>
                <div style={{ fontWeight: '600' }}>{formatCurrency(euerData?.jahresSumme?.einnahmen_rechnungen)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShoppingCart size={18} color="#ef4444" />
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Verkäufe/Kasse</div>
                <div style={{ fontWeight: '600' }}>{formatCurrency(euerData?.jahresSumme?.einnahmen_verkaeufe)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Haupt-Chart: Einnahmen vs Ausgaben */}
      <div className="euer-chart" style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '12px',
        padding: '1.25rem',
        border: '1px solid var(--border-primary)',
        marginBottom: '2rem'
      }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Monatlicher Verlauf</h3>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
            <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)' }} />
            <YAxis tick={{ fill: 'var(--text-secondary)' }} tickFormatter={formatCurrencyShort} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="einnahmen" name="Einnahmen" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="ausgaben" name="Ausgaben" fill="#ef4444" radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="ueberschuss" name="Überschuss" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Monatliche Detailtabelle */}
      <div className="euer-table" style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '12px',
        padding: '1.25rem',
        border: '1px solid var(--border-primary)',
        overflowX: 'auto'
      }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem' }}>Monatliche Übersicht</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-primary)' }}>
              <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem' }}>Monat</th>
              {isTDA ? (
                <>
                  <th style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>Mitglieder</th>
                  <th style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>Verband</th>
                  <th style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>Software</th>
                </>
              ) : (
                <>
                  <th style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>Beiträge</th>
                  <th style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>Rechnungen</th>
                  <th style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>Verkäufe</th>
                </>
              )}
              <th style={{ textAlign: 'right', padding: '0.75rem 0.5rem', color: 'var(--success)' }}>Einnahmen</th>
              <th style={{ textAlign: 'right', padding: '0.75rem 0.5rem', color: 'var(--error)' }}>Ausgaben</th>
              <th style={{ textAlign: 'right', padding: '0.75rem 0.5rem', fontWeight: '700' }}>Überschuss</th>
            </tr>
          </thead>
          <tbody>
            {euerData?.monate?.map(m => (
              <tr
                key={m.monat}
                style={{
                  borderBottom: '1px solid var(--border-secondary)',
                  backgroundColor: selectedMonat === m.monat ? 'var(--bg-hover)' : 'transparent',
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedMonat(selectedMonat === m.monat ? null : m.monat)}
              >
                <td style={{ padding: '0.75rem 0.5rem', fontWeight: '500' }}>{m.monat_name}</td>
                {isTDA ? (
                  <>
                    <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>{formatCurrency(m.einnahmen.mitglieder)}</td>
                    <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>{formatCurrency(m.einnahmen.verbandsmitgliedschaften)}</td>
                    <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>{formatCurrency(m.einnahmen.software_lizenzen)}</td>
                  </>
                ) : (
                  <>
                    <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>{formatCurrency(m.einnahmen.beitraege)}</td>
                    <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>{formatCurrency(m.einnahmen.rechnungen)}</td>
                    <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>{formatCurrency(m.einnahmen.verkaeufe)}</td>
                  </>
                )}
                <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem', color: 'var(--success)', fontWeight: '500' }}>
                  {formatCurrency(m.einnahmen.gesamt)}
                </td>
                <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem', color: 'var(--error)' }}>
                  {formatCurrency(m.ausgaben.gesamt)}
                </td>
                <td style={{
                  textAlign: 'right',
                  padding: '0.75rem 0.5rem',
                  fontWeight: '700',
                  color: m.ueberschuss >= 0 ? 'var(--success)' : 'var(--error)'
                }}>
                  {formatCurrency(m.ueberschuss)}
                </td>
              </tr>
            ))}
            {/* Jahressumme */}
            <tr style={{
              borderTop: '2px solid var(--border-primary)',
              backgroundColor: 'var(--bg-secondary)',
              fontWeight: '700'
            }}>
              <td style={{ padding: '0.75rem 0.5rem' }}>GESAMT {jahr}</td>
              {isTDA ? (
                <>
                  <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>{formatCurrency(euerData?.jahresSumme?.einnahmen_mitglieder)}</td>
                  <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>{formatCurrency(euerData?.jahresSumme?.einnahmen_verband)}</td>
                  <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>{formatCurrency(euerData?.jahresSumme?.einnahmen_software)}</td>
                </>
              ) : (
                <>
                  <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>{formatCurrency(euerData?.jahresSumme?.einnahmen_beitraege)}</td>
                  <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>{formatCurrency(euerData?.jahresSumme?.einnahmen_rechnungen)}</td>
                  <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem' }}>{formatCurrency(euerData?.jahresSumme?.einnahmen_verkaeufe)}</td>
                </>
              )}
              <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem', color: 'var(--success)' }}>
                {formatCurrency(euerData?.jahresSumme?.einnahmen_gesamt)}
              </td>
              <td style={{ textAlign: 'right', padding: '0.75rem 0.5rem', color: 'var(--error)' }}>
                {formatCurrency(euerData?.jahresSumme?.ausgaben_gesamt)}
              </td>
              <td style={{
                textAlign: 'right',
                padding: '0.75rem 0.5rem',
                color: (euerData?.jahresSumme?.ueberschuss || 0) >= 0 ? 'var(--success)' : 'var(--error)'
              }}>
                {formatCurrency(euerData?.jahresSumme?.ueberschuss)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EuerUebersicht;
