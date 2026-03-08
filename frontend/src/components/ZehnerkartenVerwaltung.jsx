import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Clock, CreditCard, CheckCircle, XCircle, Calendar, Plus, Trash2, FileText } from 'lucide-react';
import '../styles/MitgliedDetail.css';
import '../styles/ZehnerkartenVerwaltung.css';

/**
 * ZehnerkartenVerwaltung - Verwaltung von 10er-Karten im Mitglied-Detail
 * @param {number} mitgliedId - ID des Mitglieds
 * @param {object} mitglied - Mitgliedsobjekt
 * @param {boolean} isAdmin - Ist der Benutzer ein Admin?
 */
const ZehnerkartenVerwaltung = ({ mitgliedId, mitglied, isAdmin = false }) => {
  const [zehnerkarten, setZehnerkarten] = useState([]);
  const [tarife, setTarife] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewKarte, setShowNewKarte] = useState(false);
  const [selectedKarteId, setSelectedKarteId] = useState(null);
  const [buchungen, setBuchungen] = useState([]);
  const [loadingBuchungen, setLoadingBuchungen] = useState(false);

  // Nachkauf Modal States
  const [showNachkaufModal, setShowNachkaufModal] = useState(false);
  const [showZahlungsModal, setShowZahlungsModal] = useState(false);
  const [nachkaufTarifId, setNachkaufTarifId] = useState(null);
  const [selectedZahlungsart, setSelectedZahlungsart] = useState(null);

  const [newKarte, setNewKarte] = useState({
    tarif_id: '',
    gekauft_am: new Date().toISOString().split('T')[0],
    einheiten_gesamt: 10
  });

  // Lade 10er-Karten und Tarife
  useEffect(() => {
    if (mitgliedId) {
      loadZehnerkarten();
      loadTarife();
    }
  }, [mitgliedId]);

  const loadZehnerkarten = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/mitglieder/${mitgliedId}/zehnerkarten`);
      if (response.data.success) {
        setZehnerkarten(response.data.data || []);
      }
    } catch (error) {
      console.error('Fehler beim Laden der 10er-Karten:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTarife = async () => {
    try {
      const response = await axios.get('/tarife');
      const allTarife = response.data?.data || response.data || [];
      // Nur 10er-Karten-Tarife
      const zehnerkartenTarife = allTarife.filter(t =>
        t.name && t.name.toLowerCase().includes('10er karte')
      );
      setTarife(zehnerkartenTarife);
    } catch (error) {
      console.error('Fehler beim Laden der Tarife:', error);
    }
  };

  const loadBuchungen = async (karteId) => {
    try {
      setLoadingBuchungen(true);
      const response = await axios.get(`/zehnerkarten/${karteId}/buchungen`);
      if (response.data.success) {
        setBuchungen(response.data.data || []);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Buchungen:', error);
    } finally {
      setLoadingBuchungen(false);
    }
  };

  const handleCreateKarte = async () => {
    if (!newKarte.tarif_id) {
      alert('Bitte wählen Sie einen Tarif aus');
      return;
    }

    try {
      const response = await axios.post(`/mitglieder/${mitgliedId}/zehnerkarten`, newKarte);
      if (response.data.success) {
        await loadZehnerkarten();
        setShowNewKarte(false);
        setNewKarte({
          tarif_id: '',
          gekauft_am: new Date().toISOString().split('T')[0],
          einheiten_gesamt: 10
        });
        alert('✅ 10er-Karte erfolgreich erstellt!');
      }
    } catch (error) {
      console.error('Fehler beim Erstellen der 10er-Karte:', error);
      alert('❌ Fehler beim Erstellen der 10er-Karte');
    }
  };

  const handleCheckin = async (karteId) => {
    if (!window.confirm('Möchten Sie einen Check-in für heute durchführen?')) {
      return;
    }

    try {
      const response = await axios.post(`/zehnerkarten/${karteId}/checkin`, {
        buchungsdatum: new Date().toISOString().split('T')[0],
        notiz: 'Check-in'
      });

      if (response.data.success) {
        await loadZehnerkarten();
        if (selectedKarteId === karteId) {
          await loadBuchungen(karteId);
        }

        // Prüfen ob es die letzte Einheit war
        if (response.data.isLastUnit) {
          // Finde die aktuelle Karte um tarif_id zu bekommen
          const karte = zehnerkarten.find(k => k.id === karteId);
          if (karte) {
            setNachkaufTarifId(karte.tarif_id);
            setShowNachkaufModal(true);
          }
        } else {
          alert(response.data.message || '✅ Check-in erfolgreich!');
        }
      }
    } catch (error) {
      console.error('Fehler beim Check-in:', error);
      alert(error.response?.data?.error || '❌ Fehler beim Check-in');
    }
  };

  const handleNachkauf = async () => {
    if (!selectedZahlungsart) {
      alert('Bitte wählen Sie eine Zahlungsart aus');
      return;
    }

    try {
      const response = await axios.post('/zehnerkarten/nachkauf', {
        mitglied_id: mitgliedId,
        tarif_id: nachkaufTarifId,
        zahlungsart: selectedZahlungsart,
        einheiten_gesamt: 10
      });

      if (response.data.success) {
        await loadZehnerkarten();
        setShowZahlungsModal(false);
        setShowNachkaufModal(false);
        setSelectedZahlungsart(null);
        setNachkaufTarifId(null);

        // Erfolgsmeldung je nach Zahlungsart
        let message = '✅ 10er-Karte erfolgreich erstellt!\n\n';
        if (selectedZahlungsart === 'bar') {
          message += '💵 Hinweis: Der Admin wurde über die Barzahlung informiert.';
        } else if (selectedZahlungsart === 'lastschrift') {
          message += '🏦 Der Betrag wird bei der nächsten SEPA-Buchung eingezogen.';
        } else if (selectedZahlungsart === 'rechnung') {
          message += '📧 Die Rechnung wird per E-Mail versendet.';
        }
        alert(message);
      }
    } catch (error) {
      console.error('Fehler beim Nachkauf:', error);
      alert(error.response?.data?.error || '❌ Fehler beim Erstellen der 10er-Karte');
    }
  };

  const handleDeleteKarte = async (karteId) => {
    if (!window.confirm('Möchten Sie diese 10er-Karte wirklich löschen? Dies ist nur möglich, wenn noch keine Buchungen vorhanden sind.')) {
      return;
    }

    try {
      const response = await axios.delete(`/zehnerkarten/${karteId}`);
      if (response.data.success) {
        await loadZehnerkarten();
        if (selectedKarteId === karteId) {
          setSelectedKarteId(null);
          setBuchungen([]);
        }
        alert('✅ 10er-Karte erfolgreich gelöscht');
      }
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      alert(error.response?.data?.error || '❌ Fehler beim Löschen der 10er-Karte');
    }
  };

  const handleViewDetails = async (karteId) => {
    if (selectedKarteId === karteId) {
      setSelectedKarteId(null);
      setBuchungen([]);
    } else {
      setSelectedKarteId(karteId);
      await loadBuchungen(karteId);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'aktiv':
        return <CheckCircle size={20} color="#10b981" />;
      case 'aufgebraucht':
        return <XCircle size={20} color="#ef4444" />;
      case 'abgelaufen':
        return <Clock size={20} color="#f59e0b" />;
      default:
        return <CreditCard size={20} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'aktiv':
        return '#10b981';
      case 'aufgebraucht':
        return '#ef4444';
      case 'abgelaufen':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('de-DE');
  };

  if (loading) {
    return (
      <div className="zk-loading">
        <div className="loading-spinner"></div>
        <p>Lade 10er-Karten...</p>
      </div>
    );
  }

  return (
    <div className="zk-container">
      {/* HEADER */}
      <div className="zk-header">
        <h3 className="zk-title">
          10er-Karten Verwaltung
        </h3>

        {isAdmin && (
          <button
            className="neue-zehnerkarte-button"
            onClick={() => setShowNewKarte(true)}
          >
            ➕ Neue 10er-Karte
          </button>
        )}
      </div>

      {/* NEUE 10ER-KARTE FORMULAR */}
      {showNewKarte && isAdmin && (
        <div className="zk-form-box">
          <h4 className="zk-form-heading">
            Neue 10er-Karte erstellen
          </h4>

          <div className="zk-form-grid">
            <div>
              <label className="zk-label">
                Tarif *
              </label>
              <select
                value={newKarte.tarif_id}
                onChange={(e) => setNewKarte({ ...newKarte, tarif_id: e.target.value })}
                className="zk-field"
              >
                <option value="">Tarif auswählen</option>
                {tarife.map(tarif => (
                  <option key={tarif.id} value={tarif.id}>
                    {tarif.name} - €{(tarif.price_cents / 100).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="zk-label">
                Kaufdatum
              </label>
              <input
                type="date"
                value={newKarte.gekauft_am}
                onChange={(e) => setNewKarte({ ...newKarte, gekauft_am: e.target.value })}
                className="zk-field"
              />
            </div>

            <div>
              <label className="zk-label">
                Anzahl Einheiten
              </label>
              <input
                type="number"
                value={newKarte.einheiten_gesamt}
                onChange={(e) => setNewKarte({ ...newKarte, einheiten_gesamt: parseInt(e.target.value) || 10 })}
                min="1"
                className="zk-field"
              />
            </div>
          </div>

          <div className="zk-btn-row">
            <button
              onClick={handleCreateKarte}
              className="zk-btn-primary"
            >
              Erstellen
            </button>
            <button
              onClick={() => setShowNewKarte(false)}
              className="zk-btn-secondary"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* 10ER-KARTEN LISTE */}
      {zehnerkarten.length === 0 ? (
        <div className="zk-empty">
          <CreditCard size={64} className="zk-empty-icon" />
          <p className="zk-empty-heading">Keine 10er-Karten vorhanden</p>
          {isAdmin && (
            <p className="zk-empty-sub">
              Klicken Sie auf "Neue 10er-Karte", um eine zu erstellen
            </p>
          )}
        </div>
      ) : (
        <div className="zk-cards-grid">
          {zehnerkarten.map(karte => {
            const fortschritt = ((karte.einheiten_gesamt - karte.einheiten_verbleibend) / karte.einheiten_gesamt) * 100;
            const isExpired = new Date(karte.gueltig_bis) < new Date();
            const isSelected = selectedKarteId === karte.id;

            return (
              <div
                key={karte.id}
                className={`zk-card zk-card--${karte.status || 'default'}`}
              >
                {/* KARTEN-HEADER */}
                <div className="zk-card-header">
                  <div className="u-flex-row-lg">
                    {getStatusIcon(karte.status)}
                    <div>
                      <h4 className="zk-card-title">
                        {karte.tarif_name || 'Unbekannter Tarif'}
                      </h4>
                      <p className="zk-card-subtitle">
                        Gekauft am {formatDate(karte.gekauft_am)} • Gültig bis {formatDate(karte.gueltig_bis)}
                      </p>
                    </div>
                  </div>

                  <div className="u-flex-row-md">
                    <span className={`zk-status-badge zk-status-badge--${karte.status || 'default'}`}>
                      {karte.status.toUpperCase()}
                    </span>

                    {isAdmin && karte.status === 'aktiv' && (
                      <button
                        onClick={() => handleCheckin(karte.id)}
                        title="Check-in durchführen"
                        className="zk-btn-checkin"
                      >
                        <CheckCircle size={16} />
                        Check-in
                      </button>
                    )}

                    <button
                      onClick={() => handleViewDetails(karte.id)}
                      className="zk-btn-details"
                    >
                      <FileText size={16} />
                      {isSelected ? 'Verbergen' : 'Historie'}
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteKarte(karte.id)}
                        title="Löschen"
                        className="zk-btn-delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* FORTSCHRITTSBALKEN */}
                <div className="zk-progress-section">
                  <div className="zk-progress-labels">
                    <span className="zk-progress-label">
                      Verbleibend: {karte.einheiten_verbleibend} / {karte.einheiten_gesamt}
                    </span>
                    <span className="zk-progress-pct">
                      {Math.round(fortschritt)}% genutzt
                    </span>
                  </div>
                  <div className="zk-progress-track">
                    <div className={`zk-progress-fill zk-progress-fill--${karte.status || 'abgelaufen'}`} style={{ width: `${fortschritt}%` }} />
                  </div>
                </div>

                {/* BUCHUNGSHISTORIE */}
                {isSelected && (
                  <div className="zk-history-section">
                    <h5 className="zk-history-heading">
                      📅 Check-in Historie
                    </h5>

                    {loadingBuchungen ? (
                      <div className="zk-history-loading">
                        Lade Buchungen...
                      </div>
                    ) : buchungen.length === 0 ? (
                      <div className="zk-history-empty">
                        Noch keine Check-ins durchgeführt
                      </div>
                    ) : (
                      <div className="zk-history-list">
                        {buchungen.map((buchung, index) => (
                          <div
                            key={buchung.id}
                            className="zk-history-entry"
                          >
                            <div className="u-flex-row-md">
                              <Calendar size={16} color="#10B981" />
                              <span className="u-text-primary">
                                {formatDate(buchung.buchungsdatum)}
                              </span>
                              {buchung.notiz && (
                                <span className="zk-history-nota">
                                  ({buchung.notiz})
                                </span>
                              )}
                            </div>
                            <span className="zk-history-badge">
                              -{buchung.einheiten} Einheit
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* NACHKAUF MODAL - Frage ob weitere 10er-Karte gewünscht */}
      {showNachkaufModal && (
        <div className="zk-modal-overlay">
          <div className="zk-modal-box">
            <div className="zk-modal-emoji">
              🎫
            </div>
            <h2 className="zk-modal-heading">
              10er-Karte aufgebraucht!
            </h2>
            <p className="zk-modal-body">
              Ihre 10er-Karte ist nun vollständig verbraucht.<br />
              Möchten Sie eine neue 10er-Karte kaufen?
            </p>

            <div className="zk-modal-btn-row">
              <button
                onClick={() => {
                  setShowNachkaufModal(false);
                  setShowZahlungsModal(true);
                }}
                className="zk-modal-btn-primary"
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.4)';
                }}
              >
                ✅ Ja, neue Karte kaufen
              </button>
              <button
                onClick={() => {
                  setShowNachkaufModal(false);
                  setNachkaufTarifId(null);
                }}
                className="zk-modal-btn-cancel"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#ef4444';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#ef4444';
                }}
              >
                ❌ Nein, danke
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ZAHLUNGSAUSWAHL MODAL */}
      {showZahlungsModal && (
        <div className="zk-modal-overlay--payment">
          <div className="zk-modal-box--wide">
            <h2 className="zk-modal-heading--center">
              💳 Zahlungsart wählen
            </h2>

            <div className="zk-payment-grid">
              {/* Barzahlung */}
              <div
                onClick={() => setSelectedZahlungsart('bar')}
                className={`zk-payment-option${selectedZahlungsart === 'bar' ? ' zk-payment-option--selected' : ''}`}
              >
                <div className="u-flex-row-lg">
                  <div className="zk-icon-lg">💵</div>
                  <div className="u-flex-1">
                    <h4 className="zk-payment-title">
                      Barzahlung
                    </h4>
                    <p className="zk-payment-desc">
                      Der Admin wird informiert, dass Sie bar bezahlen möchten
                    </p>
                  </div>
                  {selectedZahlungsart === 'bar' && (
                    <CheckCircle size={32} color="#10B981" />
                  )}
                </div>
              </div>

              {/* Lastschrift */}
              <div
                onClick={() => setSelectedZahlungsart('lastschrift')}
                className={`zk-payment-option${selectedZahlungsart === 'lastschrift' ? ' zk-payment-option--selected' : ''}`}
              >
                <div className="u-flex-row-lg">
                  <div className="zk-icon-lg">🏦</div>
                  <div className="u-flex-1">
                    <h4 className="zk-payment-title">
                      SEPA-Lastschrift
                    </h4>
                    <p className="zk-payment-desc">
                      Der Betrag wird bei der nächsten Lastschrift eingezogen
                    </p>
                  </div>
                  {selectedZahlungsart === 'lastschrift' && (
                    <CheckCircle size={32} color="#10B981" />
                  )}
                </div>
              </div>

              {/* Rechnung */}
              <div
                onClick={() => setSelectedZahlungsart('rechnung')}
                className={`zk-payment-option${selectedZahlungsart === 'rechnung' ? ' zk-payment-option--selected' : ''}`}
              >
                <div className="u-flex-row-lg">
                  <div className="zk-icon-lg">📧</div>
                  <div className="u-flex-1">
                    <h4 className="zk-payment-title">
                      Rechnung per E-Mail
                    </h4>
                    <p className="zk-payment-desc">
                      Sie erhalten eine Rechnung per E-Mail
                    </p>
                  </div>
                  {selectedZahlungsart === 'rechnung' && (
                    <CheckCircle size={32} color="#10B981" />
                  )}
                </div>
              </div>
            </div>

            <div className="zk-modal-btn-row">
              <button
                onClick={handleNachkauf}
                disabled={!selectedZahlungsart}
                className="zk-modal-btn-nachkauf"
              >
                ✅ Bestätigen
              </button>
              <button
                onClick={() => {
                  setShowZahlungsModal(false);
                  setSelectedZahlungsart(null);
                  setNachkaufTarifId(null);
                }}
                className="zk-modal-btn-cancel"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#ef4444';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#ef4444';
                }}
              >
                ❌ Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ZehnerkartenVerwaltung;
