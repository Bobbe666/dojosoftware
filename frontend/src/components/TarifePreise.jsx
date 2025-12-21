import React, { useState, useEffect } from "react";
import {
  DollarSign,
  Package,
  Percent,
  Users,
  Calendar,
  Settings,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Tag,
  Clock,
  CreditCard,
  Calculator,
  ChevronDown,
  ChevronUp,
  Baby,
  User,
  GraduationCap
} from "lucide-react";
import axios from 'axios';
import "../styles/themes.css";       // Centralized theme system
import "../styles/components.css";   // Universal component styles
import "../styles/TarifePreise.css";

// Übersetze billing_cycle ins Deutsche
function translateBillingCycle(cycle) {
  if (!cycle) return '';
  const cycleMap = {
    'monthly': 'Monatlich',
    'monatlich': 'Monatlich',
    'quarterly': 'Vierteljährlich',
    'vierteljaehrlich': 'Vierteljährlich',
    'semi-annually': 'Halbjährlich',
    'halbjaehrlich': 'Halbjährlich',
    'annually': 'Jährlich',
    'jaehrlich': 'Jährlich',
    'yearly': 'Jährlich'
  };
  return cycleMap[cycle.toLowerCase()] || cycle;
}

const TarifePreise = () => {
  const [tarife, setTarife] = useState([]);
  const [rabatte, setRabatte] = useState([]);
  const [zahlungszyklen, setZahlungszyklen] = useState([]);
  const [laufzeiten, setLaufzeiten] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTarif, setEditingTarif] = useState(null);
  const [editingRabatt, setEditingRabatt] = useState(null);
  const [showNewTarif, setShowNewTarif] = useState(false);
  const [showNewRabatt, setShowNewRabatt] = useState(false);
  const [kinderCollapsed, setKinderCollapsed] = useState(false);
  const [studentenCollapsed, setStudentenCollapsed] = useState(false);
  const [erwachseneCollapsed, setErwachseneCollapsed] = useState(false);
  const [individuellCollapsed, setIndividuellCollapsed] = useState(false);
  const [alteTarifeCollapsed, setAlteTarifeCollapsed] = useState(true);
  const [showNewIndividuell, setShowNewIndividuell] = useState(false);

  const [newIndividuell, setNewIndividuell] = useState({
    name: "",
    duration_months: "",
    mindestlaufzeit_monate: "",
    kuendigungsfrist_monate: "",
    price_cents: "",
    aufnahmegebuehr_cents: 4999 // Standard: 49,99 EUR
  });

  const [newTarif, setNewTarif] = useState({
    name: "",
    price_cents: "",
    aufnahmegebuehr_cents: 4999, // Standard: 49,99 EUR
    currency: "EUR",
    duration_months: "",
    billing_cycle: "monthly",
    payment_method: "bank_transfer",
    active: true
  });

  const [newRabatt, setNewRabatt] = useState({
    name: "",
    beschreibung: "",
    rabatt_prozent: "",
    gueltig_von: "",
    gueltig_bis: "",
    max_nutzungen: "",
    aktiv: true
  });

  useEffect(() => {
    loadTarifeUndRabatte();
  }, []);

  const loadTarifeUndRabatte = async () => {
    try {
      setLoading(true);

      // Alle benötigten APIs laden
      const [tarifeResponse, rabatteResponse, zahlungszyklenResponse, laufzeitenResponse] = await Promise.all([
        axios.get('/tarife'),
        axios.get('/tarife/rabatte'),
        axios.get('/zahlungszyklen').catch(() => ({ data: { data: [] } })),
        axios.get('/laufzeiten').catch(() => ({ data: { data: [] } }))
      ]);

      const tarifeData = tarifeResponse.data;
      const rabatteData = rabatteResponse.data;
      const zahlungszyklenData = zahlungszyklenResponse.data;
      const laufzeitenData = laufzeitenResponse.data;

      if (tarifeData.success && rabatteData.success) {
        // Mapping für neues API Format (price_cents, duration_months, etc.)
        const mappedTarife = tarifeData.data.map(tarif => ({
          id: tarif.id,
          name: tarif.name,
          price_euros: (tarif.price_cents / 100).toFixed(2), // Cents to Euros
          price_cents: tarif.price_cents,
          aufnahmegebuehr_euros: ((tarif.aufnahmegebuehr_cents || 4999) / 100).toFixed(2),
          aufnahmegebuehr_cents: tarif.aufnahmegebuehr_cents || 4999,
          currency: tarif.currency || 'EUR',
          duration_months: tarif.duration_months,
          billing_cycle: tarif.billing_cycle,
          payment_method: tarif.payment_method,
          active: tarif.active === 1,
          ist_archiviert: tarif.ist_archiviert === 1 || tarif.ist_archiviert === true,
          // Helper für Kategorisierung - erweiterte Logik
          isChildRate: (tarif.name.toLowerCase().includes('kinder') ||
                       tarif.name.toLowerCase().includes('kids') ||
                       tarif.name.toLowerCase().includes('jugendliche')) &&
                       !tarif.name.toLowerCase().includes('studenten') &&
                       !tarif.name.toLowerCase().includes('schüler'),
          isStudentRate: tarif.name.toLowerCase().includes('studenten') ||
                        tarif.name.toLowerCase().includes('schüler') ||
                        tarif.name.toLowerCase().includes('kids'),
          isAdultRate: tarif.name.toLowerCase().includes('erwachsene') ||
                      tarif.name.toLowerCase().includes('18+')
        }));

        const mappedRabatte = rabatteData.data.map(rabatt => ({
          id: rabatt.rabatt_id,
          name: rabatt.name,
          beschreibung: rabatt.beschreibung,
          rabatt_prozent: parseFloat(rabatt.rabatt_prozent),
          gueltig_von: rabatt.gueltig_von,
          gueltig_bis: rabatt.gueltig_bis,
          max_nutzungen: rabatt.max_nutzungen,
          aktiv: rabatt.aktiv === 1,
          genutzt: rabatt.genutzt || 0
        }));

        setTarife(mappedTarife);
        setRabatte(mappedRabatte);
        console.log('Zahlungszyklen geladen:', zahlungszyklenData.data || []);
        setZahlungszyklen(zahlungszyklenData.data || []);
        setLaufzeiten(laufzeitenData.data || []);
      } else {
        console.error('API Error:', tarifeData.error || rabatteData.error);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Tarife und Rabatte:', error);
    } finally {
      setLoading(false);
    }
  };

  // Berechne Brutto-Beitrag
  const calculateBruttoBeitrag = (beitrag, mwst) => {
    const netto = parseFloat(beitrag) || 0;
    const steuer = parseFloat(mwst) || 19;
    return (netto * (1 + steuer / 100)).toFixed(2);
  };

  const handleSaveTarif = async (tarifData) => {
    try {
      let response;
      if (tarifData.id) {
        response = await axios.put(`/tarife/${tarifData.id}`, tarifData);
      } else {
        response = await axios.post('/tarife', tarifData);
      }

      const result = response.data;

      if (result.success) {
        await loadTarifeUndRabatte();
        setShowNewTarif(false);
        setEditingTarif(null);
        // Reset form
        setNewTarif({
          name: "",
          price_cents: "",
          aufnahmegebuehr_cents: 4999,
          currency: "EUR",
          duration_months: "",
          billing_cycle: "monthly",
          payment_method: "bank_transfer",
          active: true
        });
      } else {
        alert('Fehler beim Speichern: ' + result.error);
      }
    } catch (error) {
      console.error('Fehler beim Speichern des Tarifs:', error);
      alert('Fehler beim Speichern des Tarifs');
    }
  };

  const handleDeleteTarif = async (tarifId) => {
    if (window.confirm('Sind Sie sicher, dass Sie diesen Tarif löschen möchten?')) {
      try {
        const response = await axios.delete(`/tarife/${tarifId}`);
        const result = response.data;

        if (result.success) {
          await loadTarifeUndRabatte();
        } else {
          alert('Fehler beim Löschen: ' + result.error);
        }
      } catch (error) {
        console.error('Fehler beim Löschen des Tarifs:', error);
        alert('Fehler beim Löschen des Tarifs');
      }
    }
  };

  const handleArchiveTarif = async (tarifId, currentStatus) => {
    const newStatus = !currentStatus;
    const confirmMessage = newStatus
      ? 'Diesen Tarif als "Alter Tarif" markieren? Er wird dann nicht mehr für neue Mitglieder verfügbar sein.'
      : 'Diesen Tarif reaktivieren? Er wird dann wieder für neue Mitglieder verfügbar sein.';

    if (window.confirm(confirmMessage)) {
      try {
        const response = await axios.patch(`/tarife/${tarifId}/archivieren`, {
          ist_archiviert: newStatus
        });

        if (response.data.success) {
          await loadTarifeUndRabatte();
        } else {
          alert('Fehler beim Archivieren: ' + response.data.error);
        }
      } catch (error) {
        console.error('Fehler beim Archivieren des Tarifs:', error);
        alert('Fehler beim Archivieren des Tarifs');
      }
    }
  };

  if (loading) {
    return (
      <div className="tarife-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Lade Tarif-Daten...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tarife-container">
      <div className="tarife-header">
        <h1>💰 Tarife & Preise</h1>
        <p>Verwalte alle Mitgliedstarife, Zahlungszyklen und Preisstrukturen</p>
      </div>

      {/* Statistik-Übersicht */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-icon">
            <Package size={32} />
          </div>
          <div className="stat-info">
            <h3>Aktive Tarife</h3>
            <p className="stat-value">{tarife.filter(t => t.active).length}</p>
            <span className="stat-trend">von {tarife.length} Gesamt</span>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">
            <Baby size={32} />
          </div>
          <div className="stat-info">
            <h3>Kinder-Tarife</h3>
            <p className="stat-value">{tarife.filter(t => t.isChildRate && !t.ist_archiviert).length}</p>
            <span className="stat-trend">verfügbar</span>
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-icon">
            <GraduationCap size={32} />
          </div>
          <div className="stat-info">
            <h3>Studenten-Tarife</h3>
            <p className="stat-value">{tarife.filter(t => t.isStudentRate && !t.ist_archiviert).length}</p>
            <span className="stat-trend">verfügbar</span>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon">
            <User size={32} />
          </div>
          <div className="stat-info">
            <h3>Erwachsenen-Tarife</h3>
            <p className="stat-value">{tarife.filter(t => t.isAdultRate && !t.ist_archiviert).length}</p>
            <span className="stat-trend">verfügbar</span>
          </div>
        </div>

        <div className="stat-card purple">
          <div className="stat-icon">
            <DollarSign size={32} />
          </div>
          <div className="stat-info">
            <h3>Durchschnittspreis</h3>
            <p className="stat-value">
              €{tarife.length > 0 ? (tarife.reduce((sum, t) => sum + parseFloat(t.price_euros), 0) / tarife.length).toFixed(2) : '0.00'}
            </p>
            <span className="stat-trend">monatlich</span>
          </div>
        </div>
      </div>

      {/* Kinder-Tarife Sektion */}
      <div className="section">
        <div
          className="section-header collapsible"
          onClick={() => setKinderCollapsed(!kinderCollapsed)}
        >
          <h2>
            <Baby size={24} /> Kinder & Jugendliche (6-17 Jahre)
            <span className="tarif-count">({tarife.filter(t => t.isChildRate && !t.ist_archiviert).length})</span>
          </h2>
          <div className="header-actions">
            <button
              className="btn btn-primary"
              onClick={(e) => {
                e.stopPropagation();
                setShowNewTarif(true);
              }}
            >
              <Plus size={20} />
              Neuer Tarif
            </button>
            {kinderCollapsed ? <ChevronDown size={24} /> : <ChevronUp size={24} />}
          </div>
        </div>

        {!kinderCollapsed && (
          <div className="tarife-grid">
            {tarife.filter(tarif => tarif.isChildRate && !tarif.ist_archiviert).map(tarif => (
              <div key={tarif.id} className="tarif-card">
                <div className="tarif-header">
                  <div className="tarif-title">
                    <h3>{tarif.name}</h3>
                    <span className={`status-badge ${tarif.active ? 'active' : 'inactive'}`}>
                      {tarif.active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </div>
                  <div className="tarif-actions">
                    <button
                      className="action-btn edit"
                      onClick={() => setEditingTarif(tarif)}
                      title="Bearbeiten"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={() => handleDeleteTarif(tarif.id)}
                      title="Löschen"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button
                      className="action-btn archive"
                      onClick={() => handleArchiveTarif(tarif.id, tarif.ist_archiviert)}
                      title={tarif.ist_archiviert ? "Reaktivieren" : "Als alter Tarif markieren"}
                      style={{
                        backgroundColor: tarif.ist_archiviert ? '#10b981' : '#f59e0b',
                        color: 'white'
                      }}
                    >
                      {tarif.ist_archiviert ? '↺' : '📦'}
                    </button>
                  </div>
                </div>

                <div className="tarif-price">
                  <span className="currency">€</span>{tarif.price_euros}
                  <span className="period">/Monat</span>
                </div>

                <div className="tarif-details">
                  <div className="detail-item">
                    <span className="label">
                      <DollarSign size={14} /> Aufnahmegebühr
                    </span>
                    <div className="value">€{tarif.aufnahmegebuehr_euros}</div>
                  </div>
                  <div className="detail-item">
                    <span className="label">
                      <Calendar size={14} /> Laufzeit
                    </span>
                    <div className="value">{tarif.duration_months} Monate</div>
                  </div>
                  <div className="detail-item">
                    <span className="label">
                      <CreditCard size={14} /> Zahlungsmethode
                    </span>
                    <div className="value">
                      {tarif.payment_method === 'SEPA' ? 'SEPA-Lastschrift' :
                       tarif.payment_method === 'BANK_TRANSFER' ? 'Banküberweisung' :
                       tarif.payment_method === 'CARD' ? 'Kreditkarte' :
                       tarif.payment_method === 'PAYPAL' ? 'PayPal' :
                       tarif.payment_method}
                    </div>
                  </div>
                  <div className="detail-item">
                    <span className="label">
                      <Clock size={14} /> Abrechnung
                    </span>
                    <div className="value">
                      {translateBillingCycle(tarif.billing_cycle)}
                    </div>
                  </div>
                  <div className="detail-item">
                    <span className="label">
                      <Tag size={14} /> Währung
                    </span>
                    <div className="value">{tarif.currency}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Studenten & Schüler Tarife Sektion */}
      <div className="section">
        <div
          className="section-header collapsible"
          onClick={() => setStudentenCollapsed(!studentenCollapsed)}
        >
          <h2>
            <GraduationCap size={24} /> Studenten & Schüler Tarife (18+)
            <span className="tarif-count">({tarife.filter(t => t.isStudentRate && !t.ist_archiviert).length})</span>
          </h2>
          <div className="header-actions">
            <button
              className="btn btn-primary"
              onClick={(e) => {
                e.stopPropagation();
                setShowNewTarif(true);
              }}
            >
              <Plus size={20} />
              Neuer Tarif
            </button>
            {studentenCollapsed ? <ChevronDown size={24} /> : <ChevronUp size={24} />}
          </div>
        </div>

        {!studentenCollapsed && (
          <div className="tarife-grid">
            {tarife.filter(tarif => tarif.isStudentRate && !tarif.ist_archiviert).map(tarif => (
              <div key={tarif.id} className="tarif-card">
                <div className="tarif-header">
                  <div className="tarif-title">
                    <h3>{tarif.name}</h3>
                    <span className={`status-badge ${tarif.active ? 'active' : 'inactive'}`}>
                      {tarif.active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </div>
                  <div className="tarif-actions">
                    <button
                      className="action-btn edit"
                      onClick={() => setEditingTarif(tarif)}
                      title="Bearbeiten"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={() => handleDeleteTarif(tarif.id)}
                      title="Löschen"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button
                      className="action-btn archive"
                      onClick={() => handleArchiveTarif(tarif.id, tarif.ist_archiviert)}
                      title={tarif.ist_archiviert ? "Reaktivieren" : "Als alter Tarif markieren"}
                      style={{
                        backgroundColor: tarif.ist_archiviert ? '#10b981' : '#f59e0b',
                        color: 'white'
                      }}
                    >
                      {tarif.ist_archiviert ? '↺' : '📦'}
                    </button>
                  </div>
                </div>

                <div className="tarif-price">
                  <span className="currency">€</span>{tarif.price_euros}
                  <span className="period">/Monat</span>
                </div>

                <div className="tarif-details">
                  <div className="detail-item">
                    <span className="label">
                      <DollarSign size={14} /> Aufnahmegebühr
                    </span>
                    <div className="value">€{tarif.aufnahmegebuehr_euros}</div>
                  </div>
                  <div className="detail-item">
                    <span className="label">
                      <Calendar size={14} /> Laufzeit
                    </span>
                    <div className="value">{tarif.duration_months} Monate</div>
                  </div>
                  <div className="detail-item">
                    <span className="label">
                      <CreditCard size={14} /> Zahlungsmethode
                    </span>
                    <div className="value">
                      {tarif.payment_method === 'SEPA' ? 'SEPA-Lastschrift' :
                       tarif.payment_method === 'BANK_TRANSFER' ? 'Banküberweisung' :
                       tarif.payment_method === 'CARD' ? 'Kreditkarte' :
                       tarif.payment_method === 'PAYPAL' ? 'PayPal' :
                       tarif.payment_method}
                    </div>
                  </div>
                  <div className="detail-item">
                    <span className="label">
                      <Clock size={14} /> Abrechnung
                    </span>
                    <div className="value">
                      {translateBillingCycle(tarif.billing_cycle)}
                    </div>
                  </div>
                  <div className="detail-item">
                    <span className="label">
                      <Tag size={14} /> Währung
                    </span>
                    <div className="value">{tarif.currency}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Erwachsenen-Tarife Sektion */}
      <div className="section">
        <div
          className="section-header collapsible"
          onClick={() => setErwachseneCollapsed(!erwachseneCollapsed)}
        >
          <h2>
            <User size={24} /> Erwachsenen-Tarife (18+)
            <span className="tarif-count">({tarife.filter(t => t.isAdultRate && !t.ist_archiviert).length})</span>
          </h2>
          <div className="header-actions">
            <button
              className="btn btn-primary"
              onClick={(e) => {
                e.stopPropagation();
                setShowNewTarif(true);
              }}
            >
              <Plus size={20} />
              Neuer Tarif
            </button>
            {erwachseneCollapsed ? <ChevronDown size={24} /> : <ChevronUp size={24} />}
          </div>
        </div>

        {!erwachseneCollapsed && (
          <div className="tarife-grid">
            {tarife.filter(tarif => tarif.isAdultRate && !tarif.ist_archiviert).map(tarif => (
              <div key={tarif.id} className="tarif-card">
                <div className="tarif-header">
                  <div className="tarif-title">
                    <h3>{tarif.name}</h3>
                    <span className={`status-badge ${tarif.active ? 'active' : 'inactive'}`}>
                      {tarif.active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </div>
                  <div className="tarif-actions">
                    <button
                      className="action-btn edit"
                      onClick={() => setEditingTarif(tarif)}
                      title="Bearbeiten"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={() => handleDeleteTarif(tarif.id)}
                      title="Löschen"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button
                      className="action-btn archive"
                      onClick={() => handleArchiveTarif(tarif.id, tarif.ist_archiviert)}
                      title={tarif.ist_archiviert ? "Reaktivieren" : "Als alter Tarif markieren"}
                      style={{
                        backgroundColor: tarif.ist_archiviert ? '#10b981' : '#f59e0b',
                        color: 'white'
                      }}
                    >
                      {tarif.ist_archiviert ? '↺' : '📦'}
                    </button>
                  </div>
                </div>

                <div className="tarif-price">
                  <span className="currency">€</span>{tarif.price_euros}
                  <span className="period">/Monat</span>
                </div>

                <div className="tarif-details">
                  <div className="detail-item">
                    <span className="label">
                      <DollarSign size={14} /> Aufnahmegebühr
                    </span>
                    <div className="value">€{tarif.aufnahmegebuehr_euros}</div>
                  </div>
                  <div className="detail-item">
                    <span className="label">
                      <Calendar size={14} /> Laufzeit
                    </span>
                    <div className="value">{tarif.duration_months} Monate</div>
                  </div>
                  <div className="detail-item">
                    <span className="label">
                      <CreditCard size={14} /> Zahlungsmethode
                    </span>
                    <div className="value">
                      {tarif.payment_method === 'SEPA' ? 'SEPA-Lastschrift' :
                       tarif.payment_method === 'BANK_TRANSFER' ? 'Banküberweisung' :
                       tarif.payment_method === 'CARD' ? 'Kreditkarte' :
                       tarif.payment_method === 'PAYPAL' ? 'PayPal' :
                       tarif.payment_method}
                    </div>
                  </div>
                  <div className="detail-item">
                    <span className="label">
                      <Clock size={14} /> Abrechnung
                    </span>
                    <div className="value">
                      {translateBillingCycle(tarif.billing_cycle)}
                    </div>
                  </div>
                  <div className="detail-item">
                    <span className="label">
                      <Tag size={14} /> Währung
                    </span>
                    <div className="value">{tarif.currency}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Alte Tarife Sektion */}
      <div className="section">
        <div
          className="section-header collapsible"
          onClick={() => setAlteTarifeCollapsed(!alteTarifeCollapsed)}
          style={{
            background: 'rgba(107, 114, 128, 0.1)',
            borderLeft: '4px solid #6b7280'
          }}
        >
          <h2 style={{ color: '#6b7280' }}>
            <Package size={24} /> Alte Tarife (Archiviert)
            <span className="tarif-count">({tarife.filter(t => t.ist_archiviert).length})</span>
          </h2>
          <div className="header-actions">
            {alteTarifeCollapsed ? <ChevronDown size={24} /> : <ChevronUp size={24} />}
          </div>
        </div>

        {!alteTarifeCollapsed && (
          <>
            {tarife.filter(t => t.ist_archiviert).length === 0 ? (
              <div className="info-box" style={{ background: 'rgba(107, 114, 128, 0.05)' }}>
                <p style={{ color: '#6b7280' }}>
                  Keine archivierten Tarife vorhanden. Tarife können über den 📦-Button archiviert werden.
                </p>
              </div>
            ) : (
              <div className="tarife-grid">
                {tarife.filter(tarif => tarif.ist_archiviert).map(tarif => (
                  <div key={tarif.id} className="tarif-card" style={{ opacity: 0.7, border: '2px solid #6b7280' }}>
                    <div className="tarif-header">
                      <div className="tarif-title">
                        <h3>{tarif.name}</h3>
                        <span className="status-badge" style={{ background: '#6b7280' }}>
                          Archiviert
                        </span>
                      </div>
                      <div className="tarif-actions">
                        <button
                          className="action-btn edit"
                          onClick={() => setEditingTarif(tarif)}
                          title="Bearbeiten"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          className="action-btn delete"
                          onClick={() => handleDeleteTarif(tarif.id)}
                          title="Löschen"
                        >
                          <Trash2 size={16} />
                        </button>
                        <button
                          className="action-btn archive"
                          onClick={() => handleArchiveTarif(tarif.id, tarif.ist_archiviert)}
                          title={tarif.ist_archiviert ? "Reaktivieren" : "Als alter Tarif markieren"}
                          style={{
                            backgroundColor: tarif.ist_archiviert ? '#10b981' : '#f59e0b',
                            color: 'white'
                          }}
                        >
                          {tarif.ist_archiviert ? '↺' : '📦'}
                        </button>
                      </div>
                    </div>

                    <div className="tarif-price">
                      <span className="currency">€</span>{tarif.price_euros}
                      <span className="period">/Monat</span>
                    </div>

                    <div className="tarif-details">
                      <div className="detail-item">
                        <span className="label">
                          <DollarSign size={14} /> Aufnahmegebühr
                        </span>
                        <div className="value">€{tarif.aufnahmegebuehr_euros}</div>
                      </div>
                      <div className="detail-item">
                        <span className="label">
                          <Calendar size={14} /> Laufzeit
                        </span>
                        <div className="value">{tarif.duration_months} Monate</div>
                      </div>
                      <div className="detail-item">
                        <span className="label">
                          <CreditCard size={14} /> Zahlungsmethode
                        </span>
                        <div className="value">
                          {tarif.payment_method === 'SEPA' ? 'SEPA-Lastschrift' :
                           tarif.payment_method === 'BANK_TRANSFER' ? 'Banküberweisung' :
                           tarif.payment_method === 'CARD' ? 'Kreditkarte' :
                           tarif.payment_method === 'PAYPAL' ? 'PayPal' :
                           tarif.payment_method}
                        </div>
                      </div>
                      <div className="detail-item">
                        <span className="label">
                          <Clock size={14} /> Abrechnung
                        </span>
                        <div className="value">
                          {translateBillingCycle(tarif.billing_cycle)}
                        </div>
                      </div>
                      <div className="detail-item">
                        <span className="label">
                          <Tag size={14} /> Währung
                        </span>
                        <div className="value">{tarif.currency}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Individuelle Verträge (Admin Only) */}
      <div className="tarif-section">
        <div
          className="section-header collapsible"
          onClick={() => setIndividuellCollapsed(!individuellCollapsed)}
        >
          <h2>
            <Settings size={24} /> Individuelle Verträge
            <span className="tarif-count">(Admin Only)</span>
          </h2>
          <div className="header-actions">
            <button
              className="btn btn-primary"
              onClick={(e) => {
                e.stopPropagation();
                setShowNewIndividuell(true);
              }}
            >
              <Plus size={20} />
              Neuer individueller Vertrag
            </button>
            {individuellCollapsed ? <ChevronDown size={24} /> : <ChevronUp size={24} />}
          </div>
        </div>

        {!individuellCollapsed && (
          <div className="info-box">
            <p>
              Hier können individuelle Verträge mit benutzerdefinierten Konditionen erstellt werden.
              Diese Funktion ist nur für Administratoren verfügbar.
            </p>
          </div>
        )}
      </div>

      {/* Modal für individuellen Vertrag */}
      {showNewIndividuell && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Neuer individueller Vertrag</h3>
              <button
                className="close-btn"
                onClick={() => setShowNewIndividuell(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Vertragsname *</label>
                <input
                  type="text"
                  value={newIndividuell.name}
                  onChange={(e) => setNewIndividuell({...newIndividuell, name: e.target.value})}
                  placeholder="z.B. Individualtarif Max Mustermann"
                />
              </div>

              <div className="form-group">
                <label>Laufzeit (Monate) *</label>
                <input
                  type="number"
                  min="1"
                  value={newIndividuell.duration_months}
                  onChange={(e) => setNewIndividuell({...newIndividuell, duration_months: e.target.value})}
                  placeholder="z.B. 12"
                />
              </div>

              <div className="form-group">
                <label>Vertragsdauer/Mindestlaufzeit (Monate) *</label>
                <input
                  type="number"
                  min="1"
                  value={newIndividuell.mindestlaufzeit_monate}
                  onChange={(e) => setNewIndividuell({...newIndividuell, mindestlaufzeit_monate: e.target.value})}
                  placeholder="z.B. 12"
                />
              </div>

              <div className="form-group">
                <label>Kündigungsfrist (Monate) *</label>
                <input
                  type="number"
                  min="0"
                  value={newIndividuell.kuendigungsfrist_monate}
                  onChange={(e) => setNewIndividuell({...newIndividuell, kuendigungsfrist_monate: e.target.value})}
                  placeholder="z.B. 3"
                />
              </div>

              <div className="form-group">
                <label>Monatlicher Beitrag (€) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newIndividuell.price_cents ? (newIndividuell.price_cents / 100).toFixed(2) : ''}
                  onChange={(e) => setNewIndividuell({...newIndividuell, price_cents: Math.round(parseFloat(e.target.value || 0) * 100)})}
                  placeholder="z.B. 49.90"
                />
              </div>

              <div className="form-group">
                <label>Aufnahmegebühr (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newIndividuell.aufnahmegebuehr_cents ? (newIndividuell.aufnahmegebuehr_cents / 100).toFixed(2) : ''}
                  onChange={(e) => setNewIndividuell({...newIndividuell, aufnahmegebuehr_cents: Math.round(parseFloat(e.target.value || 0) * 100)})}
                  placeholder="49.99"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowNewIndividuell(false)}
              >
                Abbrechen
              </button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    await axios.post('/tarife', {
                      name: newIndividuell.name,
                      duration_months: parseInt(newIndividuell.duration_months),
                      mindestlaufzeit_monate: parseInt(newIndividuell.mindestlaufzeit_monate),
                      kuendigungsfrist_monate: parseInt(newIndividuell.kuendigungsfrist_monate),
                      price_cents: newIndividuell.price_cents,
                      aufnahmegebuehr_cents: newIndividuell.aufnahmegebuehr_cents,
                      currency: 'EUR',
                      billing_cycle: 'MONTHLY',
                      payment_method: 'SEPA',
                      active: true
                    });
                    setShowNewIndividuell(false);
                    setNewIndividuell({
                      name: "",
                      duration_months: "",
                      mindestlaufzeit_monate: "",
                      kuendigungsfrist_monate: "",
                      price_cents: "",
                      aufnahmegebuehr_cents: 4999
                    });
                    loadTarifeUndRabatte();
                    alert('Individueller Vertrag erfolgreich erstellt!');
                  } catch (error) {
                    console.error('Fehler beim Erstellen:', error);
                    alert('Fehler beim Erstellen: ' + (error.response?.data?.error || error.message));
                  }
                }}
              >
                <Save size={20} />
                Vertrag erstellen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Neuer Tarif Modal */}
      {showNewTarif && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Neuer Tarif</h3>
              <button
                className="close-btn"
                onClick={() => setShowNewTarif(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              {/* Name - volle Breite */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500' }}>
                  Name *
                </label>
                <input
                  type="text"
                  value={newTarif.name}
                  onChange={(e) => setNewTarif({...newTarif, name: e.target.value})}
                  placeholder="Tarif-Bezeichnung"
                  style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                />
              </div>

              {/* Preis & Aufnahmegebühr - 2 Spalten */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Preis (€) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newTarif.price_cents ? (newTarif.price_cents / 100).toFixed(2) : ''}
                    onChange={(e) => setNewTarif({...newTarif, price_cents: Math.round(parseFloat(e.target.value || 0) * 100)})}
                    placeholder="0.00"
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Aufnahmegebühr (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newTarif.aufnahmegebuehr_cents ? (newTarif.aufnahmegebuehr_cents / 100).toFixed(2) : ''}
                    onChange={(e) => setNewTarif({...newTarif, aufnahmegebuehr_cents: Math.round(parseFloat(e.target.value || 0) * 100)})}
                    placeholder="49.99"
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              {/* Laufzeit & Zahlungsintervall - 2 Spalten */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Laufzeit (Monate) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newTarif.duration_months}
                    onChange={(e) => setNewTarif({...newTarif, duration_months: parseInt(e.target.value) || ''})}
                    placeholder="12"
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Zahlungsintervall *
                  </label>
                  <select
                    value={newTarif.billing_cycle}
                    onChange={(e) => setNewTarif({...newTarif, billing_cycle: e.target.value})}
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                  >
                    <option value="">Bitte wählen...</option>
                    {zahlungszyklen.length > 0 ? (
                      zahlungszyklen.map(zyklus => {
                        const cycleValue = zyklus.name?.toLowerCase() || zyklus.intervall?.toLowerCase() || '';
                        return (
                          <option key={zyklus.id || zyklus.zyklus_id} value={cycleValue}>
                            {zyklus.name || zyklus.intervall}
                          </option>
                        );
                      })
                    ) : (
                      <>
                        <option value="daily">Täglich</option>
                        <option value="weekly">Wöchentlich</option>
                        <option value="monthly">Monatlich</option>
                        <option value="quarterly">Vierteljährlich</option>
                        <option value="yearly">Jährlich</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Zahlungsmethode & Währung - 2 Spalten */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Zahlungsmethode *
                  </label>
                  <select
                    value={newTarif.payment_method}
                    onChange={(e) => setNewTarif({...newTarif, payment_method: e.target.value})}
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                  >
                    <option value="bank_transfer">Banküberweisung</option>
                    <option value="direct_debit">Lastschrift</option>
                    <option value="credit_card">Kreditkarte</option>
                    <option value="cash">Bar</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Währung
                  </label>
                  <select
                    value={newTarif.currency}
                    onChange={(e) => setNewTarif({...newTarif, currency: e.target.value})}
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="CHF">CHF</option>
                  </select>
                </div>
              </div>

              {/* Status */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newTarif.active}
                    onChange={(e) => setNewTarif({...newTarif, active: e.target.checked})}
                  />
                  Tarif ist aktiv
                </label>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowNewTarif(false)}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  Abbrechen
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handleSaveTarif(newTarif)}
                  disabled={!newTarif.name || !newTarif.price_cents || !newTarif.duration_months}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Save size={16} />
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tarif bearbeiten Modal */}
      {editingTarif && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Tarif bearbeiten</h3>
              <button
                className="close-btn"
                onClick={() => setEditingTarif(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              {/* Name - volle Breite */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500' }}>
                  Name *
                </label>
                <input
                  type="text"
                  value={editingTarif.name}
                  onChange={(e) => setEditingTarif({...editingTarif, name: e.target.value})}
                  placeholder="Tarif-Bezeichnung"
                  style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                />
              </div>

              {/* Preis & Aufnahmegebühr - 2 Spalten */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Preis (€) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingTarif.price_euros || ''}
                    onChange={(e) => setEditingTarif({
                      ...editingTarif,
                      price_euros: e.target.value,
                      price_cents: Math.round(parseFloat(e.target.value || 0) * 100)
                    })}
                    placeholder="0.00"
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Aufnahmegebühr (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingTarif.aufnahmegebuehr_euros || ''}
                    onChange={(e) => setEditingTarif({
                      ...editingTarif,
                      aufnahmegebuehr_euros: e.target.value,
                      aufnahmegebuehr_cents: Math.round(parseFloat(e.target.value || 0) * 100)
                    })}
                    placeholder="49.99"
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              {/* Laufzeit & Zahlungsintervall - 2 Spalten */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Laufzeit (Monate) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editingTarif.duration_months}
                    onChange={(e) => setEditingTarif({...editingTarif, duration_months: parseInt(e.target.value) || ''})}
                    placeholder="12"
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Zahlungsintervall *
                  </label>
                  <select
                    value={editingTarif.billing_cycle?.toUpperCase() || ''}
                    onChange={(e) => setEditingTarif({...editingTarif, billing_cycle: e.target.value})}
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                  >
                    <option value="">Bitte wählen...</option>
                    <option value="MONTHLY">Monatlich</option>
                    <option value="QUARTERLY">Vierteljährlich</option>
                    <option value="YEARLY">Jährlich</option>
                  </select>
                </div>
              </div>

              {/* Zahlungsmethode & Währung - 2 Spalten */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Zahlungsmethode *
                  </label>
                  <select
                    value={editingTarif.payment_method?.toUpperCase() || ''}
                    onChange={(e) => setEditingTarif({...editingTarif, payment_method: e.target.value})}
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                  >
                    <option value="SEPA">SEPA</option>
                    <option value="CARD">Kreditkarte</option>
                    <option value="PAYPAL">PayPal</option>
                    <option value="BANK_TRANSFER">Banküberweisung</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Währung
                  </label>
                  <select
                    value={editingTarif.currency}
                    onChange={(e) => setEditingTarif({...editingTarif, currency: e.target.value})}
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="CHF">CHF</option>
                  </select>
                </div>
              </div>

              {/* Status */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingTarif.active}
                    onChange={(e) => setEditingTarif({...editingTarif, active: e.target.checked})}
                  />
                  Tarif ist aktiv
                </label>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setEditingTarif(null)}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  Abbrechen
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handleSaveTarif(editingTarif)}
                  disabled={!editingTarif.name || !editingTarif.price_cents || !editingTarif.duration_months}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Save size={16} />
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TarifePreise;