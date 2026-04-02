// Frontend/src/components/Auswertungen.jsx - Saubere Version für Backend-Datenstruktur
import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ComposedChart
} from 'recharts';
import axios from 'axios';
import '../styles/Auswertungen.css';
import '../styles/Auswertungen-BreakEven.css';

function Auswertungen() {
  const [auswertungsData, setAuswertungsData] = useState(null);
  const [kostenvorlagen, setKostenvorlagen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('breakeven');
  const [breakEvenData, setBreakEvenData] = useState(null);
  const [breakEvenForm, setBreakEvenForm] = useState({
    fixkosten: {},
    variableKosten: {},
    durchschnittsbeitrag: 85
  });
  const [timePeriod, setTimePeriod] = useState('monthly');
  const [growthPeriod, setGrowthPeriod] = useState('monat');
  const [memberAnalytics, setMemberAnalytics] = useState(null);
  const [beitragsvergleich, setBeitragsvergleich] = useState(null);
  const [beltsData, setBeltsData] = useState(null);

  const tabs = [
    { id: 'breakeven', label: 'Break-Even Analyse', icon: '💡' },
    { id: 'overview', label: 'Übersicht', icon: '📊' },
    { id: 'financial', label: 'Finanzen', icon: '💰' },
    { id: 'members', label: 'Mitglieder', icon: '👥' },
    { id: 'belts', label: 'Gürtel', icon: '🥋' },
    { id: 'performance', label: 'Performance', icon: '📈' },
    { id: 'forecasting', label: 'Prognosen', icon: '🔮' }
  ];

  const timePeriods = [
    { id: 'monthly', label: 'Monatlich', icon: '📅' },
    { id: 'quarterly', label: 'Vierteljährlich', icon: '📊' },
    { id: 'biannually', label: 'Halbjährlich', icon: '📈' },
    { id: 'annually', label: 'Jährlich', icon: '🎯' }
  ];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  useEffect(() => {
    loadAuswertungen();
    loadKostenvorlagen();
    loadMemberAnalytics();
    loadBeitragsvergleich();
    loadBeltsData();
  }, [timePeriod]);

  const loadAuswertungen = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/auswertungen/complete');
      const result = response.data;

      if (result.success) {
        setAuswertungsData(result.data);
      } else {
        throw new Error(result.error || 'Fehler beim Laden der Auswertungen');
      }
    } catch (err) {
      console.error('Fehler beim Laden der Auswertungen:', err);
      setError('Fehler beim Laden der Auswertungen: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadKostenvorlagen = async () => {
    try {
      const response = await axios.get('/auswertungen/kostenvorlagen');
      const result = response.data;

      if (result.success) {
        setKostenvorlagen(result.data);

        // Versuche, die letzte gespeicherte Berechnung zu laden
        try {
          const latestResponse = await axios.get('/auswertungen/break-even/latest');
          const latestResult = latestResponse.data;

          if (latestResult.success && latestResult.data) {
            // Letzte Berechnung gefunden - verwende diese Werte
            setBreakEvenForm({
              fixkosten: latestResult.data.fixkosten,
              variableKosten: latestResult.data.variableKosten,
              durchschnittsbeitrag: latestResult.data.durchschnittsbeitrag
            });
          } else {
            // Keine gespeicherte Berechnung - alle Kosten auf 0 setzen
            setBreakEvenForm({
              fixkosten: Object.keys(result.data.fixkosten).reduce((acc, key) => ({ ...acc, [key]: 0 }), {}),
              variableKosten: Object.keys(result.data.variableKosten).reduce((acc, key) => ({ ...acc, [key]: 0 }), {}),
              durchschnittsbeitrag: result.data.durchschnittsbeitrag
            });
          }
        } catch (latestErr) {
          console.error('Fehler beim Laden der letzten Berechnung:', latestErr);
          // Fallback: alle Kosten auf 0 setzen
          setBreakEvenForm({
            fixkosten: Object.keys(result.data.fixkosten).reduce((acc, key) => ({ ...acc, [key]: 0 }), {}),
            variableKosten: Object.keys(result.data.variableKosten).reduce((acc, key) => ({ ...acc, [key]: 0 }), {}),
            durchschnittsbeitrag: result.data.durchschnittsbeitrag
          });
        }
      }
    } catch (err) {
      console.error('Fehler beim Laden der Kostenvorlagen:', err);
    }
  };

  const calculateBreakEven = async () => {
    try {
      const response = await axios.post('/auswertungen/break-even', breakEvenForm);
      const result = response.data;

      if (result.success) {
        setBreakEvenData(result.data);
      }
    } catch (err) {
      console.error('Fehler bei Break-Even-Berechnung:', err);
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('de-DE').format(num || 0);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
  };

  const handleBreakEvenSubmit = (e) => {
    e.preventDefault();
    calculateBreakEven();
  };

  const updateFixkosten = (key, value) => {
    setBreakEvenForm(prev => ({
      ...prev,
      fixkosten: { ...prev.fixkosten, [key]: Number(value) || 0 }
    }));
  };

  const updateVariableKosten = (key, value) => {
    setBreakEvenForm(prev => ({
      ...prev,
      variableKosten: { ...prev.variableKosten, [key]: Number(value) || 0 }
    }));
  };

  const loadMemberAnalytics = async () => {
    try {
      const response = await axios.get(`/auswertungen/member-analytics?period=${timePeriod}`);
      const result = response.data;
      if (result.success) {
        setMemberAnalytics(result.data);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Mitgliederanalysen:', err);
      // Fallback: Leere Daten wenn API nicht verfügbar
      setMemberAnalytics({
        zugänge: [],
        kündigungen: [],
        ruhepausen: [],
        wachstumPrognose: {
          aktuell: 0,
          prognose3Monate: 0,
          prognose6Monate: 0,
          prognose12Monate: 0,
          wachstumsrate: 0
        }
      });
    }
  };

  const loadBeitragsvergleich = async () => {
    try {
      const response = await axios.get('/auswertungen/beitragsvergleich');
      const result = response.data;
      if (result.success) {
        setBeitragsvergleich(result.data);
      }
    } catch (err) {
      console.error('Fehler beim Laden des Beitragsvergleichs:', err);
      // Fallback: Leere Daten wenn API nicht verfügbar
      setBeitragsvergleich({
        niedrigeBeitraege: [],
        tarife: [],
        zusammenfassung: { gesamt: 0, potential: 0, niedrigsterTarif: 0, durchschnittlicheErhoehung: 0 }
      });
    }
  };

  const loadBeltsData = async () => {
    try {
      const response = await axios.get('/stile/auswertungen/guertel-uebersicht');
      if (response.data.success) {
        setBeltsData(response.data);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Gürtel-Daten:', err);
      setBeltsData({
        stile: [],
        summary: { total_stile: 0, total_guertel: 0, total_mitglieder: 0 }
      });
    }
  };


  if (loading) {
    return (
      <div className="auswertungen-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Auswertungen werden generiert...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="auswertungen-container">
        <div className="error-message">
          <h3>❌ Fehler</h3>
          <p>{error}</p>
          <button onClick={loadAuswertungen} className="retry-button">
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  if (!auswertungsData) {
    return (
      <div className="auswertungen-container">
        <div className="no-data">
          <h3>Keine Daten verfügbar</h3>
          <p>Es konnten keine Auswertungsdaten geladen werden.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auswertungen-container">
      <div className="auswertungen-header">
        <div className="header-content">
          <h1>📊 Dojo Auswertungen</h1>
          <p>Generiert am {new Date(auswertungsData.generatedAt).toLocaleString('de-DE')}</p>
        </div>
      </div>

      <div className="tab-navigation">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="tab-content">
        {activeTab === 'breakeven' && (
          <div className="tab-panel">
            <div className="break-even-container">
              <div className="section-header-break-even">
                <div>
                  <h2>🧮 Break-Even-Analyse</h2>
                  <p>Ermitteln Sie den Break-Even-Punkt Ihres Dojos und planen Sie strategisch</p>
                </div>
              </div>

              <form onSubmit={handleBreakEvenSubmit} className="break-even-form">
                <div className="break-even-input-grid">
                  {/* Fixkosten Card */}
                  <div className="cost-card">
                    <div className="cost-card-header">
                      <h3>💰 Fixkosten</h3>
                      <span className="subtitle">Monatliche Fixkosten</span>
                    </div>
                    <div className="cost-inputs">
                      {kostenvorlagen && Object.entries(kostenvorlagen.fixkosten).map(([key, value]) => (
                        <div key={key} className="input-row">
                          <label>{key.charAt(0).toUpperCase() + key.slice(1)}</label>
                          <div className="input-with-unit">
                            <input
                              type="number"
                              value={breakEvenForm.fixkosten[key] ?? value}
                              onChange={(e) => updateFixkosten(key, e.target.value)}
                              placeholder="0"
                              min="0"
                            />
                            <span className="unit">€</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Variable Kosten Card */}
                  <div className="cost-card">
                    <div className="cost-card-header">
                      <h3>📊 Variable Kosten</h3>
                      <span className="subtitle">Pro Mitglied/Monat</span>
                    </div>
                    <div className="cost-inputs">
                      {kostenvorlagen && Object.entries(kostenvorlagen.variableKosten).map(([key, value]) => (
                        <div key={key} className="input-row">
                          <label>{key.charAt(0).toUpperCase() + key.slice(1)}</label>
                          <div className="input-with-unit">
                            <input
                              type="number"
                              value={breakEvenForm.variableKosten[key] ?? value}
                              onChange={(e) => updateVariableKosten(key, e.target.value)}
                              placeholder="0"
                              min="0"
                            />
                            <span className="unit">€</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Durchschnittsbeitrag Card */}
                  <div className="cost-card">
                    <div className="cost-card-header">
                      <h3>💵 Beitrag</h3>
                      <span className="subtitle">Durchschnittlicher Mitgliedsbeitrag</span>
                    </div>
                    <div className="cost-inputs">
                      <div className="input-row">
                        <label>Monatlicher Beitrag</label>
                        <div className="input-with-unit">
                          <input
                            type="number"
                            value={breakEvenForm.durchschnittsbeitrag}
                            onChange={(e) => setBreakEvenForm(prev => ({
                              ...prev,
                              durchschnittsbeitrag: Number(e.target.value) || 0
                            }))}
                            placeholder="0"
                            min="0"
                          />
                          <span className="unit">€</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-actions-center">
                  <button type="submit" className="btn-calculate">
                    <span>🧮</span>
                    Break-Even berechnen
                  </button>
                </div>
              </form>

              {breakEvenData && (
                <div className="break-even-results">
                  {/* Hauptergebnisse als große KPI Cards */}
                  <div className="results-header">
                    <h3>📈 Ergebnisse</h3>
                  </div>

                  <div className="kpi-results-grid">
                    <div className="kpi-result-card primary">
                      <div className="kpi-icon-large">👥</div>
                      <div className="kpi-value">{breakEvenData.breakEvenPunkt.mitglieder}</div>
                      <div className="kpi-label">Break-Even Mitglieder</div>
                    </div>

                    <div className="kpi-result-card success">
                      <div className="kpi-icon-large">💰</div>
                      <div className="kpi-value">{formatCurrency(breakEvenData.breakEvenPunkt.umsatz)}</div>
                      <div className="kpi-label">Benötigter Umsatz</div>
                    </div>

                    <div className="kpi-result-card warning">
                      <div className="kpi-icon-large">💳</div>
                      <div className="kpi-value">{formatCurrency(breakEvenData.breakEvenPunkt.kostenProMitglied)}</div>
                      <div className="kpi-label">Kosten pro Mitglied</div>
                    </div>
                  </div>

                  {/* Szenarien */}
                  <div className="scenarios-section">
                    <h4>🎯 Szenarien-Analyse</h4>
                    <div className="scenarios-grid-professional">
                      {breakEvenData.szenarien.map((szenario, index) => (
                        <div key={index} className={`scenario-card-pro ${szenario.gewinn >= 0 ? 'profitable' : 'loss'}`}>
                          <div className="scenario-header">
                            <h5>{szenario.name}</h5>
                            <span className={`scenario-badge ${szenario.gewinn >= 0 ? 'success' : 'danger'}`}>
                              {szenario.gewinn >= 0 ? '✓ Profitabel' : '⚠ Verlust'}
                            </span>
                          </div>
                          <div className="scenario-metrics">
                            <div className="metric">
                              <span className="metric-label">Mitglieder</span>
                              <span className="metric-value">{szenario.mitglieder}</span>
                            </div>
                            <div className="metric">
                              <span className="metric-label">Umsatz</span>
                              <span className="metric-value">{formatCurrency(szenario.umsatz)}</span>
                            </div>
                            <div className="metric">
                              <span className="metric-label">Gewinn/Verlust</span>
                              <span className={`metric-value ${szenario.gewinn >= 0 ? 'positive' : 'negative'}`}>
                                {formatCurrency(szenario.gewinn)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Empfehlungen */}
                  <div className="recommendations-section">
                    <h4>💡 Strategische Empfehlungen</h4>
                    <div className="recommendations-list">
                      {breakEvenData.empfehlungen.map((empfehlung, index) => (
                        <div key={index} className={`recommendation-item ${empfehlung.typ || 'info'}`}>
                          <span className="recommendation-icon">
                            {empfehlung.typ === 'success' ? '✓' : empfehlung.typ === 'warning' ? '⚠' : 'ℹ'}
                          </span>
                          <div className="recommendation-content">
                            <strong>{empfehlung.titel}</strong>
                            <p>{empfehlung.beschreibung}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="tab-panel">
            {/* Kompakte KPI-Grid mit 8 Hauptkennzahlen */}
            <div className="kpi-compact-grid">
              <div className="kpi-compact">
                <div className="kpi-compact-icon">👥</div>
                <div className="kpi-compact-value">{formatNumber(auswertungsData.summary.totalMembers)}</div>
                <div className="kpi-compact-label">Mitglieder</div>
                <div className="kpi-compact-sub">+{auswertungsData.mitgliederAnalyse.neueThisMonth} Monat</div>
              </div>

              <div className="kpi-compact success">
                <div className="kpi-compact-icon">✓</div>
                <div className="kpi-compact-value">{formatNumber(auswertungsData.summary.activeMembers)}</div>
                <div className="kpi-compact-label">Aktiv</div>
                <div className="kpi-compact-sub">{Math.round((auswertungsData.summary.activeMembers / auswertungsData.summary.totalMembers) * 100)}% Quote</div>
              </div>

              <div className="kpi-compact warning">
                <div className="kpi-compact-icon">⏸</div>
                <div className="kpi-compact-value">{formatNumber(auswertungsData.summary.inactiveMembers)}</div>
                <div className="kpi-compact-label">Inaktiv</div>
                <div className="kpi-compact-sub">{Math.round((auswertungsData.summary.inactiveMembers / auswertungsData.summary.totalMembers) * 100)}% Quote</div>
              </div>

              <div className="kpi-compact info">
                <div className="kpi-compact-icon">📈</div>
                <div className="kpi-compact-value">{auswertungsData.summary.growthRate}%</div>
                <div className="kpi-compact-label">Wachstum</div>
                <div className="kpi-compact-sub">Trend</div>
              </div>

              <div className="kpi-compact">
                <div className="kpi-compact-icon">💰</div>
                <div className="kpi-compact-value">{formatCurrency(auswertungsData.summary.monthlyRevenue)}</div>
                <div className="kpi-compact-label">Monatlich</div>
                <div className="kpi-compact-sub">{formatCurrency(auswertungsData.summary.yearlyRevenue)} / Jahr</div>
              </div>

              <div className="kpi-compact">
                <div className="kpi-compact-icon">💳</div>
                <div className="kpi-compact-value">{formatCurrency(auswertungsData.finanzielleAuswertung.durchschnittsBeitrag)}</div>
                <div className="kpi-compact-label">Ø Beitrag</div>
                <div className="kpi-compact-sub">Pro Mitglied</div>
              </div>

              <div className="kpi-compact info">
                <div className="kpi-compact-icon">🔄</div>
                <div className="kpi-compact-value">{auswertungsData.summary.retentionRate}%</div>
                <div className="kpi-compact-label">Retention</div>
                <div className="kpi-compact-sub">&gt;1 Jahr</div>
              </div>

              <div className="kpi-compact success">
                <div className="kpi-compact-icon">⏱</div>
                <div className="kpi-compact-value">{auswertungsData.summary.averageMembershipDuration}</div>
                <div className="kpi-compact-label">Ø Jahre</div>
                <div className="kpi-compact-sub">Mitgliedschaft</div>
              </div>
            </div>

            {/* GROSSER WACHSTUMSTREND - Volle Breite */}
            {auswertungsData.wachstumsAnalyse?.vergleichVorjahr && auswertungsData.wachstumsAnalyse?.prognose && (
              <div className="growth-trend-section">
                <div className="growth-header">
                  <h3>📈 Wachstumstrend & Analyse</h3>
                  <div className="growth-period-tabs">
                    <button
                      className={`period-tab ${growthPeriod === 'woche' ? 'active' : ''}`}
                      onClick={() => setGrowthPeriod('woche')}
                    >
                      Woche
                    </button>
                    <button
                      className={`period-tab ${growthPeriod === 'monat' ? 'active' : ''}`}
                      onClick={() => setGrowthPeriod('monat')}
                    >
                      Monat
                    </button>
                    <button
                      className={`period-tab ${growthPeriod === 'quartal' ? 'active' : ''}`}
                      onClick={() => setGrowthPeriod('quartal')}
                    >
                      Quartal
                    </button>
                    <button
                      className={`period-tab ${growthPeriod === 'jahr' ? 'active' : ''}`}
                      onClick={() => setGrowthPeriod('jahr')}
                    >
                      Jahr
                    </button>
                  </div>
                </div>

                {/* Statistik-Karten über dem Chart */}
                <div className="growth-stats-row">
                  <div className="growth-stat-card">
                    <div className="stat-icon">🎯</div>
                    <div className="stat-content">
                      <div className="stat-label">Aktuelles Jahr {auswertungsData.wachstumsAnalyse.vergleichVorjahr.aktuellesJahr}</div>
                      <div className="stat-value">{auswertungsData.wachstumsAnalyse.vergleichVorjahr.neueAktuellesJahr} Neue</div>
                    </div>
                  </div>

                  <div className="growth-stat-card">
                    <div className="stat-icon">📅</div>
                    <div className="stat-content">
                      <div className="stat-label">Vorjahr {auswertungsData.wachstumsAnalyse.vergleichVorjahr.vorjahr}</div>
                      <div className="stat-value">{auswertungsData.wachstumsAnalyse.vergleichVorjahr.neueVorjahr} Neue</div>
                    </div>
                  </div>

                  <div className={`growth-stat-card ${auswertungsData.wachstumsAnalyse.vergleichVorjahr.prozent >= 0 ? 'positive' : 'negative'}`}>
                    <div className="stat-icon">{auswertungsData.wachstumsAnalyse.vergleichVorjahr.prozent >= 0 ? '📈' : '📉'}</div>
                    <div className="stat-content">
                      <div className="stat-label">Vergleich Vorjahr</div>
                      <div className="stat-value">
                        {auswertungsData.wachstumsAnalyse.vergleichVorjahr.prozent > 0 ? '+' : ''}
                        {auswertungsData.wachstumsAnalyse.vergleichVorjahr.prozent}%
                      </div>
                      <div className="stat-sub">
                        {auswertungsData.wachstumsAnalyse.vergleichVorjahr.differenz > 0 ? '+' : ''}
                        {auswertungsData.wachstumsAnalyse.vergleichVorjahr.differenz} Mitglieder
                      </div>
                    </div>
                  </div>

                  <div className="growth-stat-card info">
                    <div className="stat-icon">🔮</div>
                    <div className="stat-content">
                      <div className="stat-label">Prognose {auswertungsData.wachstumsAnalyse.vergleichVorjahr.aktuellesJahr + 1}</div>
                      <div className="stat-value">{auswertungsData.wachstumsAnalyse.prognose.naechstesJahr} Neue</div>
                      <div className="stat-sub">{auswertungsData.wachstumsAnalyse.prognose.basis}</div>
                    </div>
                  </div>
                </div>

                {/* Großer Chart */}
                <div className="growth-chart-container">
                  <ResponsiveContainer width="100%" height={400}>
                    <ComposedChart data={
                      growthPeriod === 'woche' ? (auswertungsData.wachstumsAnalyse.woche || []) :
                      growthPeriod === 'monat' ? (auswertungsData.wachstumsAnalyse.monat || []) :
                      growthPeriod === 'quartal' ? (auswertungsData.wachstumsAnalyse.quartal || []) :
                      (auswertungsData.wachstumsAnalyse.jahr || [])
                    }>
                      <defs>
                        <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ffd700" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#ffd700" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                      <XAxis
                        dataKey={growthPeriod === 'jahr' ? 'jahr' : growthPeriod === 'quartal' ? 'quartal' : growthPeriod === 'monat' ? 'monat' : 'periode'}
                        stroke="rgba(255,255,255,0.6)"
                        angle={growthPeriod === 'woche' || growthPeriod === 'monat' ? -45 : 0}
                        textAnchor={growthPeriod === 'woche' || growthPeriod === 'monat' ? 'end' : 'middle'}
                        height={growthPeriod === 'woche' || growthPeriod === 'monat' ? 80 : 60}
                      />
                      <YAxis stroke="rgba(255,255,255,0.6)" />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(26, 26, 46, 0.95)',
                          border: '1px solid rgba(255, 215, 0, 0.3)',
                          borderRadius: '8px'
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="neueMitglieder"
                        stroke="#ffd700"
                        strokeWidth={3}
                        fill="url(#colorGrowth)"
                        fillOpacity={1}
                      />
                      <Line
                        type="monotone"
                        dataKey="neueMitglieder"
                        stroke="#ff6b35"
                        strokeWidth={2}
                        dot={{ fill: '#ffd700', r: 5 }}
                        activeDot={{ r: 8 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Viele kompakte Charts in kompakter 3-Spalten-Grid */}
            <div className="charts-grid-compact">
              {/* Altersverteilung */}
              <div className="chart-card-compact">
                <h4>👶 Altersverteilung</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={auswertungsData.mitgliederAnalyse.altersgruppen}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({name, value}) => `${value}`}
                      outerRadius={60}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {auswertungsData.mitgliederAnalyse.altersgruppen.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Geschlechterverteilung */}
              <div className="chart-card-compact">
                <h4>⚧ Geschlechterverteilung</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={auswertungsData.mitgliederAnalyse.geschlechterVerteilung}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="geschlecht" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="anzahl" fill="#8884d8">
                      {auswertungsData.mitgliederAnalyse.geschlechterVerteilung.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Eintrittsjahre */}
              <div className="chart-card-compact">
                <h4>📅 Eintrittsjahre</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={auswertungsData.mitgliederAnalyse.eintrittsJahre}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="jahr" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="anzahl" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Stil-Verteilung (Kurse) */}
              <div className="chart-card-compact">
                <h4>🥋 Stil-Verteilung (Kurse)</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={auswertungsData.stilAnalyse.verteilung.filter(s => s.anzahl > 0)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="anzahl" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Graduierungsstatistik */}
              <div className="chart-card-compact">
                <h4>🥇 Top Gurte</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={auswertungsData.mitgliederAnalyse.graduierungsStats} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="gurtfarbe" type="category" width={100} />
                    <Tooltip />
                    <Bar dataKey="anzahl" fill="#ffc658">
                      {auswertungsData.mitgliederAnalyse.graduierungsStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Nächste Geburtstage */}
              <div className="chart-card-compact">
                <h4>🎂 Nächste Geburtstage</h4>
                <div className="birthday-list">
                  {auswertungsData.mitgliederAnalyse.naechsteGeburtstage.length > 0 ? (
                    auswertungsData.mitgliederAnalyse.naechsteGeburtstage.map((gb, index) => (
                      <div key={index} className="birthday-item">
                        <span className="birthday-icon">🎉</span>
                        <div className="birthday-info">
                          <strong>{gb.name}</strong>
                          <span className="birthday-days">
                            {gb.tageVerbleibend === 0 ? 'Heute!' : `in ${gb.tageVerbleibend} Tagen`}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="no-data">Keine Geburtstage in den nächsten 30 Tagen</p>
                  )}
                </div>
              </div>

              {/* Anwesenheit nach Wochentag */}
              <div className="chart-card-compact">
                <h4>📊 Anwesenheit/Wochentag</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={auswertungsData.anwesenheitsStatistik.wochentagsVerteilung}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="tag" angle={-45} textAnchor="end" height={60} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="anzahl" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Spitzenzeiten */}
              <div className="chart-card-compact">
                <h4>⏰ Spitzenzeiten</h4>
                <div className="peak-times-list">
                  {auswertungsData.anwesenheitsStatistik.spitzenzeiten.map((zeit, index) => (
                    <div key={index} className="peak-time-item">
                      <span className="peak-time">{zeit.zeit}</span>
                      <div className="peak-bar">
                        <div
                          className="peak-bar-fill"
                          style={{width: `${(zeit.teilnehmer / 35) * 100}%`}}
                        ></div>
                        <span className="peak-count">{zeit.teilnehmer}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'financial' && (
          <div className="tab-panel">
            {/* Finanzielle Übersicht - Kompakt */}
            <div className="kpi-compact-grid">
              <div className="kpi-compact">
                <div className="kpi-compact-icon">💰</div>
                <div className="kpi-compact-value">{formatCurrency(auswertungsData.finanzielleAuswertung.monatlicheEinnahmen)}</div>
                <div className="kpi-compact-label">Monatliche Einnahmen</div>
                <div className="kpi-compact-sub">{formatCurrency(auswertungsData.finanzielleAuswertung.jahreseinnahmen)}/Jahr</div>
              </div>

              <div className="kpi-compact">
                <div className="kpi-compact-icon">📊</div>
                <div className="kpi-compact-value">{formatCurrency(auswertungsData.finanzielleAuswertung.durchschnittsBeitrag)}</div>
                <div className="kpi-compact-label">Ø Beitrag</div>
                <div className="kpi-compact-sub">Pro Mitglied</div>
              </div>

              <div className="kpi-compact success">
                <div className="kpi-compact-icon">📈</div>
                <div className="kpi-compact-value">{auswertungsData.finanzielleAuswertung.gewinnMarge}%</div>
                <div className="kpi-compact-label">Gewinnmarge</div>
                <div className="kpi-compact-sub">Zahlungsausfall: {auswertungsData.finanzielleAuswertung.zahlungsausfall}%</div>
              </div>

              {auswertungsData.finanzielleAuswertung.tarifVerteilung && (
                <div className="kpi-compact info">
                  <div className="kpi-compact-icon">🎯</div>
                  <div className="kpi-compact-value">{auswertungsData.finanzielleAuswertung.tarifVerteilung.length}</div>
                  <div className="kpi-compact-label">Aktive Tarife</div>
                  <div className="kpi-compact-sub">Mit Mitgliedern</div>
                </div>
              )}
            </div>

            {/* Tarif-Verteilung */}
            {auswertungsData.finanzielleAuswertung.tarifVerteilung && auswertungsData.finanzielleAuswertung.tarifVerteilung.length > 0 && (
              <div className="chart-card-compact">
                <h4>📊 Tarif-Verteilung</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={auswertungsData.finanzielleAuswertung.tarifVerteilung} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis type="number" stroke="rgba(255,255,255,0.6)" />
                    <YAxis dataKey="tarifname" type="category" width={180} stroke="rgba(255,255,255,0.6)" />
                    <Tooltip
                      contentStyle={{ background: 'rgba(26, 26, 46, 0.95)', border: '1px solid rgba(255, 215, 0, 0.3)' }}
                      labelStyle={{ color: '#ffd700' }}
                    />
                    <Bar dataKey="anzahl" fill="#ffd700" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Beitragsvergleich - Optimierungspotential */}
            {beitragsvergleich?.zusammenfassung && beitragsvergleich.zusammenfassung.gesamt > 0 && (
              <div className="chart-card-compact">
                <h4>💡 Beitragsoptimierung</h4>
                <div className="kpi-compact-grid" style={{marginBottom: '20px'}}>
                  <div className="kpi-compact warning">
                    <div className="kpi-compact-icon">👥</div>
                    <div className="kpi-compact-value">{beitragsvergleich.zusammenfassung.gesamt}</div>
                    <div className="kpi-compact-label">Optimierbar</div>
                  </div>
                  <div className="kpi-compact success">
                    <div className="kpi-compact-icon">💰</div>
                    <div className="kpi-compact-value">{formatCurrency(beitragsvergleich.zusammenfassung.potential / 100)}</div>
                    <div className="kpi-compact-label">Monatl. Potential</div>
                  </div>
                  <div className="kpi-compact info">
                    <div className="kpi-compact-icon">📈</div>
                    <div className="kpi-compact-value">{formatCurrency(beitragsvergleich.zusammenfassung.durchschnittlicheErhoehung / 100)}</div>
                    <div className="kpi-compact-label">Ø Erhöhung</div>
                  </div>
                </div>

                {/* Kompakte Mitgliederliste */}
                {beitragsvergleich.niedrigeBeitraege.length > 0 && (
                  <div className="compact-member-list">
                    <table className="data-table-compact">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Aktuell</th>
                          <th>Potential</th>
                          <th>Eintritt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {beitragsvergleich.niedrigeBeitraege.slice(0, 10).map((mitglied, idx) => (
                          <tr key={idx}>
                            <td>
                              <div className="member-name-cell">
                                <span>{mitglied.name}</span>
                                <span className="badge-small">{mitglied.alterskategorie}</span>
                              </div>
                            </td>
                            <td className="align-right">{formatCurrency(mitglied.aktuellerBeitrag / 100)}</td>
                            <td className="align-right positive">+{formatCurrency(mitglied.potentialErhoehung / 100)}</td>
                            <td>{new Date(mitglied.eintrittsdatum).toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit' })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {beitragsvergleich.niedrigeBeitraege.length > 10 && (
                      <div className="table-footer">
                        Zeige 10 von {beitragsvergleich.niedrigeBeitraege.length} Mitgliedern
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <div className="tab-panel">
            {/* Zeitraum-Umschalter */}
            <div className="time-period-selector">
              <h3>📊 Zeitraum-Auswahl</h3>
              <div className="period-buttons">
                {timePeriods.map(period => (
                  <button
                    key={period.id}
                    className={`period-button ${timePeriod === period.id ? 'active' : ''}`}
                    onClick={() => setTimePeriod(period.id)}
                  >
                    <span className="period-icon">{period.icon}</span>
                    <span className="period-label">{period.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Kompakte Mitglieder-Statistiken */}
            <div className="members-stats-compact">
              <div className="stat-item-compact">
                <div className="stat-label">Gesamtmitglieder</div>
                <div className="stat-value">{formatNumber(auswertungsData.mitgliederAnalyse.gesamt)}</div>
              </div>
              <div className="stat-item-compact">
                <div className="stat-label">Aktive Mitglieder</div>
                <div className="stat-value">{formatNumber(auswertungsData.mitgliederAnalyse.aktiv)}</div>
              </div>
              <div className="stat-item-compact">
                <div className="stat-label">Neue {timePeriod === 'monthly' ? 'diesen Monat' : timePeriod === 'quarterly' ? 'dieses Quartal' : timePeriod === 'biannually' ? 'dieses Halbjahr' : 'dieses Jahr'}</div>
                <div className="stat-value">{formatNumber(auswertungsData.mitgliederAnalyse.neueThisMonth)}</div>
              </div>
              <div className="stat-item-compact">
                <div className="stat-label">Inaktive Mitglieder</div>
                <div className="stat-value">{formatNumber(auswertungsData.mitgliederAnalyse.inaktiv)}</div>
              </div>
            </div>

            {/* Mitglieder-Entwicklung Charts */}
            {memberAnalytics && (
              <div className="member-analytics-grid">
                <div className="analytics-chart">
                  <h3>📈 {timePeriod === 'monthly' ? 'Monatliche' : timePeriod === 'quarterly' ? 'Vierteljährliche' : timePeriod === 'biannually' ? 'Halbjährliche' : 'Jährliche'} Zugänge</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    {memberAnalytics.zugänge.length > 0 ? (
                      <LineChart data={memberAnalytics.zugänge}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="periode" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="wert" stroke="#4caf50" strokeWidth={3} dot={{ fill: '#4caf50', strokeWidth: 2, r: 4 }} />
                      </LineChart>
                    ) : (
                      <div className="no-data-message">
                        <p>Keine Zugangsdaten verfügbar</p>
                      </div>
                    )}
                  </ResponsiveContainer>
                </div>

                <div className="analytics-chart">
                  <h3>📉 Kündigungen</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    {memberAnalytics.kündigungen.length > 0 ? (
                      <LineChart data={memberAnalytics.kündigungen}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="periode" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="wert" stroke="#f44336" strokeWidth={3} dot={{ fill: '#f44336', strokeWidth: 2, r: 4 }} />
                      </LineChart>
                    ) : (
                      <div className="no-data-message">
                        <p>Keine Kündigungsdaten verfügbar</p>
                      </div>
                    )}
                  </ResponsiveContainer>
                </div>

                <div className="analytics-chart">
                  <h3>⏸️ Ruhepausen</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    {memberAnalytics.ruhepausen.length > 0 ? (
                      <LineChart data={memberAnalytics.ruhepausen}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="periode" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="wert" stroke="#ff9800" strokeWidth={3} dot={{ fill: '#ff9800', strokeWidth: 2, r: 4 }} />
                      </LineChart>
                    ) : (
                      <div className="no-data-message">
                        <p>Keine Ruhepausen-Daten verfügbar</p>
                      </div>
                    )}
                  </ResponsiveContainer>
                </div>

                <div className="analytics-chart">
                  <h3>🔮 Wachstumsprognose</h3>
                  <div className="growth-forecast">
                    <div className="forecast-current">
                      <span className="forecast-label">Aktuell:</span>
                      <span className="forecast-value">{memberAnalytics.wachstumPrognose.aktuell} Mitglieder</span>
                    </div>
                    <div className="forecast-item">
                      <span className="forecast-label">3 Monate:</span>
                      <span className="forecast-value positive">+{memberAnalytics.wachstumPrognose.prognose3Monate - memberAnalytics.wachstumPrognose.aktuell}</span>
                    </div>
                    <div className="forecast-item">
                      <span className="forecast-label">6 Monate:</span>
                      <span className="forecast-value positive">+{memberAnalytics.wachstumPrognose.prognose6Monate - memberAnalytics.wachstumPrognose.aktuell}</span>
                    </div>
                    <div className="forecast-item">
                      <span className="forecast-label">12 Monate:</span>
                      <span className="forecast-value positive">+{memberAnalytics.wachstumPrognose.prognose12Monate - memberAnalytics.wachstumPrognose.aktuell}</span>
                    </div>
                    <div className="forecast-growth-rate">
                      <span className="growth-rate-label">Wachstumsrate:</span>
                      <span className="growth-rate-value">{memberAnalytics.wachstumPrognose.wachstumsrate}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="demographics-chart-compact">
              <h3>Demografische Verteilung</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={auswertungsData.mitgliederAnalyse.demographics}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({geschlecht, prozent}) => `${geschlecht}: ${prozent}%`}
                    outerRadius={60}
                    fill="#8884d8"
                    dataKey="anzahl"
                  >
                    {auswertungsData.mitgliederAnalyse.demographics.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'belts' && beltsData && (
          <div className="tab-panel">
            <div className="belts-overview-header">
              <h2>🥋 Gürtel-Übersicht</h2>
              <div className="summary-stats">
                <div className="summary-stat">
                  <span className="stat-label">Stile:</span>
                  <span className="stat-value">{beltsData.summary.total_stile}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">Gürtel:</span>
                  <span className="stat-value">{beltsData.summary.total_guertel}</span>
                </div>
                <div className="summary-stat">
                  <span className="stat-label">Mitglieder:</span>
                  <span className="stat-value">{beltsData.summary.total_mitglieder}</span>
                </div>
              </div>
            </div>

            {beltsData.stile.map((stil) => (
              <div key={stil.stil_id} className="stil-section">
                <div className="stil-header">
                  <h3>{stil.stil_name}</h3>
                  <span className="stil-stats">
                    {stil.guertel.length} Gürtel • {stil.guertel.reduce((sum, g) => sum + g.mitglieder.length, 0)} Mitglieder
                  </span>
                </div>

                <div className="guertel-grid">
                  {stil.guertel.map((guertel) => (
                    <div key={guertel.graduierung_id} className="guertel-card">
                      <div className="guertel-header">
                        <div
                          className="guertel-color-badge"
                          style={{
                            background: guertel.farbe_sekundaer
                              ? `linear-gradient(135deg, ${guertel.farbe_hex}, ${guertel.farbe_sekundaer})`
                              : guertel.farbe_hex
                          }}
                        />
                        <div className="guertel-info">
                          <h4>{guertel.gurt_name}</h4>
                          <span className="guertel-category">{guertel.kategorie}</span>
                          {guertel.dan_grad && <span className="dan-badge">{guertel.dan_grad}. DAN</span>}
                        </div>
                        <span className="member-count">{guertel.mitglieder.length} Mitglieder</span>
                      </div>

                      {guertel.mitglieder.length > 0 && (
                        <div className="members-list">
                          <div className="members-header">
                            <span>Name</span>
                            <span>Anwesenheit Jahr</span>
                            <span>Anwesenheit Monat</span>
                          </div>
                          {guertel.mitglieder.map((member) => (
                            <div key={member.mitglied_id} className="member-row">
                              <span className="member-name">
                                {member.vorname} {member.nachname}
                              </span>
                              <span className="attendance-stat">{member.anwesenheit_jahr}x</span>
                              <span className="attendance-stat">{member.anwesenheit_monat}x</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {guertel.mitglieder.length === 0 && (
                        <div className="no-members">
                          <p>Keine Mitglieder</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="tab-panel">
            <div className="performance-metrics">
              <div className="metric-card">
                <div className="metric-header">
                  <h3>Anwesenheitsstatistik</h3>
                </div>
                <div className="metric-content">
                  <div className="metric-value">{auswertungsData.anwesenheitsStatistik.durchschnittlicheAnwesenheit}%</div>
                  <p>Durchschnittliche Anwesenheit</p>
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-header">
                  <h3>Kurslast</h3>
                </div>
                <div className="metric-content">
                  <div className="metric-value">{auswertungsData.kursAnalyse.durchschnittlicheTeilnehmer}</div>
                  <p>Teilnehmer pro Kurs</p>
                </div>
              </div>
            </div>

            <div className="performance-charts">
              <div className="chart-card">
                <h3>Wochentag-Anwesenheit</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={auswertungsData.anwesenheitsStatistik.wochentagsVerteilung}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="tag" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="prozent" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-card">
                <h3>Spitzenzeiten</h3>
                <div className="peak-times">
                  {auswertungsData.anwesenheitsStatistik.spitzenzeiten.map((zeit, index) => (
                    <div key={index} className="time-slot">
                      <span className="time">{zeit.zeit}</span>
                      <span className="attendance">{zeit.teilnehmer} Teilnehmer</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'forecasting' && (
          <div className="tab-panel">
            <div className="forecast-overview">
              <h3>Wachstumsprognose</h3>
              <div className="forecast-stats">
                <div className="forecast-item">
                  <div className="forecast-label">Nächster Monat</div>
                  <div className="forecast-value">+{auswertungsData.wachstumsAnalyse.prognose.naechsterMonat} Mitglieder</div>
                </div>

                <div className="forecast-item">
                  <div className="forecast-label">Nächstes Quartal</div>
                  <div className="forecast-value">+{auswertungsData.wachstumsAnalyse.prognose.naechstesQuartal} Mitglieder</div>
                </div>

                <div className="forecast-item">
                  <div className="forecast-label">Nächstes Jahr</div>
                  <div className="forecast-value">+{auswertungsData.wachstumsAnalyse.prognose.naechstesJahr} Mitglieder</div>
                </div>
              </div>

              <div className="recommendations">
                <h3>Empfehlungen</h3>
                <div className="recommendations-list">
                  {auswertungsData.recommendations.map((recommendation, index) => (
                    <div key={index} className={`recommendation-item ${recommendation.typ}`}>
                      <span className="recommendation-icon">
                        {recommendation.typ === 'success' ? '✅' :
                         recommendation.typ === 'warning' ? '⚠️' :
                         recommendation.typ === 'info' ? 'ℹ️' : '💡'}
                      </span>
                      <div className="recommendation-content">
                        <strong>{recommendation.title}</strong>
                        <p>{recommendation.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Auswertungen;