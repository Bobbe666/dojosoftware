import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  CreditCard,
  DollarSign,
  Users,
  Calendar,
  FileText,
  AlertCircle,
  TrendingUp,
  PiggyBank,
  Receipt,
  Settings,
  Search,
  ArrowDownToDot,
  BarChart3
} from "lucide-react";
import { useMitgliederUpdate } from '../context/MitgliederUpdateContext.jsx';
import { useDojoContext } from '../context/DojoContext.jsx'; // 🔒 TAX COMPLIANCE: Dojo-Filter
import config from "../config/config";
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/Beitraege.css";
import { fetchWithAuth } from '../utils/fetchWithAuth';


const Beitraege = () => {
  const navigate = useNavigate();
  const { updateTrigger } = useMitgliederUpdate();
  const { getDojoFilterParam, activeDojo, filter } = useDojoContext(); // 🔒 TAX COMPLIANCE

  const [stats, setStats] = useState({
    totalEinnahmen: 0,
    offeneRechnungen: 0,       // € Summe offener Rechnungen
    offeneAnzahl: 0,           // Anzahl offener Rechnungen
    ueberfaelligeAnzahl: 0,    // Anzahl überfälliger Rechnungen
    aktiveMitglieder: 0,
    monatlicheEinnahmen: 0
  });

  const [loading, setLoading] = useState(true);
  const [showMonatsreport, setShowMonatsreport] = useState(false);
  const [monatsreportData, setMonatsreportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    loadBeitraegeStats();
  }, [updateTrigger, activeDojo, filter]);

  const loadMonatsreport = async () => {
    try {
      setReportLoading(true);
      const dojoFilterParam = getDojoFilterParam();
      const separator = dojoFilterParam ? '&' : '?';
      const response = await fetchWithAuth(`${config.apiBaseUrl}/monatsreport${dojoFilterParam ? `?${dojoFilterParam}` : ''}${separator}${dojoFilterParam ? '' : '?'}`);
      const data = await response.json();
      if (data.success) {
        setMonatsreportData(data);
        setShowMonatsreport(true);
      } else {
        alert('Fehler beim Laden des Monatsreports: ' + (data.error || 'Unbekannter Fehler'));
      }
    } catch (error) {
      console.error('Fehler beim Laden des Monatsreports:', error);
      alert('Fehler beim Laden des Monatsreports');
    } finally {
      setReportLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const loadBeitraegeStats = async () => {
    try {
      setLoading(true);

      const dojoFilterParam = getDojoFilterParam(); // 🔒 TAX COMPLIANCE
      const separator = dojoFilterParam ? '?' : '';

      // Basis-Daten: Mitglieder + Verträge
      const [mitgliederResponse, vertraegeResponse] = await Promise.all([
        fetchWithAuth(`${config.apiBaseUrl}/mitglieder${separator}${dojoFilterParam}`),
        fetchWithAuth(`${config.apiBaseUrl}/vertraege${separator}${dojoFilterParam}`)
      ]);

      if (!mitgliederResponse.ok || !vertraegeResponse.ok) {
        throw new Error('Fehler beim Laden der Daten');
      }

      const mitgliederData = await mitgliederResponse.json();
      const vertraegeData = await vertraegeResponse.json();

      const mitglieder = Array.isArray(mitgliederData) ? mitgliederData : (mitgliederData.data || []);
      const vertraege = Array.isArray(vertraegeData) ? vertraegeData : (vertraegeData.data || []);

      const aktiveMitglieder = mitglieder.length;
      const aktiveVertraege = vertraege.filter(v => v.status === 'aktiv');
      const monatlicheEinnahmen = aktiveVertraege.reduce((sum, v) => sum + (parseFloat(v.monatsbeitrag) || 0), 0);
      const totalEinnahmen = monatlicheEinnahmen * 12;

      // Rechnungs-Statistiken (Feature: Buchhaltung / Premium)
      let offeneRechnungen = 0;
      let offeneAnzahl = 0;
      let ueberfaelligeAnzahl = 0;

      try {
        const rechnungsResponse = await fetchWithAuth(
          `${config.apiBaseUrl}/rechnungen/statistiken${dojoFilterParam ? `?${dojoFilterParam}` : ''}`
        );
        if (rechnungsResponse.ok) {
          const rechnungsData = await rechnungsResponse.json();
          if (rechnungsData.success && rechnungsData.data) {
            offeneRechnungen = parseFloat(rechnungsData.data.offene_summe) || 0;
            offeneAnzahl = parseInt(rechnungsData.data.offene_rechnungen) || 0;
            ueberfaelligeAnzahl = parseInt(rechnungsData.data.ueberfaellige_rechnungen) || 0;
          }
        }
      } catch (rechnungsError) {
        // Feature nicht verfügbar — silently fallback to 0
        console.info('Rechnungs-Statistiken nicht verfügbar:', rechnungsError.message);
      }

      setStats({ totalEinnahmen, offeneRechnungen, offeneAnzahl, ueberfaelligeAnzahl, aktiveMitglieder, monatlicheEinnahmen });
      setLoading(false);
    } catch (error) {
      console.error('Fehler beim Laden der Beitrags-Statistiken:', error);
      setStats({ totalEinnahmen: 0, offeneRechnungen: 0, offeneAnzahl: 0, ueberfaelligeAnzahl: 0, aktiveMitglieder: 0, monatlicheEinnahmen: 0 });
      setLoading(false);
    }
  };

  // Trend-Text für Offene Rechnungen
  const offeneTrendText = stats.offeneAnzahl === 0
    ? 'Keine offenen Rechnungen'
    : `${stats.offeneAnzahl} offen · ${stats.ueberfaelligeAnzahl > 0 ? `${stats.ueberfaelligeAnzahl} überfällig` : 'alle aktuell'}`;

  if (loading) {
    return (
      <div className="beitraege-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Lade Beitragsdaten…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="beitraege-container">

      {/* Header */}
      <div className="beitraege-header">
        <div className="beitraege-header-icon">
          <Receipt size={20} />
        </div>
        <div>
          <h1>Beitrags-Verwaltung</h1>
          <p>Mitgliedsbeiträge, Rechnungen und Zahlungen zentral verwalten</p>
        </div>
      </div>

      {/* Statistik-Übersicht */}
      <div className="stats-grid">
        <div className="stat-card positive">
          <div className="stat-icon"><TrendingUp size={26} /></div>
          <div className="stat-info">
            <h3>Gesamteinnahmen</h3>
            <p className="stat-value">
              {stats.totalEinnahmen.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </p>
            <span className="stat-trend">Hochrechnung 12 Monate</span>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon"><AlertCircle size={26} /></div>
          <div className="stat-info">
            <h3>Offene Rechnungen</h3>
            <p className="stat-value">
              {stats.offeneRechnungen.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </p>
            <span className="stat-trend">{offeneTrendText}</span>
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-icon"><Users size={26} /></div>
          <div className="stat-info">
            <h3>Aktive Mitglieder</h3>
            <p className="stat-value">{stats.aktiveMitglieder}</p>
            <span className="stat-trend">Zahlende Mitglieder</span>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon"><PiggyBank size={26} /></div>
          <div className="stat-info">
            <h3>Monatliche Einnahmen</h3>
            <p className="stat-value">
              {stats.monatlicheEinnahmen.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
            </p>
            <span className="stat-trend">Laufende Verträge</span>
          </div>
        </div>
      </div>

      {/* Management-Bereiche */}
      <div className="management-grid">

        {/* Lastschriften */}
        <div className="standard-card">
          <div className="card-icon"><CreditCard size={24} /></div>
          <div className="card-content">
            <h3>Lastschriften</h3>
            <p>SEPA-Lastschriftlauf generieren, Mandate verwalten und an Bank übermitteln</p>
            <div className="card-actions">
              <button className="btn btn-primary" onClick={() => navigate('/dashboard/lastschriftlauf')}>
                Lastschriftlauf
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/dashboard/sepa-mandate')}>
                SEPA-Mandate
              </button>
            </div>
          </div>
        </div>

        {/* Rechnungen */}
        <div className="standard-card">
          <div className="card-icon"><Receipt size={24} /></div>
          <div className="card-content">
            <h3>Rechnungen</h3>
            <p>Rechnungen erstellen, verwalten, als PDF exportieren und Zahlungen buchen</p>
            <div className="card-actions">
              <button className="btn btn-primary" onClick={() => navigate('/dashboard/rechnungen')}>
                Rechnungen
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/dashboard/berichte')}>
                Berichte
              </button>
            </div>
          </div>
        </div>

        {/* Zahlungsläufe — neu statt "Zahlungen verwalten" */}
        <div className="standard-card">
          <div className="card-icon"><ArrowDownToDot size={24} /></div>
          <div className="card-content">
            <h3>Zahlungsläufe</h3>
            <p>SEPA- und Stripe-Zahlungsläufe einsehen, Transaktionen verwalten und Zahlungen buchen</p>
            <div className="card-actions">
              <button className="btn btn-primary" onClick={() => navigate('/dashboard/zahllaeufe')}>
                Zahlungsläufe
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/dashboard/rechnungen')}>
                Zahlung buchen
              </button>
            </div>
          </div>
        </div>

        {/* Mahnwesen */}
        <div className="standard-card">
          <div className="card-icon"><AlertCircle size={24} /></div>
          <div className="card-content">
            <h3>Mahnwesen</h3>
            <p>Offene Rechnungen überwachen, Mahnungen versenden und Zahlungserinnerungen</p>
            <div className="card-actions">
              <button className="btn btn-primary" onClick={() => navigate('/dashboard/mahnwesen')}>
                Offene Posten
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/dashboard/mahnstufen-einstellungen')}>
                Mahnstufen
              </button>
            </div>
          </div>
        </div>

        {/* Tarife & Preise */}
        <div className="standard-card">
          <div className="card-icon"><DollarSign size={24} /></div>
          <div className="card-content">
            <h3>Tarife & Preise</h3>
            <p>Mitgliedstarife definieren, Sonderpreise verwalten und Rabatte konfigurieren</p>
            <div className="card-actions">
              <button className="btn btn-primary" onClick={() => navigate('/dashboard/tarife')}>
                Tarife
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/dashboard/rabattsystem')}>
                Rabatt-System
              </button>
            </div>
          </div>
        </div>

        {/* Berichte & Export */}
        <div className="standard-card">
          <div className="card-icon"><BarChart3 size={24} /></div>
          <div className="card-content">
            <h3>Berichte & Export</h3>
            <p>Finanzberichte erstellen, Umsatzstatistiken anzeigen und Daten exportieren</p>
            <div className="card-actions">
              <button className="btn btn-info" onClick={loadMonatsreport} disabled={reportLoading}>
                {reportLoading ? 'Lädt…' : 'Monatsreport'}
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/dashboard/berichte')}>
                Alle Berichte
              </button>
            </div>
          </div>
        </div>

        {/* Zahlungszyklen */}
        <div className="standard-card">
          <div className="card-icon"><Calendar size={24} /></div>
          <div className="card-content">
            <h3>Zahlungszyklen</h3>
            <p>Wiederkehrende Zahlungsintervalle definieren — monatlich, quartalsweise, jährlich</p>
            <div className="card-actions">
              <button className="btn btn-primary" onClick={() => navigate('/dashboard/zahlungszyklen')}>
                Zyklen verwalten
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/dashboard/zahllaeufe')}>
                Zahlungsläufe
              </button>
            </div>
          </div>
        </div>

        {/* Suche & Filter */}
        <div className="standard-card">
          <div className="card-icon"><Search size={24} /></div>
          <div className="card-content">
            <h3>Suche & Filter</h3>
            <p>Rechnungen und Zahlungen durchsuchen, filtern und Transaktionen analysieren</p>
            <div className="card-actions">
              <button className="btn btn-info" onClick={() => navigate('/dashboard/rechnungen')}>
                Rechnungssuche
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/dashboard/zahllaeufe')}>
                Transaktionslog
              </button>
            </div>
          </div>
        </div>

        {/* Einstellungen */}
        <div className="standard-card">
          <div className="card-icon"><Settings size={24} /></div>
          <div className="card-content">
            <h3>Einstellungen</h3>
            <p>Zahlungsmethoden konfigurieren, Tarife verwalten und Rechnungsvorlagen anpassen</p>
            <div className="card-actions">
              <button className="btn btn-secondary" onClick={() => navigate('/dashboard/tarife')}>
                Tarif-Konfiguration
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/dashboard/rechnungen')}>
                Rechnungsvorlagen
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Monatsreport Modal */}
      {showMonatsreport && monatsreportData && (
        <div className="ds-modal-overlay" onClick={() => setShowMonatsreport(false)}>
          <div className="ds-modal ds-modal--md" onClick={(e) => e.stopPropagation()}>

            <div className="ds-modal-header">
              <div>
                <h2 className="ds-modal-title">
                  Monatsreport{' '}
                  {new Date(monatsreportData.jahr, monatsreportData.monat - 1)
                    .toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
                </h2>
                <p className="ds-modal-subtitle">Zusammenfassung der Monatsdaten</p>
              </div>
              <button className="ds-modal-close" onClick={() => setShowMonatsreport(false)}>✕</button>
            </div>
            <div className="ds-modal-body">

            {/* Umsätze */}
            <div className="bericht-section">
              <h3>Umsätze</h3>
              <div className="bericht-stat-grid">
                <div className="bericht-stat-box">
                  <div className="label">Gesamtumsatz</div>
                  <div className="value">{formatCurrency(monatsreportData.umsaetze.gesamt)}</div>
                </div>
                <div className="bericht-stat-box">
                  <div className="label">Umsatz Verkauf</div>
                  <div className="value">{formatCurrency(monatsreportData.umsaetze.verkauf.brutto)}</div>
                  <div className="sub">{monatsreportData.umsaetze.verkauf.anzahl} Verkäufe</div>
                </div>
                <div className="bericht-stat-box">
                  <div className="label">Umsatz Beiträge</div>
                  <div className="value">{formatCurrency(monatsreportData.umsaetze.beitraege.gesamt)}</div>
                  <div className="sub">{monatsreportData.umsaetze.beitraege.anzahl} Rechnungen</div>
                </div>
              </div>
            </div>

            {/* Neue Verträge */}
            <div className="bericht-section">
              <h3>Neue Verträge ({monatsreportData.neueVertraege.anzahl})</h3>
              {monatsreportData.neueVertraege.liste.length > 0 ? (
                <div className="bericht-list">
                  {monatsreportData.neueVertraege.liste.map((vertrag) => (
                    <div key={vertrag.vertrag_id} className="bericht-list-item">
                      <div>
                        <div className="name">{vertrag.mitglied_name}</div>
                        <div className="meta">{vertrag.vertragsnummer} · {formatDate(vertrag.vertragsbeginn)}</div>
                      </div>
                      <div className="amount">{formatCurrency(vertrag.monatsbeitrag)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bericht-empty">Keine neuen Verträge</div>
              )}
            </div>

            {/* Kündigungen */}
            <div className="bericht-section">
              <h3>Kündigungen ({monatsreportData.kuendigungen.anzahl})</h3>
              {monatsreportData.kuendigungen.liste.length > 0 ? (
                <div className="bericht-list">
                  {monatsreportData.kuendigungen.liste.map((kuendigung) => (
                    <div key={kuendigung.vertrag_id} className="bericht-list-item">
                      <div>
                        <div className="name">{kuendigung.mitglied_name}</div>
                        <div className="meta">
                          {kuendigung.vertragsnummer} · Kündigung: {formatDate(kuendigung.kuendigungsdatum)}
                        </div>
                        {kuendigung.kuendigungsgrund && (
                          <div className="meta">Grund: {kuendigung.kuendigungsgrund}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bericht-empty">Keine Kündigungen</div>
              )}
            </div>

            {/* Pausen */}
            <div className="bericht-section">
              <h3>Pausen ({monatsreportData.pausen.anzahl})</h3>
              {monatsreportData.pausen.liste.length > 0 ? (
                <div className="bericht-list">
                  {monatsreportData.pausen.liste.map((pause) => (
                    <div key={pause.vertrag_id} className="bericht-list-item">
                      <div>
                        <div className="name">{pause.mitglied_name}</div>
                        <div className="meta">
                          {pause.vertragsnummer} · Von: {formatDate(pause.ruhepause_von)} bis: {formatDate(pause.ruhepause_bis)}
                        </div>
                        {pause.ruhepause_dauer_monate && (
                          <div className="meta">Dauer: {pause.ruhepause_dauer_monate} Monate</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bericht-empty">Keine Pausen</div>
              )}
            </div>

            </div>{/* ds-modal-body */}
          </div>
        </div>
      )}

    </div>
  );
};

export default Beitraege;
