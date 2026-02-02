import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  FileText,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  BarChart3,
  Wallet,
  Users,
  Building2,
  Globe,
  Monitor,
  GraduationCap,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Target,
  Receipt
} from "lucide-react";
import { useDojoContext } from '../context/DojoContext.jsx';
import config from "../config/config";
import "../styles/SuperAdminFinanzen.css";
import { fetchWithAuth } from '../utils/fetchWithAuth';
import VerbandRechnungErstellen from './VerbandRechnungErstellen';

const COLORS = {
  verband: '#3b82f6',    // Blau
  software: '#10b981',   // Grün
  schulen: '#f59e0b',    // Gold/Orange
  gesamt: '#8b5cf6',     // Lila
  positiv: '#22c55e',
  negativ: '#ef4444',
  warnung: '#f97316'
};

const SuperAdminFinanzen = () => {
  const { dojos } = useDojoContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [selectedBereich, setSelectedBereich] = useState('alle'); // alle, verband, software, schulen
  const [activeView, setActiveView] = useState('uebersicht'); // 'uebersicht' | 'rechnungen'

  // Data States
  const [financeData, setFinanceData] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [contractsData, setContractsData] = useState(null);
  const [schulenData, setSchulenData] = useState(null);
  const [timelineData, setTimelineData] = useState([]);

  useEffect(() => {
    loadAllData();
  }, [selectedPeriod]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Dojo-IDs für Schulen ermitteln
      const dojoIds = dojos && dojos.length > 0
        ? dojos.map(d => d.id).join(',')
        : '2,3';

      const [
        financeRes,
        statsRes,
        contractsRes,
        schulenRes,
        timelineRes
      ] = await Promise.all([
        fetchWithAuth(`${config.apiBaseUrl}/admin/finance`),
        fetchWithAuth(`${config.apiBaseUrl}/admin/statistics`),
        fetchWithAuth(`${config.apiBaseUrl}/admin/contracts`),
        fetchWithAuth(`${config.apiBaseUrl}/finanzcockpit/stats?period=${selectedPeriod}&dojo_ids=${dojoIds}`),
        fetchWithAuth(`${config.apiBaseUrl}/finanzcockpit/timeline?months=12&dojo_ids=${dojoIds}`)
      ]);

      if (financeRes.ok) {
        const data = await financeRes.json();
        setFinanceData(data.success ? data.finance : data);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStatsData(data.success ? data.statistics : data);
      }

      if (contractsRes.ok) {
        const data = await contractsRes.json();
        setContractsData(data.success ? data.contracts : data);
      }

      if (schulenRes.ok) {
        const data = await schulenRes.json();
        setSchulenData(data.success ? data.data : data);
      }

      if (timelineRes.ok) {
        const data = await timelineRes.json();
        if (data.success && data.data) {
          // Berechne Prognose
          const withPrognose = calculatePrognose(data.data);
          setTimelineData(withPrognose);
        }
      }

      setLoading(false);
    } catch (err) {
      console.error('Fehler beim Laden der Finanzdaten:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  // Prognose-Berechnung (Lineare Regression)
  const calculatePrognose = (data) => {
    if (!data || data.length < 3) return data;

    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    data.forEach((point, index) => {
      const y = point.umsatz || 0;
      sumX += index;
      sumY += y;
      sumXY += index * y;
      sumX2 += index * index;
    });

    const denominator = (n * sumX2 - sumX * sumX);
    if (denominator === 0) return data;

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;

    // Füge Trendwerte zu bestehenden Daten hinzu
    const dataWithTrend = data.map((point, index) => ({
      ...point,
      trend: Math.max(0, slope * index + intercept)
    }));

    // Füge 6 Monate Prognose hinzu
    const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    const lastDate = new Date();

    for (let i = 1; i <= 6; i++) {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + i);
      const monthLabel = months[futureDate.getMonth()] + ' ' + futureDate.getFullYear().toString().slice(-2);

      const prognoseValue = Math.max(0, slope * (n + i - 1) + intercept);
      dataWithTrend.push({
        label: monthLabel,
        umsatz: null,
        prognose: prognoseValue,
        prognoseMin: prognoseValue * 0.85,
        prognoseMax: prognoseValue * 1.15,
        isPrognose: true
      });
    }

    return dataWithTrend;
  };

  // Formatierungsfunktionen
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatCurrencyCompact = (amount) => {
    if (Math.abs(amount) >= 1000000) {
      return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 1,
        notation: 'compact'
      }).format(amount || 0);
    }
    return formatCurrency(amount);
  };

  const formatPercent = (value) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${(value || 0).toFixed(1)}%`;
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('de-DE').format(num || 0);
  };

  // Berechnete Werte
  const kpis = useMemo(() => {
    if (!financeData && !schulenData) return null;

    // Verband: Erwartete Jahresbeiträge / 12 für monatlichen Wert
    const verbandJahresbeitrag = financeData?.verband?.einnahmen?.jahresbeitrag_erwartet || 0;
    const verbandMonatlich = verbandJahresbeitrag / 12;
    const verbandBezahlt = financeData?.verband?.einnahmen?.bezahlt || 0;

    // Software MRR
    const software = financeData?.subscriptionRevenue?.mrr || 0;

    // Schulen
    const schulen = schulenData?.gesamteinnahmen || 0;

    // Gesamt (monatlich)
    const gesamt = verbandMonatlich + software + schulen;
    const ausgaben = schulenData?.gesamteAusgaben || 0;
    const cashflow = gesamt - ausgaben;

    // Offene Posten (Verband + Schulen)
    const verbandOffen = financeData?.verband?.einnahmen?.offen || 0;
    const schulenOffen = schulenData?.offeneRechnungenBetrag || 0;
    const offenePosten = verbandOffen + schulenOffen;
    const offeneCount = (schulenData?.offeneRechnungen || 0);

    return {
      gesamt: { value: gesamt, trend: schulenData?.einnahmenTrend || 0 },
      verband: {
        value: verbandMonatlich,
        jahresbeitrag: verbandJahresbeitrag,
        bezahlt: verbandBezahlt,
        mitglieder: financeData?.verband?.mitglieder?.aktiv || 0,
        dojos: financeData?.verband?.mitglieder?.dojos || 0,
        einzelpersonen: financeData?.verband?.mitglieder?.einzelpersonen || 0
      },
      software: { value: software, arr: financeData?.subscriptionRevenue?.arr || 0 },
      schulen: { value: schulen, trend: schulenData?.einnahmenTrend || 0 },
      cashflow: { value: cashflow, percent: gesamt > 0 ? (cashflow / gesamt) * 100 : 0 },
      offenePosten: { value: offenePosten, count: offeneCount }
    };
  }, [financeData, schulenData]);

  // Verteilungs-Daten für PieChart
  const verteilungData = useMemo(() => {
    if (!kpis) return [];
    return [
      { name: 'Verband', value: kpis.verband.value, color: COLORS.verband },
      { name: 'Software', value: kpis.software.value, color: COLORS.software },
      { name: 'Schulen', value: kpis.schulen.value, color: COLORS.schulen }
    ].filter(item => item.value > 0);
  }, [kpis]);

  // Monatsvergleich-Daten
  const monatsvergleichData = useMemo(() => {
    if (!timelineData || timelineData.length < 2) return [];

    const aktuell = timelineData.find(d => !d.isPrognose && d.umsatz !== null);
    const vormonat = timelineData.length > 1 ? timelineData[timelineData.length - 8] : null;

    return [
      { name: 'Aktuell', verband: 0, software: kpis?.software.value || 0, schulen: kpis?.schulen.value || 0 },
      { name: 'Vormonat', verband: 0, software: (kpis?.software.value || 0) * 0.95, schulen: vormonat?.umsatz || 0 }
    ];
  }, [timelineData, kpis]);

  // Prognose-Szenarien
  const prognoseJahr = useMemo(() => {
    if (!kpis) return null;
    const monatlich = kpis.gesamt.value;
    const trend = (kpis.gesamt.trend || 0) / 100;

    const realistisch = monatlich * 12 * (1 + trend);
    return {
      konservativ: realistisch * 0.9,
      realistisch: realistisch,
      optimistisch: realistisch * 1.15
    };
  }, [kpis]);

  // Warnungen
  const warnungen = useMemo(() => {
    const alerts = [];

    if (schulenData?.ueberfaelligeRechnungen > 0) {
      alerts.push({
        type: 'warning',
        icon: AlertTriangle,
        text: `${schulenData.ueberfaelligeRechnungen} Rechnungen überfällig (${formatCurrency(schulenData.offeneRechnungenBetrag)})`
      });
    }

    if (contractsData?.renewals?.next30Days > 0) {
      alerts.push({
        type: 'info',
        icon: Clock,
        text: `${contractsData.renewals.next30Days} Verträge laufen in 30 Tagen aus`
      });
    }

    if (kpis?.cashflow.value < 0) {
      alerts.push({
        type: 'error',
        icon: TrendingDown,
        text: `Negativer Cashflow: ${formatCurrency(kpis.cashflow.value)}`
      });
    }

    if (kpis?.gesamt.trend > 10) {
      alerts.push({
        type: 'success',
        icon: TrendingUp,
        text: `Überdurchschnittliches Wachstum: ${formatPercent(kpis.gesamt.trend)}`
      });
    }

    return alerts;
  }, [schulenData, contractsData, kpis]);

  // Loading State
  if (loading) {
    return (
      <div className="saf">
        <div className="saf-card saf__loading">
          <div className="saf__spinner" />
          <p>Finanzdaten werden geladen...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="saf">
        <div className="saf-card saf__error">
          <AlertCircle size={48} />
          <h3>Fehler beim Laden</h3>
          <p>{error}</p>
          <button onClick={loadAllData}>Erneut versuchen</button>
        </div>
      </div>
    );
  }

  const periodLabels = {
    month: 'Aktueller Monat',
    quarter: 'Aktuelles Quartal',
    year: 'Aktuelles Jahr'
  };

  return (
    <div className="saf">
      {/* View-Switcher Tabs */}
      <div className="saf__view-tabs">
        <button
          className={activeView === 'uebersicht' ? 'active' : ''}
          onClick={() => setActiveView('uebersicht')}
        >
          <BarChart3 size={18} />
          Finanzübersicht
        </button>
        <button
          className={activeView === 'rechnungen' ? 'active' : ''}
          onClick={() => setActiveView('rechnungen')}
        >
          <Receipt size={18} />
          Rechnungen erstellen
        </button>
      </div>

      {activeView === 'rechnungen' ? (
        <VerbandRechnungErstellen />
      ) : (
        <>
          {/* Header */}
          <header className="saf-card saf__header">
            <div className="saf__header-top">
              <div className="saf__headline">
                <span className="saf__eyebrow">TDA Int'l Org</span>
                <h1 className="saf__title">Finanzübersicht</h1>
                <p className="saf__subtitle">
                  Alle Geschäftsbereiche auf einen Blick - Verband, Software & Schulen
                </p>
              </div>
              <div className="saf__controls">
                {/* Bereichs-Switcher */}
                <div className="saf__bereich-switcher">
                  {['alle', 'verband', 'software', 'schulen'].map(bereich => (
                    <button
                      key={bereich}
                      className={selectedBereich === bereich ? 'active' : ''}
                      onClick={() => setSelectedBereich(bereich)}
                    >
                      {bereich === 'alle' && <Globe size={14} />}
                      {bereich === 'verband' && <Users size={14} />}
                      {bereich === 'software' && <Monitor size={14} />}
                      {bereich === 'schulen' && <GraduationCap size={14} />}
                      {bereich.charAt(0).toUpperCase() + bereich.slice(1)}
                    </button>
                  ))}
                </div>
                {/* Zeitraum-Selektor */}
                <div className="saf__period-selector">
                  <button
                    className={selectedPeriod === 'month' ? 'active' : ''}
                    onClick={() => setSelectedPeriod('month')}
                  >
                    Monat
                  </button>
                  <button
                    className={selectedPeriod === 'quarter' ? 'active' : ''}
                    onClick={() => setSelectedPeriod('quarter')}
                  >
                    Quartal
                  </button>
                  <button
                    className={selectedPeriod === 'year' ? 'active' : ''}
                    onClick={() => setSelectedPeriod('year')}
                  >
                    Jahr
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* KPI Grid */}
      {kpis && (
        <section className={`saf__kpi-grid saf__kpi-grid--${selectedBereich}`}>
          {/* Gesamtumsatz - nur bei "alle" */}
          {selectedBereich === 'alle' && (
            <div className="saf-card saf__kpi-card saf__kpi-card--gesamt">
              <div className="saf__kpi-icon">
                <DollarSign size={20} />
              </div>
              <div className="saf__kpi-content">
                <span className="saf__kpi-label">Gesamtumsatz</span>
                <span className="saf__kpi-value">{formatCurrency(kpis.gesamt.value)}</span>
                <span className={`saf__kpi-trend ${kpis.gesamt.trend >= 0 ? 'positive' : 'negative'}`}>
                  {kpis.gesamt.trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {formatPercent(kpis.gesamt.trend)}
                </span>
              </div>
            </div>
          )}

          {/* Verband */}
          {(selectedBereich === 'alle' || selectedBereich === 'verband') && (
            <div className={`saf-card saf__kpi-card saf__kpi-card--verband ${selectedBereich === 'verband' ? 'saf__kpi-card--expanded' : ''}`}>
              <div className="saf__kpi-icon">
                <Users size={20} />
              </div>
              <div className="saf__kpi-content">
                <span className="saf__kpi-label">Verband</span>
                <span className="saf__kpi-value">{formatCurrency(kpis.verband.value)}</span>
                <span className="saf__kpi-detail">
                  {selectedBereich === 'verband'
                    ? `${formatNumber(kpis.verband.mitglieder)} aktive Mitglieder`
                    : 'Mitgliedsbeiträge & Events'}
                </span>
                {selectedBereich === 'verband' && (
                  <>
                    <span className="saf__kpi-detail">{formatNumber(kpis.verband.dojos)} Dojos | {formatNumber(kpis.verband.einzelpersonen)} Einzelpersonen</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Software */}
          {(selectedBereich === 'alle' || selectedBereich === 'software') && (
            <div className={`saf-card saf__kpi-card saf__kpi-card--software ${selectedBereich === 'software' ? 'saf__kpi-card--expanded' : ''}`}>
              <div className="saf__kpi-icon">
                <Monitor size={20} />
              </div>
              <div className="saf__kpi-content">
                <span className="saf__kpi-label">Software MRR</span>
                <span className="saf__kpi-value">{formatCurrency(kpis.software.value)}</span>
                <span className="saf__kpi-detail">ARR: {formatCurrency(kpis.software.arr)}</span>
                {selectedBereich === 'software' && (
                  <>
                    <span className="saf__kpi-detail">Aktive Abos: {formatNumber(financeData?.subscriptionRevenue?.breakdown?.reduce((a, b) => a + (b.anzahl || 0), 0) || 0)}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Schulen */}
          {(selectedBereich === 'alle' || selectedBereich === 'schulen') && (
            <div className={`saf-card saf__kpi-card saf__kpi-card--schulen ${selectedBereich === 'schulen' ? 'saf__kpi-card--expanded' : ''}`}>
              <div className="saf__kpi-icon">
                <GraduationCap size={20} />
              </div>
              <div className="saf__kpi-content">
                <span className="saf__kpi-label">Schulen</span>
                <span className="saf__kpi-value">{formatCurrency(kpis.schulen.value)}</span>
                <span className={`saf__kpi-trend ${kpis.schulen.trend >= 0 ? 'positive' : 'negative'}`}>
                  {kpis.schulen.trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {formatPercent(kpis.schulen.trend)}
                </span>
                {selectedBereich === 'schulen' && (
                  <>
                    <span className="saf__kpi-detail">{formatNumber(schulenData?.anzahlVertraege || 0)} aktive Verträge</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Cashflow - nur bei "alle" oder "schulen" */}
          {(selectedBereich === 'alle' || selectedBereich === 'schulen') && (
            <div className={`saf-card saf__kpi-card ${kpis.cashflow.value >= 0 ? 'saf__kpi-card--positive' : 'saf__kpi-card--negative'}`}>
              <div className="saf__kpi-icon">
                <Wallet size={20} />
              </div>
              <div className="saf__kpi-content">
                <span className="saf__kpi-label">Cashflow</span>
                <span className="saf__kpi-value">{formatCurrency(kpis.cashflow.value)}</span>
                <span className="saf__kpi-detail">{formatPercent(kpis.cashflow.percent)} Marge</span>
              </div>
            </div>
          )}

          {/* Offene Posten */}
          {(selectedBereich === 'alle' || selectedBereich === 'schulen' || selectedBereich === 'verband') && (
            <div className={`saf-card saf__kpi-card ${kpis.offenePosten.count > 0 ? 'saf__kpi-card--warning' : 'saf__kpi-card--positive'}`}>
              <div className="saf__kpi-icon">
                <FileText size={20} />
              </div>
              <div className="saf__kpi-content">
                <span className="saf__kpi-label">Offene Posten</span>
                <span className="saf__kpi-value">{formatCurrency(kpis.offenePosten.value)}</span>
                <span className="saf__kpi-detail">{kpis.offenePosten.count} Rechnungen</span>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Charts Grid */}
      <section className={`saf__charts-grid ${selectedBereich !== 'alle' ? 'saf__charts-grid--single' : ''}`}>
        {/* Umsatz-Entwicklung */}
        <div className={`saf-card saf__chart-card ${selectedBereich !== 'alle' ? 'saf__chart-card--full' : 'saf__chart-card--wide'}`}>
          <div className="saf__card-header">
            <div>
              <span className="saf__card-eyebrow">
                {selectedBereich === 'alle' ? 'Entwicklung' : `${selectedBereich.charAt(0).toUpperCase() + selectedBereich.slice(1)} - Entwicklung`}
              </span>
              <h3>
                {selectedBereich === 'schulen' ? 'Schulen-Umsatz & Prognose' :
                 selectedBereich === 'verband' ? 'Verband - Beiträge & Prognose' :
                 selectedBereich === 'software' ? 'Software - MRR & Prognose' :
                 'Umsatz & Prognose'} (12 + 6 Monate)
              </h3>
            </div>
            <TrendingUp size={20} />
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={timelineData}>
              <defs>
                <linearGradient id="colorUmsatz" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.schulen} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS.schulen} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorPrognose" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.gesamt} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS.gesamt} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="label" stroke="rgba(255,255,255,0.6)" fontSize={12} />
              <YAxis stroke="rgba(255,255,255,0.6)" fontSize={12} tickFormatter={formatCurrencyCompact} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  border: '1px solid rgba(255,215,0,0.3)',
                  borderRadius: '8px',
                  color: '#fff'
                }}
                formatter={(value) => formatCurrency(value)}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="umsatz"
                stroke={COLORS.schulen}
                fill="url(#colorUmsatz)"
                strokeWidth={2}
                name="Ist-Umsatz"
                dot={{ fill: COLORS.schulen, r: 3 }}
              />
              <Area
                type="monotone"
                dataKey="prognose"
                stroke={COLORS.gesamt}
                fill="url(#colorPrognose)"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Prognose"
                dot={{ fill: COLORS.gesamt, r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="trend"
                stroke="#22c55e"
                strokeWidth={2}
                strokeDasharray="3 3"
                name="Trend"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Verteilung - nur bei "alle" anzeigen */}
        {selectedBereich === 'alle' && (
          <div className="saf-card saf__chart-card">
            <div className="saf__card-header">
              <div>
                <span className="saf__card-eyebrow">Verteilung</span>
                <h3>Umsatz nach Bereich</h3>
              </div>
              <PieChartIcon size={20} />
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={verteilungData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {verteilungData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(255,215,0,0.3)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                formatter={(value) => formatCurrency(value)}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="saf__pie-legend">
            {verteilungData.map(item => (
              <div key={item.name} className="saf__pie-legend-item">
                <span className="saf__pie-dot" style={{ backgroundColor: item.color }} />
                <span>{item.name}</span>
                <span className="saf__pie-value">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
        )}
      </section>

      {/* Prognose Szenarien */}
      {prognoseJahr && (
        <section className="saf__prognose-section">
          <div className="saf-card">
            <div className="saf__card-header">
              <div>
                <span className="saf__card-eyebrow">Prognose</span>
                <h3>Jahresprognose {new Date().getFullYear()}</h3>
              </div>
              <Target size={20} />
            </div>
            <div className="saf__szenarien-grid">
              <div className="saf__szenario saf__szenario--konservativ">
                <span className="saf__szenario-label">Konservativ</span>
                <span className="saf__szenario-value">{formatCurrency(prognoseJahr.konservativ)}</span>
                <span className="saf__szenario-detail">-10% vom Trend</span>
              </div>
              <div className="saf__szenario saf__szenario--realistisch">
                <span className="saf__szenario-label">Realistisch</span>
                <span className="saf__szenario-value">{formatCurrency(prognoseJahr.realistisch)}</span>
                <span className="saf__szenario-detail">Basierend auf Trend</span>
              </div>
              <div className="saf__szenario saf__szenario--optimistisch">
                <span className="saf__szenario-label">Optimistisch</span>
                <span className="saf__szenario-value">{formatCurrency(prognoseJahr.optimistisch)}</span>
                <span className="saf__szenario-detail">+15% vom Trend</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Detail-Tabellen */}
      <section className={`saf__details-grid saf__details-grid--${selectedBereich}`}>
        {/* Verband Details */}
        {(selectedBereich === 'alle' || selectedBereich === 'verband') && (
          <div className="saf-card saf__detail-card">
            <div className="saf__detail-header">
              <Users size={20} style={{ color: COLORS.verband }} />
              <div>
                <h3>Verband</h3>
                <p>TDA International</p>
              </div>
            </div>
            <div className="saf__detail-list">
              <div className="saf__detail-row">
                <span>Aktive Mitglieder</span>
                <span>{formatNumber(financeData?.verband?.mitglieder?.aktiv || 0)}</span>
              </div>
              {financeData?.verband?.breakdown?.map(item => (
                <div key={item.typ} className="saf__detail-row saf__detail-row--sub">
                  <span>{item.typ === 'dojo' ? 'Dojos' : 'Einzelpersonen'}</span>
                  <span>{formatNumber(item.anzahl)} ({formatCurrency(item.durchschnitt)}/Jahr)</span>
                </div>
              ))}
              <div className="saf__detail-row">
                <span>Jahresbeiträge (erwartet)</span>
                <span>{formatCurrency(financeData?.verband?.einnahmen?.jahresbeitrag_erwartet || 0)}</span>
              </div>
              <div className="saf__detail-row">
                <span>Bezahlt</span>
                <span style={{ color: COLORS.positiv }}>{formatCurrency(financeData?.verband?.einnahmen?.bezahlt || 0)}</span>
              </div>
              <div className="saf__detail-row">
                <span>Offen</span>
                <span style={{ color: (financeData?.verband?.einnahmen?.offen || 0) > 0 ? COLORS.warnung : COLORS.positiv }}>
                  {formatCurrency(financeData?.verband?.einnahmen?.offen || 0)}
                </span>
              </div>
              <div className="saf__detail-row saf__detail-row--total">
                <span>Monatlich (anteilig)</span>
                <span>{formatCurrency((financeData?.verband?.einnahmen?.jahresbeitrag_erwartet || 0) / 12)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Software Details */}
        {(selectedBereich === 'alle' || selectedBereich === 'software') && (
          <div className="saf-card saf__detail-card">
            <div className="saf__detail-header">
              <Monitor size={20} style={{ color: COLORS.software }} />
              <div>
                <h3>Software</h3>
                <p>SaaS Subscriptions</p>
              </div>
            </div>
            <div className="saf__detail-list">
              <div className="saf__detail-row">
                <span>MRR (Monthly)</span>
                <span>{formatCurrency(financeData?.subscriptionRevenue?.mrr || 0)}</span>
              </div>
              <div className="saf__detail-row">
                <span>ARR (Annual)</span>
                <span>{formatCurrency(financeData?.subscriptionRevenue?.arr || 0)}</span>
              </div>
              <div className="saf__detail-row">
                <span>Aktive Abos</span>
                <span>{formatNumber(financeData?.subscriptionRevenue?.breakdown?.reduce((a, b) => a + (b.anzahl || 0), 0) || 0)}</span>
              </div>
              {financeData?.subscriptionRevenue?.breakdown?.map(plan => (
                <div key={plan.plan} className="saf__detail-row saf__detail-row--sub">
                  <span>{plan.plan} ({plan.interval || 'monatlich'})</span>
                  <span>{plan.anzahl}x à {formatCurrency(plan.preis)}/Mo</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Schulen Details */}
        {(selectedBereich === 'alle' || selectedBereich === 'schulen') && (
          <div className="saf-card saf__detail-card">
            <div className="saf__detail-header">
              <GraduationCap size={20} style={{ color: COLORS.schulen }} />
              <div>
                <h3>Kampfsportschulen</h3>
                <p>KSS & TDA</p>
              </div>
            </div>
            <div className="saf__detail-list">
              <div className="saf__detail-row">
                <span>Monatliche Einnahmen</span>
                <span>{formatCurrency(schulenData?.monatlicheEinnahmen || 0)}</span>
              </div>
              <div className="saf__detail-row">
                <span>Verkäufe</span>
                <span>{formatCurrency(schulenData?.verkaeufeEinnahmen || 0)}</span>
              </div>
              <div className="saf__detail-row">
                <span>Aktive Verträge</span>
                <span>{formatNumber(schulenData?.anzahlVertraege || 0)}</span>
              </div>
              <div className="saf__detail-row">
                <span>Ausgaben</span>
                <span style={{ color: COLORS.negativ }}>{formatCurrency(schulenData?.gesamteAusgaben || 0)}</span>
              </div>
              <div className="saf__detail-row saf__detail-row--total">
                <span>Gesamt</span>
                <span>{formatCurrency(schulenData?.gesamteinnahmen || 0)}</span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Warnungen */}
      {warnungen.length > 0 && (
        <section className="saf__alerts-section">
          <div className="saf-card">
            <div className="saf__card-header">
              <div>
                <span className="saf__card-eyebrow">Insights</span>
                <h3>Warnungen & Hinweise</h3>
              </div>
              <AlertCircle size={20} />
            </div>
            <div className="saf__alerts-list">
              {warnungen.map((alert, index) => {
                const Icon = alert.icon;
                return (
                  <div key={index} className={`saf__alert saf__alert--${alert.type}`}>
                    <Icon size={18} />
                    <span>{alert.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
        </>
      )}
    </div>
  );
};

export default SuperAdminFinanzen;
