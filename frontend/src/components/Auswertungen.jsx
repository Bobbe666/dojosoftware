// Frontend/src/components/Auswertungen.jsx - Saubere Version für Backend-Datenstruktur
import React, { useState, useEffect, useMemo, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
import '../styles/Auswertungen-Members.css';
import '../styles/Auswertungen-Belts.css';
import '../styles/Auswertungen-Anmeldungen.css';

function Auswertungen() {
  const navigate = useNavigate();
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
  const [collapsedStile, setCollapsedStile] = useState({});
  const [kursPerformance, setKursPerformance] = useState(null);
  const [absprungRisiko, setAbsprungRisiko] = useState(null);
  const [vertragsablauf, setVertragsablauf] = useState(null);
  const [zahlungsrueckstand, setZahlungsrueckstand] = useState(null);
  const [trainingsfrequenz, setTrainingsfrequenz] = useState(null);
  const [onboardingKohorte, setOnboardingKohorte] = useState(null);
  const [checkinStreaks, setCheckinStreaks] = useState(null);
  const [graduierungsPyramide, setGraduierungsPyramide] = useState(null);
  const [trainerAuslastung, setTrainerAuslastung] = useState(null);
  const [collapsedPerfSections, setCollapsedPerfSections] = useState({});
  const [expandedRisikoTiers, setExpandedRisikoTiers] = useState({});
  const [registrierungenStats, setRegistrierungenStats] = useState(null);

  const tabs = [
    { id: 'breakeven', label: 'Break-Even Analyse', icon: '💡' },
    { id: 'overview', label: 'Übersicht', icon: '📊' },
    { id: 'financial', label: 'Finanzen', icon: '💰' },
    { id: 'members', label: 'Mitglieder', icon: '👥' },
    { id: 'anmeldungen', label: 'Anmeldungen', icon: '📋' },
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
    loadKursPerformance();
    loadAbsprungRisiko();
    loadVertragsablauf();
    loadZahlungsrueckstand();
    loadTrainingsfrequenz();
    loadOnboardingKohorte();
    loadCheckinStreaks();
    loadGraduierungsPyramide();
    loadTrainerAuslastung();
    loadRegistrierungenStats();
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
            // Letzte Berechnung gefunden - Fixkosten/variableKosten aus Speicher, aber
            // durchschnittsbeitrag immer aus echten aktiven Verträgen (nicht gespeicherter Wert)
            setBreakEvenForm({
              fixkosten: latestResult.data.fixkosten,
              variableKosten: latestResult.data.variableKosten,
              durchschnittsbeitrag: result.data.durchschnittsbeitrag
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


  const loadKursPerformance = async () => {
    try {
      const response = await axios.get(`/auswertungen/kurs-performance${dojoParam}`);
      if (response.data.success) setKursPerformance(response.data.data);
    } catch (err) {
      console.error('Fehler beim Laden der Kurs-Performance:', err);
    }
  };

  const loadAbsprungRisiko = async () => {
    try {
      const r = await axios.get(`/auswertungen/absprung-risiko${dojoParam}`);
      if (r.data.success) setAbsprungRisiko(r.data.data);
    } catch (err) { console.error('absprung-risiko:', err); }
  };
  const loadVertragsablauf = async () => {
    try {
      const r = await axios.get(`/auswertungen/vertragsablauf${dojoParam}`);
      if (r.data.success) setVertragsablauf(r.data.data);
    } catch (err) { console.error('vertragsablauf:', err); }
  };
  const loadZahlungsrueckstand = async () => {
    try {
      const r = await axios.get(`/auswertungen/zahlungsrueckstand${dojoParam}`);
      if (r.data.success) setZahlungsrueckstand(r.data.data);
    } catch (err) { console.error('zahlungsrueckstand:', err); }
  };
  const loadTrainingsfrequenz = async () => {
    try {
      const r = await axios.get(`/auswertungen/trainingsfrequenz${dojoParam}`);
      if (r.data.success) setTrainingsfrequenz(r.data.data);
    } catch (err) { console.error('trainingsfrequenz:', err); }
  };
  const loadOnboardingKohorte = async () => {
    try {
      const r = await axios.get(`/auswertungen/onboarding-kohorte${dojoParam}`);
      if (r.data.success) setOnboardingKohorte(r.data.data);
    } catch (err) { console.error('onboarding-kohorte:', err); }
  };
  const loadCheckinStreaks = async () => {
    try {
      const r = await axios.get(`/auswertungen/check-in-streaks${dojoParam}`);
      if (r.data.success) setCheckinStreaks(r.data.data);
    } catch (err) { console.error('check-in-streaks:', err); }
  };
  const loadGraduierungsPyramide = async () => {
    try {
      const r = await axios.get(`/auswertungen/graduierungs-pyramide${dojoParam}`);
      if (r.data.success) setGraduierungsPyramide(r.data.data);
    } catch (err) { console.error('graduierungs-pyramide:', err); }
  };
  const loadTrainerAuslastung = async () => {
    try {
      const r = await axios.get(`/auswertungen/trainer-auslastung${dojoParam}`);
      if (r.data.success) setTrainerAuslastung(r.data.data);
    } catch (err) { console.error('trainer-auslastung:', err); }
  };

  const loadRegistrierungenStats = async () => {
    try {
      const r = await axios.get(`/auswertungen/registrierungen-stats${dojoParam}`);
      if (r.data.success) setRegistrierungenStats(r.data.data);
    } catch (err) { console.error('registrierungen-stats:', err); }
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
      <div className="be-page-header" style={{ marginBottom: '1.5rem' }}>
        <div className="be-page-header-left">
          <h2>Dojo Auswertungen</h2>
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
                          <div className="fin-opt-name" title={m.name}>
                            {m.name}
                            {m.tarifName && <span className="fin-opt-tarif">{m.tarifName}</span>}
                          </div>
                          <div className="fin-opt-current">
                            {formatCurrency(m.aktuellerBeitrag / 100)}
                            {m.sollBeitrag && <span className="fin-opt-soll"> → {formatCurrency(m.sollBeitrag / 100)}</span>}
                          </div>
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

        {activeTab === 'members' && (() => {
          const ttStyle = { background: 'rgba(10,10,25,0.97)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 8, fontSize: 12, color: '#fff' };
          const axisStyle = { tick: { fill: 'rgba(255,255,255,0.45)', fontSize: 11 }, axisLine: { stroke: 'rgba(255,255,255,0.08)' }, tickLine: false };
          const gridStyle = { stroke: 'rgba(255,255,255,0.06)', strokeDasharray: '0' };
          const periodLabel = timePeriod === 'monthly' ? 'Monatlich' : timePeriod === 'quarterly' ? 'Quartal' : timePeriod === 'biannually' ? 'Halbjahr' : 'Jährlich';
          return (
          <div className="mem-wrapper">

            {/* ── Period Toggle + KPI Row ── */}
            <div>
              <div className="mem-period-header">
                <span className="mem-period-label">Zeitraum</span>
                <div className="mem-period-tabs">
                  {timePeriods.map(p => (
                    <button
                      key={p.id}
                      className={`mem-period-btn${timePeriod === p.id ? ' active' : ''}`}
                      onClick={() => setTimePeriod(p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mem-kpi-row">
                <div className="mem-kpi">
                  <div className="mem-kpi-label">Gesamt</div>
                  <div className="mem-kpi-value mem-kpi-value--gold">{formatNumber(auswertungsData.mitgliederAnalyse.gesamt)}</div>
                  <div className="mem-kpi-sub">Mitglieder</div>
                </div>
                <div className="mem-kpi">
                  <div className="mem-kpi-label">Aktiv</div>
                  <div className="mem-kpi-value mem-kpi-value--green">{formatNumber(auswertungsData.mitgliederAnalyse.aktiv)}</div>
                  <div className="mem-kpi-sub">aktive Mitglieder</div>
                </div>
                <div className="mem-kpi">
                  <div className="mem-kpi-label">Neue {periodLabel}</div>
                  <div className="mem-kpi-value">{formatNumber(auswertungsData.mitgliederAnalyse.neueThisMonth)}</div>
                  <div className="mem-kpi-sub">Zugänge</div>
                </div>
                <div className="mem-kpi">
                  <div className="mem-kpi-label">Inaktiv</div>
                  <div className="mem-kpi-value mem-kpi-value--red">{formatNumber(auswertungsData.mitgliederAnalyse.inaktiv)}</div>
                  <div className="mem-kpi-sub">inaktive Mitglieder</div>
                </div>
              </div>
            </div>

            {/* ── Charts Grid ── */}
            {memberAnalytics && (
              <div className="mem-charts-grid">

                {/* Zugänge */}
                <div className="mem-chart">
                  <div className="mem-chart-header">
                    <span className="mem-chart-title">Zugänge</span>
                  </div>
                  <div className="mem-chart-body">
                    {memberAnalytics.zugänge.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={memberAnalytics.zugänge}>
                          <defs>
                            <linearGradient id="zugGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="periode" {...axisStyle} />
                          <YAxis {...axisStyle} />
                          <Tooltip contentStyle={ttStyle} />
                          <Area type="monotone" dataKey="wert" stroke="#10b981" strokeWidth={2} fill="url(#zugGrad)" dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="mem-no-data">Keine Daten verfügbar</div>
                    )}
                  </div>
                </div>

                {/* Kündigungen */}
                <div className="mem-chart">
                  <div className="mem-chart-header">
                    <span className="mem-chart-title">Kündigungen</span>
                  </div>
                  <div className="mem-chart-body">
                    {memberAnalytics.kündigungen.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={memberAnalytics.kündigungen}>
                          <defs>
                            <linearGradient id="kündGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="periode" {...axisStyle} />
                          <YAxis {...axisStyle} />
                          <Tooltip contentStyle={ttStyle} />
                          <Area type="monotone" dataKey="wert" stroke="#ef4444" strokeWidth={2} fill="url(#kündGrad)" dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="mem-no-data">Keine Daten verfügbar</div>
                    )}
                  </div>
                </div>

                {/* Ruhepausen */}
                <div className="mem-chart">
                  <div className="mem-chart-header">
                    <span className="mem-chart-title">Ruhepausen</span>
                  </div>
                  <div className="mem-chart-body">
                    {memberAnalytics.ruhepausen.length > 0 ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={memberAnalytics.ruhepausen}>
                          <defs>
                            <linearGradient id="ruheGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid {...gridStyle} />
                          <XAxis dataKey="periode" {...axisStyle} />
                          <YAxis {...axisStyle} />
                          <Tooltip contentStyle={ttStyle} />
                          <Area type="monotone" dataKey="wert" stroke="#f59e0b" strokeWidth={2} fill="url(#ruheGrad)" dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="mem-no-data">Keine Daten verfügbar</div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* ── Forecast + Demographics ── */}
            <div className="mem-demo-row">

              {/* Wachstumsprognose */}
              {memberAnalytics && (
                <div className="mem-chart">
                  <div className="mem-chart-header">
                    <span className="mem-chart-title">Wachstumsprognose</span>
                  </div>
                  <div className="mem-forecast">
                    <div className="mem-forecast-hero">
                      <div className="mem-forecast-current-val">{memberAnalytics.wachstumPrognose.aktuell}</div>
                      <div className="mem-forecast-current-label">Aktuelle Mitglieder</div>
                    </div>
                    <div className="mem-forecast-rows">
                      {[
                        { h: '3 Monate', v: memberAnalytics.wachstumPrognose.prognose3Monate },
                        { h: '6 Monate', v: memberAnalytics.wachstumPrognose.prognose6Monate },
                        { h: '12 Monate', v: memberAnalytics.wachstumPrognose.prognose12Monate },
                      ].map(({ h, v }) => (
                        <div className="mem-forecast-item" key={h}>
                          <div className="mem-forecast-horizon">{h}</div>
                          <div className="mem-forecast-val">+{v - memberAnalytics.wachstumPrognose.aktuell}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mem-forecast-rate">
                      <span className="mem-forecast-rate-label">Wachstumsrate</span>
                      <span className="mem-forecast-rate-value">{memberAnalytics.wachstumPrognose.wachstumsrate}% / Monat</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Demografische Verteilung */}
              <div className="mem-demo-chart">
                <div className="mem-chart-header">
                  <span className="mem-chart-title">Demografische Verteilung</span>
                </div>
                <div className="mem-chart-body">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={auswertungsData.mitgliederAnalyse.demographics}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ geschlecht, prozent }) => `${geschlecht}: ${prozent}%`}
                        outerRadius={75}
                        dataKey="anzahl"
                      >
                        {auswertungsData.mitgliederAnalyse.demographics.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#ffd700','#10b981','#63b3ed','#f59e0b','#8b5cf6'][index % 5]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={ttStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

          </div>
          );
        })()}

        {activeTab === 'anmeldungen' && (() => {
          const rs = registrierungenStats;
          if (!rs) return <div className="loading-state">Lade Anmeldungsstatistiken…</div>;

          const kpi = rs.kpi || {};
          const dieserMonat = kpi.dieser_monat || 0;
          const vormonat = kpi.vormonat || 0;
          const vorjahrMonat = kpi.vorjahr_monat || 0;
          const vmDelta = vormonat > 0 ? Math.round(((dieserMonat - vormonat) / vormonat) * 100) : null;
          const vjDelta = vorjahrMonat > 0 ? Math.round(((dieserMonat - vorjahrMonat) / vorjahrMonat) * 100) : null;

          const quelle = rs.quelle || {};
          const gesamtQuelle = (quelle.empfehlung || 0) + (quelle.direkt || 0);
          const quelleData = [
            { name: 'Direkt', value: quelle.direkt || 0, color: '#6366f1' },
            { name: 'Empfehlung', value: quelle.empfehlung || 0, color: '#22c55e' },
            { name: 'Promo-Code', value: quelle.mit_promo || 0, color: '#f59e0b' }
          ].filter(d => d.value > 0);

          const formatMonat = (m) => {
            if (!m) return '';
            const [y, mo] = m.split('-');
            const monate = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
            return `${monate[parseInt(mo) - 1]} ${y.slice(2)}`;
          };

          const funnelMax = Math.max(...(rs.funnel || []).map(f => f.anzahl), 1);

          return (
            <div className="anm-wrapper">

              {/* KPI-Zeile */}
              <div className="anm-kpi-row">
                <div className="anm-kpi-card">
                  <div className="anm-kpi-label">Dieser Monat</div>
                  <div className="anm-kpi-value">{dieserMonat}</div>
                  {vmDelta !== null && (
                    <div className={`anm-kpi-delta ${vmDelta >= 0 ? 'pos' : 'neg'}`}>
                      {vmDelta >= 0 ? '▲' : '▼'} {Math.abs(vmDelta)}% vs. Vormonat
                    </div>
                  )}
                </div>
                <div className="anm-kpi-card">
                  <div className="anm-kpi-label">Vormonat</div>
                  <div className="anm-kpi-value">{vormonat}</div>
                </div>
                <div className="anm-kpi-card">
                  <div className="anm-kpi-label">Vorjahr (gleicher Monat)</div>
                  <div className="anm-kpi-value">{vorjahrMonat}</div>
                  {vjDelta !== null && (
                    <div className={`anm-kpi-delta ${vjDelta >= 0 ? 'pos' : 'neg'}`}>
                      {vjDelta >= 0 ? '▲' : '▼'} {Math.abs(vjDelta)}% YoY
                    </div>
                  )}
                </div>
                <div className="anm-kpi-card highlight">
                  <div className="anm-kpi-label">Aktive Mitglieder</div>
                  <div className="anm-kpi-value">{formatNumber(kpi.gesamt_aktiv || 0)}</div>
                </div>
              </div>

              <div className="anm-main-grid">

                {/* Trend-Chart: Neuanmeldungen 12 Monate */}
                <div className="anm-card anm-card--wide">
                  <div className="anm-card-title">Neuanmeldungen – 12 Monate</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart data={rs.trendData || []} margin={{ top: 8, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                      <XAxis dataKey="monat" tickFormatter={formatMonat} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 8, fontSize: 12 }}
                        labelFormatter={formatMonat}
                      />
                      <Bar dataKey="anzahl" name="Anmeldungen" fill="#6366f1" radius={[3, 3, 0, 0]} />
                      <Line dataKey="vorjahr" name="Vorjahr" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                    </ComposedChart>
                  </ResponsiveContainer>
                  <div className="anm-legend">
                    <span className="anm-legend-item"><span style={{background:'#6366f1'}}></span>Anmeldungen</span>
                    <span className="anm-legend-item"><span style={{background:'#f59e0b'}}></span>Vorjahr</span>
                  </div>
                </div>

                {/* Quelle */}
                <div className="anm-card">
                  <div className="anm-card-title">Herkunft (letzte 12 Monate)</div>
                  {gesamtQuelle === 0 ? (
                    <div className="anm-empty">Keine Daten</div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie data={quelleData} dataKey="value" cx="50%" cy="50%" outerRadius={65} paddingAngle={3}>
                            {quelleData.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 8, fontSize: 12 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="anm-quelle-list">
                        {quelleData.map((d, i) => (
                          <div key={i} className="anm-quelle-item">
                            <span className="anm-quelle-dot" style={{ background: d.color }}></span>
                            <span className="anm-quelle-name">{d.name}</span>
                            <span className="anm-quelle-val">{d.value}</span>
                            <span className="anm-quelle-pct">({Math.round((d.value / gesamtQuelle) * 100)}%)</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Wochentage */}
                <div className="anm-card">
                  <div className="anm-card-title">Anmeldetag (letzte 12 Monate)</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={rs.wochentage || []} margin={{ top: 8, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                      <XAxis dataKey="tag" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fill: '#9ca3af', fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 8, fontSize: 12 }}
                      />
                      <Bar dataKey="anzahl" name="Anmeldungen" fill="#22c55e" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Registrierungs-Funnel */}
                <div className="anm-card anm-card--wide">
                  <div className="anm-card-title">Registrierungs-Funnel</div>
                  <div className="anm-funnel">
                    {(rs.funnel || []).map((step, i) => (
                      <div key={i} className="anm-funnel-step">
                        <div className="anm-funnel-label">{step.schritt}</div>
                        <div className="anm-funnel-bar-wrap">
                          <div
                            className="anm-funnel-bar"
                            style={{ width: `${Math.round((step.anzahl / funnelMax) * 100)}%` }}
                          ></div>
                        </div>
                        <div className="anm-funnel-count">{step.anzahl}</div>
                      </div>
                    ))}
                  </div>
                  <p className="anm-funnel-hint">Zeigt wo Registrierungen abgebrochen werden. "Abgeschlossen" = vollständige Mitglieder.</p>
                </div>

              </div>
            </div>
          );
        })()}

        {activeTab === 'belts' && beltsData && (
          <div className="blt-wrapper">

            {/* ── Header ── */}
            <div className="blt-page-header">
              <div className="blt-page-header-left">
                <h2>Gürtel-Übersicht</h2>
                <p>Graduierungen, Mitglieder und Anwesenheiten je Kampfkunststil</p>
              </div>
              <button
                className="blt-assign-btn"
                onClick={() => navigate('/dashboard/guertel-massenzuweisung')}
              >
                ⚡ Massenzuweisung
              </button>
            </div>

            {/* ── KPI Row ── */}
            <div className="blt-kpi-row">
              <div className="blt-kpi">
                <div className="blt-kpi-label">Stile</div>
                <div className="blt-kpi-value">{beltsData.summary.total_stile}</div>
                <div className="blt-kpi-sub">Kampfkunststile</div>
              </div>
              <div className="blt-kpi">
                <div className="blt-kpi-label">Gürtel</div>
                <div className="blt-kpi-value">{beltsData.summary.total_guertel}</div>
                <div className="blt-kpi-sub">Graduierungsstufen</div>
              </div>
              <div className="blt-kpi">
                <div className="blt-kpi-label">Mitglieder</div>
                <div className="blt-kpi-value">{beltsData.summary.total_mitglieder}</div>
                <div className="blt-kpi-sub">mit Gürtelzuweisung</div>
              </div>
            </div>

            {/* ── Stile ── */}
            {beltsData.stile.map((stil) => {
              const isCollapsed = collapsedStile[stil.stil_id];
              const totalMembers = stil.guertel.reduce((sum, g) => sum + g.mitglieder.length, 0);
              return (
                <div key={stil.stil_id} className="blt-stil-section">
                  <div
                    className="blt-stil-header"
                    onClick={() => setCollapsedStile(prev => ({ ...prev, [stil.stil_id]: !prev[stil.stil_id] }))}
                  >
                    <h3>{stil.stil_name}</h3>
                    <div className="blt-stil-meta">
                      <span className="blt-stil-stats">{stil.guertel.length} Gürtel · {totalMembers} Mitglieder</span>
                      <span className={`blt-stil-chevron${isCollapsed ? ' blt-stil-chevron--collapsed' : ''}`}>▾</span>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="blt-guertel-grid">
                      {stil.guertel.map((guertel) => (
                        <div key={guertel.graduierung_id} className="blt-guertel-card">
                          <div className="blt-guertel-header">
                            <div
                              className="blt-color-badge"
                              style={{
                                '--badge-bg': guertel.farbe_sekundaer
                                  ? `linear-gradient(135deg, ${guertel.farbe_hex}, ${guertel.farbe_sekundaer})`
                                  : guertel.farbe_hex
                              }}
                            />
                            <div className="blt-guertel-info">
                              <div className="blt-guertel-name">
                                {guertel.gurt_name}
                                {guertel.dan_grad && <span className="blt-dan-badge">{guertel.dan_grad}. DAN</span>}
                              </div>
                              <div className="blt-guertel-category">{guertel.kategorie}</div>
                            </div>
                            <span className="blt-member-count">{guertel.mitglieder.length} Mitgl.</span>
                          </div>

                          {guertel.mitglieder.length > 0 ? (
                            <div className="blt-member-list">
                              <div className="blt-member-list-header">
                                <span>Name</span>
                                <span>Jahr</span>
                                <span>Monat</span>
                              </div>
                              {guertel.mitglieder.map((member) => (
                                <div key={member.mitglied_id} className="blt-member-row">
                                  <span className="blt-member-name">{member.vorname} {member.nachname}</span>
                                  <span className="blt-attendance">{member.anwesenheit_jahr}×</span>
                                  <span className="blt-attendance">{member.anwesenheit_monat}×</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="blt-no-members">Keine Mitglieder</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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
          const toggleSection = (key) => setCollapsedPerfSections(p => ({ ...p, [key]: !p[key] }));
          const toggleTier = (key) => setExpandedRisikoTiers(p => ({ ...p, [key]: !p[key] }));
          const SectionHeader = ({ sKey, title }) => (
            <div className="perf-section-header" onClick={() => toggleSection(sKey)}>
              <span className="perf-section-title">{title}</span>
              <span className={`perf-section-chevron ${collapsedPerfSections[sKey] ? 'perf-section-chevron--up' : ''}`}>›</span>
            </div>
          );

          return (
            <div className="perf-wrapper">

              {/* ── KPI Header ── */}
              <SectionHeader sKey="kpis" title="📊 KPI Kennzahlen" />
              {!collapsedPerfSections.kpis && (
              <div className="perf-kpi-row">
                <div className="perf-kpi">
                  <div className="perf-kpi-label">
                    Ø Check-ins / Tag
                    <span className="perf-tooltip-wrap">
                      <span className="perf-info-icon">ℹ</span>
                      <span className="perf-tooltip">Durchschnittliche Anzahl an Check-ins pro Tag über die letzten 90 Tage. Zeigt wie aktiv das Dojo genutzt wird.</span>
                    </span>
                  </div>
                  <div className="perf-kpi-value perf-kpi-value--gold">
                    {anw.durchschnittlicheAnwesenheit}
                  </div>
                  <div className="perf-kpi-sub">letzte 90 Tage</div>
                </div>
                <div className="perf-kpi">
                  <div className="perf-kpi-label">
                    Retention Rate
                    <span className="perf-tooltip-wrap">
                      <span className="perf-info-icon">ℹ</span>
                      <span className="perf-tooltip">Anteil der aktiven Mitglieder, die länger als 1 Jahr dabei sind. Über 75% ist gut, über 85% ist ausgezeichnet. Niedrige Werte deuten auf hohe Fluktuation hin.</span>
                    </span>
                  </div>
                  <div className={`perf-kpi-value ${sum.retentionRate >= 75 ? 'perf-kpi-value--green' : 'perf-kpi-value--red'}`}>
                    {sum.retentionRate}%
                  </div>
                  <div className="perf-kpi-sub">länger als 1 Jahr</div>
                  <div className="perf-kpi-bar">
                    <div className={`perf-kpi-bar-fill ${sum.retentionRate >= 75 ? 'perf-kpi-bar-fill--green' : 'perf-kpi-bar-fill--red'}`} style={{ width: `${sum.retentionRate}%` }} />
                  </div>
                </div>
                <div className="perf-kpi">
                  <div className="perf-kpi-label">
                    Aktivquote
                    <span className="perf-tooltip-wrap">
                      <span className="perf-info-icon">ℹ</span>
                      <span className="perf-tooltip">Anteil der aktiven Mitglieder an der Gesamtmitgliederzahl (inkl. inaktiver). Über 80% ist ein gesundes Verhältnis.</span>
                    </span>
                  </div>
                  <div className={`perf-kpi-value ${aktivQuote >= 80 ? 'perf-kpi-value--green' : ''}`}>
                    {aktivQuote}%
                  </div>
                  <div className="perf-kpi-sub">{sum.activeMembers} von {sum.totalMembers} aktiv</div>
                  <div className="perf-kpi-bar">
                    <div className="perf-kpi-bar-fill perf-kpi-bar-fill--primary" style={{ width: `${aktivQuote}%` }} />
                  </div>
                </div>
                <div className="perf-kpi">
                  <div className="perf-kpi-label">
                    Churn Rate
                    <span className="perf-tooltip-wrap">
                      <span className="perf-info-icon">ℹ</span>
                      <span className="perf-tooltip">Anteil der Austritte der letzten 12 Monate an der Gesamtmitgliederzahl. Unter 3% ist sehr gut, über 7% ist bedenklich.</span>
                    </span>
                  </div>
                  <div className={`perf-kpi-value ${ma.churnRate <= 3 ? 'perf-kpi-value--green' : ma.churnRate <= 7 ? '' : 'perf-kpi-value--red'}`}>
                    {ma.churnRate}%
                  </div>
                  <div className="perf-kpi-sub">Austritte / Gesamt</div>
                </div>
              </div>
              )}

              {/* ── Wochentag + Spitzenzeiten ── */}
              <SectionHeader sKey="wochepeak" title="📅 Check-ins & Trainingszeiten" />
              {!collapsedPerfSections.wochepeak && (
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
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}
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
              )}

              {/* ── Mitgliedschaftsdauer (volle Breite) ── */}
              <SectionHeader sKey="dauer" title="⏱ Mitgliedschaftsdauer" />
              {!collapsedPerfSections.dauer && dauer.length > 0 && (
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

              {/* ── Kurs-Performance ── */}
              <SectionHeader sKey="kurse" title="🏋 Kurs-Performance" />
              {!collapsedPerfSections.kurse && kursPerformance && (() => {
                const { kurse: kp, wochenplan, freieSlots } = kursPerformance;
                const maxSchnitt = kp.length > 0 ? Math.max(...kp.map(k => k.schnitt_pro_tag)) : 1;
                const stilFarben = {
                  'Enso Karate':    '#ffd700',
                  'Kickboxen':      '#f97316',
                  'ShieldX':        '#3b82f6',
                  'Brazilian Jiu Jitsu': '#10b981',
                };
                const stilColor = (stil) => stilFarben[stil] || '#8b5cf6';
                const tageOrder = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
                const activeTage = tageOrder.filter(t => (wochenplan[t]||[]).length > 0);

                return (
                  <>
                    {/* Kurs-Ranking */}
                    <div className="perf-card">
                      <div className="perf-card-header">
                        <span className="perf-card-title">Kurs-Ranking — Ø Teilnehmer/Einheit</span>
                        <span className="perf-card-meta">letzte 90 Tage</span>
                      </div>
                      <div className="perf-kurs-list">
                        {kp.map((k, i) => (
                          <div className="perf-kurs-row" key={k.kurs_id}>
                            <div className="perf-kurs-rank">
                              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="perf-kurs-rank-num">{i+1}</span>}
                            </div>
                            <div className="perf-kurs-info">
                              <div className="perf-kurs-name">{k.name}</div>
                              <div className="perf-kurs-meta">
                                <span className="perf-kurs-stil-dot" style={{ background: stilColor(k.stil) }} />
                                <span className="perf-kurs-stil">{k.stil}</span>
                                <span className="perf-kurs-sep">·</span>
                                <span>{k.tage.map(t => t.tag.slice(0,2)).join(', ')}</span>
                                {k.checkins_gesamt > 0 && <><span className="perf-kurs-sep">·</span><span>{k.checkins_gesamt} Check-ins</span></>}
                              </div>
                            </div>
                            <div className="perf-kurs-bar-wrap">
                              <div className="perf-kurs-bar-bg">
                                <div className="perf-kurs-bar-fill"
                                  style={{ width: `${Math.round((k.schnitt_pro_tag / maxSchnitt) * 100)}%`, background: stilColor(k.stil) }} />
                              </div>
                              {k.auslastung_pct !== null && (
                                <div className={`perf-kurs-auslastung ${k.auslastung_pct >= 80 ? 'perf-kurs-auslastung--voll' : ''}`}>
                                  {k.auslastung_pct}% Auslastung
                                </div>
                              )}
                            </div>
                            <div className="perf-kurs-schnitt">
                              <span className="perf-kurs-schnitt-val">{k.schnitt_pro_tag || '–'}</span>
                              <span className="perf-kurs-schnitt-label">Ø/Einheit</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Wochenplan mit Check-in-Dichte */}
                    <div className="perf-card">
                      <div className="perf-card-header">
                        <span className="perf-card-title">Kursplan nach Wochentag</span>
                        <span className="perf-card-meta">{activeTage.length} aktive Trainingstage</span>
                      </div>
                      <div className="perf-wochenplan">
                        {activeTage.map(tag => (
                          <div className="perf-wplan-tag" key={tag}>
                            <div className="perf-wplan-tag-label">{tag}</div>
                            <div className="perf-wplan-kurse">
                              {(wochenplan[tag]||[]).map((k, i) => (
                                <div className="perf-wplan-kurs" key={i}
                                  style={{ borderLeft: `3px solid ${stilColor(k.stil)}` }}>
                                  <div className="perf-wplan-time">
                                    {k.start?.slice(0,5)} – {k.ende?.slice(0,5)}
                                  </div>
                                  <div className="perf-wplan-kname">{k.name}</div>
                                  <div className="perf-wplan-kmeta">
                                    <span className="perf-wplan-stil">{k.stil}</span>
                                    {k.checkins > 0 && (
                                      <span className="perf-wplan-checkins">⬤ Ø {k.schnitt}/Einheit</span>
                                    )}
                                    {k.checkins === 0 && (
                                      <span className="perf-wplan-leer">Noch keine Check-ins</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Freie Kapazitäten */}
                    <div className="perf-card">
                      <div className="perf-card-header">
                        <span className="perf-card-title">Freie Zeitfenster — Potential für neue Kurse</span>
                        <span className="perf-card-meta">Lücken ≥ 30 Min im Zeitraum 14:00–22:00</span>
                      </div>
                      <div className="perf-freie-slots">
                        {tageOrder.map(tag => {
                          const slots = freieSlots[tag] || [];
                          if (slots.length === 0) return null;
                          const istFreierTag = (wochenplan[tag]||[]).length === 0;
                          return (
                            <div className={`perf-freier-tag ${istFreierTag ? 'perf-freier-tag--komplett' : ''}`} key={tag}>
                              <div className="perf-freier-tag-label">
                                {tag}
                                {istFreierTag && <span className="perf-freier-badge">ganzer Tag frei</span>}
                              </div>
                              <div className="perf-freier-slots-list">
                                {slots.map((s, i) => (
                                  <div className="perf-freier-slot" key={i}>
                                    <span className="perf-freier-time">{s.start?.slice(0,5)} – {s.ende?.slice(0,5)}</span>
                                    <span className="perf-freier-dauer">{Math.floor(s.minuten/60)}h{s.minuten%60>0?` ${s.minuten%60}min`:''} verfügbar</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }).filter(Boolean)}
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* ── RISIKO: Absprung + Vertragsablauf ── */}
              <SectionHeader sKey="risiko" title="⚠ Mitglieder-Risiko" />
              {!collapsedPerfSections.risiko && (
                <div className="perf-columns">

                  {/* Absprung-Risiko */}
                  {absprungRisiko && (() => {
                    const tiers = [
                      { key: 'tier3w', data: absprungRisiko.tier3w, label: '3–6 Wochen', color: '#f59e0b' },
                      { key: 'tier6w', data: absprungRisiko.tier6w, label: '6W – 2 Monate', color: '#ef4444' },
                      { key: 'tier2m', data: absprungRisiko.tier2m, label: '2+ Monate / noch nie', color: '#dc2626' },
                    ];
                    const total = tiers.reduce((s, t) => s + t.data.length, 0);
                    return (
                      <div className="perf-card">
                        <div className="perf-card-header">
                          <span className="perf-card-title">Absprung-Risiko</span>
                          <span className="perf-card-meta">{total} Mitglieder inaktiv</span>
                        </div>
                        <div className="perf-risiko-wrap">
                          {tiers.map((tier) => {
                            const isExpanded = expandedRisikoTiers[tier.key];
                            const visible = isExpanded ? tier.data : tier.data.slice(0, 4);
                            const more = tier.data.length - 4;
                            return (
                              <div className="perf-risiko-tier" key={tier.key}>
                                <div className="perf-risiko-tier-header">
                                  <span className="perf-risiko-count" style={{ color: tier.color }}>{tier.data.length}</span>
                                  <span className="perf-risiko-tier-label">{tier.label}</span>
                                </div>
                                {visible.map(m => (
                                  <div className="perf-risiko-member" key={m.mitglied_id}>
                                    <span className="perf-risiko-name">{m.vorname} {m.nachname}</span>
                                    <span className="perf-risiko-days" style={{ color: tier.color }}>
                                      {m.tage_weg !== null ? `${m.tage_weg}T` : 'noch nie'}
                                    </span>
                                  </div>
                                ))}
                                {more > 0 && (
                                  <button className="perf-risiko-expand" onClick={() => toggleTier(tier.key)}>
                                    {isExpanded ? '▲ weniger anzeigen' : `▼ ${more} weitere anzeigen`}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Vertragsablauf */}
                  {vertragsablauf && (() => {
                    const buckets = [
                      { data: vertragsablauf.in30, label: '≤ 30 Tage', color: '#dc2626' },
                      { data: vertragsablauf.in60, label: '31–60 Tage', color: '#f59e0b' },
                      { data: vertragsablauf.in90, label: '61–90 Tage', color: '#6b7280' },
                    ];
                    const total = buckets.reduce((s, b) => s + b.data.length, 0);
                    return (
                      <div className="perf-card">
                        <div className="perf-card-header">
                          <span className="perf-card-title">Vertragsablauf-Pipeline</span>
                          <span className="perf-card-meta">{total} Verträge in 90 Tagen</span>
                        </div>
                        {total === 0 ? (
                          <div className="perf-empty">Keine Verträge laufen in den nächsten 90 Tagen ab</div>
                        ) : (
                          <div className="perf-ablauf-wrap">
                            {buckets.map((bucket, bi) => bucket.data.length > 0 && (
                              <div className="perf-ablauf-bucket" key={bi}>
                                <div className="perf-ablauf-bucket-label" style={{ color: bucket.color }}>
                                  <span className="perf-ablauf-count">{bucket.data.length}</span>
                                  {bucket.label}
                                </div>
                                {bucket.data.map(m => (
                                  <div className="perf-ablauf-member" key={m.id}>
                                    <span className="perf-ablauf-mname">{m.vorname} {m.nachname}</span>
                                    <span className="perf-ablauf-date">{m.vertragsende}</span>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ── ENGAGEMENT: Frequenz + Streaks ── */}
              <SectionHeader sKey="engagement" title="📊 Engagement" />
              {!collapsedPerfSections.engagement && (
                <div className="perf-columns">

                  {trainingsfrequenz && (() => {
                    const maxCount = Math.max(...trainingsfrequenz.buckets.map(b => b.count), 1);
                    return (
                      <div className="perf-card">
                        <div className="perf-card-header">
                          <span className="perf-card-title">Trainingsfrequenz</span>
                          <span className="perf-card-meta">letzte 90 Tage · {trainingsfrequenz.total} Mitglieder</span>
                        </div>
                        <div className="perf-freq-list">
                          {trainingsfrequenz.buckets.map((b, i) => {
                            const pct = Math.round((b.count / trainingsfrequenz.total) * 100);
                            return (
                              <div className="perf-freq-row" key={i}>
                                <div className="perf-freq-label">{b.label}</div>
                                <div className="perf-freq-bar-bg">
                                  <div className="perf-freq-bar-fill"
                                    style={{ width: `${Math.round((b.count / maxCount) * 100)}%`, background: b.color }} />
                                </div>
                                <div className="perf-freq-count">{b.count}</div>
                                <div className="perf-freq-pct">{pct}%</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {checkinStreaks && checkinStreaks.length > 0 && (() => {
                    const maxStreak = checkinStreaks[0].streak;
                    return (
                      <div className="perf-card">
                        <div className="perf-card-header">
                          <span className="perf-card-title">🔥 Trainingsstreaks</span>
                          <span className="perf-card-meta">konsekutive Wochen</span>
                        </div>
                        <div className="perf-streak-list">
                          {checkinStreaks.map((s, i) => (
                            <div className="perf-streak-row" key={i}>
                              <span className="perf-streak-rank">
                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`}
                              </span>
                              <span className="perf-streak-name">{s.name}</span>
                              <div className="perf-streak-bar-bg">
                                <div className="perf-streak-bar-fill"
                                  style={{ width: `${Math.round((s.streak / maxStreak) * 100)}%` }} />
                              </div>
                              <span className="perf-streak-weeks">{s.streak}W</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ── FINANZEN + ONBOARDING ── */}
              <SectionHeader sKey="finanzen" title="💰 Finanzen & Onboarding" />
              {!collapsedPerfSections.finanzen && (
                <div className="perf-columns">

                  {zahlungsrueckstand && (() => {
                    const zr = zahlungsrueckstand;
                    const maxTrend = Math.max(...zr.trend.map(t => t.gesamt), 1);
                    return (
                      <div className="perf-card">
                        <div className="perf-card-header">
                          <span className="perf-card-title">Zahlungsrückstand</span>
                          <span className="perf-card-meta">fällige Beiträge bis heute</span>
                        </div>
                        <div className="perf-zahlung-summary">
                          <div className="perf-zahlung-kpi">
                            <span className={`perf-zahlung-pct ${zr.offen_pct > 15 ? 'perf-zahlung-pct--red' : zr.offen_pct > 8 ? 'perf-zahlung-pct--amber' : 'perf-zahlung-pct--green'}`}>
                              {zr.offen_pct}%
                            </span>
                            <span className="perf-zahlung-label">Ausfallquote</span>
                          </div>
                          <div className="perf-zahlung-kpi">
                            <span className="perf-zahlung-pct perf-zahlung-pct--red">
                              {zr.offen_betrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                            </span>
                            <span className="perf-zahlung-label">offen</span>
                          </div>
                          <div className="perf-zahlung-kpi">
                            <span className="perf-zahlung-pct">{zr.offen_count}</span>
                            <span className="perf-zahlung-label">Einträge</span>
                          </div>
                        </div>
                        {zr.trend.length > 0 && (
                          <div className="perf-zahlung-trend">
                            <div className="perf-zahlung-trend-label">Trend (letzte 6 Monate) — grau=gesamt, rot=offen</div>
                            <div className="perf-zahlung-trend-bars">
                              {zr.trend.map((t, i) => (
                                <div className="perf-zahlung-trend-col" key={i}>
                                  <div className="perf-zahlung-trend-bar-wrap">
                                    <div className="perf-zahlung-trend-bar-total"
                                      style={{ height: `${Math.round((t.gesamt / maxTrend) * 48)}px` }} />
                                    <div className="perf-zahlung-trend-bar-offen"
                                      style={{ height: `${Math.round((t.offen / maxTrend) * 48)}px` }} />
                                  </div>
                                  <div className="perf-zahlung-trend-monat">{t.monat.slice(5)}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {onboardingKohorte && onboardingKohorte.length > 0 && (() => {
                    const MN = { '01':'Jan','02':'Feb','03':'Mär','04':'Apr','05':'Mai','06':'Jun','07':'Jul','08':'Aug','09':'Sep','10':'Okt','11':'Nov','12':'Dez' };
                    return (
                      <div className="perf-card">
                        <div className="perf-card-header">
                          <span className="perf-card-title">Onboarding-Kohorten</span>
                          <span className="perf-card-meta">% trainiert in Monat 1 / 2 / 3</span>
                        </div>
                        <div className="perf-kohorte-table">
                          <div className="perf-kohorte-header-row">
                            <div className="perf-kohorte-cell perf-kohorte-cell--head">Monat</div>
                            <div className="perf-kohorte-cell perf-kohorte-cell--head">Neu</div>
                            <div className="perf-kohorte-cell perf-kohorte-cell--head">M1</div>
                            <div className="perf-kohorte-cell perf-kohorte-cell--head">M2</div>
                            <div className="perf-kohorte-cell perf-kohorte-cell--head">M3</div>
                          </div>
                          {onboardingKohorte.map((k, i) => {
                            const mm = k.monat.slice(5);
                            const yy = k.monat.slice(2,4);
                            return (
                              <div className="perf-kohorte-row" key={i}>
                                <div className="perf-kohorte-cell perf-kohorte-cell--month">{MN[mm]} '{yy}</div>
                                <div className="perf-kohorte-cell">{k.total}</div>
                                <div className="perf-kohorte-cell">
                                  <span className={`perf-kohorte-pct ${k.m1_pct >= 70 ? 'pct--green' : k.m1_pct >= 40 ? 'pct--amber' : 'pct--red'}`}>{k.m1_pct}%</span>
                                </div>
                                <div className="perf-kohorte-cell">
                                  {k.m2_pct !== null
                                    ? <span className={`perf-kohorte-pct ${k.m2_pct >= 60 ? 'pct--green' : k.m2_pct >= 30 ? 'pct--amber' : 'pct--red'}`}>{k.m2_pct}%</span>
                                    : <span className="perf-kohorte-pending">–</span>}
                                </div>
                                <div className="perf-kohorte-cell">
                                  {k.m3_pct !== null
                                    ? <span className={`perf-kohorte-pct ${k.m3_pct >= 50 ? 'pct--green' : k.m3_pct >= 25 ? 'pct--amber' : 'pct--red'}`}>{k.m3_pct}%</span>
                                    : <span className="perf-kohorte-pending">–</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ── GRADUIERUNGS-PYRAMIDE ── */}
              {graduierungsPyramide && graduierungsPyramide.length > 0 && (<>
                <SectionHeader sKey="pyramide" title="🥋 Graduierungs-Pyramide" />
                {!collapsedPerfSections.pyramide && (
                  <div className="perf-card">
                    <div className="perf-card-header">
                      <span className="perf-card-title">Graduierungs-Pyramide</span>
                      <span className="perf-card-meta">aktive Mitglieder nach Grad</span>
                    </div>
                    <div className="perf-pyramide-stile">
                      {graduierungsPyramide.map(stil => {
                        const maxCount = Math.max(...stil.stufen.map(s => s.count), 1);
                        return (
                          <div className="perf-pyramide-stil" key={stil.stil}>
                            <div className="perf-pyramide-stil-title">{stil.stil}</div>
                            <div className="perf-pyramide-total">{stil.total} Mitglieder</div>
                            <div className="perf-pyramide-levels">
                              {stil.stufen.map((stufe, i) => {
                                const pct = Math.round((stufe.count / maxCount) * 100);
                                const hex = stufe.farbe_hex || '#ffffff';
                                const isWhite = hex.toLowerCase() === '#ffffff';
                                return (
                                  <div className="perf-pyramide-level" key={i}>
                                    <div className="perf-pyramide-bar-wrap">
                                      <div className="perf-pyramide-bar"
                                        style={{ width: `${pct}%`, background: isWhite ? 'rgba(255,255,255,0.18)' : hex, borderColor: isWhite ? 'rgba(255,255,255,0.3)' : hex }} />
                                    </div>
                                    <div className="perf-pyramide-label" title={stufe.grad_name}>{stufe.grad_name}</div>
                                    <div className="perf-pyramide-count">{stufe.count}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>)}

              {/* ── TRAINER-AUSLASTUNG ── */}
              {trainerAuslastung && trainerAuslastung.length > 0 && (<>
                <SectionHeader sKey="trainer" title="👤 Trainer-Auslastung" />
                {!collapsedPerfSections.trainer && (() => {
                  const maxTeilnehmer = Math.max(...trainerAuslastung.map(t => t.gesamt_teilnehmer), 1);
                  return (
                    <div className="perf-card">
                      <div className="perf-card-header">
                        <span className="perf-card-title">Trainer-Auslastung</span>
                        <span className="perf-card-meta">letzte 90 Tage</span>
                      </div>
                      <div className="perf-trainer-list">
                        {trainerAuslastung.map((t) => (
                          <div className="perf-trainer-row" key={t.trainer_id}>
                            <div className="perf-trainer-avatar">{t.initials}</div>
                            <div className="perf-trainer-info">
                              <div className="perf-trainer-name">{t.name}</div>
                              <div className="perf-trainer-stil">{t.stil}</div>
                            </div>
                            <div className="perf-trainer-bar-wrap">
                              <div className="perf-trainer-bar-bg">
                                <div className="perf-trainer-bar-fill"
                                  style={{ width: `${Math.round((t.gesamt_teilnehmer / maxTeilnehmer) * 100)}%` }} />
                              </div>
                            </div>
                            <div className="perf-trainer-stats">
                              <span className="perf-trainer-avg">{t.avg_teilnehmer}</span>
                              <span className="perf-trainer-avg-label">Ø/Einheit</span>
                            </div>
                            <div className="perf-trainer-einheiten">{t.einheiten} Einh.</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </>)}

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

          // Forecast aus member-analytics (absolut) — Deltas daraus ableiten
          const mp = memberAnalytics?.wachstumPrognose || {};
          const heute = mp.aktuell || sum.activeMembers;
          const stages = [
            { period: 'Heute',       members: heute,                     delta: null },
            { period: '+ 3 Monate',  members: mp.prognose3Monate  || heute, delta: (mp.prognose3Monate  || heute) - heute },
            { period: '+ 6 Monate',  members: mp.prognose6Monate  || heute, delta: (mp.prognose6Monate  || heute) - heute },
            { period: '+ 12 Monate', members: mp.prognose12Monate || heute, delta: (mp.prognose12Monate || heute) - heute },
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