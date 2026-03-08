import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Target, Award, Calendar, Clock, Trophy, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import MemberHeader from './MemberHeader.jsx';
import '../styles/components.css';
import '../styles/MemberStats.css';
import config from '../config/config.js';

const MemberStats = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [showMonthDetails, setShowMonthDetails] = useState(false);
  const [monthDetails, setMonthDetails] = useState([]);
  const [comparisonData, setComparisonData] = useState(null);
  const [memberData, setMemberData] = useState(null);

  const API_BASE = config.apiBaseUrl;

  const loadMonthDetails = async (month, year, mitgliedId) => {
    try {
      console.log(`Lade Monatsdetails für Monat ${month}/${year}, Mitglied-ID: ${mitgliedId}`);

      // Lade die Anwesenheitsdaten für das Mitglied
      const response = await fetchWithAuth(`${API_BASE}/anwesenheit/${mitgliedId}`);

      if (response.ok) {
        const allData = await response.json();

        // Filtere die Daten für den gewählten Monat/Jahr
        const filteredData = allData.filter(entry => {
          const entryDate = new Date(entry.datum);
          return entryDate.getMonth() + 1 === parseInt(month) &&
                 entryDate.getFullYear() === parseInt(year) &&
                 entry.anwesend === 1;
        });

        console.log(`Gefundene Trainingstage für ${month}/${year}:`, filteredData.length);
        setMonthDetails(filteredData);
      } else {
        console.log('Anwesenheitsdaten nicht verfügbar');
        setMonthDetails([]);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Monatsdetails:', error);
      setMonthDetails([]);
    }
  };

  // Lade Vergleichsdaten mit anderen Mitgliedern
  const loadComparisonData = async () => {
    try {
      const response = await fetchWithAuth(`${API_BASE}/mitglieder/comparison-stats`);

      if (response.ok) {
        const data = await response.json();
        setComparisonData(data);
      } else {
        console.log('Vergleichsdaten-API nicht verfügbar, zeige keine Vergleichsdaten');
        setComparisonData(null);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Vergleichsdaten:', error);
      setComparisonData(null);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const mitgliedId = user?.mitglied_id;
      if (!mitgliedId) {
        throw new Error('Keine Mitglieds-ID gefunden');
      }
      console.log('MemberStats: Lade Mitgliedsdaten für ID:', mitgliedId);

      const memberResponse = await fetchWithAuth(`${API_BASE}/mitglieder/${mitgliedId}`);

      if (!memberResponse.ok) {
        throw new Error(`HTTP ${memberResponse.status}: ${memberResponse.statusText}`);
      }

      const memberData = await memberResponse.json();
      console.log('MemberStats: Mitgliedsdaten geladen:', memberData);
      setMemberData(memberData);

      // Lade Anwesenheitsdaten
      const attendanceResponse = await fetchWithAuth(`${API_BASE}/anwesenheit/${mitgliedId}`);
      let attendanceData = [];
      if (attendanceResponse.ok) {
        attendanceData = await attendanceResponse.json();
      }

      // Tatsächlich besuchte Trainings
      const totalAnwesend = Array.isArray(attendanceData)
        ? attendanceData.filter(a => a.anwesend === 1 || a.anwesend === true).length
        : 0;

      // Kurse des Mitglieds laden (für Stundenplan-basierte Anwesenheitsberechnung)
      let memberKurse = [];
      try {
        const kurseResponse = await fetchWithAuth(`${API_BASE}/mitglieder/${mitgliedId}/kurse`);
        if (kurseResponse.ok) {
          const kurseData = await kurseResponse.json();
          memberKurse = Array.isArray(kurseData) ? kurseData : (kurseData.kurse || []);
        }
      } catch (e) {
        console.warn('Kurse nicht ladbar:', e);
      }

      // Mögliche Trainings seit Eintrittsdatum (Stundenplan-basiert, wie MemberDashboard)
      const wochentagMap = {
        'Montag': 1, 'Dienstag': 2, 'Mittwoch': 3, 'Donnerstag': 4,
        'Freitag': 5, 'Samstag': 6, 'Sonntag': 0
      };
      const eintrittsdatum = memberData.eintrittsdatum ? new Date(memberData.eintrittsdatum) : null;
      const heute = new Date();
      heute.setHours(23, 59, 59, 0);
      let moeglich = 0;
      if (eintrittsdatum && memberKurse.length > 0) {
        memberKurse.forEach(kurs => {
          if (!kurs.wochentag) return;
          const zielTag = wochentagMap[kurs.wochentag];
          if (zielTag === undefined) return;
          const start = new Date(eintrittsdatum);
          start.setHours(0, 0, 0, 0);
          const tageOffset = (zielTag - start.getDay() + 7) % 7;
          start.setDate(start.getDate() + tageOffset);
          if (start <= heute) {
            const diffMs = heute - start;
            const diffTage = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            moeglich += Math.floor(diffTage / 7) + 1;
          }
        });
      }
      const attendancePercentage = moeglich > 0
        ? Math.round((totalAnwesend / moeglich) * 100)
        : null;

      // Berechne Monatsdaten aus Anwesenheit
      const monthlyData = calculateMonthlyData(attendanceData);

      // Lade Stile mit Graduierungen + aktuelle Graduierung je Stil
      let aktuellerGürtel = '—';
      let naechsterGuertel = '—';
      try {
        const stileRes = await fetchWithAuth(`${API_BASE}/mitglieder/${mitgliedId}/stile`);
        if (stileRes.ok) {
          const stileResult = await stileRes.json();
          const memberStile = stileResult.success ? stileResult.stile : stileResult;
          if (Array.isArray(memberStile) && memberStile.length > 0) {
            // Ersten Stil nehmen (oder alle kombinieren)
            const belts = [];
            const nextBelts = [];
            for (const stil of memberStile) {
              const stilDataRes = await fetchWithAuth(`${API_BASE}/mitglieder/${mitgliedId}/stil/${stil.stil_id}/data`);
              if (!stilDataRes.ok) continue;
              const stilData = await stilDataRes.json();
              const grads = stil.graduierungen || [];
              const currentIdx = grads.findIndex(g => g.graduierung_id === stilData?.data?.current_graduierung_id);
              if (currentIdx !== -1) {
                belts.push(grads[currentIdx].name);
                if (currentIdx + 1 < grads.length) {
                  nextBelts.push(grads[currentIdx + 1].name);
                }
              } else if (grads.length > 0) {
                belts.push(grads[0].name);
                if (grads.length > 1) nextBelts.push(grads[1].name);
              }
            }
            if (belts.length > 0) aktuellerGürtel = belts.join(', ');
            if (nextBelts.length > 0) naechsterGuertel = nextBelts.join(', ');
          }
        }
      } catch (e) {
        console.warn('Stil/Gürtel nicht ladbar:', e);
      }

      // Lade Ziele
      let ziele = [];
      try {
        const zieleResponse = await fetchWithAuth(`${API_BASE}/fortschritt/mitglied/${mitgliedId}/ziele`);
        if (zieleResponse.ok) {
          ziele = await zieleResponse.json();
        }
      } catch (error) {
        console.log('Keine Ziele verfügbar');
      }

      setStats({
        trainingsstunden: totalAnwesend,
        anwesenheit: attendancePercentage,
        anwesenheitAnwesend: totalAnwesend,
        anwesenheitMoeglich: moeglich,
        aktuellerGürtel,
        naechsterGuertel,
        monatsDaten: monthlyData,
        ziele: ziele
      });

      // Lade Vergleichsdaten
      await loadComparisonData();

    } catch (error) {
      console.error('Fehler beim Laden der Statistiken:', error);
      // Zeige leere Daten statt Mock-Daten
      setStats({
        trainingsstunden: 0,
        anwesenheit: 0,
        aktuellerGürtel: 'Nicht verfügbar',
        naechsterGuertel: '-',
        trainingswochen: 0,
        durchschnittlicheStunden: 0,
        laengsteSerie: 0,
        aktuelleSerie: 0,
        pruefungen: [],
        monatsDaten: [],
        ziele: []
      });
    } finally {
      setLoading(false);
    }
  };

  // Hilfsfunktion: Monatsdaten aus Anwesenheit berechnen
  const calculateMonthlyData = (attendanceData) => {
    if (!Array.isArray(attendanceData) || attendanceData.length === 0) {
      return [];
    }

    const monthMap = {};
    attendanceData.forEach(entry => {
      if (!entry.datum || entry.anwesend !== 1) return;

      const date = new Date(entry.datum);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
      const monthLabel = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;

      if (!monthMap[monthKey]) {
        monthMap[monthKey] = {
          monat: monthLabel,
          stunden: 0,
          tage: 0,
          sortKey: monthKey
        };
      }

      monthMap[monthKey].stunden += 1;
      monthMap[monthKey].tage += 1;
    });

    // Sortiere nach Datum und nehme die letzten 6 Monate
    return Object.values(monthMap)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .slice(-6);
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-content">
          <div className="member-stats-loading">
            <div className="loading-spinner"></div>
            <p>Lade Statistiken...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <MemberHeader />
      <div className="dashboard-content">
        <div className="member-stats">
          <div className="stats-header">
            <h1>
              <BarChart3 size={32} />
              Meine Statistiken
            </h1>
            <p>Dein Trainingsfortschritt und deine Erfolge im Überblick</p>
          </div>

          {/* Hauptstatistiken */}
          <div className="stats-grid">
            <div className="stat-card primary">
              <div className="stat-icon">
                <Clock size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-number">{stats.trainingsstunden}</div>
                <div className="stat-label">Trainingsstunden</div>
                <div className="stat-trend">+12 diese Woche</div>
              </div>
            </div>

            <div className="stat-card success">
              <div className="stat-icon">
                <TrendingUp size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-number">{stats.anwesenheit !== null ? `${stats.anwesenheit}%` : '—'}</div>
                <div className="stat-label">Anwesenheit</div>
                {stats.anwesenheitMoeglich > 0 && (
                  <div className="stat-trend">{stats.anwesenheitAnwesend} / {stats.anwesenheitMoeglich}</div>
                )}
              </div>
            </div>

            <div className="stat-card warning">
              <div className="stat-icon">
                <Award size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-number">{stats.aktuellerGürtel}</div>
                <div className="stat-label">Aktueller Gürtel</div>
                <div className="stat-trend">Nächster: {stats.naechsterGuertel}</div>
              </div>
            </div>

            <div className="stat-card info">
              <div className="stat-icon">
                <Target size={24} />
              </div>
              <div className="stat-content">
                <div className="stat-number">{stats.aktuelleSerie}</div>
                <div className="stat-label">Trainingstage in Serie</div>
                <div className="stat-trend">Best: {stats.laengsteSerie} Tage</div>
              </div>
            </div>
          </div>

          {/* Vergleich mit anderen */}
          {comparisonData && (
            <div className="stats-section">
              <h2>
                <TrendingUp size={20} />
                Vergleich mit anderen Mitgliedern
              </h2>
              <div className="comparison-grid">
                {Object.entries(comparisonData).map(([key, data]) => {
                  const labels = {
                    trainingsstunden: 'Trainingsstunden',
                    anwesenheit: 'Anwesenheit (%)',
                    trainingswochen: 'Trainingswochen'
                  };
                  
                  const getPerformanceLevel = (percentile) => {
                    if (percentile >= 90) return { level: 'Top 10%', color: 'var(--success)', icon: '🥇' };
                    if (percentile >= 75) return { level: 'Sehr gut', color: 'var(--info)', icon: '🥈' };
                    if (percentile >= 50) return { level: 'Überdurchschnittlich', color: '#8B5CF6', icon: '🥉' };
                    if (percentile >= 25) return { level: 'Durchschnittlich', color: 'var(--warning)', icon: '📊' };
                    return { level: 'Verbesserung möglich', color: 'var(--error)', icon: '📈' };
                  };
                  
                  const performance = getPerformanceLevel(data.percentile);
                  
                  return (
                    <div key={key} className="comparison-card">
                      <div className="comparison-header">
                        <h3>{labels[key]}</h3>
                        <div className="performance-badge" style={{ '--perf-color': performance.color }}>
                          <span>{performance.icon}</span>
                          <span>{performance.level}</span>
                        </div>
                      </div>
                      
                      <div className="comparison-values">
                        <div className="value-row">
                          <span className="label">Dein Wert:</span>
                          <span className="value primary">{data.deinWert}{key === 'anwesenheit' ? '%' : key === 'trainingsstunden' ? 'h' : ''}</span>
                        </div>
                        <div className="value-row">
                          <span className="label">Durchschnitt:</span>
                          <span className="value">{data.durchschnitt}{key === 'anwesenheit' ? '%' : key === 'trainingsstunden' ? 'h' : ''}</span>
                        </div>
                        <div className="value-row">
                          <span className="label">Top 10%:</span>
                          <span className="value top">{data.top10Prozent}{key === 'anwesenheit' ? '%' : key === 'trainingsstunden' ? 'h' : ''}</span>
                        </div>
                      </div>
                      
                      <div className="comparison-bar">
                        <div className="bar-container">
                          <div className="bar-average" style={{ width: `${(data.durchschnitt / data.top10Prozent) * 100}%` }}></div>
                          <div className="bar-top"></div>
                          <div className="bar-your" style={{ width: `${(data.deinWert / data.top10Prozent) * 100}%` }}></div>
                        </div>
                        <div className="bar-labels">
                          <span>Durchschnitt</span>
                          <span>Dein Wert</span>
                          <span>Top 10%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="comparison-note">
                <p>📊 Basierend auf anonymisierten Daten aller aktiven Mitglieder</p>
              </div>
            </div>
          )}

          {/* Prüfungsverlauf */}
          <div className="stats-section">
            <h2>
              <Trophy size={20} />
              Prüfungsverlauf
            </h2>
            <div className="pruefungen-list">
              {stats.pruefungen?.map((pruefung, index) => (
                <div key={index} className="pruefung-item">
                  <div className="pruefung-date">
                    {new Date(pruefung.datum).toLocaleDateString('de-DE')}
                  </div>
                  <div className="pruefung-details">
                    <div className="pruefung-guertel">{pruefung.guertel} Gürtel</div>
                    <div className={`pruefung-status ${pruefung.status}`}>
                      {pruefung.status === 'bestanden' ? '✅ Bestanden' : pruefung.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Monatliche Trainingsdaten */}
          <div className="stats-section">
            <h2>
              <Calendar size={20} />
              Trainingsstunden pro Monat
            </h2>
            <div className="training-chart-wrapper">
              {/* Balkendiagramm */}
              <div className="training-chart training-chart-positioned">
                {stats.monatsDaten?.map((monat, index) => {
                  const maxStunden = Math.max(...stats.monatsDaten.map(m => m.stunden));
                  const avgStunden = stats.monatsDaten.reduce((sum, m) => sum + m.stunden, 0) / stats.monatsDaten.length;

                  // Berechne die Höhe relativ zum Maximum (von 0% bis 100%)
                  const barHeight = maxStunden > 0 ? (monat.stunden / maxStunden) * 100 : 0;

                  // Bestimme die Farbe basierend auf dem Wert
                  let barClass = 'medium';
                  if (monat.stunden >= avgStunden * 1.1) {
                    barClass = 'high';
                  } else if (monat.stunden <= avgStunden * 0.9) {
                    barClass = 'low';
                  }

                  return (
                    <div
                      key={index}
                      className="chart-bar chart-bar-clickable"
                    >
                      <div
                        className="bar-container bar-container-col"
                        onClick={() => {
                          console.log('Balken geklickt, Monat:', monat);
                          setSelectedMonth(monat);
                          // Extrahiere Jahr und Monat aus dem monat String (z.B. "Aug 2023")
                          const [monthName, year] = monat.monat.split(' ');
                          const monthNumber = new Date(Date.parse(monthName + " 1, 2000")).getMonth() + 1;
                          loadMonthDetails(monthNumber, year, memberData?.mitglied_id);
                          setShowMonthDetails(true);
                        }}
                      >
                        <div
                          className={`bar-fill ${barClass}`}
                          style={{ height: `${Math.max(barHeight, 10)}%` }}
                        >
                          <span className="bar-fill-label">{monat.stunden}h</span>
                        </div>
                      </div>
                      <div className="bar-label">{monat.monat}</div>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>

          {/* Ziele und Fortschritt - nur anzeigen wenn Ziele existieren */}
          {stats.ziele && stats.ziele.length > 0 && (
            <div className="stats-section">
              <h2>
                <Target size={20} />
                Deine Ziele
              </h2>
              <div className="goals-list">
                {stats.ziele.map((ziel, index) => (
                  <div key={index} className="goal-item">
                    <div className="goal-progress">
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${ziel.fortschritt_prozent || 0}%` }}></div>
                      </div>
                      <span>{ziel.titel}</span>
                    </div>
                    <div className="goal-status">
                      {ziel.messbar && ziel.ziel_wert ?
                        `${ziel.aktueller_wert || 0}/${ziel.ziel_wert} (${ziel.fortschritt_prozent || 0}%)` :
                        ziel.status === 'erreicht' ? '✅ Erreicht' : 'In Arbeit'
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Monatsdetails Popup */}
      {showMonthDetails && selectedMonth && (
        <div className="month-details-overlay" onClick={() => setShowMonthDetails(false)}>
          <div className="month-details-popup" onClick={(e) => e.stopPropagation()}>
            <div className="month-details-header">
              <h3>Trainingsdetails - {selectedMonth.monat}</h3>
              <button 
                className="close-button"
                onClick={() => setShowMonthDetails(false)}
              >
                <X size={20} />
              </button>
            </div>
            <div className="month-details-content">
              <div className="month-summary">
                <div className="summary-item">
                  <Calendar size={16} />
                  <span>{selectedMonth.tage} Trainingstage</span>
                </div>
                <div className="summary-item">
                  <Clock size={16} />
                  <span>{selectedMonth.stunden} Trainingsstunden</span>
                </div>
              </div>
              <div className="training-days-list">
                <h4>Trainingsdaten:</h4>
                {monthDetails.length > 0 ? (
                  monthDetails.map((tag, index) => (
                    <div key={index} className="training-day-item">
                      <div className="training-date">
                        <Calendar size={14} />
                        <span>{new Date(tag.datum).toLocaleDateString('de-DE')}</span>
                      </div>
                      <div className="training-details">
                        <div className="training-time">
                          <Clock size={14} />
                          <span>{tag.uhrzeit || tag.stunde}</span>
                        </div>
                        <div className="training-course">
                          <Trophy size={14} />
                          <span>{tag.kurs_name || tag.kurs || tag.gruppenname}</span>
                        </div>
                        <div className="training-trainer">
                          <Award size={14} />
                          <span>{tag.trainer_name || tag.trainer}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-data">
                    <p>Keine Trainingsdaten für diesen Monat verfügbar.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberStats;