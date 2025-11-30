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
  Filter
} from "lucide-react";
import { useMitgliederUpdate } from '../context/MitgliederUpdateContext.jsx';
import { useDojoContext } from '../context/DojoContext.jsx'; // 🔒 TAX COMPLIANCE: Dojo-Filter
import config from "../config/config";
import "../styles/themes.css";       // Centralized theme system
import "../styles/components.css";   // Universal component styles  
import "../styles/Beitraege.css";

const Beitraege = () => {
  const navigate = useNavigate();
  const { updateTrigger } = useMitgliederUpdate(); // 🔄 Automatische Updates nach Mitgliedsanlage
  const { getDojoFilterParam, activeDojo, filter } = useDojoContext(); // 🔒 TAX COMPLIANCE: Dojo-Filter
  const [stats, setStats] = useState({
    totalEinnahmen: 0,
    offeneRechnungen: 0,
    aktiveMitglieder: 0,
    monatlicheEinnahmen: 0
  });
  
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadBeitraegeStats();
    // 🔄 AUTOMATISCHES UPDATE: Lädt neu wenn sich Mitglieder ändern
    // 🔒 TAX COMPLIANCE: Lädt neu wenn Dojo-Filter ändert
  }, [updateTrigger, activeDojo, filter]);

  const loadBeitraegeStats = async () => {
    try {
      setLoading(true);
      
      // API-Aufrufe für Beitrags-Statistiken
      const dojoFilterParam = getDojoFilterParam(); // 🔒 TAX COMPLIANCE: Dojo-Filter
      const separator = dojoFilterParam ? '?' : '';
      const [
        mitgliederResponse,
        vertraegeResponse
      ] = await Promise.all([
        fetch(`${config.apiBaseUrl}/mitglieder${separator}${dojoFilterParam}`),
        fetch(`${config.apiBaseUrl}/vertraege${separator}${dojoFilterParam}`)
      ]);

      if (!mitgliederResponse.ok || !vertraegeResponse.ok) {
        throw new Error('Fehler beim Laden der Daten');
      }

      const mitgliederData = await mitgliederResponse.json();
      const vertraegeData = await vertraegeResponse.json();

      const mitglieder = mitgliederData.data || [];
      const vertraege = vertraegeData.data || [];

      // Berechne Statistiken basierend auf echten Daten
      const aktiveMitglieder = mitglieder.filter(m => m.status === 'aktiv').length;
      const aktiveVertraege = vertraege.filter(v => v.status === 'aktiv');
      
      // Berechne monatliche Einnahmen
      const monatlicheEinnahmen = aktiveVertraege.reduce((sum, vertrag) => {
        return sum + (parseFloat(vertrag.monatlicher_beitrag) || 0);
      }, 0);

      // Berechne Gesamteinnahmen (vereinfacht: 12 Monate)
      const totalEinnahmen = monatlicheEinnahmen * 12;
      
      // TODO: Echte API für offene Rechnungen implementieren
      const offeneRechnungen = 0; // Placeholder bis echte Rechnungs-API verfügbar ist

      setStats({
        totalEinnahmen,
        offeneRechnungen,
        aktiveMitglieder,
        monatlicheEinnahmen
      });
      
      setLoading(false);
    } catch (error) {
      console.error('Fehler beim Laden der Beitrags-Statistiken:', error);
      setStats({
        totalEinnahmen: 0,
        offeneRechnungen: 0,
        aktiveMitglieder: 0,
        monatlicheEinnahmen: 0
      });
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="beitraege-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Lade Beitragsdaten...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="beitraege-container">
      <div className="beitraege-header">
        <h1>💰 Beitrags-Verwaltung</h1>
        <p>Verwalte alle Mitgliedsbeiträge, Rechnungen und Zahlungen zentral</p>
      </div>

      {/* Statistik-Übersicht */}
      <div className="stats-grid">
        <div className="stat-card positive">
          <div className="stat-icon">
            <TrendingUp size={32} />
          </div>
          <div className="stat-info">
            <h3>Gesamteinnahmen</h3>
            <p className="stat-value">€{stats.totalEinnahmen.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</p>
            <span className="stat-trend">+12% vs. Vormonat</span>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon">
            <AlertCircle size={32} />
          </div>
          <div className="stat-info">
            <h3>Offene Rechnungen</h3>
            <p className="stat-value">€{stats.offeneRechnungen.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</p>
            <span className="stat-trend">7 Rechnungen offen</span>
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-icon">
            <Users size={32} />
          </div>
          <div className="stat-info">
            <h3>Aktive Mitglieder</h3>
            <p className="stat-value">{stats.aktiveMitglieder}</p>
            <span className="stat-trend">Zahlende Mitglieder</span>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">
            <PiggyBank size={32} />
          </div>
          <div className="stat-info">
            <h3>Monatliche Einnahmen</h3>
            <p className="stat-value">€{stats.monatlicheEinnahmen.toLocaleString('de-DE', { minimumFractionDigits: 2 })}</p>
            <span className="stat-trend">Durchschnitt</span>
          </div>
        </div>
      </div>

      {/* Management-Bereiche */}
      <div className="management-grid">
        {/* LASTSCHRIFTEN CARD - ERSTE POSITION */}
        <div className="standard-card">
          <div className="card-icon">
            <CreditCard size={48} />
          </div>
          <div className="card-content">
            <h3>Lastschriften</h3>
            <p>SEPA-Lastschriftlauf generieren, Mandate verwalten und an Bank übermitteln</p>
            <div className="card-actions">
              <button
                className="btn btn-primary"
                onClick={() => navigate('/dashboard/lastschriftlauf')}
              >
                Lastschriftlauf
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => navigate('/dashboard/sepa-mandate')}
              >
                SEPA-Mandate
              </button>
            </div>
          </div>
        </div>

        <div className="standard-card">
          <div className="card-icon">
            <Receipt size={48} />
          </div>
          <div className="card-content">
            <h3>Rechnungen erstellen</h3>
            <p>Neue Rechnungen für Mitgliedsbeiträge, Kurse oder Sonderleistungen erstellen</p>
            <div className="card-actions">
              <button
                className="btn btn-primary"
                onClick={() => navigate('/dashboard/rechnungen')}
              >
                Rechnungen verwalten
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => alert('Vorlagenverwaltung wird implementiert')}
              >
                Vorlagen verwalten
              </button>
            </div>
          </div>
        </div>

        <div className="standard-card">
          <div className="card-icon">
            <CreditCard size={48} />
          </div>
          <div className="card-content">
            <h3>Zahlungen verwalten</h3>
            <p>Eingehende Zahlungen erfassen, Zahlungsarten verwalten und SEPA-Lastschriften</p>
            <div className="card-actions">
              <button 
                className="btn btn-primary"
                onClick={() => alert('Zahlungserfassung wird implementiert')}
              >
                Zahlung erfassen
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => alert('SEPA-Verwaltung wird implementiert')}
              >
                SEPA-Verwaltung
              </button>
            </div>
          </div>
        </div>

        <div className="standard-card">
          <div className="card-icon">
            <AlertCircle size={48} />
          </div>
          <div className="card-content">
            <h3>Mahnwesen</h3>
            <p>Offene Rechnungen überwachen, Mahnungen versenden und Zahlungserinnerungen</p>
            <div className="card-actions">
              <button
                className="btn btn-primary"
                onClick={() => navigate('/dashboard/mahnwesen')}
              >
                Offene Posten
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => navigate('/dashboard/mahnstufen-einstellungen')}
              >
                Mahnstufen
              </button>
            </div>
          </div>
        </div>

        <div className="standard-card">
          <div className="card-icon">
            <DollarSign size={48} />
          </div>
          <div className="card-content">
            <h3>Tarife & Preise</h3>
            <p>Mitgliedstarife definieren, Sonderpreise verwalten und Rabatte konfigurieren</p>
            <div className="card-actions">
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/dashboard/tarife')}
              >
                Tarife bearbeiten
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => navigate('/dashboard/tarife')}
              >
                Rabatt-System
              </button>
            </div>
          </div>
        </div>

        <div className="standard-card">
          <div className="card-icon">
            <FileText size={48} />
          </div>
          <div className="card-content">
            <h3>Berichte & Export</h3>
            <p>Finanzberichte erstellen, Umsatzstatistiken anzeigen und Daten exportieren</p>
            <div className="card-actions">
              <button 
                className="btn btn-info"
                onClick={() => alert('Monatsreport wird generiert...')}
              >
                Monatsreport
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => alert('Datenexport wird implementiert')}
              >
                Daten exportieren
              </button>
            </div>
          </div>
        </div>

        <div className="standard-card">
          <div className="card-icon">
            <Calendar size={48} />
          </div>
          <div className="card-content">
            <h3>Zahlungszyklen</h3>
            <p>Wiederkehrende Rechnungen automatisieren und Zahlungsintervalle verwalten</p>
            <div className="card-actions">
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/dashboard/zahlungszyklen')}
              >
                Zyklen verwalten
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => alert('Zahlungsplan wird implementiert')}
              >
                Zahlungsplan
              </button>
            </div>
          </div>
        </div>

        <div className="standard-card">
          <div className="card-icon">
            <Search size={48} />
          </div>
          <div className="card-content">
            <h3>Suche & Filter</h3>
            <p>Zahlungen durchsuchen, nach Kriterien filtern und Transaktionen analysieren</p>
            <div className="card-actions">
              <button className="btn btn-info">
                Erweiterte Suche
              </button>
              <button className="btn btn-secondary">
                Transaktionslog
              </button>
            </div>
          </div>
        </div>

        <div className="standard-card">
          <div className="card-icon">
            <Settings size={48} />
          </div>
          <div className="card-content">
            <h3>Einstellungen</h3>
            <p>Zahlungsmethoden konfigurieren, Steuereinstellungen und Rechnungsvorlagen</p>
            <div className="card-actions">
              <button className="btn btn-secondary">
                Konfiguration
              </button>
              <button className="btn btn-secondary">
                Vorlagen
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h2>Schnellzugriff</h2>
        <div className="action-buttons">
          <button 
            className="action-btn success"
            onClick={() => alert('Schnelle Zahlungserfassung wird geöffnet')}
          >
            <DollarSign size={20} />
            Schnelle Zahlung erfassen
          </button>
          <button 
            className="action-btn primary"
            onClick={() => alert('Sammelrechnungserstellung wird geöffnet')}
          >
            <Receipt size={20} />
            Sammelrechnung erstellen
          </button>
          <button 
            className="action-btn warning"
            onClick={() => alert('Mahnungsversand wird vorbereitet')}
          >
            <AlertCircle size={20} />
            Mahnungen versenden
          </button>
          <button 
            className="action-btn info"
            onClick={() => alert('Monatsabschluss wird durchgeführt')}
          >
            <FileText size={20} />
            Monatsabschluss
          </button>
        </div>
      </div>
    </div>
  );
};

export default Beitraege;
