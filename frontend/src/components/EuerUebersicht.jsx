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
import '../styles/EuerUebersicht.css';
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
        <div className="eu-chart-tooltip">
          <p className="eu-fw600-mb">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="eu-tooltip-entry" style={{ '--entry-color': entry.color }}>
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
      <div className="loading-container eu-loading">
        <div className="loading-spinner"></div>
        <p>Lade EÜR-Daten...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container eu-error">
        <p>Fehler: {error}</p>
        <button onClick={loadEuerData} className="btn btn-primary eu-mt1">
          Erneut versuchen
        </button>
      </div>
    );
  }

  return (
    <div className="euer-uebersicht">
      {/* Header */}
      <div className="euer-header eu-header-flex">
        <div>
          <h2 className="eu-h2-flex">
            <FileSpreadsheet size={24} />
            EÜR - Einnahmen-Überschuss-Rechnung
            {isTDA && <span className="eu-tda-badge">TDA</span>}
          </h2>
          <p className="eu-header-note">
            {isTDA ? 'Tiger & Dragon Association International' : activeDojo?.dojoname || 'Dojo'}
          </p>
        </div>

        <div className="u-flex-row-lg">
          {/* Jahr-Auswahl */}
          <div className="u-flex-row-sm">
            <button
              onClick={() => setJahr(j => j - 1)}
              className="btn btn-icon"
              title="Vorheriges Jahr"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="eu-year-display">
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
          <div className="u-flex-gap-sm">
            <button onClick={handleExportCSV} className="btn btn-secondary u-flex-row-sm">
              <Download size={16} />
              CSV
            </button>
            <button onClick={handleExportPDF} className="btn btn-primary u-flex-row-sm">
              <FileText size={16} />
              PDF für Finanzamt
            </button>
          </div>
        </div>
      </div>

      {/* Jahresübersicht Cards */}
      <div className="euer-summary-cards eu-summary-cards-grid">
        {/* Einnahmen */}
        <div className="stat-card eu-stat-card">
          <div className="eu-icon-row">
            <TrendingUp size={20} color="var(--success)" />
            <span className="eu-sub-label">Einnahmen {jahr}</span>
          </div>
          <div className="eu-stat-success">
            {formatCurrency(euerData?.jahresSumme?.einnahmen_gesamt)}
          </div>
        </div>

        {/* Ausgaben */}
        <div className="stat-card eu-stat-card">
          <div className="eu-icon-row">
            <TrendingDown size={20} color="var(--error)" />
            <span className="eu-sub-label">Ausgaben {jahr}</span>
          </div>
          <div className="eu-stat-error">
            {formatCurrency(euerData?.jahresSumme?.ausgaben_gesamt)}
          </div>
        </div>

        {/* Überschuss */}
        <div className={`stat-card eu-stat-card${(euerData?.jahresSumme?.ueberschuss || 0) >= 0 ? ' eu-stat-card--pos' : ' eu-stat-card--neg'}`}>
          <div className="eu-icon-row">
            <DollarSign size={20} />
            <span className="eu-sub-label">Überschuss {jahr}</span>
          </div>
          <div className={`eu-ueberschuss-value${(euerData?.jahresSumme?.ueberschuss || 0) >= 0 ? ' eu-ueberschuss-value--pos' : ' eu-ueberschuss-value--neg'}`}>
            {formatCurrency(euerData?.jahresSumme?.ueberschuss)}
          </div>
        </div>

        {/* TDA-spezifisch: Verbandsmitglieder */}
        {isTDA && euerData?.statistiken && (
          <div className="stat-card eu-stat-card">
            <div className="eu-icon-row">
              <Building2 size={20} color="var(--primary)" />
              <span className="eu-sub-label">Verbandsmitglieder</span>
            </div>
            <div className="eu-stat-neutral">
              {euerData.statistiken.aktive_verbandsmitglieder?.gesamt ?? '—'}
            </div>
            <div className="eu-stat-note">
              {euerData.statistiken.aktive_verbandsmitglieder?.dojos ?? 0} Dojos, {euerData.statistiken.aktive_verbandsmitglieder?.einzelpersonen ?? 0} Einzelpersonen
            </div>
          </div>
        )}
      </div>

      {/* Einnahmen-Aufschlüsselung für TDA */}
      {isTDA && (
        <div className="euer-einnahmen-breakdown eu-breakdown-card">
          <h3 className="eu-section-heading">Einnahmen nach Kategorie</h3>
          <div className="eu-summary-grid">
            <div className="u-flex-row-sm">
              <Users size={18} color="#10b981" />
              <div>
                <div className="eu-meta-label">Mitgliedsbeiträge</div>
                <div className="eu-fw600">{formatCurrency(euerData?.jahresSumme?.einnahmen_mitglieder)}</div>
              </div>
            </div>
            <div className="u-flex-row-sm">
              <Building2 size={18} color="#3b82f6" />
              <div>
                <div className="eu-meta-label">Verbandsmitgliedschaften</div>
                <div className="eu-fw600">{formatCurrency(euerData?.jahresSumme?.einnahmen_verband)}</div>
              </div>
            </div>
            <div className="u-flex-row-sm">
              <Laptop size={18} color="#8b5cf6" />
              <div>
                <div className="eu-meta-label">Software-Lizenzen</div>
                <div className="eu-fw600">{formatCurrency(euerData?.jahresSumme?.einnahmen_software)}</div>
              </div>
            </div>
            <div className="u-flex-row-sm">
              <CreditCard size={18} color="#f59e0b" />
              <div>
                <div className="eu-meta-label">Rechnungen</div>
                <div className="eu-fw600">{formatCurrency(euerData?.jahresSumme?.einnahmen_rechnungen)}</div>
              </div>
            </div>
            <div className="u-flex-row-sm">
              <ShoppingCart size={18} color="#ef4444" />
              <div>
                <div className="eu-meta-label">Verkäufe/Kasse</div>
                <div className="eu-fw600">{formatCurrency(euerData?.jahresSumme?.einnahmen_verkaeufe)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Haupt-Chart: Einnahmen vs Ausgaben */}
      <div className="euer-chart eu-chart-card">
        <h3 className="eu-section-heading">Monatlicher Verlauf</h3>
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
      <div className="euer-table eu-table-card">
        <h3 className="eu-section-heading">Monatliche Übersicht</h3>
        <table className="eu-table-full">
          <thead>
            <tr className="eu-thead-row">
              <th className="eu-th-left">Monat</th>
              {isTDA ? (
                <>
                  <th className="u-td-right">Mitglieder</th>
                  <th className="u-td-right">Verband</th>
                  <th className="u-td-right">Software</th>
                </>
              ) : (
                <>
                  <th className="u-td-right">Beiträge</th>
                  <th className="u-td-right">Rechnungen</th>
                  <th className="u-td-right">Verkäufe</th>
                </>
              )}
              <th className="eu-td-success">Einnahmen</th>
              <th className="eu-td-error">Ausgaben</th>
              <th className="eu-td-right-bold">Überschuss</th>
            </tr>
          </thead>
          <tbody>
            {euerData?.monate?.map(m => (
              <tr
                key={m.monat}
                className={`eu-tbody-row${selectedMonat === m.monat ? ' eu-tbody-row--selected' : ''}`}
                onClick={() => setSelectedMonat(selectedMonat === m.monat ? null : m.monat)}
              >
                <td className="eu-td-left">{m.monat_name}</td>
                {isTDA ? (
                  <>
                    <td className="u-td-right">{formatCurrency(m.einnahmen.mitglieder)}</td>
                    <td className="u-td-right">{formatCurrency(m.einnahmen.verbandsmitgliedschaften)}</td>
                    <td className="u-td-right">{formatCurrency(m.einnahmen.software_lizenzen)}</td>
                  </>
                ) : (
                  <>
                    <td className="u-td-right">{formatCurrency(m.einnahmen.beitraege)}</td>
                    <td className="u-td-right">{formatCurrency(m.einnahmen.rechnungen)}</td>
                    <td className="u-td-right">{formatCurrency(m.einnahmen.verkaeufe)}</td>
                  </>
                )}
                <td className="eu-td-success-muted">
                  {formatCurrency(m.einnahmen.gesamt)}
                </td>
                <td className="eu-td-error">
                  {formatCurrency(m.ausgaben.gesamt)}
                </td>
                <td className={`eu-td-right-bold${m.ueberschuss >= 0 ? ' eu-td-right-bold--pos' : ' eu-td-right-bold--neg'}`}>
                  {formatCurrency(m.ueberschuss)}
                </td>
              </tr>
            ))}
            {/* Jahressumme */}
            <tr className="eu-total-row">
              <td className="eu-total-first-cell">GESAMT {jahr}</td>
              {isTDA ? (
                <>
                  <td className="u-td-right">{formatCurrency(euerData?.jahresSumme?.einnahmen_mitglieder)}</td>
                  <td className="u-td-right">{formatCurrency(euerData?.jahresSumme?.einnahmen_verband)}</td>
                  <td className="u-td-right">{formatCurrency(euerData?.jahresSumme?.einnahmen_software)}</td>
                </>
              ) : (
                <>
                  <td className="u-td-right">{formatCurrency(euerData?.jahresSumme?.einnahmen_beitraege)}</td>
                  <td className="u-td-right">{formatCurrency(euerData?.jahresSumme?.einnahmen_rechnungen)}</td>
                  <td className="u-td-right">{formatCurrency(euerData?.jahresSumme?.einnahmen_verkaeufe)}</td>
                </>
              )}
              <td className="eu-td-success">
                {formatCurrency(euerData?.jahresSumme?.einnahmen_gesamt)}
              </td>
              <td className="eu-td-error">
                {formatCurrency(euerData?.jahresSumme?.ausgaben_gesamt)}
              </td>
              <td className={`eu-total-ueberschuss${(euerData?.jahresSumme?.ueberschuss || 0) >= 0 ? ' eu-total-ueberschuss--pos' : ' eu-total-ueberschuss--neg'}`}>
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
