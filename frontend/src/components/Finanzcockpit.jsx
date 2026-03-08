import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  Calendar,
  FileText,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  BarChart3,
  Wallet,
  Users,
  Receipt,
  CheckCircle2,
  FileSpreadsheet,
  Upload,
  CalendarDays,
  AlertTriangle,
  ChevronRight,
  RotateCcw,
  Building2
} from "lucide-react";
import { useMitgliederUpdate } from '../context/MitgliederUpdateContext.jsx';
import { useDojoContext } from '../context/DojoContext.jsx'; // 🔒 TAX COMPLIANCE: Dojo-Filter
import config from "../config/config";
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/Finanzcockpit.css";
import { fetchWithAuth } from '../utils/fetchWithAuth';


const COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#f97316'];

const Finanzcockpit = () => {
  const navigate = useNavigate();
  const { updateTrigger } = useMitgliederUpdate();
  const { getDojoFilterParam, activeDojo, filter, dojos, switchDojo, setFilter } = useDojoContext(); // 🔒 TAX COMPLIANCE: Dojo-Filter
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  // Dojo-Auswahl für schnelles Wechseln im Finanzcockpit
  const [selectedDojoId, setSelectedDojoId] = useState(filter === 'all' ? 'all' : (activeDojo?.id || 'all'));
  const [stats, setStats] = useState(null);
  const [timelineData, setTimelineData] = useState([]);
  const [tarifData, setTarifData] = useState([]);
  const [alerts, setAlerts] = useState({ ruecklastschriften: 0 });
  const [aktiverChartTab, setAktiverChartTab] = useState('zahlungsarten');

  useEffect(() => {
    loadFinanzStats();
    loadTimelineData();
    loadTarifData();
    loadAlerts();
  }, [updateTrigger, selectedPeriod, activeDojo, filter]); // 🔒 TAX COMPLIANCE: Neu laden wenn Dojo-Filter ändert

  // Sync selectedDojoId mit aktivem Dojo
  useEffect(() => {
    if (filter === 'all') {
      setSelectedDojoId('all');
    } else if (activeDojo && typeof activeDojo === 'object') {
      setSelectedDojoId(activeDojo.id);
    }
  }, [activeDojo, filter]);

  // Handler für Dojo-Wechsel im Finanzcockpit
  const handleDojoChange = (dojoId) => {
    setSelectedDojoId(dojoId);
    if (dojoId === 'all') {
      // Alle Dojos anzeigen
      if (dojos.length > 0) {
        const hauptDojo = dojos.find(d => d.ist_hauptdojo) || dojos[0];
        switchDojo(hauptDojo);
      }
      setFilter('all');
    } else {
      // Spezifisches Dojo auswählen
      const selectedDojo = dojos.find(d => d.id === parseInt(dojoId));
      if (selectedDojo) {
        switchDojo(selectedDojo);
        setFilter('current');
      }
    }
  };

  // Aktuell angezeigter Dojo-Name
  const getCurrentDojoLabel = () => {
    if (filter === 'all' || selectedDojoId === 'all') {
      return 'Alle Standorte';
    }
    if (activeDojo && typeof activeDojo === 'object') {
      return activeDojo.dojoname;
    }
    return 'Alle Standorte';
  };

  const loadFinanzStats = async () => {
    try {
      setLoading(true);
      
      const dojoFilterParam = getDojoFilterParam(); // 🔒 TAX COMPLIANCE: Dojo-Filter
      const separator = dojoFilterParam ? '&' : '';
      const response = await fetchWithAuth(`${config.apiBaseUrl}/finanzcockpit/stats?period=${selectedPeriod}${separator}${dojoFilterParam}`);
      
      if (!response.ok) {
        throw new Error('Fehler beim Laden der Finanzstatistiken');
      }

      const result = await response.json();
      
      if (result.success) {
        setStats(result.data);
      } else {
        throw new Error(result.error || 'Fehler beim Laden der Daten');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Fehler beim Laden der Finanzstatistiken:', error);
      setStats(null);
      setLoading(false);
    }
  };

  const loadTimelineData = async () => {
    try {
      const dojoFilterParam = getDojoFilterParam(); // 🔒 TAX COMPLIANCE: Dojo-Filter
      const months = selectedPeriod === 'month' ? 3 : selectedPeriod === 'quarter' ? 6 : 12;
      const separator = dojoFilterParam ? '&' : '';
      const response = await fetchWithAuth(`${config.apiBaseUrl}/finanzcockpit/timeline?period=${selectedPeriod}&months=${months}${separator}${dojoFilterParam}`);

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Berechne Trendlinie (lineare Regression)
          const data = result.data || [];
          const n = data.length;

          if (n > 1) {
            let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
            data.forEach((point, index) => {
              sumX += index;
              sumY += point.umsatz || 0;
              sumXY += index * (point.umsatz || 0);
              sumX2 += index * index;
            });

            // Vermeide Division durch 0
            const denominator = (n * sumX2 - sumX * sumX);
            if (denominator !== 0) {
              const slope = (n * sumXY - sumX * sumY) / denominator;
              const intercept = (sumY - slope * sumX) / n;

              // Füge Trendwerte hinzu
              const dataWithTrend = data.map((point, index) => ({
                ...point,
                trend: slope * index + intercept
              }));
              setTimelineData(dataWithTrend);
            } else {
              // Wenn alle Werte gleich sind (z.B. alle 0), keine Trendlinie
              setTimelineData(data.map(point => ({ ...point, trend: point.umsatz || 0 })));
            }
          } else {
            setTimelineData(data);
          }
        } else {
          setTimelineData([]);
        }
      } else {
        setTimelineData([]);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Timeline-Daten:', error);
      setTimelineData([]);
    }
  };

  const loadTarifData = async () => {
    try {
      const dojoFilterParam = getDojoFilterParam(); // 🔒 TAX COMPLIANCE: Dojo-Filter
      const separator = dojoFilterParam ? '&' : '';
      const response = await fetchWithAuth(`${config.apiBaseUrl}/finanzcockpit/tarif-breakdown?${dojoFilterParam}`);

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setTarifData(result.data);
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden der Tarif-Daten:', error);
    }
  };

  const loadAlerts = async () => {
    try {
      const dojoFilterParam = getDojoFilterParam();
      const rlRes = await fetchWithAuth(
        `${config.apiBaseUrl}/ruecklastschriften${dojoFilterParam ? '?' + dojoFilterParam : ''}`
      );
      if (rlRes.ok) {
        const rlData = await rlRes.json();
        const offen = (rlData.ruecklastschriften || []).filter(r => r.status === 'offen' || r.status === 'neu').length;
        setAlerts(prev => ({ ...prev, ruecklastschriften: offen }));
      }
    } catch (_) {
      // Alerts sind optional — Fehler still ignorieren
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
  };

  const formatCurrencyCompact = (amount) => {
    try {
      return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 1,
        notation: 'compact'
      }).format(amount || 0).replace(/\u00a0/g, ' ');
    } catch (error) {
      const value = Math.abs(amount || 0);
      const suffix = value >= 1_000_000 ? ' Mio' : value >= 1_000 ? ' Tsd' : '';
      const divisor = value >= 1_000_000 ? 1_000_000 : value >= 1_000 ? 1_000 : 1;
      return `${formatCurrency((amount || 0) / divisor)}${suffix}`;
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('de-DE').format(num || 0);
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

  const periodLabels = {
    month: 'Aktueller Monat',
    quarter: 'Aktuelles Quartal',
    year: 'Aktuelles Jahr'
  };

  const periodLabel = periodLabels[selectedPeriod] || 'Zeitraum';

  // Custom Tooltip für Einnahmen-Aufschlüsselung mit Tarif-Details
  const CustomIncomeTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="fc__tooltip">
          <p className="fc__tooltip-title">
            {label}: {formatCurrency(payload[0].value)}
          </p>

          {label === 'Verträge' && tarifData.length > 0 && (
            <div className="fc__tooltip-breakdown">
              <p className="fc__tooltip-breakdown-heading">
                Aufschlüsselung nach Tarifen:
              </p>
              {tarifData.map(tarif => (
                <div
                  key={tarif.name}
                  className="fc__tooltip-row"
                >
                  <span className="u-text-primary">
                    {tarif.name}
                  </span>
                  <span className="fc__tooltip-row-value">
                    {formatCurrency(tarif.value)} ({tarif.count})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Daten für Zahlungsarten-Chart
  const paymentMethodData = stats ? [
    { name: 'Bar', value: stats.barEinnahmen || 0 },
    { name: 'Karte', value: stats.kartenEinnahmen || 0 },
    { name: 'Lastschrift', value: stats.lastschriftEinnahmen || 0 }
  ].filter(item => item.value > 0) : [];

  // Daten für Einnahmen-Aufschlüsselung
  const incomeBreakdownData = stats ? [
    { name: 'Verträge', value: stats.monatlicheEinnahmen || 0 },
    { name: 'Verkäufe', value: stats.verkaeufeEinnahmen || 0 },
    { name: 'Rechnungen', value: stats.rechnungenEinnahmen || 0 },
    { name: 'Zahlungen', value: stats.zahlungenEinnahmen || 0 },
    { name: 'Zahlläufe', value: stats.zahllaeufeEinnahmen || 0 }
  ].filter(item => item.value > 0) : [];

  const averageSale = stats?.anzahlVerkaeufe > 0
    ? (stats.verkaeufeEinnahmen || 0) / stats.anzahlVerkaeufe
    : 0;

  const kpiCards = stats ? [
    {
      id: 'revenue',
      icon: TrendingUp,
      label: 'Gesamteinnahmen',
      value: formatCurrency(stats.gesamteinnahmen),
      detail: `${stats.einnahmenTrend > 0 ? '+' : ''}${(stats.einnahmenTrend ?? 0).toFixed(1)}% vs. Vorperiode`,
      tone: stats.einnahmenTrend >= 0 ? 'positive' : 'negative',
      route: '/dashboard/jahresuebersicht'
    },
    {
      id: 'expenses',
      icon: TrendingDown,
      label: 'Gesamtausgaben',
      value: formatCurrency(stats.gesamteAusgaben),
      detail: stats.ausgabenTrend !== 0
        ? `${stats.ausgabenTrend > 0 ? '+' : ''}${(stats.ausgabenTrend ?? 0).toFixed(1)}% vs. Vorperiode`
        : 'Trenddaten folgen',
      tone: stats.gesamteAusgaben > 0 ? 'warning' : 'neutral',
      route: '/dashboard/ausgaben'
    },
    {
      id: 'cashflow',
      icon: Wallet,
      label: 'Cashflow',
      value: formatCurrency(stats.cashflow),
      detail: `${stats.cashflowProzent > 0 ? '+' : ''}${(stats.cashflowProzent ?? 0).toFixed(1)}% Marge`,
      tone: stats.cashflow >= 0 ? 'positive' : 'negative',
      route: '/dashboard/euer'
    },
    {
      id: 'open-invoices',
      icon: FileText,
      label: 'Offene Rechnungen',
      value: formatNumber(stats.offeneRechnungen),
      detail: `${formatCurrency(stats.offeneRechnungenBetrag)} offen`,
      tone: stats.offeneRechnungen > 0 ? 'warning' : 'positive',
      route: '/dashboard/rechnungen'
    },
    {
      id: 'contracts',
      icon: Users,
      label: 'Aktive Verträge',
      value: formatNumber(stats.anzahlVertraege),
      detail: `${formatCurrency(stats.monatlicheEinnahmen)} pro Monat`,
      tone: 'neutral',
      route: '/dashboard/beitraege'
    },
    {
      id: 'sales',
      icon: Receipt,
      label: 'Verkäufe',
      value: formatNumber(stats.anzahlVerkaeufe),
      detail: `${formatCurrency(stats.verkaeufeEinnahmen)} Umsatz`,
      tone: 'neutral',
      route: '/dashboard/tresen'
    }
  ] : [];

  const insights = stats ? [
    {
      id: 'period',
      icon: Calendar,
      title: 'Auswertungszeitraum',
      description: `${formatDate(stats.dateStart)} – ${formatDate(stats.dateEnd)}`
    },
    {
      id: 'cashflow',
      icon: stats.cashflow >= 0 ? ArrowUpRight : ArrowDownRight,
      title: stats.cashflow >= 0 ? 'Positiver Cashflow' : 'Cashflow unter Null',
      description: stats.cashflow >= 0
        ? `Überschuss von ${formatCurrency(stats.cashflow)} nach Ausgaben`
        : `Defizit von ${formatCurrency(Math.abs(stats.cashflow))} nach Ausgaben`
    },
    {
      id: 'average-sale',
      icon: BarChart3,
      title: 'Ø Umsatz pro Verkauf',
      description: `${formatCurrency(averageSale)} bei ${formatNumber(stats.anzahlVerkaeufe)} Verkäufen`
    },
    {
      id: 'open-postings',
      icon: stats.offeneRechnungen > 0 ? AlertCircle : CheckCircle2,
      title: stats.offeneRechnungen > 0 ? 'Offene Forderungen' : 'Keine offenen Rechnungen',
      description: stats.offeneRechnungen > 0
        ? `${formatNumber(stats.offeneRechnungen)} Rechnungen über ${formatCurrency(stats.offeneRechnungenBetrag)}`
        : 'Alle Rechnungen sind beglichen'
    }
  ] : [];

  const incomeMetrics = stats ? [
    { label: 'Monatlich', value: formatCurrency(stats.monatlicheEinnahmen) },
    { label: 'Quartal', value: formatCurrency(stats.quartalsEinnahmen) },
    { label: 'Jahr', value: formatCurrency(stats.jahresEinnahmen) },
    {
      label: 'Trend',
      value: `${Math.abs((stats.einnahmenTrend ?? 0).toFixed(1))}%`,
      tone: stats.einnahmenTrend >= 0 ? 'positive' : 'negative',
      icon: stats.einnahmenTrend >= 0 ? ArrowUpRight : ArrowDownRight
    }
  ] : [];

  const paymentMetrics = stats ? [
    { label: 'Bar', value: formatCurrency(stats.barEinnahmen) },
    { label: 'Karte', value: formatCurrency(stats.kartenEinnahmen) },
    { label: 'Lastschrift', value: formatCurrency(stats.lastschriftEinnahmen) }
  ] : [];

  const dueMetrics = stats ? [
    {
      label: 'Offener Betrag',
      value: formatCurrency(stats.offeneRechnungenBetrag),
      tone: stats.offeneRechnungenBetrag > 0 ? 'warning' : 'positive'
    },
    {
      label: 'Offene Rechnungen',
      value: formatNumber(stats.offeneRechnungen),
      tone: stats.offeneRechnungen > 0 ? 'warning' : 'positive'
    },
    {
      label: 'Überfällig',
      value: stats.ueberfaelligeRechnungen > 0
        ? formatNumber(stats.ueberfaelligeRechnungen)
        : 'Keine',
      tone: stats.ueberfaelligeRechnungen > 0 ? 'negative' : 'positive'
    },
    {
      label: 'Ausstehende Beiträge',
      value: formatCurrency(stats.ausstehendeZahlungenBetrag),
      sublabel: `${formatNumber(stats.ausstehendeZahlungen)} Verträge`
    }
  ] : [];

  const activityMetrics = stats ? [
    {
      label: 'Zahlläufe',
      value: formatNumber(stats.anzahlZahllaeufe),
      sublabel: `${formatCurrency(stats.zahllaeufeEinnahmen)} abgeschlossen`
    },
    {
      label: 'Zahlungen',
      value: formatNumber(stats.anzahlZahlungen),
      sublabel: formatCurrency(stats.zahlungenEinnahmen)
    },
    {
      label: 'Rechnungen (bezahlt)',
      value: formatCurrency(stats.rechnungenEinnahmen)
    },
    {
      label: 'Ausgaben',
      value: formatCurrency(stats.gesamteAusgaben),
      sublabel: `${formatNumber(stats.anzahlAusgaben)} Buchungen`
    }
  ] : [];

  const ActionCard = ({ icon: Icon, label, desc, iconColor, onClick, badge }) => (
    <button className="fc__action-card" onClick={onClick}>
      <span className="fc__action-card-icon" style={{ '--icon-color': iconColor || 'var(--primary)' }}>
        <Icon size={20} />
      </span>
      <span className="fc__action-card-text">
        <span className="fc__action-card-label">{label}</span>
        {desc && <span className="fc__action-card-desc">{desc}</span>}
      </span>
      {badge > 0 && <span className="fc__action-badge">{badge}</span>}
      <ChevronRight size={14} className="fc__action-card-arrow" />
    </button>
  );

  if (loading) {
    return (
      <div className="finanzcockpit">
        <div className="finanzcockpit-card finanzcockpit__state">
          <div className="finanzcockpit__spinner" />
          <p>Finanzdaten werden geladen…</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="finanzcockpit">
        <div className="finanzcockpit-card finanzcockpit__state is-error">
          <AlertCircle size={48} />
          <h3>Fehler beim Laden der Daten</h3>
          <p>Bitte versuchen Sie es später erneut.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="finanzcockpit">
      <header className="finanzcockpit-card finanzcockpit__header">
        <div className="finanzcockpit__header-top">
          <div className="finanzcockpit__headline">
            <span className="finanzcockpit__eyebrow">Finanzen</span>
            <div className="finanzcockpit__title-row">
              <h1 className="finanzcockpit__title">Finanzcockpit</h1>
              <span className="finanzcockpit__badge">{periodLabel}</span>
            </div>
            <p className="finanzcockpit__subtitle">
              Alle Kennzahlen und Bewegungen auf einen Blick – inklusive Cashflow, offenen Posten und Zahlungsarten.
            </p>
          </div>
          <div className="finanzcockpit__controls">
            {/* Dojo-Selektor */}
            {dojos && dojos.length > 1 && (
              <div className="finanzcockpit__dojo-selector">
                <Building2 size={14} />
                <select
                  value={selectedDojoId}
                  onChange={(e) => handleDojoChange(e.target.value)}
                  className="finanzcockpit__dojo-select"
                >
                  <option value="all">Alle Standorte</option>
                  {dojos.map(dojo => (
                    <option key={dojo.id} value={dojo.id}>
                      {dojo.dojoname}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="finanzcockpit__period-selector">
              <button
                className={selectedPeriod === 'month' ? 'is-active' : ''}
                onClick={() => setSelectedPeriod('month')}
              >
                Monat
              </button>
              <button
                className={selectedPeriod === 'quarter' ? 'is-active' : ''}
                onClick={() => setSelectedPeriod('quarter')}
              >
                Quartal
              </button>
              <button
                className={selectedPeriod === 'year' ? 'is-active' : ''}
                onClick={() => setSelectedPeriod('year')}
              >
                Jahr
              </button>
            </div>
            <div className="finanzcockpit__period-info">
              <Calendar size={16} />
              <span>{formatDate(stats.dateStart)} – {formatDate(stats.dateEnd)}</span>
            </div>
          </div>
        </div>
      </header>

      <section className="finanzcockpit__kpi-grid">
        {kpiCards.map(({ id, icon: Icon, label, value, detail, tone, route }) => (
          <div
            key={id}
            className={`finanzcockpit-card finanzcockpit__kpi-card finanzcockpit__kpi-card--${tone}${route ? ' finanzcockpit__kpi-card--clickable' : ''}`}
            onClick={() => route && navigate(route)}
            title={route ? `Zu ${label}` : undefined}
          >
            <div className="finanzcockpit__kpi-meta">
              <div className="finanzcockpit__kpi-icon">
                <Icon size={18} />
              </div>
              <span className="finanzcockpit__kpi-label">{label}</span>
              {route && <ChevronRight size={13} className="finanzcockpit__kpi-arrow" />}
            </div>
            <div className="finanzcockpit__kpi-value">{value}</div>
            <span className="finanzcockpit__kpi-detail">{detail}</span>
          </div>
        ))}
      </section>

      {(alerts.ruecklastschriften > 0 || (stats.ausstehendeZahlungen || 0) > 0 || (stats.offeneRechnungen || 0) > 0) && (
        <section className="fc__alerts">
          {alerts.ruecklastschriften > 0 && (
            <div className="fc__alert-card fc__alert-card--error" onClick={() => navigate('/dashboard/ruecklastschriften')}>
              <AlertTriangle size={16} />
              <span className="fc__alert-count">{alerts.ruecklastschriften}</span>
              <span className="fc__alert-label">offene Rücklastschrift{alerts.ruecklastschriften !== 1 ? 'en' : ''}</span>
              <ChevronRight size={13} className="fc__alert-arrow" />
            </div>
          )}
          {(stats.ausstehendeZahlungen || 0) > 0 && (
            <div className="fc__alert-card fc__alert-card--warning" onClick={() => navigate('/dashboard/beitraege')}>
              <AlertCircle size={16} />
              <span className="fc__alert-count">{stats.ausstehendeZahlungen}</span>
              <span className="fc__alert-label">ausstehende Beitragszahlung{stats.ausstehendeZahlungen !== 1 ? 'en' : ''}</span>
              <ChevronRight size={13} className="fc__alert-arrow" />
            </div>
          )}
          {(stats.offeneRechnungen || 0) > 0 && (
            <div className="fc__alert-card fc__alert-card--invoice" onClick={() => navigate('/dashboard/rechnungen')}>
              <FileText size={16} />
              <span className="fc__alert-count">{stats.offeneRechnungen}</span>
              <span className="fc__alert-label">offene Rechnung{stats.offeneRechnungen !== 1 ? 'en' : ''}</span>
              <ChevronRight size={13} className="fc__alert-arrow" />
            </div>
          )}
        </section>
      )}

      <div className="fc__main-grid">
        {/* Linke Spalte: Charts + Insights */}
        <div className="fc__charts-col">
          <div className="finanzcockpit-card">
            <div className="finanzcockpit__card-header">
              <div>
                <span className="finanzcockpit__card-eyebrow">Performance</span>
                <h3>Umsatz-Entwicklung</h3>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="label" stroke="rgba(255,255,255,0.5)" />
                <YAxis stroke="rgba(255,255,255,0.5)" tickFormatter={formatCurrencyCompact} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--modal-bg-dark)', border: '1px solid var(--border-accent)', borderRadius: '12px', color: 'var(--text-1)' }} formatter={(value) => formatCurrency(value)} />
                <Legend />
                <Line type="monotone" dataKey="umsatz" stroke="#ffd700" strokeWidth={2} name="Umsatz" dot={{ fill: '#ffd700', r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="trend" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" name="Trend" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="finanzcockpit-card">
            <div className="finanzcockpit__card-header">
              <div>
                <span className="finanzcockpit__card-eyebrow">Aufschlüsselung</span>
                <h3>{aktiverChartTab === 'zahlungsarten' ? 'Zahlungsarten' : 'Einnahmen'}</h3>
              </div>
              <div className="fc__chart-tabs">
                <button className={aktiverChartTab === 'zahlungsarten' ? 'is-active' : ''} onClick={() => setAktiverChartTab('zahlungsarten')}>
                  <PieChartIcon size={13} /> Zahlungsarten
                </button>
                <button className={aktiverChartTab === 'einnahmen' ? 'is-active' : ''} onClick={() => setAktiverChartTab('einnahmen')}>
                  <BarChart3 size={13} /> Aufschlüsselung
                </button>
              </div>
            </div>
            {aktiverChartTab === 'zahlungsarten' && paymentMethodData.length > 0 && (
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie data={paymentMethodData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={80} dataKey="value">
                    {paymentMethodData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: 'var(--modal-bg-dark)', border: '1px solid var(--border-accent)', borderRadius: '12px', color: 'var(--text-1)' }} formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            )}
            {aktiverChartTab === 'zahlungsarten' && paymentMethodData.length === 0 && (
              <p className="fc__no-data">Keine Daten im gewählten Zeitraum</p>
            )}
            {aktiverChartTab === 'einnahmen' && incomeBreakdownData.length > 0 && (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={incomeBreakdownData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" />
                  <YAxis stroke="rgba(255,255,255,0.5)" tickFormatter={formatCurrencyCompact} />
                  <Tooltip content={<CustomIncomeTooltip />} />
                  <Bar dataKey="value" fill="#ffd700" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            {aktiverChartTab === 'einnahmen' && incomeBreakdownData.length === 0 && (
              <p className="fc__no-data">Keine Daten im gewählten Zeitraum</p>
            )}
          </div>

          <div className="finanzcockpit-card finanzcockpit__insights">
            <div className="finanzcockpit__card-header">
              <div>
                <span className="finanzcockpit__card-eyebrow">Insights</span>
                <h3>Schnelle Einschätzungen</h3>
              </div>
            </div>
            <ul className="finanzcockpit__insight-list">
              {insights.map(({ id, icon: Icon, title, description }) => (
                <li key={id}>
                  <div className="finanzcockpit__insight-icon"><Icon size={16} /></div>
                  <div>
                    <p className="finanzcockpit__insight-title">{title}</p>
                    <p className="finanzcockpit__insight-description">{description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Rechte Spalte: Aktionen */}
        <div className="fc__actions-col">
          <div className="fc__action-groups">
            <div className="fc__action-group">
              <h3 className="fc__action-group-title">Buchführung</h3>
              <div className="fc__action-list">
                <ActionCard icon={FileSpreadsheet} label="EÜR erstellen" desc="Einnahmen-Überschuss-Rechnung" iconColor="#10b981" onClick={() => navigate('/dashboard/euer')} />
                <ActionCard icon={TrendingDown} label="Ausgaben erfassen" desc="Neue Ausgabe buchen" iconColor="#ef4444" onClick={() => navigate('/dashboard/ausgaben')} />
                <ActionCard icon={Upload} label="Kontoauszug importieren" desc="CSV / MT940 importieren" iconColor="#f97316" onClick={() => navigate('/dashboard/kontoauszug-import')} />
                <ActionCard icon={CalendarDays} label="Jahresübersicht" desc="Monat-für-Monat Verlauf" iconColor="#6366f1" onClick={() => navigate('/dashboard/jahresuebersicht')} />
              </div>
            </div>

            <div className="fc__action-group">
              <h3 className="fc__action-group-title">Zahlungsverkehr</h3>
              <div className="fc__action-list">
                <ActionCard icon={CreditCard} label="Lastschriftlauf" desc="SEPA-Einzüge starten" iconColor="#3b82f6" onClick={() => navigate('/dashboard/lastschriftlauf')} />
                <ActionCard icon={AlertCircle} label="Mahnwesen" desc="Überfällige Zahlungen" iconColor="#f59e0b" onClick={() => navigate('/dashboard/mahnwesen')} badge={stats?.ausstehendeZahlungen || 0} />
                <ActionCard icon={RotateCcw} label="Rücklastschriften" desc="Fehlgeschlagene Abbuchungen" iconColor="#ef4444" onClick={() => navigate('/dashboard/ruecklastschriften')} badge={alerts.ruecklastschriften} />
              </div>
            </div>

            <div className="fc__action-group">
              <h3 className="fc__action-group-title">Rechnungen & Beiträge</h3>
              <div className="fc__action-list">
                <ActionCard icon={FileText} label="Rechnungen prüfen" desc="Offene Posten verwalten" iconColor="#f59e0b" onClick={() => navigate('/dashboard/rechnungen')} badge={stats?.offeneRechnungen || 0} />
                <ActionCard icon={DollarSign} label="Beiträge verwalten" desc="Verträge und Tarife" iconColor="#10b981" onClick={() => navigate('/dashboard/beitraege')} />
              </div>
            </div>

            <div className="fc__action-group">
              <h3 className="fc__action-group-title">Mitglieder-Analysen</h3>
              <div className="fc__action-list">
                <ActionCard icon={AlertCircle} label="Ohne SEPA-Mandat" desc="Mitglieder ohne Einzugsermächtigung" iconColor="#ef4444" onClick={() => navigate('/dashboard/mitglieder-filter/ohne-sepa')} />
                <ActionCard icon={FileText} label="Ohne Vertrag" desc="Mitglieder ohne aktiven Vertrag" iconColor="#f59e0b" onClick={() => navigate('/dashboard/mitglieder-filter/ohne-vertrag')} />
                <ActionCard icon={AlertTriangle} label="Tarif-Abweichungen" desc="Soll/Ist-Vergleich der Beiträge" iconColor="#8b5cf6" onClick={() => navigate('/dashboard/mitglieder-filter/tarif-abweichung')} />
                <ActionCard icon={CreditCard} label="Nach Zahlungsweise" desc="Gruppiert nach Bar / Karte / SEPA" iconColor="#3b82f6" onClick={() => navigate('/dashboard/mitglieder-filter/zahlungsweisen')} />
              </div>
            </div>

            <div className="fc__action-group">
              <h3 className="fc__action-group-title">Dokumente & Export</h3>
              <div className="fc__action-list">
                <ActionCard icon={FileSpreadsheet} label="Dokument-Vorlagen" desc="Briefe und E-Mails verwalten" iconColor="#8B0000" onClick={() => navigate('/dashboard/vorlagen')} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="finanzcockpit__details">
        <div className="finanzcockpit-card finanzcockpit__detail-card">
          <div className="finanzcockpit__detail-header">
            <TrendingUp size={16} />
            <div>
              <h3>Einnahmen-Übersicht</h3>
              <p>Regelmäßige und variable Umsätze</p>
            </div>
          </div>
          <div className="finanzcockpit__metrics-list">
            {incomeMetrics.map(metric => {
              const MetricIcon = metric.icon;
              return (
                <div key={metric.label} className="finanzcockpit__metric-row">
                  <span className="finanzcockpit__metric-label">{metric.label}</span>
                  <span className={`finanzcockpit__metric-value ${metric.tone ? `is-${metric.tone}` : ''}`}>
                    {MetricIcon && <MetricIcon size={13} />}{metric.value}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="finanzcockpit-card finanzcockpit__detail-card">
          <div className="finanzcockpit__detail-header">
            <PieChartIcon size={16} />
            <div>
              <h3>Zahlungsarten</h3>
              <p>Wie Mitglieder und Kunden zahlen</p>
            </div>
          </div>
          <div className="finanzcockpit__metrics-list">
            {paymentMetrics.map(metric => (
              <div key={metric.label} className="finanzcockpit__metric-row">
                <span className="finanzcockpit__metric-label">{metric.label}</span>
                <span className="finanzcockpit__metric-value">{metric.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="finanzcockpit-card finanzcockpit__detail-card">
          <div className="finanzcockpit__detail-header">
            <FileText size={16} />
            <div>
              <h3>Offene Posten</h3>
              <p>Forderungen und offene Beiträge</p>
            </div>
          </div>
          <div className="finanzcockpit__metrics-list">
            {dueMetrics.map(metric => (
              <div key={metric.label} className="finanzcockpit__metric-row">
                <span className="finanzcockpit__metric-label">{metric.label}</span>
                <span className={`finanzcockpit__metric-value ${metric.tone ? `is-${metric.tone}` : ''}`}>
                  {metric.value}
                  {metric.sublabel && <small>{metric.sublabel}</small>}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="finanzcockpit-card finanzcockpit__detail-card">
          <div className="finanzcockpit__detail-header">
            <BarChart3 size={16} />
            <div>
              <h3>Aktivität</h3>
              <p>Operative Kennzahlen der Periode</p>
            </div>
          </div>
          <div className="finanzcockpit__metrics-list">
            {activityMetrics.map(metric => (
              <div key={metric.label} className="finanzcockpit__metric-row">
                <span className="finanzcockpit__metric-label">{metric.label}</span>
                <span className="finanzcockpit__metric-value">
                  {metric.value}
                  {metric.sublabel && <small>{metric.sublabel}</small>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Finanzcockpit;
