import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext.jsx';
import TemplateEditor from './TemplateEditor';
import '../styles/Dashboard.css';

/**
 * Erweiterte Dokumentenverwaltung mit Versionierung
 * Verwaltet AGB, Datenschutz, Hausordnung, etc. mit Versionshistorie
 */
const DokumenteVerwaltung = () => {
  const { activeDojo, dojos } = useDojoContext();
  const [dokumente, setDokumente] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDokumentTyp, setSelectedDokumentTyp] = useState('agb');
  const [showNewVersion, setShowNewVersion] = useState(false);
  const [viewingDokument, setViewingDokument] = useState(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [activeTab, setActiveTab] = useState('dokumente'); // 'dokumente' oder 'vorlagen'
  const [vorlagen, setVorlagen] = useState([]);
  const [loadingVorlagen, setLoadingVorlagen] = useState(false);
  const [activeVorlagenKategorie, setActiveVorlagenKategorie] = useState('alle');
  const [subTab, setSubTab] = useState('vorlagen'); // 'vorlagen' oder Dokumenttyp (agb, datenschutz, etc.)
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [targetDojoId, setTargetDojoId] = useState(null);
  const [vorlagenExpanded, setVorlagenExpanded] = useState(true);
  const [dokumenteExpanded, setDokumenteExpanded] = useState(true);

  const [newDokument, setNewDokument] = useState({
    dokumenttyp: 'agb',
    version: '',
    titel: '',
    inhalt: '',
    gueltig_ab: new Date().toISOString().split('T')[0],
    gueltig_bis: null,
    aktiv: true,
    dojo_id: null
  });

  const dokumentTypen = [
    { value: 'agb', label: 'AGB (Allgemeine Geschäftsbedingungen)', icon: '📋' },
    { value: 'datenschutz', label: 'Datenschutzerklärung', icon: '🔒' },
    { value: 'widerruf', label: 'Widerrufsbelehrung', icon: '↩️' },
    { value: 'hausordnung', label: 'Hausordnung', icon: '🏠' },
    { value: 'dojokun', label: 'Dojo Regeln (Dojokun)', icon: '🥋' },
    { value: 'haftung', label: 'Haftungsausschluss', icon: '⚠️' },
    { value: 'sonstiges', label: 'Sonstige Dokumente', icon: '📄' }
  ];

  const vorlagenKategorien = [
    { value: 'alle', label: 'Alle Vorlagen', icon: '📚' },
    { value: 'vertrag', label: 'Neumitglied', icon: '✨' },
    { value: 'bestand', label: 'Bestand', icon: '📊' },
    { value: 'kuendigung', label: 'Kündigung', icon: '📤' }
  ];

  useEffect(() => {
    if (activeDojo) {
      loadDokumente();
      loadVorlagen();
    }
  }, [activeDojo]);

  const loadDokumente = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/vertraege/dokumente/${activeDojo.id}`);
      setDokumente(response.data.data || []);
      setError('');
    } catch (err) {
      console.error('❌ Fehler beim Laden der Dokumente:', err);
      setError('Fehler beim Laden der Dokumente: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const loadVorlagen = async () => {
    try {
      setLoadingVorlagen(true);
      const response = await axios.get(`/vertragsvorlagen?dojo_id=${activeDojo.id}&aktiv=true`);
      setVorlagen(response.data.data || []);
    } catch (err) {
      console.error('❌ Fehler beim Laden der Vorlagen:', err);
    } finally {
      setLoadingVorlagen(false);
    }
  };

  const handleDeleteVorlage = async (id) => {
    if (!confirm('Möchten Sie diese Vorlage wirklich löschen?')) {
      return;
    }
    try {
      await axios.delete(`/vertragsvorlagen/${id}`);
      alert('✅ Vorlage erfolgreich gelöscht');
      loadVorlagen();
    } catch (err) {
      console.error('❌ Fehler beim Löschen der Vorlage:', err);
      alert('❌ Fehler beim Löschen der Vorlage');
    }
  };

  const handleEditVorlage = (id) => {
    setSelectedTemplate(id);
    setShowTemplateEditor(true);
    setActiveTab('vorlagen'); // Wechsle zum Vorlagen-Tab, damit der Editor sichtbar wird
  };

  const handleOpenCopyModal = () => {
    setShowCopyModal(true);
  };

  const handleToggleDocument = (id) => {
    setSelectedDocuments(prev =>
      prev.includes(id)
        ? prev.filter(docId => docId !== id)
        : [...prev, id]
    );
  };

  const handleCopyDocuments = async () => {
    if (!targetDojoId) {
      alert('Bitte wählen Sie ein Ziel-Dojo aus');
      return;
    }

    if (selectedDocuments.length === 0) {
      alert('Bitte wählen Sie mindestens ein Dokument aus');
      return;
    }

    try {
      for (const docId of selectedDocuments) {
        await axios.post(`/vertragsvorlagen/${docId}/copy`, {
          target_dojo_id: targetDojoId
        });
      }
      alert(`✅ ${selectedDocuments.length} Dokument(e) erfolgreich kopiert`);
      setShowCopyModal(false);
      setSelectedDocuments([]);
      setTargetDojoId(null);
    } catch (error) {
      console.error('Fehler beim Kopieren:', error);
      alert('❌ Fehler beim Kopieren der Dokumente');
    }
  };

  const getDojoName = (dojo_id) => {
    const dojo = dojos?.find(d => d.id === dojo_id);
    return dojo?.dojoname || `Dojo ${dojo_id}`;
  };

  const getFilteredVorlagen = () => {
    if (activeVorlagenKategorie === 'alle') {
      return vorlagen;
    }

    // Filter nach Kategorie basierend auf template_type
    if (activeVorlagenKategorie === 'vertrag') {
      return vorlagen.filter(v => v.template_type === 'vertrag' || v.template_type === 'sepa');
    }

    if (activeVorlagenKategorie === 'kuendigung') {
      return vorlagen.filter(v => v.template_type === 'kuendigung' || v.template_type === 'custom');
    }

    if (activeVorlagenKategorie === 'bestand') {
      return vorlagen.filter(v =>
        v.template_type === 'agb' ||
        v.template_type === 'datenschutz' ||
        (!['vertrag', 'sepa', 'kuendigung'].includes(v.template_type))
      );
    }

    return vorlagen;
  };

  const filteredVorlagen = getFilteredVorlagen();
  const filteredDokumente = dokumente.filter(d => d.dokumenttyp === selectedDokumentTyp);

  const handleImportFromDojos = async () => {
    if (!confirm('Möchten Sie die Dokumente aus den Dojo-Einstellungen importieren? Bereits vorhandene Dokumente werden übersprungen.')) {
      return;
    }

    try {
      const response = await axios.post('/vertraege/dokumente/import-from-dojos');
      if (response.data.success) {
        alert(`✅ ${response.data.message}`);
        loadDokumente();
      }
    } catch (err) {
      console.error('Fehler beim Import:', err);
      alert('❌ Fehler beim Import: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCreateVersion = async () => {
    try {
      if (!newDokument.version || !newDokument.titel || !newDokument.inhalt) {
        alert('Bitte füllen Sie alle Pflichtfelder aus.');
        return;
      }

      if (!activeDojo) {
        alert('Kein aktives Dojo ausgewählt.');
        return;
      }

      // Wenn "Alle Dojos" ausgewählt ist und kein Dojo manuell gewählt wurde, fragen
      if (activeDojo.id === 'all' && !newDokument.dojo_id) {
        alert('Bitte wählen Sie ein Dojo aus, dem dieses Dokument zugeordnet werden soll.');
        return;
      }

      const payload = {
        dojo_id: activeDojo.id === 'all' ? newDokument.dojo_id : activeDojo.id,
        dokumenttyp: selectedDokumentTyp,
        version: newDokument.version,
        titel: newDokument.titel,
        inhalt: newDokument.inhalt,
        gueltig_ab: newDokument.gueltig_ab,
        gueltig_bis: newDokument.gueltig_bis || null,
        aktiv: newDokument.aktiv
      };

      const response = await axios.post('/vertraege/dokumente', payload);

      if (response.data.success) {
        alert('✅ Dokumentversion erfolgreich erstellt!');
        setShowNewVersion(false);
        // Dokumente neu laden
        loadDokumente();
        // Formular zurücksetzen
        setNewDokument({
          dokumenttyp: selectedDokumentTyp,
          version: '',
          titel: '',
          inhalt: '',
          gueltig_ab: new Date().toISOString().split('T')[0],
          gueltig_bis: null,
          aktiv: true
        });
      }
    } catch (err) {
      console.error('Fehler beim Erstellen der Version:', err);
      alert('Fehler beim Erstellen der Version: ' + (err.response?.data?.error || err.message));
    }
  };

  const getTypLabel = (typ) => {
    const found = dokumentTypen.find(d => d.value === typ);
    return found ? found.label : typ;
  };

  const getTypIcon = (typ) => {
    const found = dokumentTypen.find(d => d.value === typ);
    return found ? found.icon : '📄';
  };

  return (
    <div style={{
      padding: '1rem 2rem 2rem 2rem',
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      minHeight: '100vh',
      color: 'white'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ 
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '2rem',
          flexWrap: 'wrap'
        }}>
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            flex: 1,
            minWidth: 0
          }}>
            <h2 style={{
              fontSize: '2rem',
              fontWeight: '700',
              margin: 0,
              background: 'linear-gradient(135deg, #FFD700, #FFA500)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              position: 'relative',
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <span style={{
                filter: 'drop-shadow(0 2px 8px rgba(255, 215, 0, 0.3))',
                position: 'relative',
                zIndex: 2,
                WebkitTextFillColor: 'initial',
                color: 'inherit'
              }}>📚</span>
              Dokumentenverwaltung
            </h2>
            <p style={{ 
              color: 'rgba(255,255,255,0.6)', 
              fontSize: '0.95rem',
              margin: 0,
              whiteSpace: 'nowrap',
              position: 'relative',
              zIndex: 2
            }}>
              Verwalten Sie rechtliche Dokumente mit Versionierung und Gültigkeitszeiträumen
            </p>
          </div>
        </div>

        {/* Tab-Navigation */}
        <div style={{
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'center',
          marginBottom: '1.5rem',
          position: 'relative',
          zIndex: 1
        }}>
          <button
            onClick={() => setActiveTab('dokumente')}
            className={activeTab === 'dokumente' ? '' : 'logout-button'}
            style={{
              padding: activeTab === 'dokumente' ? '0.875rem 1.5rem' : '10px 20px',
              background: activeTab === 'dokumente'
                ? 'linear-gradient(135deg, #FFD700, #FFA500)'
                : 'linear-gradient(135deg, rgba(255, 215, 0, 0.3) 0%, rgba(255, 215, 0, 0.1) 50%, transparent 100%)',
              border: activeTab === 'dokumente' ? 'none' : '1px solid rgba(255, 215, 0, 0.2)',
              color: activeTab === 'dokumente' ? '#1a1a2e' : 'rgba(255, 255, 255, 0.95)',
              fontSize: '0.95rem',
              fontWeight: activeTab === 'dokumente' ? '600' : '700',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              borderRadius: '12px',
              position: 'relative',
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: activeTab === 'dokumente'
                ? '0 4px 12px rgba(255, 215, 0, 0.3)'
                : '0 2px 8px rgba(255, 215, 0, 0.2)',
              backdropFilter: 'blur(10px)',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'dokumente') {
                e.target.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.4) 0%, rgba(255, 215, 0, 0.2) 50%, rgba(255, 107, 53, 0.1) 100%)';
                e.target.style.borderColor = 'rgba(255, 215, 0, 0.4)';
                e.target.style.color = '#ffd700';
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 4px 15px rgba(255, 215, 0, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'dokumente') {
                e.target.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.3) 0%, rgba(255, 215, 0, 0.1) 50%, transparent 100%)';
                e.target.style.borderColor = 'rgba(255, 215, 0, 0.2)';
                e.target.style.color = 'rgba(255, 255, 255, 0.95)';
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 2px 8px rgba(255, 215, 0, 0.2)';
              }
            }}
          >
            <span style={{ position: 'relative', zIndex: 2 }}>📄</span>
            <span>Dokumente & Versionen</span>
          </button>
          <button
            onClick={() => setActiveTab('vorlagen')}
            className={activeTab === 'vorlagen' ? '' : 'logout-button'}
            style={{
              padding: activeTab === 'vorlagen' ? '0.875rem 1.5rem' : '10px 20px',
              background: activeTab === 'vorlagen'
                ? 'linear-gradient(135deg, #FFD700, #FFA500)'
                : 'linear-gradient(135deg, rgba(255, 215, 0, 0.3) 0%, rgba(255, 215, 0, 0.1) 50%, transparent 100%)',
              border: activeTab === 'vorlagen' ? 'none' : '1px solid rgba(255, 215, 0, 0.2)',
              color: activeTab === 'vorlagen' ? '#1a1a2e' : 'rgba(255, 255, 255, 0.95)',
              fontSize: '0.95rem',
              fontWeight: activeTab === 'vorlagen' ? '600' : '700',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              borderRadius: '12px',
              position: 'relative',
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: activeTab === 'vorlagen'
                ? '0 4px 12px rgba(255, 215, 0, 0.3)'
                : '0 2px 8px rgba(255, 215, 0, 0.2)',
              backdropFilter: 'blur(10px)',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'vorlagen') {
                e.target.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.4) 0%, rgba(255, 215, 0, 0.2) 50%, rgba(255, 107, 53, 0.1) 100%)';
                e.target.style.borderColor = 'rgba(255, 215, 0, 0.4)';
                e.target.style.color = '#ffd700';
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 4px 15px rgba(255, 215, 0, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== 'vorlagen') {
                e.target.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.3) 0%, rgba(255, 215, 0, 0.1) 50%, transparent 100%)';
                e.target.style.borderColor = 'rgba(255, 215, 0, 0.2)';
                e.target.style.color = 'rgba(255, 255, 255, 0.95)';
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 2px 8px rgba(255, 215, 0, 0.2)';
              }
            }}
          >
            <span style={{ position: 'relative', zIndex: 2 }}>✏️</span>
            <span>Editor</span>
            <span style={{
              position: 'absolute',
              top: '0.25rem',
              right: '0.25rem',
              background: '#22c55e',
              color: 'white',
              fontSize: '0.6rem',
              padding: '0.15rem 0.35rem',
              borderRadius: '4px',
              fontWeight: 'bold',
              zIndex: 3,
              lineHeight: '1'
            }}>
              NEU
            </span>
          </button>
          {dojos && dojos.length > 1 && activeTab === 'dokumente' && (
            <button
              onClick={handleOpenCopyModal}
              className="logout-button"
              style={{
                marginLeft: 'auto',
                position: 'relative',
                zIndex: 2
              }}
            >
              📋 Dokumente kopieren
            </button>
          )}
          {activeTab === 'dokumente' && (
            <button
              onClick={handleImportFromDojos}
              className="logout-button"
              style={{
                marginLeft: dojos && dojos.length > 1 ? '0.5rem' : 'auto',
                position: 'relative',
                zIndex: 2,
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, rgba(34, 197, 94, 0.1) 50%, transparent 100%)',
                borderColor: 'rgba(34, 197, 94, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 0.4) 0%, rgba(34, 197, 94, 0.2) 50%, rgba(34, 197, 94, 0.1) 100%)';
                e.target.style.borderColor = 'rgba(34, 197, 94, 0.5)';
                e.target.style.color = '#22c55e';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, rgba(34, 197, 94, 0.1) 50%, transparent 100%)';
                e.target.style.borderColor = 'rgba(34, 197, 94, 0.3)';
                e.target.style.color = 'rgba(255, 255, 255, 0.95)';
              }}
            >
              📥 Dokumente importieren
            </button>
          )}
        </div>

        {/* Dokumente-Tab */}
        {activeTab === 'dokumente' && (
          <>
            {/* Filter-Container mit cleanerem Design */}
            <div style={{
              marginBottom: '1.5rem',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '16px',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 215, 0, 0.1)',
              overflow: 'hidden'
            }}>
              {/* Vertragsvorlagen-Sektion */}
              <div style={{
                padding: '1.25rem',
                borderBottom: '1px solid rgba(255, 215, 0, 0.1)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.75rem'
                }}>
                  <span style={{ fontSize: '1.1rem' }}>📝</span>
                  <h4 style={{
                    margin: 0,
                    color: '#FFD700',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    opacity: 0.9
                  }}>
                    Vertragsvorlagen
                  </h4>
                </div>
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  flexWrap: 'wrap'
                }}>
                  {vorlagenKategorien.map((kategorie) => (
                    <button
                      key={kategorie.value}
                      onClick={() => {
                        setSubTab(kategorie.value);
                        setActiveVorlagenKategorie(kategorie.value);
                      }}
                      style={{
                        padding: '0.65rem 1.1rem',
                        background: subTab === kategorie.value
                          ? 'linear-gradient(135deg, #FFD700, #FFA500)'
                          : 'rgba(255, 255, 255, 0.05)',
                        border: subTab === kategorie.value
                          ? 'none'
                          : '1px solid rgba(255, 215, 0, 0.15)',
                        borderRadius: '10px',
                        color: subTab === kategorie.value
                          ? '#1a1a2e'
                          : 'rgba(255, 255, 255, 0.85)',
                        fontSize: '0.875rem',
                        fontWeight: subTab === kategorie.value ? '600' : '500',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        whiteSpace: 'nowrap',
                        boxShadow: subTab === kategorie.value
                          ? '0 4px 12px rgba(255, 215, 0, 0.25)'
                          : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                      onMouseEnter={(e) => {
                        if (subTab !== kategorie.value) {
                          e.target.style.background = 'rgba(255, 215, 0, 0.1)';
                          e.target.style.borderColor = 'rgba(255, 215, 0, 0.3)';
                          e.target.style.color = '#FFD700';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (subTab !== kategorie.value) {
                          e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                          e.target.style.borderColor = 'rgba(255, 215, 0, 0.15)';
                          e.target.style.color = 'rgba(255, 255, 255, 0.85)';
                        }
                      }}
                    >
                      <span>{kategorie.icon}</span>
                      <span>{kategorie.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Rechtliche Dokumente-Sektion */}
              <div style={{
                padding: '1.25rem'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.75rem'
                }}>
                  <span style={{ fontSize: '1.1rem' }}>📄</span>
                  <h4 style={{
                    margin: 0,
                    color: '#FFD700',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    opacity: 0.9
                  }}>
                    Rechtliche Dokumente
                  </h4>
                </div>
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  flexWrap: 'wrap'
                }}>
                  {dokumentTypen.map(typ => (
                    <button
                      key={typ.value}
                      onClick={() => {
                        setSubTab(typ.value);
                        setSelectedDokumentTyp(typ.value);
                      }}
                      style={{
                        padding: '0.65rem 1.1rem',
                        background: subTab === typ.value
                          ? 'linear-gradient(135deg, #FFD700, #FFA500)'
                          : 'rgba(255, 255, 255, 0.05)',
                        border: subTab === typ.value
                          ? 'none'
                          : '1px solid rgba(255, 215, 0, 0.15)',
                        borderRadius: '10px',
                        color: subTab === typ.value
                          ? '#1a1a2e'
                          : 'rgba(255, 255, 255, 0.85)',
                        fontSize: '0.875rem',
                        fontWeight: subTab === typ.value ? '600' : '500',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        whiteSpace: 'nowrap',
                        boxShadow: subTab === typ.value
                          ? '0 4px 12px rgba(255, 215, 0, 0.25)'
                          : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                      onMouseEnter={(e) => {
                        if (subTab !== typ.value) {
                          e.target.style.background = 'rgba(255, 215, 0, 0.1)';
                          e.target.style.borderColor = 'rgba(255, 215, 0, 0.3)';
                          e.target.style.color = '#FFD700';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (subTab !== typ.value) {
                          e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                          e.target.style.borderColor = 'rgba(255, 215, 0, 0.15)';
                          e.target.style.color = 'rgba(255, 255, 255, 0.85)';
                        }
                      }}
                    >
                      <span>{typ.icon}</span>
                      <span>{typ.label.replace(' (Allgemeine Geschäftsbedingungen)', '').replace('Dojo Regeln (Dojokun)', 'Dojokun')}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Vorlagen-Bereich */}
            <div style={{ marginBottom: '2rem' }}>
              <div
                onClick={() => setVorlagenExpanded(!vorlagenExpanded)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2rem',
                  marginBottom: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{
                    fontSize: '1.2rem',
                    transition: 'transform 0.3s ease',
                    transform: vorlagenExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    color: '#FFD700'
                  }}>
                    ▶
                  </span>
                  <h3 style={{
                    margin: 0,
                    color: '#FFD700',
                    fontSize: '1.5rem',
                    fontWeight: '700',
                    minWidth: '150px'
                  }}>
                    📝 Vorlagen
                  </h3>
                </div>
                <div style={{ flex: 1, height: '2px', background: 'linear-gradient(to right, rgba(255, 215, 0, 0.5), transparent)' }}></div>
              </div>
              {vorlagenExpanded && (

              <div>
                {loadingVorlagen ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,0.6)' }}>
                    Lade Vorlagen...
                  </div>
                ) : vorlagen.length === 0 ? (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    padding: '3rem',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    textAlign: 'center'
                  }}>
                    <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.1rem' }}>
                      Noch keine Vorlagen erstellt
                    </p>
                    <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem' }}>
                      Wechseln Sie zum "Editor" Tab um eine neue Vorlage zu erstellen
                    </p>
                  </div>
                ) : filteredVorlagen.length === 0 ? (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    padding: '3rem',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    textAlign: 'center'
                  }}>
                    <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.1rem' }}>
                      Keine Vorlagen in dieser Kategorie
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {filteredVorlagen.map((vorlage) => (
                      <div
                        key={vorlage.id}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '12px',
                          padding: '1.5rem',
                          backdropFilter: 'blur(10px)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        {vorlage.is_default && (
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            padding: '0.5rem 1rem',
                            background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                            borderRadius: '0 12px 0 12px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            color: '#1a1a2e'
                          }}>
                            ⭐ STANDARD
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                          <div style={{ flex: 1 }}>
                            <h4 style={{ margin: '0 0 0.5rem 0', color: 'white', fontSize: '1.2rem' }}>
                              {vorlage.name}
                            </h4>
                            {vorlage.beschreibung && (
                              <p style={{ margin: '0 0 0.75rem 0', color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem' }}>
                                {vorlage.beschreibung}
                              </p>
                            )}
                            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', flexWrap: 'wrap' }}>
                              <span>🏢 {getDojoName(vorlage.dojo_id)}</span>
                              <span>📋 Typ: {vorlage.template_type}</span>
                              <span>📅 Version: {vorlage.version}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                            <button
                              onClick={() => handleEditVorlage(vorlage.id)}
                              style={{
                                padding: '0.5rem 1rem',
                                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                border: 'none',
                                borderRadius: '6px',
                                color: 'white',
                                fontSize: '0.85rem',
                                cursor: 'pointer'
                              }}
                            >
                              ✏️ Bearbeiten
                            </button>
                            <button
                              onClick={() => handleDeleteVorlage(vorlage.id)}
                              style={{
                                padding: '0.5rem 1rem',
                                background: 'transparent',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                borderRadius: '6px',
                                color: 'rgba(239, 68, 68, 0.8)',
                                fontSize: '0.85rem',
                                cursor: 'pointer'
                              }}
                            >
                              🗑️ Löschen
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              )}
            </div>

            {/* Dokumente-Bereich */}
            <div style={{ marginBottom: '2rem' }}>
              <div
                onClick={() => setDokumenteExpanded(!dokumenteExpanded)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2rem',
                  marginBottom: '1rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{
                    fontSize: '1.2rem',
                    transition: 'transform 0.3s ease',
                    transform: dokumenteExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    color: '#FFD700'
                  }}>
                    ▶
                  </span>
                  <h3 style={{
                    margin: 0,
                    color: '#FFD700',
                    fontSize: '1.5rem',
                    fontWeight: '700',
                    minWidth: '150px'
                  }}>
                    📄 Dokumente
                  </h3>
                </div>
                <div style={{ flex: 1, height: '2px', background: 'linear-gradient(to right, rgba(255, 215, 0, 0.5), transparent)' }}></div>
              </div>
              {dokumenteExpanded && (

        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          padding: '1.5rem',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{
              fontSize: '1.3rem',
              fontWeight: '600',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              {getTypIcon(selectedDokumentTyp)}
              {getTypLabel(selectedDokumentTyp)} - Versionen
            </h3>
            <button
              onClick={() => setShowNewVersion(true)}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                border: '1px solid #FFD700',
                borderRadius: '8px',
                color: '#1a1a2e',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 15px rgba(255, 215, 0, 0.3)'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 20px rgba(255, 215, 0, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 15px rgba(255, 215, 0, 0.3)';
              }}
            >
              <span>+</span>
              Neue Version erstellen
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,0.6)' }}>
              Lade Dokumente...
            </div>
          ) : filteredDokumente.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              background: 'rgba(255, 215, 0, 0.05)',
              borderRadius: '10px',
              border: '2px dashed rgba(255, 215, 0, 0.3)'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
              <h4 style={{ marginBottom: '0.5rem', color: '#FFD700' }}>Keine Versionen vorhanden</h4>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
                Erstellen Sie die erste Version dieses Dokumenttyps.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filteredDokumente
                .sort((a, b) => b.version.localeCompare(a.version))
                .map(dok => (
                  <div
                    key={dok.id}
                    style={{
                      background: dok.aktiv
                        ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.15), rgba(255, 165, 0, 0.15))'
                        : 'rgba(255, 255, 255, 0.05)',
                      border: dok.aktiv
                        ? '2px solid #FFD700'
                        : '2px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '2rem',
                      transition: 'all 0.3s ease',
                      boxShadow: dok.aktiv
                        ? '0 8px 32px rgba(255, 215, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                        : '0 4px 16px rgba(0, 0, 0, 0.2)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = dok.aktiv
                        ? '0 12px 48px rgba(255, 215, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                        : '0 8px 32px rgba(0, 0, 0, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = dok.aktiv
                        ? '0 8px 32px rgba(255, 215, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                        : '0 4px 16px rgba(0, 0, 0, 0.2)';
                    }}
                  >
                    {/* Dekorativer Glanz-Effekt */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: '200px',
                      height: '200px',
                      background: 'radial-gradient(circle, rgba(255, 215, 0, 0.1) 0%, transparent 70%)',
                      pointerEvents: 'none'
                    }} />
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '1rem'
                    }}>
                      <div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem',
                          marginBottom: '0.5rem'
                        }}>
                          <span style={{
                            fontSize: '1.2rem',
                            fontWeight: '700',
                            color: dok.aktiv ? '#FFD700' : 'rgba(255,255,255,0.8)'
                          }}>
                            Version {dok.version}
                          </span>
                          {dok.aktiv && (
                            <span style={{
                              padding: '0.25rem 0.75rem',
                              background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                              borderRadius: '20px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              color: '#1a1a2e'
                            }}>
                              ✓ AKTIV
                            </span>
                          )}
                        </div>
                        <h4 style={{
                          fontSize: '1.1rem',
                          fontWeight: '600',
                          margin: '0 0 0.5rem 0',
                          color: 'white'
                        }}>
                          {dok.titel}
                        </h4>
                        <div style={{
                          fontSize: '0.85rem',
                          color: 'rgba(255,255,255,0.6)',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '1rem'
                        }}>
                          <span>🏢 {getDojoName(dok.dojo_id)}</span>
                          <span>📅 Gültig ab: {new Date(dok.gueltig_ab).toLocaleDateString('de-DE')}</span>
                          {dok.gueltig_bis && (
                            <span>📅 Gültig bis: {new Date(dok.gueltig_bis).toLocaleDateString('de-DE')}</span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => setViewingDokument(dok)}
                          style={{
                            padding: '0.5rem 1rem',
                            background: 'transparent',
                            border: '1px solid rgba(59, 130, 246, 0.4)',
                            borderRadius: '8px',
                            color: '#3B82F6',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = 'rgba(59, 130, 246, 0.1)';
                            e.target.style.borderColor = 'rgba(59, 130, 246, 0.6)';
                            e.target.style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = 'transparent';
                            e.target.style.borderColor = 'rgba(59, 130, 246, 0.4)';
                            e.target.style.transform = 'translateY(0)';
                          }}
                        >
                          👁️ Anzeigen
                        </button>
                        <button
                          style={{
                            padding: '0.5rem 1rem',
                            background: 'transparent',
                            border: '1px solid rgba(245, 158, 11, 0.4)',
                            borderRadius: '8px',
                            color: '#F59E0B',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = 'rgba(245, 158, 11, 0.1)';
                            e.target.style.borderColor = 'rgba(245, 158, 11, 0.6)';
                            e.target.style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = 'transparent';
                            e.target.style.borderColor = 'rgba(245, 158, 11, 0.4)';
                            e.target.style.transform = 'translateY(0)';
                          }}
                        >
                          ✏️ Bearbeiten
                        </button>
                      </div>
                    </div>

                    {/* Inhalt-Vorschau - Verbessert */}
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02))',
                      borderRadius: '8px',
                      padding: '1.25rem',
                      fontSize: '0.85rem',
                      color: 'rgba(255,255,255,0.7)',
                      maxHeight: '120px',
                      overflow: 'hidden',
                      position: 'relative',
                      border: '1px solid rgba(255, 215, 0, 0.1)',
                      fontFamily: 'Georgia, serif',
                      lineHeight: '1.5'
                    }}>
                      <div style={{
                        filter: 'brightness(0.9)',
                        textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                      }}>
                        {dok.inhalt.replace(/<[^>]*>/g, '').substring(0, 180)}...
                      </div>
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '60px',
                        background: 'linear-gradient(to bottom, transparent, rgba(30, 41, 59, 0.95))',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        paddingBottom: '0.5rem'
                      }}>
                        <span style={{
                          fontSize: '0.75rem',
                          color: '#ffd700',
                          fontStyle: 'italic'
                        }}>
                          Klicken Sie auf "Anzeigen" für den vollständigen Text
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
              )}
            </div>

        {/* Modal für neue Version */}
        {showNewVersion && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '2rem'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '800px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              border: '2px solid rgba(255, 215, 0, 0.3)'
            }}>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                marginBottom: '1.5rem',
                color: '#FFD700'
              }}>
                Neue Version erstellen: {getTypLabel(selectedDokumentTyp)}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Dojo-Auswahl wenn "Alle Dojos" aktiv ist */}
                {activeDojo?.id === 'all' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)' }}>
                      Dojo *
                    </label>
                    <select
                      value={newDokument.dojo_id || ''}
                      onChange={(e) => setNewDokument({...newDokument, dojo_id: parseInt(e.target.value)})}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '6px',
                        color: 'white',
                        fontSize: '0.95rem'
                      }}
                    >
                      <option value="" style={{ background: '#1e293b', color: 'white' }}>-- Dojo auswählen --</option>
                      {dojos?.filter(d => d.id !== 'all').map(dojo => (
                        <option key={dojo.id} value={dojo.id} style={{ background: '#1e293b', color: 'white' }}>
                          {dojo.dojoname}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)' }}>
                    Version *
                  </label>
                  <input
                    type="text"
                    placeholder="z.B. 1.1, 2.0"
                    value={newDokument.version}
                    onChange={(e) => setNewDokument({...newDokument, version: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '6px',
                      color: 'white',
                      fontSize: '0.95rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)' }}>
                    Titel *
                  </label>
                  <input
                    type="text"
                    placeholder="z.B. Allgemeine Geschäftsbedingungen"
                    value={newDokument.titel}
                    onChange={(e) => setNewDokument({...newDokument, titel: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '6px',
                      color: 'white',
                      fontSize: '0.95rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)' }}>
                    Inhalt * (HTML möglich)
                  </label>
                  <textarea
                    rows="10"
                    placeholder="Dokumenteninhalt..."
                    value={newDokument.inhalt}
                    onChange={(e) => setNewDokument({...newDokument, inhalt: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '6px',
                      color: 'white',
                      fontSize: '0.95rem',
                      fontFamily: 'monospace',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)' }}>
                      Gültig ab *
                    </label>
                    <input
                      type="date"
                      value={newDokument.gueltig_ab}
                      onChange={(e) => setNewDokument({...newDokument, gueltig_ab: e.target.value})}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '6px',
                        color: 'white',
                        fontSize: '0.95rem'
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)' }}>
                      Gültig bis (optional)
                    </label>
                    <input
                      type="date"
                      value={newDokument.gueltig_bis || ''}
                      onChange={(e) => setNewDokument({...newDokument, gueltig_bis: e.target.value || null})}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        borderRadius: '6px',
                        color: 'white',
                        fontSize: '0.95rem'
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowNewVersion(false)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '8px',
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                    e.target.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'transparent';
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                    e.target.style.transform = 'translateY(0)';
                  }}
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleCreateVersion}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                    border: '1px solid #FFD700',
                    borderRadius: '8px',
                    color: '#1a1a2e',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 15px rgba(255, 215, 0, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(255, 215, 0, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 15px rgba(255, 215, 0, 0.3)';
                  }}
                >
                  Version erstellen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal zum Anzeigen des Dokuments */}
        {viewingDokument && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '2rem',
            overflow: 'auto'
          }}
          onClick={() => setViewingDokument(null)}
          >
            <div
              style={{
                background: 'white',
                borderRadius: '12px',
                maxWidth: '900px',
                width: '100%',
                maxHeight: '90vh',
                overflow: 'auto',
                position: 'relative',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{
                position: 'sticky',
                top: 0,
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                padding: '1.5rem',
                borderTopLeftRadius: '12px',
                borderTopRightRadius: '12px',
                borderBottom: '3px solid #ffd700',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 10
              }}>
                <div>
                  <h2 style={{
                    fontSize: '1.5rem',
                    fontWeight: '700',
                    color: '#ffd700',
                    margin: 0,
                    marginBottom: '0.5rem'
                  }}>
                    {getTypIcon(viewingDokument.dokumenttyp)} {viewingDokument.titel}
                  </h2>
                  <p style={{
                    fontSize: '0.9rem',
                    color: 'rgba(255, 255, 255, 0.7)',
                    margin: 0
                  }}>
                    Version {viewingDokument.version} | Gültig ab {new Date(viewingDokument.gueltig_ab).toLocaleDateString('de-DE')}
                  </p>
                </div>
                <button
                  onClick={() => setViewingDokument(null)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    color: 'white',
                    fontSize: '1.5rem',
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'transparent';
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Content - Professionelles Styling */}
              <div
                style={{
                  padding: '3rem 4rem',
                  color: '#1a1a2e',
                  lineHeight: '1.8',
                  background: 'linear-gradient(to bottom, #ffffff, #fafafa)',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                }}
              >
                <style>
                  {`
                    @media print {
                      body * {
                        visibility: hidden;
                      }
                      .print-content, .print-content * {
                        visibility: visible;
                      }
                      .print-content {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                      }
                    }
                  `}
                </style>
                <div
                  className="print-content"
                  style={{
                    maxWidth: '800px',
                    margin: '0 auto'
                  }}
                  dangerouslySetInnerHTML={{ __html: viewingDokument.inhalt }}
                />
              </div>

              {/* Footer mit Buttons */}
              <div style={{
                position: 'sticky',
                bottom: 0,
                background: '#f8f9fa',
                padding: '1.5rem',
                borderBottomLeftRadius: '12px',
                borderBottomRightRadius: '12px',
                borderTop: '1px solid #e5e7eb',
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => window.print()}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'transparent',
                    border: '1px solid rgba(59, 130, 246, 0.4)',
                    borderRadius: '8px',
                    color: '#3B82F6',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(59, 130, 246, 0.1)';
                    e.target.style.borderColor = 'rgba(59, 130, 246, 0.6)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'transparent';
                    e.target.style.borderColor = 'rgba(59, 130, 246, 0.4)';
                  }}
                >
                  🖨️ Drucken
                </button>
                <button
                  onClick={() => setViewingDokument(null)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'linear-gradient(135deg, #ffd700, #ff6b35)',
                    border: '1px solid #ffd700',
                    borderRadius: '8px',
                    color: '#1a1a2e',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 15px rgba(255, 215, 0, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(255, 215, 0, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 15px rgba(255, 215, 0, 0.3)';
                  }}
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        )}
          </>
        )}

        {/* Vorlagen-Tab (Template Editor) */}
        {activeTab === 'vorlagen' && (
          <div>
            {showTemplateEditor ? (
              <TemplateEditor
                templateId={selectedTemplate}
                dojoId={activeDojo?.id}
                onSave={() => {
                  setShowTemplateEditor(false);
                  setSelectedTemplate(null);
                  loadVorlagen();
                }}
                onClose={() => {
                  setShowTemplateEditor(false);
                  setSelectedTemplate(null);
                }}
              />
            ) : (
              <div>
                {/* Header mit Button */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '2rem'
                }}>
                  <h3 style={{ margin: 0, color: '#FFD700', fontSize: '1.5rem' }}>
                    📝 Vertragsvorlagen
                  </h3>
                  <button
                    onClick={() => {
                      setSelectedTemplate(null);
                      setShowTemplateEditor(true);
                    }}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'linear-gradient(135deg, #22c55e, #10b981)',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'transform 0.3s ease',
                      boxShadow: '0 4px 15px rgba(34, 197, 94, 0.3)'
                    }}
                    onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                  >
                    ➕ Neue Vorlage erstellen
                  </button>
                </div>

                {/* Kategorie-Tabs */}
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  marginBottom: '2rem',
                  borderBottom: '2px solid rgba(255, 255, 255, 0.1)',
                  paddingBottom: '0.5rem'
                }}>
                  {vorlagenKategorien.map((kategorie) => (
                    <button
                      key={kategorie.value}
                      onClick={() => setActiveVorlagenKategorie(kategorie.value)}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: activeVorlagenKategorie === kategorie.value
                          ? 'linear-gradient(135deg, #FFD700, #FFA500)'
                          : 'rgba(255, 255, 255, 0.05)',
                        border: activeVorlagenKategorie === kategorie.value
                          ? '2px solid #FFD700'
                          : '2px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px',
                        color: activeVorlagenKategorie === kategorie.value
                          ? '#1a1a2e'
                          : 'rgba(255, 255, 255, 0.7)',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                      onMouseEnter={(e) => {
                        if (activeVorlagenKategorie !== kategorie.value) {
                          e.target.style.background = 'rgba(255, 255, 255, 0.08)';
                          e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (activeVorlagenKategorie !== kategorie.value) {
                          e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                          e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                        }
                      }}
                    >
                      <span>{kategorie.icon}</span>
                      <span>{kategorie.label}</span>
                    </button>
                  ))}
                </div>

                {/* Vorlagen-Liste */}
                {loadingVorlagen ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,0.6)' }}>
                    Lade Vorlagen...
                  </div>
                ) : vorlagen.length === 0 ? (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    padding: '3rem',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    textAlign: 'center'
                  }}>
                    <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.1rem' }}>
                      Noch keine Vorlagen erstellt
                    </p>
                    <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem' }}>
                      Erstellen Sie Ihre erste Vorlage mit dem Button oben
                    </p>
                  </div>
                ) : filteredVorlagen.length === 0 ? (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    padding: '3rem',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    textAlign: 'center'
                  }}>
                    <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.1rem' }}>
                      Keine Vorlagen in dieser Kategorie
                    </p>
                    <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem' }}>
                      Erstellen Sie eine neue Vorlage mit dem Button oben
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {filteredVorlagen.map((vorlage) => (
                      <div
                        key={vorlage.id}
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '12px',
                          padding: '1.5rem',
                          backdropFilter: 'blur(10px)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          transition: 'all 0.3s ease',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        {/* Gradient Overlay */}
                        {vorlage.is_default && (
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            padding: '0.5rem 1rem',
                            background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                            borderRadius: '0 12px 0 12px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            color: '#1a1a2e'
                          }}>
                            ⭐ STANDARD
                          </div>
                        )}

                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '1rem'
                        }}>
                          <div style={{ flex: 1 }}>
                            <h4 style={{
                              margin: '0 0 0.5rem 0',
                              color: 'white',
                              fontSize: '1.2rem',
                              fontWeight: '600'
                            }}>
                              {vorlage.name}
                            </h4>
                            {vorlage.beschreibung && (
                              <p style={{
                                margin: '0 0 0.75rem 0',
                                color: 'rgba(255, 255, 255, 0.6)',
                                fontSize: '0.9rem'
                              }}>
                                {vorlage.beschreibung}
                              </p>
                            )}
                            <div style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '1rem',
                              fontSize: '0.85rem',
                              color: 'rgba(255, 255, 255, 0.5)'
                            }}>
                              <span>
                                📄 Typ: {vorlage.template_type || 'vertrag'}
                              </span>
                              <span>
                                📅 Version: {vorlage.version || 1}
                              </span>
                              <span>
                                🕒 Erstellt: {new Date(vorlage.erstellt_am).toLocaleDateString('de-DE')}
                              </span>
                              {vorlage.aktualisiert_am && vorlage.erstellt_am !== vorlage.aktualisiert_am && (
                                <span>
                                  ✏️ Bearbeitet: {new Date(vorlage.aktualisiert_am).toLocaleDateString('de-DE')}
                                </span>
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                            <button
                              onClick={() => handleEditVorlage(vorlage.id)}
                              style={{
                                padding: '0.5rem 1rem',
                                background: 'transparent',
                                border: '1px solid rgba(59, 130, 246, 0.4)',
                                borderRadius: '8px',
                                color: '#3B82F6',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.background = 'rgba(59, 130, 246, 0.1)';
                                e.target.style.borderColor = 'rgba(59, 130, 246, 0.6)';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.background = 'transparent';
                                e.target.style.borderColor = 'rgba(59, 130, 246, 0.4)';
                              }}
                            >
                              ✏️ Bearbeiten
                            </button>
                            <button
                              onClick={() => handleDeleteVorlage(vorlage.id)}
                              style={{
                                padding: '0.5rem 1rem',
                                background: 'transparent',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                borderRadius: '8px',
                                color: '#EF4444',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.background = 'rgba(239, 68, 68, 0.1)';
                                e.target.style.borderColor = 'rgba(239, 68, 68, 0.6)';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.background = 'transparent';
                                e.target.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                              }}
                            >
                              🗑️ Löschen
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Kopieren Modal */}
        {showCopyModal && (
          <div
            onClick={() => setShowCopyModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(5px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                borderRadius: '16px',
                padding: '2rem',
                maxWidth: '600px',
                width: '90%',
                maxHeight: '80vh',
                overflow: 'auto',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(255, 215, 0, 0.2)'
              }}
            >
              <button
                onClick={() => setShowCopyModal(false)}
                style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
                }}
              >
                ✕
              </button>

              <h3 style={{
                margin: '0 0 1rem 0',
                color: '#ffd700',
                fontSize: '1.5rem',
                fontWeight: '700'
              }}>
                📋 Dokumente kopieren
              </h3>
              <p style={{ color: 'rgba(255, 255, 255, 0.7)', marginBottom: '2rem' }}>
                Wählen Sie die Dokumente aus, die Sie in ein anderes Dojo kopieren möchten
              </p>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  color: '#ffd700'
                }}>
                  Ziel-Dojo:
                </label>
                <select
                  value={targetDojoId || ''}
                  onChange={(e) => setTargetDojoId(parseInt(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '1rem'
                  }}
                >
                  <option value="">-- Dojo auswählen --</option>
                  {dojos?.filter(d => d.id !== activeDojo?.id).map(dojo => (
                    <option key={dojo.id} value={dojo.id} style={{ background: '#1e293b', color: 'white' }}>
                      {dojo.dojoname}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  color: '#ffd700'
                }}>
                  Dokumente auswählen:
                </label>
                <div style={{
                  maxHeight: '300px',
                  overflow: 'auto',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '8px',
                  padding: '1rem',
                  border: '1px solid rgba(255, 215, 0, 0.2)'
                }}>
                  {vorlagen.map((vorlage) => (
                    <div
                      key={vorlage.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.75rem',
                        marginBottom: '0.5rem',
                        background: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 215, 0, 0.1)',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease'
                      }}
                      onClick={() => {
                        setSelectedDocuments(prev =>
                          prev.includes(vorlage.id)
                            ? prev.filter(id => id !== vorlage.id)
                            : [...prev, vorlage.id]
                        );
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 215, 0, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedDocuments.includes(vorlage.id)}
                        onChange={() => {}}
                        style={{
                          marginRight: '0.75rem',
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer'
                        }}
                      />
                      <label style={{
                        margin: 0,
                        cursor: 'pointer',
                        flex: 1,
                        color: 'rgba(255, 255, 255, 0.9)',
                        fontSize: '0.9rem'
                      }}>
                        {vorlage.name} ({vorlage.template_type})
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{
                display: 'flex',
                gap: '1rem',
                justifyContent: 'flex-end',
                marginTop: '2rem'
              }}>
                <button
                  onClick={handleCopyDocuments}
                  disabled={!targetDojoId || selectedDocuments.length === 0}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: !targetDojoId || selectedDocuments.length === 0
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'linear-gradient(135deg, #22c55e, #10b981)',
                    border: 'none',
                    borderRadius: '8px',
                    color: !targetDojoId || selectedDocuments.length === 0
                      ? 'rgba(255, 255, 255, 0.3)'
                      : 'white',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    cursor: !targetDojoId || selectedDocuments.length === 0
                      ? 'not-allowed'
                      : 'pointer',
                    transition: 'transform 0.3s ease',
                    boxShadow: !targetDojoId || selectedDocuments.length === 0
                      ? 'none'
                      : '0 4px 15px rgba(34, 197, 94, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    if (targetDojoId && selectedDocuments.length > 0) {
                      e.target.style.transform = 'translateY(-2px)';
                    }
                  }}
                  onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                >
                  ✅ {selectedDocuments.length} Dokument(e) kopieren
                </button>
                <button
                  onClick={() => {
                    setShowCopyModal(false);
                    setSelectedDocuments([]);
                    setTargetDojoId(null);
                  }}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '8px',
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'transparent';
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                  }}
                >
                  ❌ Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DokumenteVerwaltung;
