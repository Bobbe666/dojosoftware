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
import { useDojoContext } from '../context/DojoContext';
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
  const { activeDojo } = useDojoContext();
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

  // Ermittle die dojo_id aus dem aktivem Dojo
  const getDojoId = () => {
    if (!activeDojo || activeDojo === 'super-admin') {
      return null; // Super-Admin sieht alle zentral verwalteten Dojos
    }
    return activeDojo.id;
  };

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
    mindestlaufzeit_monate: "",
    kuendigungsfrist_monate: 3,
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
  }, [activeDojo]); // Neu laden wenn sich das aktive Dojo ändert

  const loadTarifeUndRabatte = async () => {
    try {
      setLoading(true);

      // Dojo-ID für API-Calls
      const dojoId = getDojoId();
      const dojoParam = dojoId ? `?dojo_id=${dojoId}` : '';

      console.log('📊 TarifePreise: Lade Tarife für Dojo:', dojoId, 'activeDojo:', activeDojo);

      // Alle benötigten APIs laden
      const [tarifeResponse, rabatteResponse, zahlungszyklenResponse, laufzeitenResponse] = await Promise.all([
        axios.get(`/tarife${dojoParam}`),
        axios.get(`/tarife/rabatte${dojoParam}`),
        axios.get(`/zahlungszyklen${dojoParam}`).catch(() => ({ data: { data: [] } })),
        axios.get(`/laufzeiten${dojoParam}`).catch(() => ({ data: { data: [] } }))
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
      const dojoId = getDojoId();
      const dojoParam = dojoId ? `?dojo_id=${dojoId}` : '';

      let response;
      if (tarifData.id) {
        response = await axios.put(`/tarife/${tarifData.id}${dojoParam}`, tarifData);
      } else {
        response = await axios.post(`/tarife${dojoParam}`, tarifData);
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
        const dojoId = getDojoId();
        const dojoParam = dojoId ? `?dojo_id=${dojoId}` : '';
        const response = await axios.delete(`/tarife/${tarifId}${dojoParam}`);
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
        const dojoId = getDojoId();
        const dojoParam = dojoId ? `?dojo_id=${dojoId}` : '';
        const response = await axios.put(`/api/tarife/${tarifId}/archivieren${dojoParam}`, {
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

  const handleSetNachfolger = async (tarifId) => {
    const tarif = tarife.find(t => t.id === tarifId);
    if (!tarif) return;

    // Zeige Auswahldialog mit aktiven Tarifen
    const aktiveTarife = tarife.filter(t => !t.ist_archiviert && t.id !== tarifId);
    if (aktiveTarife.length === 0) {
      alert('Keine aktiven Tarife verfügbar. Bitte erstellen Sie zuerst einen neuen Tarif.');
      return;
    }

    const options = aktiveTarife.map(t => `${t.id}: ${t.name} (€${t.price_euros}/Monat)`).join('\n');
    const nachfolgerId = prompt(`Nachfolger-Tarif für "${tarif.name}" festlegen:\n\n${options}\n\nBitte Tarif-ID eingeben (oder leer lassen zum Entfernen):`);

    if (nachfolgerId === null) return; // Abgebrochen

    const nachfolgerTarifId = nachfolgerId.trim() === '' ? null : parseInt(nachfolgerId, 10);

    try {
      const dojoId = getDojoId();
      const dojoParam = dojoId ? `?dojo_id=${dojoId}` : '';
      const response = await axios.put(`/api/tarife/${tarifId}/nachfolger${dojoParam}`, {
        nachfolger_tarif_id: nachfolgerTarifId
      });

      if (response.data.success) {
        alert(nachfolgerTarifId ? 'Nachfolger-Tarif erfolgreich zugewiesen!' : 'Nachfolger-Tarif entfernt');
        await loadTarifeUndRabatte();
      } else {
        alert('Fehler beim Zuweisen: ' + response.data.error);
      }
    } catch (error) {
      console.error('Fehler beim Zuweisen des Nachfolger-Tarifs:', error);
      alert('Fehler beim Zuweisen des Nachfolger-Tarifs');
    }
  };

  const handleMigrateContracts = async (tarifId) => {
    const tarif = tarife.find(t => t.id === tarifId);
    if (!tarif) return;

    // Wenn Nachfolger gesetzt ist, diesen vorschlagen
    const nachfolger = tarif.nachfolger_tarif_id
      ? tarife.find(t => t.id === tarif.nachfolger_tarif_id)
      : null;

    let zielTarifId;
    if (nachfolger) {
      const useNachfolger = window.confirm(
        `Alle aktiven Verträge von "${tarif.name}" auf den Nachfolger-Tarif "${nachfolger.name}" (€${nachfolger.price_euros}/Monat) umstellen?\n\nDies betrifft ALLE Mitglieder mit diesem Tarif!`
      );
      if (!useNachfolger) return;
      zielTarifId = nachfolger.id;
    } else {
      // Zeige Auswahldialog mit aktiven Tarifen
      const aktiveTarife = tarife.filter(t => !t.ist_archiviert && t.id !== tarifId);
      if (aktiveTarife.length === 0) {
        alert('Keine aktiven Tarife verfügbar. Bitte erstellen Sie zuerst einen neuen Tarif.');
        return;
      }

      const options = aktiveTarife.map(t => `${t.id}: ${t.name} (€${t.price_euros}/Monat)`).join('\n');
      const inputId = prompt(`ALLE aktiven Verträge von "${tarif.name}" umstellen auf:\n\n${options}\n\nBitte Ziel-Tarif-ID eingeben:`);

      if (!inputId) return; // Abgebrochen
      zielTarifId = parseInt(inputId, 10);
    }

    try {
      const dojoId = getDojoId();
      const dojoParam = dojoId ? `?dojo_id=${dojoId}` : '';
      const response = await axios.post(`/api/tarife/${tarifId}/migrate-contracts${dojoParam}`, {
        ziel_tarif_id: zielTarifId
      });

      if (response.data.success) {
        alert(`✅ ${response.data.message}\n\nAnzahl migriert: ${response.data.anzahl_migriert}\nNeuer Monatsbeitrag: €${response.data.neuer_monatsbeitrag}`);
        await loadTarifeUndRabatte();
      } else {
        alert('Fehler bei der Migration: ' + response.data.error);
      }
    } catch (error) {
      console.error('Fehler bei der Vertrags-Migration:', error);
      const errorMsg = error.response?.data?.message || error.response?.data?.error || 'Unbekannter Fehler';
      alert(`Fehler bei der Vertrags-Migration: ${errorMsg}`);
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
      <div className="tarife-page-header">
        <div className="tarife-page-header-icon"><DollarSign size={18} /></div>
        <div>
          <h1>Tarife & Preise</h1>
          <p>Mitgliedstarife, Zahlungszyklen und Preisstrukturen verwalten</p>
        </div>
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
                      className={`action-btn archive${tarif.ist_archiviert ? ' is-archived' : ''}`}
                      onClick={() => handleArchiveTarif(tarif.id, tarif.ist_archiviert)}
                      title={tarif.ist_archiviert ? "Reaktivieren" : "Als alter Tarif markieren"}
                    >
                      {tarif.ist_archiviert ? '↺' : '▣'}
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
                      className={`action-btn archive${tarif.ist_archiviert ? ' is-archived' : ''}`}
                      onClick={() => handleArchiveTarif(tarif.id, tarif.ist_archiviert)}
                      title={tarif.ist_archiviert ? "Reaktivieren" : "Als alter Tarif markieren"}
                    >
                      {tarif.ist_archiviert ? '↺' : '▣'}
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
                      className={`action-btn archive${tarif.ist_archiviert ? ' is-archived' : ''}`}
                      onClick={() => handleArchiveTarif(tarif.id, tarif.ist_archiviert)}
                      title={tarif.ist_archiviert ? "Reaktivieren" : "Als alter Tarif markieren"}
                    >
                      {tarif.ist_archiviert ? '↺' : '▣'}
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
          className="section-header collapsible tp-archived-header"
          onClick={() => setAlteTarifeCollapsed(!alteTarifeCollapsed)}
        >
          <h2 className="u-text-muted">
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
              <div className="info-box tp-info-box-gray">
                <p className="u-text-muted">
                  Keine archivierten Tarife vorhanden. Tarife können über den 📦-Button archiviert werden.
                </p>
              </div>
            ) : (
              <div className="tarife-grid">
                {tarife.filter(tarif => tarif.ist_archiviert).map(tarif => (
                  <div key={tarif.id} className="tarif-card tp-tarif-card--archived">
                    <div className="tarif-header">
                      <div className="tarif-title">
                        <h3>{tarif.name}</h3>
                        <span className="status-badge tp-badge-archived">
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
                          className={tarif.ist_archiviert ? 'action-btn archive tp-btn-archive--active' : 'action-btn archive tp-btn-archive--inactive'}
                          onClick={() => handleArchiveTarif(tarif.id, tarif.ist_archiviert)}
                          title={tarif.ist_archiviert ? "Reaktivieren" : "Als alter Tarif markieren"}
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

                      {/* Nachfolger-Tarif Info */}
                      {tarif.nachfolger_tarif_id && (
                        <div className="detail-item tp-nachfolger-item">
                          <span className="label u-text-success">
                            ➜ Nachfolger-Tarif
                          </span>
                          <div className="value tp-nachfolger-value">
                            {tarife.find(t => t.id === tarif.nachfolger_tarif_id)?.name || `ID ${tarif.nachfolger_tarif_id}`}
                          </div>
                        </div>
                      )}

                      {/* Verwaltungs-Buttons für archivierte Tarife */}
                      <div className="tp-admin-btn-row">
                        <button
                          onClick={() => handleSetNachfolger(tarif.id)}
                          className="tp-btn-nachfolger"
                        >
                          {tarif.nachfolger_tarif_id ? '✏️ Nachfolger ändern' : '➕ Nachfolger festlegen'}
                        </button>
                        <button
                          onClick={() => handleMigrateContracts(tarif.id)}
                          className="tp-btn-migrate"
                        >
                          🔄 Verträge migrieren
                        </button>
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
        <div className="ds-modal-overlay" onClick={() => setShowNewIndividuell(false)}>
          <div className="ds-modal ds-modal--md" onClick={(e) => e.stopPropagation()}>
            <div className="ds-modal-header">
              <div>
                <h3 className="ds-modal-title">Neuer individueller Vertrag</h3>
              </div>
              <button className="ds-modal-close" onClick={() => setShowNewIndividuell(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="ds-modal-body">

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

            </div>{/* ds-modal-body */}
            <div className="ds-modal-footer">
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
                    const dojoId = getDojoId();
                    const dojoParam = dojoId ? `?dojo_id=${dojoId}` : '';
                    await axios.post(`/tarife${dojoParam}`, {
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
                <Save size={18} />
                Vertrag erstellen
              </button>
            </div>{/* ds-modal-footer */}
          </div>
        </div>
      )}

      {/* Neuer Tarif Modal */}
      {showNewTarif && (
        <div className="ds-modal-overlay" onClick={() => setShowNewTarif(false)}>
          <div className="ds-modal ds-modal--md" onClick={(e) => e.stopPropagation()}>
            <div className="ds-modal-header">
              <div>
                <h3 className="ds-modal-title">Neuer Tarif</h3>
              </div>
              <button className="ds-modal-close" onClick={() => setShowNewTarif(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="ds-modal-body">
              {/* Name - volle Breite */}
              <div className="tp-field-mb">
                <label className="u-form-label">
                  Name *
                </label>
                <input
                  type="text"
                  value={newTarif.name}
                  onChange={(e) => setNewTarif({...newTarif, name: e.target.value})}
                  placeholder="Tarif-Bezeichnung"
                  className="u-input-sm"
                />
              </div>

              {/* Preis & Aufnahmegebühr - 2 Spalten */}
              <div className="u-grid-2col">
                <div>
                  <label className="u-form-label">
                    Preis (€) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newTarif.price_cents ? (newTarif.price_cents / 100).toFixed(2) : ''}
                    onChange={(e) => setNewTarif({...newTarif, price_cents: Math.round(parseFloat(e.target.value || 0) * 100)})}
                    placeholder="0.00"
                    className="u-input-sm"
                  />
                </div>

                <div>
                  <label className="u-form-label">
                    Aufnahmegebühr (€)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newTarif.aufnahmegebuehr_cents ? (newTarif.aufnahmegebuehr_cents / 100).toFixed(2) : ''}
                    onChange={(e) => setNewTarif({...newTarif, aufnahmegebuehr_cents: Math.round(parseFloat(e.target.value || 0) * 100)})}
                    placeholder="49.99"
                    className="u-input-sm"
                  />
                </div>
              </div>

              {/* Laufzeit & Zahlungsintervall - 2 Spalten */}
              <div className="u-grid-2col">
                <div>
                  <label className="u-form-label">
                    Laufzeit (Monate) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newTarif.duration_months}
                    onChange={(e) => setNewTarif({...newTarif, duration_months: parseInt(e.target.value) || ''})}
                    placeholder="12"
                    className="u-input-sm"
                  />
                </div>

                <div>
                  <label className="u-form-label">
                    Zahlungsintervall *
                  </label>
                  <select
                    value={newTarif.billing_cycle}
                    onChange={(e) => setNewTarif({...newTarif, billing_cycle: e.target.value})}
                    className="u-input-sm"
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
              <div className="u-grid-2col">
                <div>
                  <label className="u-form-label">
                    Zahlungsmethode *
                  </label>
                  <select
                    value={newTarif.payment_method}
                    onChange={(e) => setNewTarif({...newTarif, payment_method: e.target.value})}
                    className="u-input-sm"
                  >
                    <option value="bank_transfer">Banküberweisung</option>
                    <option value="direct_debit">Lastschrift</option>
                    <option value="credit_card">Kreditkarte</option>
                    <option value="cash">Bar</option>
                  </select>
                </div>

                <div>
                  <label className="u-form-label">
                    Währung
                  </label>
                  <select
                    value={newTarif.currency}
                    onChange={(e) => setNewTarif({...newTarif, currency: e.target.value})}
                    className="u-input-sm"
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="CHF">CHF</option>
                  </select>
                </div>
              </div>

              {/* Mindestlaufzeit & Kündigungsfrist */}
              <div className="u-grid-2col" style={{marginTop: '12px'}}>
                <div>
                  <label className="u-form-label">Mindestlaufzeit (Monate)</label>
                  <input
                    type="number"
                    min="1"
                    value={newTarif.mindestlaufzeit_monate || ''}
                    onChange={(e) => setNewTarif({...newTarif, mindestlaufzeit_monate: parseInt(e.target.value) || ''})}
                    placeholder={newTarif.duration_months || '12'}
                    className="u-input-sm"
                  />
                </div>
                <div>
                  <label className="u-form-label">Kündigungsfrist (Monate)</label>
                  <input
                    type="number"
                    min="1"
                    value={newTarif.kuendigungsfrist_monate ?? ''}
                    onChange={(e) => setNewTarif({...newTarif, kuendigungsfrist_monate: parseInt(e.target.value) || ''})}
                    placeholder="3"
                    className="u-input-sm"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="tp-status-row">
                <label className="tp-status-label">
                  <input
                    type="checkbox"
                    checked={newTarif.active}
                    onChange={(e) => setNewTarif({...newTarif, active: e.target.checked})}
                  />
                  Tarif ist aktiv
                </label>
              </div>

            </div>{/* ds-modal-body */}
            <div className="ds-modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowNewTarif(false)}
                >
                  Abbrechen
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handleSaveTarif(newTarif)}
                  disabled={!newTarif.name || !newTarif.price_cents || !newTarif.duration_months}
                >
                  <Save size={16} />
                  Speichern
                </button>
            </div>{/* ds-modal-footer */}
          </div>
        </div>
      )}

      {/* Tarif bearbeiten Modal */}
      {editingTarif && (
        <div className="ds-modal-overlay" onClick={() => setEditingTarif(null)}>
          <div className="ds-modal ds-modal--md" onClick={(e) => e.stopPropagation()}>
            <div className="ds-modal-header">
              <div>
                <h3 className="ds-modal-title">Tarif bearbeiten</h3>
                <p className="ds-modal-subtitle">{editingTarif.name}</p>
              </div>
              <button className="ds-modal-close" onClick={() => setEditingTarif(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="ds-modal-body">
              {/* Name - volle Breite */}
              <div className="tp-field-mb">
                <label className="u-form-label">
                  Name *
                </label>
                <input
                  type="text"
                  value={editingTarif.name}
                  onChange={(e) => setEditingTarif({...editingTarif, name: e.target.value})}
                  placeholder="Tarif-Bezeichnung"
                  className="u-input-sm"
                />
              </div>

              {/* Preis & Aufnahmegebühr - 2 Spalten */}
              <div className="u-grid-2col">
                <div>
                  <label className="u-form-label">
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
                    className="u-input-sm"
                  />
                </div>

                <div>
                  <label className="u-form-label">
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
                    className="u-input-sm"
                  />
                </div>
              </div>

              {/* Laufzeit & Zahlungsintervall - 2 Spalten */}
              <div className="u-grid-2col">
                <div>
                  <label className="u-form-label">
                    Laufzeit (Monate) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editingTarif.duration_months}
                    onChange={(e) => setEditingTarif({...editingTarif, duration_months: parseInt(e.target.value) || ''})}
                    placeholder="12"
                    className="u-input-sm"
                  />
                </div>

                <div>
                  <label className="u-form-label">
                    Zahlungsintervall *
                  </label>
                  <select
                    value={editingTarif.billing_cycle?.toUpperCase() || ''}
                    onChange={(e) => setEditingTarif({...editingTarif, billing_cycle: e.target.value})}
                    className="u-input-sm"
                  >
                    <option value="">Bitte wählen...</option>
                    <option value="MONTHLY">Monatlich</option>
                    <option value="QUARTERLY">Vierteljährlich</option>
                    <option value="YEARLY">Jährlich</option>
                  </select>
                </div>
              </div>

              {/* Zahlungsmethode & Währung - 2 Spalten */}
              <div className="u-grid-2col">
                <div>
                  <label className="u-form-label">
                    Zahlungsmethode *
                  </label>
                  <select
                    value={editingTarif.payment_method?.toUpperCase() || ''}
                    onChange={(e) => setEditingTarif({...editingTarif, payment_method: e.target.value})}
                    className="u-input-sm"
                  >
                    <option value="SEPA">SEPA</option>
                    <option value="CARD">Kreditkarte</option>
                    <option value="PAYPAL">PayPal</option>
                    <option value="BANK_TRANSFER">Banküberweisung</option>
                  </select>
                </div>

                <div>
                  <label className="u-form-label">
                    Währung
                  </label>
                  <select
                    value={editingTarif.currency}
                    onChange={(e) => setEditingTarif({...editingTarif, currency: e.target.value})}
                    className="u-input-sm"
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="CHF">CHF</option>
                  </select>
                </div>
              </div>

              {/* Mindestlaufzeit & Kündigungsfrist - 2 Spalten */}
              <div className="u-grid-2col" style={{marginTop: '12px'}}>
                <div>
                  <label className="u-form-label">
                    Mindestlaufzeit (Monate)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editingTarif.mindestlaufzeit_monate || ''}
                    onChange={(e) => setEditingTarif({...editingTarif, mindestlaufzeit_monate: parseInt(e.target.value) || ''})}
                    placeholder={editingTarif.duration_months || '12'}
                    className="u-input-sm"
                  />
                </div>
                <div>
                  <label className="u-form-label">
                    Kündigungsfrist (Monate)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editingTarif.kuendigungsfrist_monate ?? ''}
                    onChange={(e) => setEditingTarif({...editingTarif, kuendigungsfrist_monate: parseInt(e.target.value) || ''})}
                    placeholder="3"
                    className="u-input-sm"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="tp-status-row">
                <label className="tp-status-label">
                  <input
                    type="checkbox"
                    checked={editingTarif.active}
                    onChange={(e) => setEditingTarif({...editingTarif, active: e.target.checked})}
                  />
                  Tarif ist aktiv
                </label>
              </div>

            </div>{/* ds-modal-body */}
            <div className="ds-modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setEditingTarif(null)}
                >
                  Abbrechen
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handleSaveTarif(editingTarif)}
                  disabled={!editingTarif.name || !editingTarif.price_cents || !editingTarif.duration_months}
                >
                  <Save size={16} />
                  Speichern
                </button>
            </div>{/* ds-modal-footer */}
          </div>
        </div>
      )}
    </div>
  );
};

export default TarifePreise;