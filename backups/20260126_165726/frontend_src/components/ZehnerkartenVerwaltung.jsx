import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Clock, CreditCard, CheckCircle, XCircle, Calendar, Plus, Trash2, FileText } from 'lucide-react';
import '../styles/MitgliedDetail.css';

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
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="loading-spinner"></div>
        <p>Lade 10er-Karten...</p>
      </div>
    );
  }

  return (
    <div style={{
      marginBottom: '2rem',
      background: 'linear-gradient(135deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 30, 0.98) 100%)',
      borderRadius: '16px',
      padding: '2rem',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      border: '1px solid rgba(255, 255, 255, 0.05)'
    }}>
      {/* HEADER */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        paddingBottom: '1rem',
        borderBottom: '2px solid rgba(255, 215, 0, 0.2)'
      }}>
        <h3 style={{
          margin: 0,
          fontSize: '1.8rem',
          fontWeight: '700',
          background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text'
        }}>
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
        <div style={{
          background: 'rgba(16, 185, 129, 0.08)',
          border: '2px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <h4 style={{ color: '#10B981', marginTop: 0, marginBottom: '1rem' }}>
            Neue 10er-Karte erstellen
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.9)' }}>
                Tarif *
              </label>
              <select
                value={newKarte.tarif_id}
                onChange={(e) => setNewKarte({ ...newKarte, tarif_id: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'white',
                  fontSize: '0.9rem'
                }}
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
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.9)' }}>
                Kaufdatum
              </label>
              <input
                type="date"
                value={newKarte.gekauft_am}
                onChange={(e) => setNewKarte({ ...newKarte, gekauft_am: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'white',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.9)' }}>
                Anzahl Einheiten
              </label>
              <input
                type="number"
                value={newKarte.einheiten_gesamt}
                onChange={(e) => setNewKarte({ ...newKarte, einheiten_gesamt: parseInt(e.target.value) || 10 })}
                min="1"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'white',
                  fontSize: '0.9rem'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={handleCreateKarte}
              style={{
                background: '#10B981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '0.75rem 1.5rem',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Erstellen
            </button>
            <button
              onClick={() => setShowNewKarte(false)}
              style={{
                background: 'transparent',
                color: '#ef4444',
                border: '1px solid #ef4444',
                borderRadius: '8px',
                padding: '0.75rem 1.5rem',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* 10ER-KARTEN LISTE */}
      {zehnerkarten.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: 'rgba(255, 255, 255, 0.6)'
        }}>
          <CreditCard size={64} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <p style={{ fontSize: '1.1rem', margin: 0 }}>Keine 10er-Karten vorhanden</p>
          {isAdmin && (
            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
              Klicken Sie auf "Neue 10er-Karte", um eine zu erstellen
            </p>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {zehnerkarten.map(karte => {
            const fortschritt = ((karte.einheiten_gesamt - karte.einheiten_verbleibend) / karte.einheiten_gesamt) * 100;
            const isExpired = new Date(karte.gueltig_bis) < new Date();
            const isSelected = selectedKarteId === karte.id;

            return (
              <div
                key={karte.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: `2px solid ${getStatusColor(karte.status)}`,
                  borderRadius: '12px',
                  padding: '1.5rem',
                  transition: 'all 0.3s ease'
                }}
              >
                {/* KARTEN-HEADER */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {getStatusIcon(karte.status)}
                    <div>
                      <h4 style={{
                        margin: 0,
                        fontSize: '1.2rem',
                        color: '#10B981',
                        fontWeight: '700'
                      }}>
                        {karte.tarif_name || 'Unbekannter Tarif'}
                      </h4>
                      <p style={{
                        margin: '0.25rem 0 0 0',
                        fontSize: '0.85rem',
                        color: 'rgba(255, 255, 255, 0.6)'
                      }}>
                        Gekauft am {formatDate(karte.gekauft_am)} • Gültig bis {formatDate(karte.gueltig_bis)}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{
                      padding: '0.4rem 1rem',
                      borderRadius: '20px',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      background: `${getStatusColor(karte.status)}20`,
                      color: getStatusColor(karte.status),
                      border: `1px solid ${getStatusColor(karte.status)}`
                    }}>
                      {karte.status.toUpperCase()}
                    </span>

                    {isAdmin && karte.status === 'aktiv' && (
                      <button
                        onClick={() => handleCheckin(karte.id)}
                        title="Check-in durchführen"
                        style={{
                          background: '#10B981',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '0.5rem 1rem',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}
                      >
                        <CheckCircle size={16} />
                        Check-in
                      </button>
                    )}

                    <button
                      onClick={() => handleViewDetails(karte.id)}
                      style={{
                        background: 'transparent',
                        color: '#10B981',
                        border: '1px solid #10B981',
                        borderRadius: '8px',
                        padding: '0.5rem 1rem',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <FileText size={16} />
                      {isSelected ? 'Verbergen' : 'Historie'}
                    </button>

                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteKarte(karte.id)}
                        title="Löschen"
                        style={{
                          background: 'transparent',
                          color: '#ef4444',
                          border: '1px solid #ef4444',
                          borderRadius: '8px',
                          padding: '0.5rem',
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* FORTSCHRITTSBALKEN */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem'
                  }}>
                    <span style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.8)' }}>
                      Verbleibend: {karte.einheiten_verbleibend} / {karte.einheiten_gesamt}
                    </span>
                    <span style={{ fontSize: '0.9rem', color: '#10B981', fontWeight: '600' }}>
                      {Math.round(fortschritt)}% genutzt
                    </span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '12px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${fortschritt}%`,
                      height: '100%',
                      background: karte.status === 'aktiv'
                        ? 'linear-gradient(90deg, #10B981 0%, #34D399 100%)'
                        : karte.status === 'aufgebraucht'
                        ? 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)'
                        : 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)',
                      transition: 'width 0.5s ease',
                      borderRadius: '6px'
                    }} />
                  </div>
                </div>

                {/* BUCHUNGSHISTORIE */}
                {isSelected && (
                  <div style={{
                    marginTop: '1.5rem',
                    paddingTop: '1.5rem',
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <h5 style={{
                      margin: '0 0 1rem 0',
                      fontSize: '1rem',
                      color: '#10B981',
                      fontWeight: '600'
                    }}>
                      📅 Check-in Historie
                    </h5>

                    {loadingBuchungen ? (
                      <div style={{ textAlign: 'center', padding: '1rem' }}>
                        Lade Buchungen...
                      </div>
                    ) : buchungen.length === 0 ? (
                      <div style={{
                        textAlign: 'center',
                        padding: '1rem',
                        color: 'rgba(255, 255, 255, 0.6)',
                        fontSize: '0.9rem'
                      }}>
                        Noch keine Check-ins durchgeführt
                      </div>
                    ) : (
                      <div style={{
                        maxHeight: '300px',
                        overflowY: 'auto',
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '8px',
                        padding: '0.5rem'
                      }}>
                        {buchungen.map((buchung, index) => (
                          <div
                            key={buchung.id}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '0.75rem',
                              background: index % 2 === 0 ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                              borderRadius: '6px',
                              fontSize: '0.9rem'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <Calendar size={16} color="#10B981" />
                              <span style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                                {formatDate(buchung.buchungsdatum)}
                              </span>
                              {buchung.notiz && (
                                <span style={{
                                  fontSize: '0.8rem',
                                  color: 'rgba(255, 255, 255, 0.6)',
                                  fontStyle: 'italic'
                                }}>
                                  ({buchung.notiz})
                                </span>
                              )}
                            </div>
                            <span style={{
                              padding: '0.25rem 0.75rem',
                              borderRadius: '12px',
                              background: 'rgba(16, 185, 129, 0.2)',
                              color: '#10B981',
                              fontSize: '0.8rem',
                              fontWeight: '600'
                            }}>
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
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
            borderRadius: '16px',
            padding: '2.5rem',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            border: '2px solid rgba(16, 185, 129, 0.3)',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: '4rem',
              marginBottom: '1rem'
            }}>
              🎫
            </div>
            <h2 style={{
              color: '#10B981',
              fontSize: '1.8rem',
              marginBottom: '1rem',
              fontWeight: '700'
            }}>
              10er-Karte aufgebraucht!
            </h2>
            <p style={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '1.1rem',
              marginBottom: '2rem',
              lineHeight: '1.6'
            }}>
              Ihre 10er-Karte ist nun vollständig verbraucht.<br />
              Möchten Sie eine neue 10er-Karte kaufen?
            </p>

            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center'
            }}>
              <button
                onClick={() => {
                  setShowNachkaufModal(false);
                  setShowZahlungsModal(true);
                }}
                style={{
                  background: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '1rem 2.5rem',
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
                  transition: 'all 0.3s ease'
                }}
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
                style={{
                  background: 'transparent',
                  color: '#ef4444',
                  border: '2px solid #ef4444',
                  borderRadius: '12px',
                  padding: '1rem 2.5rem',
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
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
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10001
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
            borderRadius: '16px',
            padding: '2.5rem',
            maxWidth: '600px',
            width: '90%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
            border: '2px solid rgba(16, 185, 129, 0.3)'
          }}>
            <h2 style={{
              color: '#10B981',
              fontSize: '1.8rem',
              marginBottom: '1.5rem',
              fontWeight: '700',
              textAlign: 'center'
            }}>
              💳 Zahlungsart wählen
            </h2>

            <div style={{
              display: 'grid',
              gap: '1rem',
              marginBottom: '2rem'
            }}>
              {/* Barzahlung */}
              <div
                onClick={() => setSelectedZahlungsart('bar')}
                style={{
                  background: selectedZahlungsart === 'bar'
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(52, 211, 153, 0.2) 100%)'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: selectedZahlungsart === 'bar'
                    ? '2px solid #10B981'
                    : '2px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  if (selectedZahlungsart !== 'bar') {
                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedZahlungsart !== 'bar') {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ fontSize: '2.5rem' }}>💵</div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{
                      margin: 0,
                      fontSize: '1.2rem',
                      color: '#10B981',
                      fontWeight: '700'
                    }}>
                      Barzahlung
                    </h4>
                    <p style={{
                      margin: '0.5rem 0 0 0',
                      fontSize: '0.9rem',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}>
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
                style={{
                  background: selectedZahlungsart === 'lastschrift'
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(52, 211, 153, 0.2) 100%)'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: selectedZahlungsart === 'lastschrift'
                    ? '2px solid #10B981'
                    : '2px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  if (selectedZahlungsart !== 'lastschrift') {
                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedZahlungsart !== 'lastschrift') {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ fontSize: '2.5rem' }}>🏦</div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{
                      margin: 0,
                      fontSize: '1.2rem',
                      color: '#10B981',
                      fontWeight: '700'
                    }}>
                      SEPA-Lastschrift
                    </h4>
                    <p style={{
                      margin: '0.5rem 0 0 0',
                      fontSize: '0.9rem',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}>
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
                style={{
                  background: selectedZahlungsart === 'rechnung'
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(52, 211, 153, 0.2) 100%)'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: selectedZahlungsart === 'rechnung'
                    ? '2px solid #10B981'
                    : '2px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  if (selectedZahlungsart !== 'rechnung') {
                    e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedZahlungsart !== 'rechnung') {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ fontSize: '2.5rem' }}>📧</div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{
                      margin: 0,
                      fontSize: '1.2rem',
                      color: '#10B981',
                      fontWeight: '700'
                    }}>
                      Rechnung per E-Mail
                    </h4>
                    <p style={{
                      margin: '0.5rem 0 0 0',
                      fontSize: '0.9rem',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}>
                      Sie erhalten eine Rechnung per E-Mail
                    </p>
                  </div>
                  {selectedZahlungsart === 'rechnung' && (
                    <CheckCircle size={32} color="#10B981" />
                  )}
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center'
            }}>
              <button
                onClick={handleNachkauf}
                disabled={!selectedZahlungsart}
                style={{
                  background: selectedZahlungsart
                    ? 'linear-gradient(135deg, #10B981 0%, #34D399 100%)'
                    : 'rgba(255, 255, 255, 0.1)',
                  color: selectedZahlungsart ? 'white' : 'rgba(255, 255, 255, 0.5)',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '1rem 2.5rem',
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  cursor: selectedZahlungsart ? 'pointer' : 'not-allowed',
                  boxShadow: selectedZahlungsart ? '0 4px 15px rgba(16, 185, 129, 0.4)' : 'none',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  if (selectedZahlungsart) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.5)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedZahlungsart) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.4)';
                  }
                }}
              >
                ✅ Bestätigen
              </button>
              <button
                onClick={() => {
                  setShowZahlungsModal(false);
                  setSelectedZahlungsart(null);
                  setNachkaufTarifId(null);
                }}
                style={{
                  background: 'transparent',
                  color: '#ef4444',
                  border: '2px solid #ef4444',
                  borderRadius: '12px',
                  padding: '1rem 2.5rem',
                  fontSize: '1.1rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
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
