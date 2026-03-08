// Frontend/src/components/Auswertungen.jsx - Saubere Version für Backend-Datenstruktur
import React, { useState, useEffect, useMemo, useContext, useRef } from 'react';
import { useDojoContext } from '../context/DojoContext';
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
  ComposedChart,
  ReferenceLine
} from 'recharts';
import axios from 'axios';
import '../styles/Auswertungen.css';
import '../styles/Auswertungen-BreakEven.css';
import '../styles/Auswertungen-Overview.css';
import '../styles/Auswertungen-Finanzen.css';
import '../styles/Auswertungen-Performance.css';
import '../styles/Auswertungen-Prognosen.css';

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
  const [formResetKey, setFormResetKey] = useState(0);
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

  const { activeDojo } = useDojoContext();
  const activeDojoId = activeDojo && activeDojo !== 'super-admin' && activeDojo !== 'verband'
    ? activeDojo.id
    : null;
  const dojoParam = activeDojoId ? `?dojo_id=${activeDojoId}` : '';

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  useEffect(() => {
    loadAuswertungen();
    loadKostenvorlagen();
    loadMemberAnalytics();
    loadBeitragsvergleich();
    loadBeltsData();
  }, [timePeriod, activeDojoId]);

  const loadAuswertungen = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/auswertungen/complete${dojoParam}`);
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
            setFormResetKey(k => k + 1);
          } else {
            // Keine gespeicherte Berechnung - alle Kosten auf 0 setzen
            setBreakEvenForm({
              fixkosten: Object.keys(result.data.fixkosten).reduce((acc, key) => ({ ...acc, [key]: 0 }), {}),
              variableKosten: Object.keys(result.data.variableKosten).reduce((acc, key) => ({ ...acc, [key]: 0 }), {}),
              durchschnittsbeitrag: result.data.durchschnittsbeitrag
            });
            setFormResetKey(k => k + 1);
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

  const debouncedSave = useRef(null);

  const scheduleAutoSave = (newForm) => {
    if (debouncedSave.current) clearTimeout(debouncedSave.current);
    debouncedSave.current = setTimeout(() => calculateBreakEven(newForm), 700);
  };

  const calculateBreakEven = async (formData) => {
    const data = formData || breakEvenForm;
    try {
      const response = await axios.post('/auswertungen/break-even', data);
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
    setBreakEvenForm(prev => {
      const newForm = { ...prev, fixkosten: { ...prev.fixkosten, [key]: Number(value) || 0 } };
      scheduleAutoSave(newForm);
      return newForm;
    });
  };

  const updateVariableKosten = (key, value) => {
    setBreakEvenForm(prev => {
      const newForm = { ...prev, variableKosten: { ...prev.variableKosten, [key]: parseFloat(value) || 0 } };
      scheduleAutoSave(newForm);
      return newForm;
    });
  };

  const loadMemberAnalytics = async () => {
    try {
      const sep = dojoParam ? '&' : '?';
      const response = await axios.get(`/auswertungen/member-analytics${dojoParam}${sep}period=${timePeriod}`);
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
      const response = await axios.get(`/auswertungen/beitragsvergleich${dojoParam}`);
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


  // Label-Maps für leserliche Beschriftungen
  const fixkostenLabels = {
    miete: 'Miete / Pacht', versicherung: 'Versicherung', strom: 'Strom',
    wasser: 'Wasser', gas: 'Gas / Heizung', internet: 'Internet',
    hausmeister: 'Hausmeister', wartung: 'Instandhaltung', verwaltung: 'Verwaltung'
  };
  const variableKostenLabels = {
    zahlungsabwicklung: 'Zahlungsabwicklung', verwaltung: 'Verwaltungsaufwand',
    material: 'Verbrauchsmaterial', sonstiges: 'Sonstiges'
  };

  // Live Break-Even-Berechnung (kein API-Call nötig)
  const breakEvenCalc = useMemo(() => {
    if (!kostenvorlagen) return null;
    const gesamtFixkosten = Object.values(breakEvenForm.fixkosten).reduce((s, v) => s + (Number(v) || 0), 0);
    const variableKostenProMitglied = Object.values(breakEvenForm.variableKosten).reduce((s, v) => s + (Number(v) || 0), 0);
    const beitrag = breakEvenForm.durchschnittsbeitrag || 0;
    const deckungsbeitrag = beitrag - variableKostenProMitglied;
    if (deckungsbeitrag <= 0 || gesamtFixkosten <= 0) return null;

    const bep = Math.ceil(gesamtFixkosten / deckungsbeitrag);
    const breakEvenUmsatz = bep * beitrag;
    const gesamtKosten = (n) => gesamtFixkosten + variableKostenProMitglied * n;
    const n1 = Math.ceil(bep * 1.2), n2 = Math.ceil(bep * 1.5), n3 = Math.ceil(bep * 2);

    // Chart-Daten: Kosten- vs. Umsatzlinie
    const maxN = Math.max(n3 + 5, 30);
    const chartData = Array.from({ length: 31 }, (_, i) => {
      const n = Math.round((i / 30) * maxN);
      return { mitglieder: n, kosten: Math.round(gesamtKosten(n)), umsatz: Math.round(n * beitrag) };
    });

    return {
      bep, gesamtFixkosten, variableKostenProMitglied, deckungsbeitrag,
      breakEvenUmsatz, chartData,
      szenarien: [
        { name: 'Konservativ', mitglieder: n1, umsatz: n1 * beitrag, gewinn: n1 * beitrag - gesamtKosten(n1), beschreibung: '+20% Sicherheit' },
        { name: 'Optimal',     mitglieder: n2, umsatz: n2 * beitrag, gewinn: n2 * beitrag - gesamtKosten(n2), beschreibung: '+50% über BEP' },
        { name: 'Wachstum',    mitglieder: n3, umsatz: n3 * beitrag, gewinn: n3 * beitrag - gesamtKosten(n3), beschreibung: '2× Mitglieder' },
      ],
      empfehlungen: [
        {
          typ: bep < 80 ? 'success' : 'warning',
          titel: `Break-Even bei ${bep} Mitgliedern`,
          beschreibung: bep < 80
            ? `Gut erreichbar. Mit 20% Puffer brauchen Sie ${n1} Mitglieder.`
            : 'Hoher Break-Even. Prüfen Sie Fixkosten oder erhöhen Sie den Mitgliedsbeitrag.'
        },
        {
          typ: 'info',
          titel: 'Deckungsbeitrag',
          beschreibung: `Jedes Mitglied trägt ${deckungsbeitrag.toFixed(2)}€ zur Fixkostendeckung bei (${beitrag}€ Beitrag − ${variableKostenProMitglied.toFixed(2)}€ variable Kosten).`
        },
        {
          typ: 'info',
          titel: 'Formel',
          beschreibung: `BEP = ${gesamtFixkosten.toLocaleString('de-DE')}€ ÷ ${deckungsbeitrag.toFixed(2)}€ = ${bep} Mitglieder`
        }
      ]
    };
  }, [breakEvenForm, kostenvorlagen]);

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
            <div className="be-wrapper">

              {/* ── Header ── */}
              <div className="be-page-header">
                <div className="be-page-header-left">
                  <h2>🧮 Break-Even-Analyse</h2>
                  <p>BEP = Fixkosten / (Ø-Beitrag − variable Kosten pro Mitglied)</p>
                </div>
                {breakEvenCalc && (
                  <div className="be-hero-kpi">
                    <span className="be-hero-value">{breakEvenCalc.bep}</span>
                    <span className="be-hero-label">Mitglieder zum Break-Even</span>
                  </div>
                )}
              </div>

              {/* ── Zwei Spalten ── */}
              <div className="be-columns">

                {/* Linke Spalte: Eingaben */}
                <div className="be-left">

                  {/* Fixkosten */}
                  <div className="be-section">
                    <div className="be-section-title">
                      <span className="be-section-title-label">💰 Fixkosten / Monat</span>
                      {breakEvenCalc && (
                        <span className="be-section-total">{formatCurrency(breakEvenCalc.gesamtFixkosten)}</span>
                      )}
                    </div>
                    {kostenvorlagen && Object.entries(kostenvorlagen.fixkosten).map(([key, defaultVal]) => (
                      <div key={key} className="be-row">
                        <label>{fixkostenLabels[key] || key}</label>
                        <div className="be-field">
                          <input
                            key={`fk-${key}-${formResetKey}`}
                            type="number"
                            defaultValue={breakEvenForm.fixkosten[key] ?? defaultVal}
                            onBlur={(e) => updateFixkosten(key, e.target.value)}
                            min="0"
                            step="0.01"
                          />
                          <span className="be-field-unit">€</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Variable Kosten */}
                  <div className="be-section">
                    <div className="be-section-title">
                      <span className="be-section-title-label">📊 Variable Kosten / Mitglied</span>
                      {breakEvenCalc && (
                        <span className="be-section-total">{formatCurrency(breakEvenCalc.variableKostenProMitglied)}</span>
                      )}
                    </div>
                    {kostenvorlagen && Object.entries(kostenvorlagen.variableKosten).map(([key, defaultVal]) => (
                      <div key={key} className="be-row">
                        <label>{variableKostenLabels[key] || key}</label>
                        <div className="be-field">
                          <input
                            key={`vk-${key}-${formResetKey}`}
                            type="number"
                            defaultValue={breakEvenForm.variableKosten[key] ?? defaultVal}
                            onBlur={(e) => updateVariableKosten(key, e.target.value)}
                            min="0"
                            step="0.01"
                          />
                          <span className="be-field-unit">€</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Ø-Beitrag */}
                  <div className="be-section">
                    <div className="be-section-title">
                      <span className="be-section-title-label">💵 Ø-Mitgliedsbeitrag</span>
                      {breakEvenCalc && (
                        <span className="be-section-total">DB: {formatCurrency(breakEvenCalc.deckungsbeitrag)}/Mitgl.</span>
                      )}
                    </div>
                    <div className="be-row be-beitrag-row">
                      <label>pro Mitglied / Monat</label>
                      <div className="be-field">
                        <input
                          key={`db-${formResetKey}`}
                          type="number"
                          defaultValue={breakEvenForm.durchschnittsbeitrag}
                          onBlur={(e) => setBreakEvenForm(prev => {
                            const newForm = { ...prev, durchschnittsbeitrag: Number(e.target.value) || 0 };
                            scheduleAutoSave(newForm);
                            return newForm;
                          })}
                          min="0"
                          step="0.01"
                        />
                        <span className="be-field-unit">€</span>
                      </div>
                    </div>
                  </div>

                  {/* Speichern */}
                  <button className="be-save-btn" onClick={calculateBreakEven}>
                    💾 Analyse speichern
                  </button>

                </div>

                {/* Rechte Spalte: Ergebnisse */}
                <div className="be-right">
                  {breakEvenCalc ? (
                    <>
                      {/* KPI-Dreierleiste */}
                      <div className="be-kpi-row">
                        <div className="be-kpi be-kpi--main">
                          <span className="be-kpi-icon">🎯</span>
                          <span className="be-kpi-value">{breakEvenCalc.bep}</span>
                          <span className="be-kpi-label">BEP Mitglieder</span>
                        </div>
                        <div className="be-kpi">
                          <span className="be-kpi-icon">💰</span>
                          <span className="be-kpi-value">{formatCurrency(breakEvenCalc.breakEvenUmsatz)}</span>
                          <span className="be-kpi-label">Umsatz nötig / Monat</span>
                        </div>
                        <div className="be-kpi">
                          <span className="be-kpi-icon">📊</span>
                          <span className="be-kpi-value">{formatCurrency(breakEvenCalc.deckungsbeitrag)}</span>
                          <span className="be-kpi-label">Deckungsbeitrag / Mitgl.</span>
                        </div>
                      </div>

                      {/* Kosten vs. Umsatz Chart */}
                      <div className="be-chart-card">
                        <div className="be-chart-header">
                          <h4>Kosten vs. Umsatz</h4>
                          <div className="be-chart-legend">
                            <span className="be-legend-item">
                              <span className="be-legend-dot be-legend-dot--kosten" />
                              Gesamtkosten
                            </span>
                            <span className="be-legend-item">
                              <span className="be-legend-dot be-legend-dot--umsatz" />
                              Umsatz
                            </span>
                          </div>
                        </div>
                        <ResponsiveContainer width="100%" height={210}>
                          <LineChart data={breakEvenCalc.chartData} margin={{ top: 5, right: 10, bottom: 20, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis
                              dataKey="mitglieder"
                              stroke="rgba(255,255,255,0.3)"
                              tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
                              label={{ value: 'Mitglieder', position: 'insideBottom', offset: -10, style: { fill: 'rgba(255,255,255,0.35)', fontSize: 10 } }}
                            />
                            <YAxis
                              stroke="rgba(255,255,255,0.3)"
                              tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
                              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                            />
                            <Tooltip
                              formatter={(v, name) => [formatCurrency(v), name === 'kosten' ? 'Kosten' : 'Umsatz']}
                              labelFormatter={(l) => `${l} Mitglieder`}
                              contentStyle={{ background: 'rgba(15,15,30,0.97)', border: '1px solid rgba(255,215,0,0.25)', borderRadius: 8, fontSize: 12 }}
                            />
                            <ReferenceLine
                              x={breakEvenCalc.bep}
                              stroke="rgba(255,215,0,0.6)"
                              strokeDasharray="5 3"
                              label={{ value: `BEP`, position: 'top', style: { fill: '#ffd700', fontSize: 11, fontWeight: 700 } }}
                            />
                            <Line type="monotone" dataKey="kosten" stroke="#ef4444" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="umsatz" stroke="#10b981" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Szenarien */}
                      <div className="be-scenarios-card">
                        <h4 className="be-scenarios-title">Szenarien</h4>
                        <div className="be-scenario-grid">
                          {breakEvenCalc.szenarien.map((s, i) => (
                            <div key={i} className={`be-scenario ${s.gewinn >= 0 ? 'be-scenario--profit' : 'be-scenario--loss'}`}>
                              <div className="be-scenario-name">{s.name}</div>
                              <div className="be-scenario-members">{s.mitglieder}</div>
                              <div className="be-scenario-members-label">Mitglieder</div>
                              <div className={`be-scenario-profit ${s.gewinn >= 0 ? 'positive' : 'negative'}`}>
                                {s.gewinn >= 0 ? '+' : ''}{formatCurrency(s.gewinn)}
                              </div>
                              <div className="be-scenario-desc">{s.beschreibung}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="be-invalid">
                      ⚠️ Bitte gültige Werte eingeben: Deckungsbeitrag muss &gt; 0 sein.
                    </div>
                  )}
                </div>
              </div>

              {/* ── Ist-Zustand Vergleich ── */}
              {breakEvenCalc && auswertungsData && (() => {
                const istMitglieder = auswertungsData.summary.activeMembers;
                const istUmsatz = auswertungsData.summary.monthlyRevenue;
                const istGesamtkosten = breakEvenCalc.gesamtFixkosten + breakEvenCalc.variableKostenProMitglied * istMitglieder;
                const istErgebnis = istUmsatz - istGesamtkosten;
                const auslastung = Math.round((istMitglieder / breakEvenCalc.bep) * 100);
                const mitgliederDelta = istMitglieder - breakEvenCalc.bep;
                const umsatzDelta = istUmsatz - breakEvenCalc.breakEvenUmsatz;
                const isProfit = istErgebnis >= 0;
                return (
                  <div className="be-ist-card">
                    <div className="be-ist-header">
                      <span className="be-ist-title">📍 Ist-Zustand vs. Break-Even</span>
                      <span className={`be-ist-badge ${isProfit ? 'be-ist-badge--green' : 'be-ist-badge--red'}`}>
                        {isProfit ? '✓ Im Gewinn' : '⚠ Im Verlust'}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="be-ist-progress">
                      <div className="be-ist-bar-bg">
                        <div
                          className={`be-ist-bar-fill ${auslastung >= 100 ? 'be-ist-bar-fill--over' : ''}`}
                          style={{ width: `${Math.min(auslastung, 100)}%` }}
                        />
                      </div>
                      <div className="be-ist-bar-meta">
                        <span className="be-ist-bar-pct">{auslastung}%</span>
                        <span className="be-ist-bar-text">
                          {auslastung >= 100
                            ? `${mitgliederDelta} Mitglieder über dem Break-Even`
                            : `Noch ${Math.abs(mitgliederDelta)} Mitglieder bis zum Break-Even`}
                        </span>
                        <span className="be-ist-bar-bep">BEP: {breakEvenCalc.bep}</span>
                      </div>
                    </div>

                    {/* 4 Vergleichs-KPIs */}
                    <div className="be-ist-kpis">
                      <div className="be-ist-kpi">
                        <div className="be-ist-kpi-label">Aktive Mitglieder</div>
                        <div className="be-ist-kpi-ist">{istMitglieder}</div>
                        <div className="be-ist-kpi-vs">BEP {breakEvenCalc.bep}</div>
                        <div className={`be-ist-kpi-delta ${mitgliederDelta >= 0 ? 'be-ist-delta--pos' : 'be-ist-delta--neg'}`}>
                          {mitgliederDelta >= 0 ? '+' : ''}{mitgliederDelta}
                        </div>
                      </div>
                      <div className="be-ist-kpi">
                        <div className="be-ist-kpi-label">Monatsumsatz</div>
                        <div className="be-ist-kpi-ist">{formatCurrency(istUmsatz)}</div>
                        <div className="be-ist-kpi-vs">BEP {formatCurrency(breakEvenCalc.breakEvenUmsatz)}</div>
                        <div className={`be-ist-kpi-delta ${umsatzDelta >= 0 ? 'be-ist-delta--pos' : 'be-ist-delta--neg'}`}>
                          {umsatzDelta >= 0 ? '+' : ''}{formatCurrency(umsatzDelta)}
                        </div>
                      </div>
                      <div className="be-ist-kpi">
                        <div className="be-ist-kpi-label">Monatl. Gesamtkosten</div>
                        <div className="be-ist-kpi-ist">{formatCurrency(istGesamtkosten)}</div>
                        <div className="be-ist-kpi-vs">Fix {formatCurrency(breakEvenCalc.gesamtFixkosten)}</div>
                        <div className="be-ist-kpi-delta be-ist-delta--neutral">
                          +{formatCurrency(breakEvenCalc.variableKostenProMitglied * istMitglieder)} variabel
                        </div>
                      </div>
                      <div className={`be-ist-kpi ${isProfit ? 'be-ist-kpi--profit' : 'be-ist-kpi--loss'}`}>
                        <div className="be-ist-kpi-label">Monatl. Ergebnis</div>
                        <div className={`be-ist-kpi-ist ${isProfit ? 'be-ist-delta--pos' : 'be-ist-delta--neg'}`}>
                          {isProfit ? '+' : ''}{formatCurrency(istErgebnis)}
                        </div>
                        <div className="be-ist-kpi-vs">Umsatz − Kosten</div>
                        <div className={`be-ist-kpi-delta ${isProfit ? 'be-ist-delta--pos' : 'be-ist-delta--neg'}`}>
                          {isProfit ? 'Gewinn' : 'Verlust'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── Empfehlungen (volle Breite) ── */}
              {breakEvenCalc && (
                <div className="be-tips">
                  {breakEvenCalc.empfehlungen.map((e, i) => (
                    <div key={i} className={`be-tip be-tip--${e.typ}`}>
                      <div className="be-tip-icon">
                        {e.typ === 'success' ? '✓' : e.typ === 'warning' ? '⚠' : 'ℹ'}
                      </div>
                      <div className="be-tip-content">
                        <strong>{e.titel}</strong>
                        <p>{e.beschreibung}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>
        )}

        {activeTab === 'overview' && (() => {
          const ov = auswertungsData;
          const s = ov.summary;
          const ma = ov.mitgliederAnalyse;
          const wa = ov.wachstumsAnalyse;
          const fin = ov.finanzielleAuswertung;
          const anw = ov.anwesenheitsStatistik;
          const aktivQuote = s.totalMembers > 0 ? Math.round((s.activeMembers / s.totalMembers) * 100) : 0;
          const inaktivQuote = 100 - aktivQuote;
          const chartData = growthPeriod === 'woche' ? (wa?.woche || []) :
                            growthPeriod === 'monat' ? (wa?.monat || []) :
                            growthPeriod === 'quartal' ? (wa?.quartal || []) :
                            (wa?.jahr || []);
          const xKey = growthPeriod === 'jahr' ? 'jahr' : growthPeriod === 'quartal' ? 'quartal' : growthPeriod === 'monat' ? 'monat' : 'periode';
          const rotateTick = growthPeriod === 'woche' || growthPeriod === 'monat';
          const tooltipStyle = { background: 'rgba(10,10,25,0.97)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 8, fontSize: 12 };
          const PIE_COLORS = ['#ffd700','#10b981','#63b3ed','#f59e0b','#8b5cf6','#ec4899','#06b6d4'];
          const maxPeak = anw?.spitzenzeiten?.length ? Math.max(...anw.spitzenzeiten.map(z => z.teilnehmer)) : 1;

          return (
            <div className="ov-wrapper">

              {/* ── 8 KPI Cards ── */}
              <div className="ov-kpi-row">
                <div className="ov-kpi">
                  <div className="ov-kpi-label">Mitglieder gesamt</div>
                  <div className="ov-kpi-value">{formatNumber(s.totalMembers)}</div>
                  <div className="ov-kpi-sub">+{ma.neueThisMonth} diesen Monat</div>
                  <div className="ov-kpi-bar"><div className="ov-kpi-bar-fill ov-kpi-bar-fill--gold" /></div>
                </div>
                <div className="ov-kpi">
                  <div className="ov-kpi-label">Aktive Mitglieder</div>
                  <div className="ov-kpi-value ov-kpi-value--green">{formatNumber(s.activeMembers)}</div>
                  <div className="ov-kpi-sub">{aktivQuote}% Aktivquote</div>
                  <div className="ov-kpi-bar"><div className="ov-kpi-bar-fill ov-kpi-bar-fill--green" style={{ width: `${aktivQuote}%` }} /></div>
                </div>
                <div className="ov-kpi">
                  <div className="ov-kpi-label">Inaktive Mitglieder</div>
                  <div className="ov-kpi-value ov-kpi-value--red">{formatNumber(s.inactiveMembers)}</div>
                  <div className="ov-kpi-sub">{inaktivQuote}% inaktiv</div>
                  <div className="ov-kpi-bar"><div className="ov-kpi-bar-fill ov-kpi-bar-fill--red" style={{ width: `${inaktivQuote}%` }} /></div>
                </div>
                <div className="ov-kpi">
                  <div className="ov-kpi-label">Wachstumsrate</div>
                  <div className={`ov-kpi-value ${s.growthRate >= 0 ? 'ov-kpi-value--green' : 'ov-kpi-value--red'}`}>
                    {s.growthRate > 0 ? '+' : ''}{s.growthRate}%
                  </div>
                  <div className="ov-kpi-sub">Trend</div>
                </div>
                <div className="ov-kpi">
                  <div className="ov-kpi-label">Monatl. Einnahmen</div>
                  <div className="ov-kpi-value ov-kpi-value--gold">{formatCurrency(s.monthlyRevenue)}</div>
                  <div className="ov-kpi-sub">{formatCurrency(s.yearlyRevenue)} / Jahr</div>
                </div>
                <div className="ov-kpi">
                  <div className="ov-kpi-label">Ø Mitgliedsbeitrag</div>
                  <div className="ov-kpi-value">{formatCurrency(fin.durchschnittsBeitrag)}</div>
                  <div className="ov-kpi-sub">pro Mitglied / Monat</div>
                </div>
                <div className="ov-kpi">
                  <div className="ov-kpi-label">Retention Rate</div>
                  <div className="ov-kpi-value ov-kpi-value--blue">{s.retentionRate}%</div>
                  <div className="ov-kpi-sub">länger als 1 Jahr</div>
                  <div className="ov-kpi-bar"><div className="ov-kpi-bar-fill ov-kpi-bar-fill--blue" style={{ width: `${s.retentionRate}%` }} /></div>
                </div>
                <div className="ov-kpi">
                  <div className="ov-kpi-label">Ø Mitgliedschaft</div>
                  <div className="ov-kpi-value">{s.averageMembershipDuration}</div>
                  <div className="ov-kpi-sub">Jahre</div>
                </div>
              </div>

              {/* ── Wachstumstrend ── */}
              {wa?.vergleichVorjahr && wa?.prognose && (
                <div className="ov-growth">
                  <div className="ov-growth-header">
                    <span className="ov-growth-title">Wachstumstrend</span>
                    <div className="ov-period-tabs">
                      {[['woche','Woche'],['monat','Monat'],['quartal','Quartal'],['jahr','Jahr']].map(([id, label]) => (
                        <button key={id} className={`ov-period-btn ${growthPeriod === id ? 'active' : ''}`} onClick={() => setGrowthPeriod(id)}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="ov-growth-stats">
                    <div className="ov-stat">
                      <div className="ov-stat-label">Aktuelles Jahr {wa.vergleichVorjahr.aktuellesJahr}</div>
                      <div className="ov-stat-value">{wa.vergleichVorjahr.neueAktuellesJahr}</div>
                      <div className="ov-stat-sub">Neue Mitglieder</div>
                    </div>
                    <div className="ov-stat">
                      <div className="ov-stat-label">Vorjahr {wa.vergleichVorjahr.vorjahr}</div>
                      <div className="ov-stat-value">{wa.vergleichVorjahr.neueVorjahr}</div>
                      <div className="ov-stat-sub">Neue Mitglieder</div>
                    </div>
                    <div className={`ov-stat ${wa.vergleichVorjahr.prozent >= 0 ? 'ov-stat--pos' : 'ov-stat--neg'}`}>
                      <div className="ov-stat-label">Vorjahresvergleich</div>
                      <div className={`ov-stat-value ${wa.vergleichVorjahr.prozent >= 0 ? 'ov-stat-value--pos' : 'ov-stat-value--neg'}`}>
                        {wa.vergleichVorjahr.prozent > 0 ? '+' : ''}{wa.vergleichVorjahr.prozent}%
                      </div>
                      <div className="ov-stat-sub">
                        {wa.vergleichVorjahr.differenz > 0 ? '+' : ''}{wa.vergleichVorjahr.differenz} Mitglieder
                      </div>
                    </div>
                    <div className="ov-stat">
                      <div className="ov-stat-label">Prognose {wa.vergleichVorjahr.aktuellesJahr + 1}</div>
                      <div className="ov-stat-value">{wa.prognose.naechstesJahr}</div>
                      <div className="ov-stat-sub">{wa.prognose.basis}</div>
                    </div>
                  </div>

                  <div className="ov-growth-chart">
                    <ResponsiveContainer width="100%" height={280}>
                      <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: rotateTick ? 60 : 10, left: 0 }}>
                        <defs>
                          <linearGradient id="ovGrowth" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ffd700" stopOpacity={0.5}/>
                            <stop offset="95%" stopColor="#ffd700" stopOpacity={0.03}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey={xKey} stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }}
                          angle={rotateTick ? -40 : 0} textAnchor={rotateTick ? 'end' : 'middle'} />
                        <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Area type="monotone" dataKey="neueMitglieder" stroke="#ffd700" strokeWidth={2} fill="url(#ovGrowth)" />
                        <Line type="monotone" dataKey="neueMitglieder" stroke="#ffd700" strokeWidth={2.5}
                          dot={{ fill: '#ffd700', r: 3, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* ── Charts Grid ── */}
              <div className="ov-charts-grid">

                {/* Altersverteilung */}
                <div className="ov-card">
                  <div className="ov-card-header">
                    <span className="ov-card-title">Altersverteilung</span>
                    <span className="ov-card-meta">{ma.altersgruppen.reduce((s,a) => s + a.value, 0)} Mitglieder</span>
                  </div>
                  <div className="ov-card-body">
                    <ResponsiveContainer width="100%" height={190}>
                      <PieChart>
                        <Pie data={ma.altersgruppen} cx="50%" cy="50%" innerRadius={40} outerRadius={70}
                          dataKey="value" labelLine={false}
                          label={({ cx, cy, midAngle, innerRadius, outerRadius, value }) => {
                            const r = innerRadius + (outerRadius - innerRadius) * 1.4;
                            const x = cx + r * Math.cos(-midAngle * Math.PI / 180);
                            const y = cy + r * Math.sin(-midAngle * Math.PI / 180);
                            return value > 0 ? <text x={x} y={y} fill="rgba(255,255,255,0.6)" textAnchor="middle" dominantBaseline="central" fontSize={10}>{value}</text> : null;
                          }}>
                          {ma.altersgruppen.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Geschlechterverteilung */}
                <div className="ov-card">
                  <div className="ov-card-header">
                    <span className="ov-card-title">Geschlechterverteilung</span>
                  </div>
                  <div className="ov-card-body">
                    <ResponsiveContainer width="100%" height={190}>
                      <BarChart data={ma.geschlechterVerteilung} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="geschlecht" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.5)' }} />
                        <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="anzahl" radius={[4,4,0,0]}>
                          {ma.geschlechterVerteilung.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Eintrittsjahre */}
                <div className="ov-card">
                  <div className="ov-card-header">
                    <span className="ov-card-title">Eintrittsjahre</span>
                  </div>
                  <div className="ov-card-body">
                    <ResponsiveContainer width="100%" height={190}>
                      <BarChart data={ma.eintrittsJahre} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="jahr" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} />
                        <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="anzahl" fill="#10b981" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Stil-Verteilung */}
                <div className="ov-card">
                  <div className="ov-card-header">
                    <span className="ov-card-title">Stil-Verteilung</span>
                  </div>
                  <div className="ov-card-body">
                    <ResponsiveContainer width="100%" height={190}>
                      <BarChart data={ov.stilAnalyse.verteilung.filter(s => s.anzahl > 0)} margin={{ top: 5, right: 10, bottom: 40, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} angle={-35} textAnchor="end" />
                        <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="anzahl" fill="#f59e0b" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gurtverteilung */}
                <div className="ov-card">
                  <div className="ov-card-header">
                    <span className="ov-card-title">Gurtverteilung</span>
                  </div>
                  <div className="ov-card-body">
                    <ResponsiveContainer width="100%" height={190}>
                      <BarChart data={ma.graduierungsStats} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis type="number" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }} />
                        <YAxis dataKey="gurtfarbe" type="category" width={90} stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="anzahl" radius={[0,4,4,0]}>
                          {ma.graduierungsStats.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Nächste Geburtstage */}
                <div className="ov-card">
                  <div className="ov-card-header">
                    <span className="ov-card-title">Nächste Geburtstage</span>
                    <span className="ov-card-meta">30 Tage</span>
                  </div>
                  {ma.naechsteGeburtstage.length > 0 ? (
                    <div className="ov-birthday-list">
                      {ma.naechsteGeburtstage.map((gb, i) => (
                        <div key={i} className="ov-birthday-row">
                          <div className="ov-birthday-dot" />
                          <span className="ov-birthday-name">{gb.name}</span>
                          <span className={`ov-birthday-days ${gb.tageVerbleibend === 0 ? 'ov-birthday-days--today' : ''}`}>
                            {gb.tageVerbleibend === 0 ? 'Heute!' : `in ${gb.tageVerbleibend} T.`}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="ov-empty">Keine Geburtstage in den nächsten 30 Tagen</div>
                  )}
                </div>

                {/* Anwesenheit / Wochentag */}
                <div className="ov-card">
                  <div className="ov-card-header">
                    <span className="ov-card-title">Anwesenheit / Wochentag</span>
                  </div>
                  <div className="ov-card-body">
                    <ResponsiveContainer width="100%" height={190}>
                      <BarChart data={anw?.wochentagsVerteilung || []} margin={{ top: 5, right: 10, bottom: 30, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="tag" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.45)' }} angle={-30} textAnchor="end" />
                        <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="anzahl" fill="#ffd700" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Spitzenzeiten */}
                <div className="ov-card">
                  <div className="ov-card-header">
                    <span className="ov-card-title">Spitzenzeiten</span>
                  </div>
                  <div className="ov-peak-list">
                    {(anw?.spitzenzeiten || []).map((zeit, i) => (
                      <div key={i} className="ov-peak-row">
                        <span className="ov-peak-time">{zeit.zeit}</span>
                        <div className="ov-peak-bar-bg">
                          <div className="ov-peak-bar-fill" style={{ width: `${(zeit.teilnehmer / maxPeak) * 100}%` }} />
                        </div>
                        <span className="ov-peak-count">{zeit.teilnehmer}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          );
        })()}

        {activeTab === 'financial' && (() => {
          const fin = auswertungsData.finanzielleAuswertung;
          const tarife = fin.tarifVerteilung || [];
          const maxUmsatz = tarife.length > 0 ? Math.max(...tarife.map(t => Number(t.monatsumsatz) || 0)) : 1;
          const totalUmsatz = tarife.reduce((s, t) => s + (Number(t.monatsumsatz) || 0), 0) || 1;
          const totalMitgl = tarife.reduce((s, t) => s + (Number(t.anzahl) || 0), 0);
          const PIE_COLORS = ['#ffd700','#10b981','#63b3ed','#f59e0b','#8b5cf6','#ec4899','#06b6d4'];
          const opt = beitragsvergleich;
          const hasOpt = opt?.zusammenfassung?.gesamt > 0;
          const ttStyle = { background: 'rgba(10,10,25,0.97)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 8, fontSize: 12 };

          return (
            <div className="fin-wrapper">

              {/* ── KPI Header ── */}
              <div className="fin-kpi-row">
                <div className="fin-kpi fin-kpi--hero">
                  <div className="fin-kpi-label">Monatliche Einnahmen</div>
                  <div className="fin-kpi-value">{formatCurrency(fin.monatlicheEinnahmen)}</div>
                  <div className="fin-kpi-sub">{formatCurrency(fin.jahreseinnahmen)} / Jahr</div>
                </div>
                <div className="fin-kpi">
                  <div className="fin-kpi-label">Aktive Verträge</div>
                  <div className="fin-kpi-value">{totalMitgl}</div>
                  <div className="fin-kpi-sub">{tarife.length} Tarife</div>
                </div>
                <div className="fin-kpi">
                  <div className="fin-kpi-label">Ø Beitrag</div>
                  <div className="fin-kpi-value">{formatCurrency(fin.durchschnittsBeitrag)}</div>
                  <div className="fin-kpi-sub">pro Vertrag / Monat</div>
                </div>
                <div className="fin-kpi">
                  <div className="fin-kpi-label">Optimierungspotential</div>
                  {hasOpt ? (
                    <>
                      <div className="fin-kpi-value fin-kpi-value--green">+{formatCurrency(opt.zusammenfassung.potential / 100)}</div>
                      <div className="fin-kpi-sub fin-kpi-sub--positive">{opt.zusammenfassung.gesamt} Mitgl. · / Monat möglich</div>
                    </>
                  ) : (
                    <>
                      <div className="fin-kpi-value fin-kpi-value--green">✓</div>
                      <div className="fin-kpi-sub">Alle auf aktuellem Tarif</div>
                    </>
                  )}
                </div>
              </div>

              {/* ── Tarif-Liste + Donut ── */}
              <div className="fin-columns fin-columns--wide">

                {/* Umsatz nach Tarif (Liste) */}
                <div className="fin-card">
                  <div className="fin-card-header">
                    <span className="fin-card-title">Umsatz nach Tarif</span>
                    <span className="fin-card-badge">{formatCurrency(fin.monatlicheEinnahmen)} / Monat</span>
                  </div>
                  {tarife.length > 0 ? (
                    <div className="fin-tarif-list">
                      {tarife.map((t, i) => (
                        <div className="fin-tarif-row" key={i}>
                          <div className="fin-tarif-label-row">
                            <div className="fin-color-dot" style={{ '--dot-color': PIE_COLORS[i % PIE_COLORS.length] }} />
                            <div className="fin-tarif-name" title={t.tarifname}>{t.tarifname}</div>
                          </div>
                          <div className="fin-tarif-bar-wrap">
                            <div className="fin-tarif-bar-bg">
                              <div className="fin-tarif-bar-fill" style={{ width: `${Math.round(((Number(t.monatsumsatz) || 0) / maxUmsatz) * 100)}%`, '--dot-color': PIE_COLORS[i % PIE_COLORS.length] }} />
                            </div>
                          </div>
                          <div className="fin-tarif-meta">
                            <div className="fin-tarif-umsatz">{formatCurrency(Number(t.monatsumsatz) || 0)}</div>
                            <div className="fin-tarif-count">{t.anzahl} Mitgl. · {formatCurrency((Number(t.price_cents) || 0) / 100)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="fin-empty">Keine Tarife mit aktiven Verträgen</div>
                  )}
                </div>

                {/* Umsatz-Verteilung Donut */}
                <div className="fin-card">
                  <div className="fin-card-header">
                    <span className="fin-card-title">Umsatz-Verteilung</span>
                    <span className="fin-card-badge">{tarife.length} Tarife</span>
                  </div>
                  {tarife.length > 0 ? (
                    <div className="fin-donut-wrap">
                      <PieChart width={150} height={150}>
                        <Pie
                          data={tarife.map(t => ({ name: t.tarifname, value: Number(t.monatsumsatz) || 0 }))}
                          cx={75} cy={75} innerRadius={46} outerRadius={68}
                          dataKey="value" startAngle={90} endAngle={-270}
                        >
                          {tarife.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={ttStyle} formatter={(v) => formatCurrency(v)} />
                      </PieChart>
                      <div className="fin-donut-legend">
                        {tarife.map((t, i) => (
                          <div key={i} className="fin-legend-item">
                            <div className="fin-legend-dot" style={{ '--dot-color': PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="fin-legend-name" title={t.tarifname}>{t.tarifname}</span>
                            <span className="fin-legend-pct">{Math.round(((Number(t.monatsumsatz) || 0) / totalUmsatz) * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="fin-empty">Keine Daten</div>
                  )}
                </div>
              </div>

              {/* ── Mitglieder pro Tarif + Beitragsoptimierung ── */}
              <div className="fin-columns">

                {/* Bar Chart: Mitglieder pro Tarif */}
                <div className="fin-card">
                  <div className="fin-card-header">
                    <span className="fin-card-title">Mitglieder pro Tarif</span>
                    <span className="fin-card-badge">{totalMitgl} gesamt</span>
                  </div>
                  <div className="fin-chart-pad">
                    <ResponsiveContainer width="100%" height={210}>
                      <BarChart
                        data={tarife.map(t => ({
                          name: t.tarifname.length > 16 ? t.tarifname.slice(0, 16) + '…' : t.tarifname,
                          anzahl: t.anzahl,
                          beitrag: (Number(t.price_cents) || 0) / 100
                        }))}
                        margin={{ top: 5, right: 10, bottom: 45, left: -10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.45)' }} angle={-30} textAnchor="end" />
                        <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} />
                        <Tooltip contentStyle={ttStyle} formatter={(v, n) => [n === 'anzahl' ? `${v} Mitglieder` : formatCurrency(v), n === 'anzahl' ? 'Mitglieder' : 'Beitrag']} />
                        <Bar dataKey="anzahl" radius={[4, 4, 0, 0]}>
                          {tarife.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Beitragsoptimierung */}
                {hasOpt ? (
                  <div className="fin-card">
                    <div className="fin-card-header">
                      <span className="fin-card-title">Beitragsoptimierung</span>
                      <span className="fin-card-badge">{opt.zusammenfassung.gesamt} Mitgl.</span>
                    </div>
                    <div className="fin-opt-summary">
                      <div className="fin-opt-kpi">
                        <div className="fin-opt-kpi-value">+{formatCurrency(opt.zusammenfassung.potential / 100)}</div>
                        <div className="fin-opt-kpi-label">Monatl. Potential</div>
                      </div>
                      <div className="fin-opt-kpi">
                        <div className="fin-opt-kpi-value">+{formatCurrency(opt.zusammenfassung.durchschnittlicheErhoehung / 100)}</div>
                        <div className="fin-opt-kpi-label">Ø Erhöhung / Mitgl.</div>
                      </div>
                    </div>
                    <div className="fin-opt-list">
                      {opt.niedrigeBeitraege.slice(0, 15).map((m, idx) => (
                        <div className="fin-opt-row" key={idx}>
                          <div className="fin-opt-name" title={m.name}>{m.name}</div>
                          <div className="fin-opt-current">{formatCurrency(m.aktuellerBeitrag / 100)}</div>
                          <div className="fin-opt-delta">+{formatCurrency(m.potentialErhoehung / 100)}</div>
                        </div>
                      ))}
                      {opt.niedrigeBeitraege.length > 15 && (
                        <div className="fin-empty fin-empty--sm">
                          + {opt.niedrigeBeitraege.length - 15} weitere
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="fin-card">
                    <div className="fin-card-header">
                      <span className="fin-card-title">Beitragsoptimierung</span>
                    </div>
                    <div className="fin-empty fin-empty--lg">
                      Alle Mitglieder zahlen bereits den aktuellen Tarif.
                    </div>
                  </div>
                )}
              </div>

            </div>
          );
        })()}

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
                            '--badge-bg': guertel.farbe_sekundaer
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

        {activeTab === 'performance' && (() => {
          const anw   = auswertungsData.anwesenheitsStatistik;
          const sum   = auswertungsData.summary;
          const ma    = auswertungsData.mitgliederAnalyse;
          const woche = anw.wochentagsVerteilung || [];
          const peaks = anw.spitzenzeiten || [];
          const dauer = ma.mitgliedschaftsLaengen || [];
          const maxWoche = woche.length > 0 ? Math.max(...woche.map(w => w.anzahl)) : 1;
          const maxPeak  = peaks.length  > 0 ? Math.max(...peaks.map(p => p.teilnehmer)) : 1;
          const maxDauer = dauer.length  > 0 ? Math.max(...dauer.map(d => d.anzahl)) : 1;
          const topTag   = woche.length  > 0 ? woche.reduce((a, b) => a.anzahl > b.anzahl ? a : b) : null;
          const topPeak  = peaks.length  > 0 ? peaks[0] : null;
          const aktivQuote = sum.totalMembers > 0
            ? Math.round((sum.activeMembers / sum.totalMembers) * 100) : 0;
          const DAUER_COLORS = ['#f59e0b','#ffd700','#10b981','#3b82f6','#8b5cf6'];

          return (
            <div className="perf-wrapper">

              {/* ── KPI Header ── */}
              <div className="perf-kpi-row">
                <div className="perf-kpi">
                  <div className="perf-kpi-label">Ø Check-ins / Tag</div>
                  <div className="perf-kpi-value perf-kpi-value--gold">
                    {anw.durchschnittlicheAnwesenheit}
                  </div>
                  <div className="perf-kpi-sub">letzte 90 Tage</div>
                </div>
                <div className="perf-kpi">
                  <div className="perf-kpi-label">Retention Rate</div>
                  <div className={`perf-kpi-value ${sum.retentionRate >= 75 ? 'perf-kpi-value--green' : 'perf-kpi-value--red'}`}>
                    {sum.retentionRate}%
                  </div>
                  <div className="perf-kpi-sub">länger als 1 Jahr</div>
                  <div className="perf-kpi-bar">
                    <div className={`perf-kpi-bar-fill ${sum.retentionRate >= 75 ? 'perf-kpi-bar-fill--green' : 'perf-kpi-bar-fill--red'}`} style={{ width: `${sum.retentionRate}%` }} />
                  </div>
                </div>
                <div className="perf-kpi">
                  <div className="perf-kpi-label">Aktivquote</div>
                  <div className={`perf-kpi-value ${aktivQuote >= 80 ? 'perf-kpi-value--green' : ''}`}>
                    {aktivQuote}%
                  </div>
                  <div className="perf-kpi-sub">{sum.activeMembers} von {sum.totalMembers} aktiv</div>
                  <div className="perf-kpi-bar">
                    <div className="perf-kpi-bar-fill perf-kpi-bar-fill--primary" style={{ width: `${aktivQuote}%` }} />
                  </div>
                </div>
                <div className="perf-kpi">
                  <div className="perf-kpi-label">Churn Rate</div>
                  <div className={`perf-kpi-value ${ma.churnRate <= 3 ? 'perf-kpi-value--green' : ma.churnRate <= 7 ? '' : 'perf-kpi-value--red'}`}>
                    {ma.churnRate}%
                  </div>
                  <div className="perf-kpi-sub">Austritte / Gesamt</div>
                </div>
              </div>

              {/* ── Wochentag + Spitzenzeiten ── */}
              <div className="perf-columns">

                {/* Wochentag-Verteilung */}
                <div className="perf-card">
                  <div className="perf-card-header">
                    <span className="perf-card-title">Check-ins nach Wochentag</span>
                    {topTag && <span className="perf-card-meta">Spitzentag: {topTag.tag}</span>}
                  </div>
                  {woche.length > 0 ? (
                    <div className="perf-week-list">
                      {woche.map((w, i) => {
                        const isTop = topTag && w.tag === topTag.tag;
                        return (
                          <div className="perf-week-row" key={i}>
                            <div className="perf-week-tag">{w.tag}</div>
                            <div className="perf-week-bar-bg">
                              <div
                                className={`perf-week-bar-fill${isTop ? ' perf-week-bar-fill--top' : ''}`}
                                style={{ width: `${Math.round((w.anzahl / maxWoche) * 100)}%` }}
                              />
                            </div>
                            <div className="perf-week-count">{w.anzahl}</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="perf-empty">Noch keine Check-in-Daten vorhanden</div>
                  )}
                </div>

                {/* Spitzenzeiten */}
                <div className="perf-card">
                  <div className="perf-card-header">
                    <span className="perf-card-title">Top Trainingszeiten</span>
                    {topPeak && <span className="perf-card-meta">Peak: {topPeak.zeit}</span>}
                  </div>
                  {peaks.length > 0 ? (
                    <div className="perf-peak-list">
                      {peaks.map((p, i) => (
                        <div className="perf-peak-row" key={i}>
                          <div className={`perf-peak-rank perf-peak-rank--${i + 1}`}>
                            {i + 1 <= 3 ? ['①','②','③'][i] : i + 1}
                          </div>
                          <div className="perf-peak-time">{p.zeit}</div>
                          <div className="perf-peak-bar-bg">
                            <div
                              className="perf-peak-bar-fill"
                              style={{ width: `${Math.round((p.teilnehmer / maxPeak) * 100)}%` }}
                            />
                          </div>
                          <div className="perf-peak-count">{p.teilnehmer}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="perf-empty">Noch keine Check-in-Daten vorhanden</div>
                  )}
                </div>
              </div>

              {/* ── Mitgliedschaftsdauer (volle Breite) ── */}
              {dauer.length > 0 && (
                <div className="perf-card">
                  <div className="perf-card-header">
                    <span className="perf-card-title">Mitgliedschaftsdauer</span>
                    <span className="perf-card-meta">Ø {sum.averageMembershipDuration} Jahre</span>
                  </div>
                  <div className="perf-duration-list">
                    {dauer.map((d, i) => (
                      <div className="perf-duration-row" key={i}>
                        <div className="perf-duration-label">{d.zeitraum}</div>
                        <div className="perf-duration-bar-bg">
                          <div
                            className="perf-duration-bar-fill"
                            style={{
                              width: `${Math.round((d.anzahl / maxDauer) * 100)}%`,
                              '--dot-color': DAUER_COLORS[i % DAUER_COLORS.length]
                            }}
                          />
                        </div>
                        <div className="perf-duration-count">{d.anzahl}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          );
        })()}

        {activeTab === 'forecasting' && (() => {
          const wa   = auswertungsData.wachstumsAnalyse;
          const prog = wa.prognose || {};
          const vj   = wa.vergleichVorjahr || {};
          const sum  = auswertungsData.summary;
          const recs = auswertungsData.recommendations || [];

          // Umsatz je Mitglied für Revenue-Prognose
          const revenuePerMember = sum.activeMembers > 0
            ? sum.monthlyRevenue / sum.activeMembers : 0;

          const stages = [
            { period: 'Heute',        members: sum.activeMembers,                          delta: null },
            { period: '+ 3 Monate',   members: sum.activeMembers + (prog.naechsterMonat * 3 || 0),  delta: prog.naechsterMonat * 3 || 0 },
            { period: '+ 6 Monate',   members: sum.activeMembers + (prog.naechstesQuartal * 2 || 0), delta: prog.naechstesQuartal * 2 || 0 },
            { period: '+ 12 Monate',  members: sum.activeMembers + (prog.naechstesJahr || 0),        delta: prog.naechstesJahr || 0 },
          ];

          const wachstumsrate = memberAnalytics?.wachstumPrognose?.wachstumsrate ?? 0;
          const ratePositive = wachstumsrate > 0;

          const recIcon = (typ) => typ === 'success' ? '✓' : typ === 'warning' ? '!' : 'i';

          return (
            <div className="fc-wrapper">

              {/* ── Prognose-Timeline ── */}
              <div className="fc-timeline">
                {stages.map((s, i) => (
                  <div className={`fc-stage${i === 0 ? ' fc-stage--current' : ''}`} key={i}>
                    <div className="fc-stage-period">{s.period}</div>
                    <div className="fc-stage-members">{formatNumber(s.members)}</div>
                    {s.delta > 0 && (
                      <div className="fc-stage-delta">{formatNumber(s.delta)} Mitgl.</div>
                    )}
                    <div className="fc-stage-revenue">
                      <strong>{formatCurrency(Math.round(s.members * revenuePerMember))}</strong>
                      <span> / Monat</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Wachstumsrate + Vorjahresvergleich ── */}
              <div className="fc-columns">

                {/* Wachstumsrate */}
                <div className="fc-card">
                  <div className="fc-card-header">
                    <span className="fc-card-title">Wachstumstrend</span>
                    <span className={`fc-card-badge ${ratePositive ? 'fc-card-badge--green' : wachstumsrate < 0 ? 'fc-card-badge--red' : 'fc-card-badge--yellow'}`}>
                      {ratePositive ? '+' : ''}{wachstumsrate}% / Periode
                    </span>
                  </div>
                  <div className="fc-rate-display">
                    <div className={`fc-rate-big ${ratePositive ? 'fc-rate-big--positive' : wachstumsrate < 0 ? 'fc-rate-big--negative' : 'fc-rate-big--neutral'}`}>
                      {ratePositive ? '+' : ''}{wachstumsrate}%
                    </div>
                    <div className="fc-rate-info">
                      <div className="fc-rate-label">
                        Durchschnittliche Wachstumsrate basierend auf den letzten Zugängen
                      </div>
                      {prog.basis && <div className="fc-basis">{prog.basis}</div>}
                    </div>
                  </div>
                </div>

                {/* Vorjahresvergleich */}
                <div className="fc-card">
                  <div className="fc-card-header">
                    <span className="fc-card-title">Vorjahresvergleich</span>
                    {vj.prozent !== undefined && (
                      <span className={`fc-card-badge ${vj.prozent >= 0 ? 'fc-card-badge--green' : 'fc-card-badge--red'}`}>
                        {vj.prozent > 0 ? '+' : ''}{vj.prozent}%
                      </span>
                    )}
                  </div>
                  <div className="fc-compare-list">
                    {vj.vorjahr && (
                      <div className="fc-compare-row">
                        <div className="fc-compare-label">Jahr {vj.vorjahr}</div>
                        <div className="fc-compare-value">{vj.neueVorjahr} neue Mitgl.</div>
                        <div className="fc-compare-delta" />
                      </div>
                    )}
                    {vj.aktuellesJahr && (
                      <div className="fc-compare-row">
                        <div className="fc-compare-label">Jahr {vj.aktuellesJahr}</div>
                        <div className="fc-compare-value">{vj.neueAktuellesJahr} neue Mitgl.</div>
                        <div className={`fc-compare-delta ${vj.differenz >= 0 ? 'fc-compare-delta--positive' : 'fc-compare-delta--negative'}`}>
                          {vj.differenz > 0 ? '+' : ''}{vj.differenz}
                        </div>
                      </div>
                    )}
                    {vj.aktuellesJahr && (
                      <div className="fc-compare-row">
                        <div className="fc-compare-label">Prognose {(vj.aktuellesJahr || 0) + 1}</div>
                        <div className="fc-compare-value">{prog.naechstesJahr} neue Mitgl.</div>
                        <div className="fc-compare-delta fc-compare-delta--positive">erwartet</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Empfehlungen ── */}
              {recs.length > 0 && (
                <>
                  <div className="fc-section-label">Handlungsempfehlungen</div>
                  <div className="fc-recs">
                    {recs.map((r, i) => (
                      <div key={i} className={`fc-rec fc-rec--${r.typ}`}>
                        <div className="fc-rec-icon">{recIcon(r.typ)}</div>
                        <div className="fc-rec-body">
                          <strong>{r.title}</strong>
                          <p>{r.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

            </div>
          );
        })()}
      </div>
    </div>
  );
}

export default Auswertungen;