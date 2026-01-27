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
import { fetchWithAuth } from '../utils/fetchWithAuth';


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
  const [showMonatsreport, setShowMonatsreport] = useState(false);
  const [monatsreportData, setMonatsreportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  
  useEffect(() => {
    loadBeitraegeStats();
    // 🔄 AUTOMATISCHES UPDATE: Lädt neu wenn sich Mitglieder ändern
    // 🔒 TAX COMPLIANCE: Lädt neu wenn Dojo-Filter ändert
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
      
      // API-Aufrufe für Beitrags-Statistiken
      const dojoFilterParam = getDojoFilterParam(); // 🔒 TAX COMPLIANCE: Dojo-Filter
      const separator = dojoFilterParam ? '?' : '';
      const [
        mitgliederResponse,
        vertraegeResponse
      ] = await Promise.all([
        fetchWithAuth(`${config.apiBaseUrl}/mitglieder${separator}${dojoFilterParam}`),
        fetchWithAuth(`${config.apiBaseUrl}/vertraege${separator}${dojoFilterParam}`)
      ]);

      if (!mitgliederResponse.ok || !vertraegeResponse.ok) {
        throw new Error('Fehler beim Laden der Daten');
      }

      const mitgliederData = await mitgliederResponse.json();
      const vertraegeData = await vertraegeResponse.json();

      // Handle both array and object responses
      const mitglieder = Array.isArray(mitgliederData) ? mitgliederData : (mitgliederData.data || []);
      const vertraege = Array.isArray(vertraegeData) ? vertraegeData : (vertraegeData.data || []);

      // Berechne Statistiken basierend auf echten Daten
      // API liefert bereits nur aktive Mitglieder (WHERE aktiv = 1)
      const aktiveMitglieder = mitglieder.length;
      const aktiveVertraege = vertraege.filter(v => v.status === 'aktiv');
      
      // Berechne monatliche Einnahmen
      const monatlicheEinnahmen = aktiveVertraege.reduce((sum, vertrag) => {
        return sum + (parseFloat(vertrag.monatsbeitrag) || 0);
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
                onClick={() => navigate('/dashboard/rabattsystem')}
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
                onClick={loadMonatsreport}
                disabled={reportLoading}
              >
                {reportLoading ? 'Lädt...' : 'Monatsreport'}
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

      {/* Monatsreport Modal */}
      {showMonatsreport && monatsreportData && (
        <div 
          className="modal-overlay" 
          onClick={() => setShowMonatsreport(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(5px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem'
          }}
        >
          <div 
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'rgba(26, 26, 46, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 215, 0, 0.3)',
              borderRadius: '20px',
              padding: '2rem',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ 
                color: '#ffd700', 
                fontSize: '1.75rem', 
                margin: 0,
                textShadow: '0 2px 8px rgba(0, 0, 0, 0.9), 0 0 4px rgba(255, 215, 0, 0.6)'
              }}>
                Monatsreport {new Date(monatsreportData.jahr, monatsreportData.monat - 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
              </h2>
              <button
                onClick={() => setShowMonatsreport(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                ✕
              </button>
            </div>

            {/* Umsätze */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ color: '#ffd700', marginBottom: '1rem', fontSize: '1.25rem' }}>Umsätze</h3>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.05)', 
                  padding: '1rem', 
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 215, 0, 0.2)'
                }}>
                  <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Gesamtumsatz</div>
                  <div style={{ color: '#ffd700', fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {formatCurrency(monatsreportData.umsaetze.gesamt)}
                  </div>
                </div>
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.05)', 
                  padding: '1rem', 
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 215, 0, 0.2)'
                }}>
                  <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Umsatz Verkauf</div>
                  <div style={{ color: '#ffd700', fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {formatCurrency(monatsreportData.umsaetze.verkauf.brutto)}
                  </div>
                  <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    {monatsreportData.umsaetze.verkauf.anzahl} Verkäufe
                  </div>
                </div>
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.05)', 
                  padding: '1rem', 
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 215, 0, 0.2)'
                }}>
                  <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Umsatz Beiträge</div>
                  <div style={{ color: '#ffd700', fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {formatCurrency(monatsreportData.umsaetze.beitraege.gesamt)}
                  </div>
                  <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    {monatsreportData.umsaetze.beitraege.anzahl} Rechnungen
                  </div>
                </div>
              </div>
            </div>

            {/* Neue Verträge */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ color: '#ffd700', marginBottom: '1rem', fontSize: '1.25rem' }}>
                Neue Verträge ({monatsreportData.neueVertraege.anzahl})
              </h3>
              {monatsreportData.neueVertraege.liste.length > 0 ? (
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.05)', 
                  padding: '1rem', 
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 215, 0, 0.2)',
                  maxHeight: '200px',
                  overflow: 'auto'
                }}>
                  {monatsreportData.neueVertraege.liste.map((vertrag) => (
                    <div key={vertrag.vertrag_id} style={{ 
                      padding: '0.75rem', 
                      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ color: '#fff', fontWeight: '600' }}>{vertrag.mitglied_name}</div>
                        <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.875rem' }}>
                          {vertrag.vertragsnummer} • {formatDate(vertrag.vertragsbeginn)}
                        </div>
                      </div>
                      <div style={{ color: '#ffd700', fontWeight: 'bold' }}>
                        {formatCurrency(vertrag.monatsbeitrag)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontStyle: 'italic' }}>Keine neuen Verträge</div>
              )}
            </div>

            {/* Kündigungen */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ color: '#ffd700', marginBottom: '1rem', fontSize: '1.25rem' }}>
                Kündigungen ({monatsreportData.kuendigungen.anzahl})
              </h3>
              {monatsreportData.kuendigungen.liste.length > 0 ? (
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.05)', 
                  padding: '1rem', 
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 215, 0, 0.2)',
                  maxHeight: '200px',
                  overflow: 'auto'
                }}>
                  {monatsreportData.kuendigungen.liste.map((kuendigung) => (
                    <div key={kuendigung.vertrag_id} style={{ 
                      padding: '0.75rem', 
                      borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <div style={{ color: '#fff', fontWeight: '600' }}>{kuendigung.mitglied_name}</div>
                      <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.875rem' }}>
                        {kuendigung.vertragsnummer} • Kündigungsdatum: {formatDate(kuendigung.kuendigungsdatum)}
                      </div>
                      {kuendigung.kuendigungsgrund && (
                        <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                          Grund: {kuendigung.kuendigungsgrund}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontStyle: 'italic' }}>Keine Kündigungen</div>
              )}
            </div>

            {/* Pausen */}
            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ color: '#ffd700', marginBottom: '1rem', fontSize: '1.25rem' }}>
                Pausen ({monatsreportData.pausen.anzahl})
              </h3>
              {monatsreportData.pausen.liste.length > 0 ? (
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.05)', 
                  padding: '1rem', 
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 215, 0, 0.2)',
                  maxHeight: '200px',
                  overflow: 'auto'
                }}>
                  {monatsreportData.pausen.liste.map((pause) => (
                    <div key={pause.vertrag_id} style={{ 
                      padding: '0.75rem', 
                      borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <div style={{ color: '#fff', fontWeight: '600' }}>{pause.mitglied_name}</div>
                      <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.875rem' }}>
                        {pause.vertragsnummer} • Von: {formatDate(pause.ruhepause_von)} bis: {formatDate(pause.ruhepause_bis)}
                      </div>
                      {pause.ruhepause_dauer_monate && (
                        <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                          Dauer: {pause.ruhepause_dauer_monate} Monate
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontStyle: 'italic' }}>Keine Pausen</div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Beitraege;
