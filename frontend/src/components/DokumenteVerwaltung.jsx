import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext.jsx';
import { createSafeHtml } from '../utils/sanitizer';

// Lazy load TemplateEditor - GrapesJS ist 1.1MB und wird nur bei Bedarf geladen
const TemplateEditor = lazy(() => import('./TemplateEditor'));
import '../styles/Dashboard.css';
import '../styles/DokumenteVerwaltung.css';

/**
 * Erweiterte Dokumentenverwaltung mit Versionierung
 * Verwaltet AGB, Datenschutz, Hausordnung, etc. mit Versionshistorie
 */
const DokumenteVerwaltung = ({ embedded = false }) => {
  const { activeDojo, dojos } = useDojoContext();
  const [dokumente, setDokumente] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDokumentTyp, setSelectedDokumentTyp] = useState('alle');
  const [showNewVersion, setShowNewVersion] = useState(false);
  const [viewingDokument, setViewingDokument] = useState(null);
  const viewRef = useRef(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [activeTab, setActiveTab] = useState('dokumente'); // 'dokumente' oder 'vorlagen'
  const [vorlagen, setVorlagen] = useState([]);
  const [loadingVorlagen, setLoadingVorlagen] = useState(false);
  const [activeVorlagenKategorie, setActiveVorlagenKategorie] = useState('alle');
  const [subTab, setSubTab] = useState('vorlagen'); // 'vorlagen' oder Dokumenttyp (agb, datenschutz, etc.)
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [selectedDokumenteForCopy, setSelectedDokumenteForCopy] = useState([]);
  const [targetDojoId, setTargetDojoId] = useState(null);
  const [contentView, setContentView] = useState('vorlagen'); // 'vorlagen' | 'dokumente'

  const [editingDokument, setEditingDokument] = useState(null);
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
    { value: 'alle', label: 'Alle Dokumente', icon: '📚' },
    { value: 'agb', label: 'AGB (Allgemeine Geschäftsbedingungen)', icon: '📋' },
    { value: 'datenschutz', label: 'Datenschutzerklärung', icon: '🔒' },
    { value: 'widerruf', label: 'Widerrufsbelehrung', icon: '↩️' },
    { value: 'hausordnung', label: 'Hausordnung', icon: '🏠' },
    { value: 'dojokun', label: 'Dojo Regeln (Dojokun)', icon: '🥋' },
    { value: 'haftung', label: 'Haftungsausschluss', icon: '⚠️' },
    { value: 'kuendigung', label: 'Kündigungsschreiben', icon: '📤' },
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
      console.log('🔍 Loading documents for dojo:', activeDojo?.id, activeDojo);
      const response = await axios.get(`/vertraege/dokumente/${activeDojo.id}`);
      console.log('📦 Received documents:', response.data.data?.length, 'documents');
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

  const handleEditDokument = (dokument) => {
    // Automatisch Version erhöhen (z.B. 1.0 → 1.1, 1.9 → 2.0, 2.5 → 2.6)
    const incrementVersion = (currentVersion) => {
      const parts = currentVersion.split('.');
      if (parts.length === 2) {
        const major = parseInt(parts[0]);
        const minor = parseInt(parts[1]);
        // Minor erhöhen, bei 9 → 0 und Major erhöhen
        if (minor >= 9) {
          return `${major + 1}.0`;
        } else {
          return `${major}.${minor + 1}`;
        }
      }
      // Fallback: einfach ".1" anhängen
      return currentVersion + '.1';
    };

    // NICHT setEditingDokument setzen, damit neue Version erstellt wird
    setEditingDokument(null);
    setNewDokument({
      dokumenttyp: dokument.dokumenttyp,
      version: incrementVersion(dokument.version),
      titel: dokument.titel,
      inhalt: dokument.inhalt,
      gueltig_ab: dokument.gueltig_ab ? dokument.gueltig_ab.split('T')[0] : new Date().toISOString().split('T')[0],
      gueltig_bis: dokument.gueltig_bis ? dokument.gueltig_bis.split('T')[0] : null,
      aktiv: dokument.aktiv,
      dojo_id: dokument.dojo_id
    });
    setSelectedDokumentTyp(dokument.dokumenttyp);
    setShowNewVersion(true);
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

    const totalSelected = selectedDocuments.length + selectedDokumenteForCopy.length;
    if (totalSelected === 0) {
      alert('Bitte wählen Sie mindestens ein Dokument aus');
      return;
    }

    try {
      let copied = 0;
      let errors = 0;

      // Copy Vertragsvorlagen
      for (const docId of selectedDocuments) {
        try {
          await axios.post(`/vertragsvorlagen/${docId}/copy`, {
            target_dojo_id: targetDojoId
          });
          copied++;
        } catch (err) {
          console.error(`Fehler beim Kopieren der Vorlage ${docId}:`, err.response?.data?.error || err.message);
          errors++;
        }
      }

      // Copy Vertragsdokumente (AGB, etc.)
      for (const docId of selectedDokumenteForCopy) {
        try {
          await axios.post(`/vertraege/dokumente/${docId}/copy`, {
            target_dojo_id: targetDojoId
          });
          copied++;
        } catch (err) {
          console.error(`Fehler beim Kopieren des Dokuments ${docId}:`, err.response?.data?.error || err.message);
          errors++;
        }
      }

      if (errors > 0) {
        alert(`⚠️ ${copied} Dokument(e) kopiert, ${errors} Fehler`);
      } else {
        alert(`✅ ${copied} Dokument(e) erfolgreich kopiert`);
      }

      setShowCopyModal(false);
      setSelectedDocuments([]);
      setSelectedDokumenteForCopy([]);
      setTargetDojoId(null);
      loadDokumente();
      loadVorlagen();
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
  const filteredDokumente = selectedDokumentTyp === 'alle'
    ? dokumente
    : dokumente.filter(d => d.dokumenttyp === selectedDokumentTyp);

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
      if (activeDojo.id === 'all' && !newDokument.dojo_id && !editingDokument) {
        alert('Bitte wählen Sie ein Dojo aus, dem dieses Dokument zugeordnet werden soll.');
        return;
      }

      // Formatiere Datumswerte korrekt für MySQL (YYYY-MM-DD)
      const formatDate = (dateStr) => {
        if (!dateStr) return null;
        // Falls bereits im richtigen Format (YYYY-MM-DD), direkt zurückgeben
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
        // Sonst ISO-String zu YYYY-MM-DD konvertieren
        return dateStr.split('T')[0];
      };

      const payload = {
        dojo_id: activeDojo.id === 'all' ? newDokument.dojo_id : activeDojo.id,
        dokumenttyp: selectedDokumentTyp,
        version: newDokument.version,
        titel: newDokument.titel,
        inhalt: newDokument.inhalt,
        gueltig_ab: formatDate(newDokument.gueltig_ab),
        gueltig_bis: formatDate(newDokument.gueltig_bis),
        aktiv: newDokument.aktiv
      };

      console.log('📤 Sending payload:', payload);
      console.log('✨ Creating new document version');
      const response = await axios.post('/vertraege/dokumente', payload);

      console.log('📥 Server response:', response.data);
      if (response.data.success) {
        alert('✅ Neue Dokumentversion erfolgreich erstellt!');

        // Frage ob Mitglieder benachrichtigt werden sollen
        const shouldNotify = confirm(
          '📢 Möchten Sie alle Mitglieder über die neue Dokumentversion benachrichtigen?\n\n' +
          'Die Mitglieder erhalten eine Push-Benachrichtigung, die sie bestätigen müssen.'
        );

        if (shouldNotify) {
          try {
            const dojoId = activeDojo.id === 'all' ? newDokument.dojo_id : activeDojo.id;
            const notifyResponse = await axios.post('/notifications/document-update', {
              dojo_id: dojoId,
              document_type: selectedDokumentTyp,
              document_title: newDokument.titel,
              document_version: newDokument.version
            });

            if (notifyResponse.data.success) {
              alert(`✅ ${notifyResponse.data.sent} Benachrichtigungen wurden versendet!`);
            }
          } catch (notifyErr) {
            console.error('Fehler beim Versenden der Benachrichtigungen:', notifyErr);
            alert('⚠️ Dokument wurde gespeichert, aber Benachrichtigungen konnten nicht versendet werden.');
          }
        }

        setShowNewVersion(false);
        // Dokumente neu laden
        console.log('🔄 Reloading documents...');
        loadDokumente();
        // Formular zurücksetzen
        setNewDokument({
          dokumenttyp: selectedDokumentTyp,
          version: '',
          titel: '',
          inhalt: '',
          gueltig_ab: new Date().toISOString().split('T')[0],
          gueltig_bis: null,
          aktiv: true,
          dojo_id: null
        });
      }
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      alert('Fehler beim Speichern: ' + (err.response?.data?.error || err.message));
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
    <div className={embedded ? 'dv-root-wrapper dv-root-wrapper--embedded' : 'dv-root-wrapper dv-root-wrapper--full'}>
      <div className="dv-content-wrapper">
        {/* Header - nur anzeigen wenn nicht eingebettet */}
        {!embedded && (
        <div className="dv-header-bar">
          <div className="dv-header-left">
            <h2 className="dv-page-title">
              <span className="dv-title-icon">📚</span>
              Dokumentenverwaltung
            </h2>
            <p className="dv-page-subtitle">
              Verwalten Sie rechtliche Dokumente mit Versionierung und Gültigkeitszeiträumen
            </p>
          </div>
        </div>
        )}

        {/* Tab-Navigation */}
        <div className="dv-tab-bar">
          <button
            onClick={() => setActiveTab('dokumente')}
            className={`dv-tab-btn${activeTab === 'dokumente' ? ' dv-tab-btn--active' : ''}`}
          >
            Dokumente & Versionen
          </button>
          <button
            onClick={() => setActiveTab('vorlagen')}
            className={`dv-tab-btn${activeTab === 'vorlagen' ? ' dv-tab-btn--active' : ''}`}
          >
            Vorlagen-Editor
          </button>
        </div>

        {/* Dokumente-Tab */}
        {activeTab === 'dokumente' && (
          <>
            {/* Ansichts-Umschalter */}
            <div className="dv-subtab-bar">
              <button
                onClick={() => setContentView('vorlagen')}
                className={`dv-subtab-btn${contentView === 'vorlagen' ? ' dv-subtab-btn--active' : ''}`}
              >
                <span>📝</span> Vertragsvorlagen
                <span className={contentView === 'vorlagen' ? 'dv-subtab-badge--active' : 'dv-subtab-badge'}>{vorlagen.length}</span>
              </button>
              <button
                onClick={() => setContentView('dokumente')}
                className={`dv-subtab-btn${contentView === 'dokumente' ? ' dv-subtab-btn--active' : ''}`}
              >
                <span>📄</span> Rechtliche Dokumente
                <span className={contentView === 'dokumente' ? 'dv-subtab-badge--active' : 'dv-subtab-badge'}>{dokumente.length}</span>
              </button>
            </div>

            {/* Kategorie-Filter */}
            <div className="dv-filter-bar">
              {contentView === 'vorlagen'
                ? vorlagenKategorien.map((kategorie) => (
                    <button
                      key={kategorie.value}
                      onClick={() => {
                        setSubTab(kategorie.value);
                        setActiveVorlagenKategorie(kategorie.value);
                      }}
                      className={`dv-filter-btn${activeVorlagenKategorie === kategorie.value ? ' dv-filter-btn--active' : ''}`}
                    >
                      <span>{kategorie.icon}</span>
                      <span>{kategorie.label}</span>
                    </button>
                  ))
                : dokumentTypen.map(typ => (
                    <button
                      key={typ.value}
                      onClick={() => {
                        setSubTab(typ.value);
                        setSelectedDokumentTyp(typ.value);
                      }}
                      className={`dv-filter-btn${selectedDokumentTyp === typ.value ? ' dv-filter-btn--active' : ''}`}
                    >
                      <span>{typ.icon}</span>
                      <span>{typ.label.replace(' (Allgemeine Geschäftsbedingungen)', '').replace('Dojo Regeln (Dojokun)', 'Dojokun')}</span>
                    </button>
                  ))
              }
              {/* Aktionen rechts */}
              <div className="dv-actions-right">
                {contentView === 'dokumente' && (
                  <button
                    onClick={handleImportFromDojos}
                    className="dv-btn-new-vorlage"
                  >
                    <span>📥</span> Importieren
                  </button>
                )}
                {dojos && dojos.length > 1 && (
                  <button
                    onClick={handleOpenCopyModal}
                    className="dv-btn-secondary"
                  >
                    <span>📋</span> Kopieren
                  </button>
                )}
              </div>
            </div>

            {/* === CONTENT: Vertragsvorlagen === */}
            {contentView === 'vorlagen' && (
              <div>
                {loadingVorlagen ? (
                  <div className="dv-loading-text">
                    Lade Vorlagen...
                  </div>
                ) : vorlagen.length === 0 ? (
                  <div className="dv-empty-box">
                    <p className="dv-empty-text-main">
                      Noch keine Vorlagen erstellt
                    </p>
                    <p className="dv-vorlage-hint">
                      Wechseln Sie zum "Editor" Tab um eine neue Vorlage zu erstellen
                    </p>
                  </div>
                ) : filteredVorlagen.length === 0 ? (
                  <div className="dv-empty-box">
                    <p className="dv-empty-text-main">
                      Keine Vorlagen in dieser Kategorie
                    </p>
                  </div>
                ) : (
                  <div className="u-grid-gap-sm">
                    {filteredVorlagen.map((vorlage) => (
                      <div
                        key={vorlage.id}
                        className="dv-vorlage-card"
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary-alpha-30, rgba(255,215,0,0.3))'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-default, rgba(255,255,255,0.1))'}
                      >
                        {vorlage.is_default && (
                          <span className="dv-badge-standard">STANDARD</span>
                        )}
                        <div className="dv-row-between">
                          <div className="u-flex-1-min0">
                            <h4 className="dv-vorlage-name">
                              {vorlage.name}
                            </h4>
                            {vorlage.beschreibung && (
                              <p className="dv-vorlage-desc">
                                {vorlage.beschreibung}
                              </p>
                            )}
                            <div className="dv-doc-meta">
                              <span>Typ: {vorlage.template_type}</span>
                              <span>Version: {vorlage.version}</span>
                              <span>{getDojoName(vorlage.dojo_id)}</span>
                            </div>
                          </div>
                          <div className="dv-btn-group-sm">
                            <button
                              onClick={() => handleEditVorlage(vorlage.id)}
                              className="dv-btn-primary-xs"
                            >
                              Bearbeiten
                            </button>
                            <button
                              onClick={() => handleDeleteVorlage(vorlage.id)}
                              className="dv-btn-danger-xs"
                            >
                              L&ouml;schen
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* === CONTENT: Rechtliche Dokumente === */}
            {contentView === 'dokumente' && (
              <div>
                {/* Header */}
                <div className="dv-doc-section-header">
                  <h3 className="dv-doc-section-title">
                    {getTypIcon(selectedDokumentTyp)} {getTypLabel(selectedDokumentTyp)}
                    <span className="dv-badge-version-count">{filteredDokumente.length} Versionen</span>
                  </h3>
                  <button
                    onClick={() => setShowNewVersion(true)}
                    className="dv-btn-primary-sm"
                  >
                    + Neue Version
                  </button>
                </div>

                {loading ? (
                  <div className="dv-loading-text">
                    Lade Dokumente...
                  </div>
                ) : filteredDokumente.length === 0 ? (
                  <div className="dv-doc-empty">
                    <p className="dv-empty-centered">
                      Keine Versionen vorhanden. Erstellen Sie die erste Version.
                    </p>
                  </div>
                ) : (
                  <div className="u-flex-col-sm">
                    {filteredDokumente
                      .sort((a, b) => b.version.localeCompare(a.version))
                      .map(dok => (
                        <div
                          key={dok.id}
                          className={`dv-dok-card${dok.aktiv ? ' dv-dok-card--aktiv' : ''}`}
                          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary-alpha-30, rgba(255,215,0,0.3))'}
                          onMouseLeave={(e) => e.currentTarget.style.borderColor = dok.aktiv ? 'var(--primary-alpha-30, rgba(255,215,0,0.3))' : 'var(--border-default, rgba(255,255,255,0.08))'}
                        >
                          <div className="u-flex-row-lg">
                          {/* Typ-Icon */}
                          <div className={`dv-dok-icon-box${dok.aktiv ? ' dv-dok-icon-box--aktiv' : ''}`}>
                            {getTypIcon(dok.dokumenttyp)}
                          </div>

                          {/* Info */}
                          <div className="u-flex-1-min0">
                            <div className="dv-doc-title-row">
                              <span className="dv-doc-item-title">
                                {dok.titel}
                              </span>
                              <span className="dv-badge-version">v{dok.version}</span>
                              {dok.aktiv && (
                                <span className="dv-badge-aktiv">Aktiv</span>
                              )}
                            </div>
                            <div className="dv-doc-meta">
                              <span>{getDojoName(dok.dojo_id)}</span>
                              <span>ab {new Date(dok.gueltig_ab).toLocaleDateString('de-DE')}</span>
                              {dok.gueltig_bis && (
                                <span>bis {new Date(dok.gueltig_bis).toLocaleDateString('de-DE')}</span>
                              )}
                            </div>
                          </div>

                          {/* Aktionen */}
                          <div className="dv-btn-group-sm">
                            <button
                              onClick={() => {
                                const next = viewingDokument?.id === dok.id ? null : dok;
                                setViewingDokument(next);
                                if (next) {
                                  setTimeout(() => viewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
                                }
                              }}
                              className={`dv-view-btn${viewingDokument?.id === dok.id ? ' dv-view-btn--active' : ''}`}
                            >
                              {viewingDokument?.id === dok.id ? 'Verbergen' : 'Anzeigen'}
                            </button>
                            <button
                              onClick={() => handleEditDokument(dok)}
                              className="dv-btn-secondary dv-btn-secondary-xs"
                            >
                              Neue Version
                            </button>
                          </div>
                          </div>

                          {/* Inline-Vorschau */}
                        {viewingDokument?.id === dok.id && (
                          <div ref={viewRef} className="dv-doc-preview">
                            {/* Vorschau-Header */}
                            <div className="dv-doc-preview-bar">
                              <div>
                                <span className="dv-preview-title">
                                  {dok.titel}
                                </span>
                                <span className="dv-preview-version">
                                  Version {dok.version}
                                </span>
                              </div>
                              <div className="u-flex-gap-xs">
                                <button
                                  onClick={() => window.print()}
                                  className="dv-btn-tool"
                                >
                                  Drucken
                                </button>
                                <button
                                  onClick={() => setViewingDokument(null)}
                                  className="dv-btn-tool"
                                >
                                  Schliessen
                                </button>
                              </div>
                            </div>
                            {/* Vorschau-Inhalt */}
                            <div
                              className="print-content"
                              className="dv-doc-preview-content"
                              dangerouslySetInnerHTML={createSafeHtml(dok.inhalt)}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

        {/* Modal für neue Version */}
        {showNewVersion && (
          <div className="dv-modal-overlay">
            <div className="dv-modal-panel">
              <h3 className="dv-modal-title">
                ✨ Neue Version erstellen: {getTypLabel(selectedDokumentTyp)}
              </h3>

              <div className="u-flex-col-sm">
                {/* Dojo-Auswahl wenn "Alle Dojos" aktiv ist */}
                {activeDojo?.id === 'all' && (
                  <div>
                    <label className="dv-form-label">
                      Dojo *
                    </label>
                    <select
                      value={newDokument.dojo_id || ''}
                      onChange={(e) => setNewDokument({...newDokument, dojo_id: parseInt(e.target.value)})}
                      className="dv-input"
                    >
                      <option value="" className="dv-select-option">-- Dojo auswählen --</option>
                      {dojos?.filter(d => d.id !== 'all').map(dojo => (
                        <option key={dojo.id} value={dojo.id} className="dv-select-option">
                          {dojo.dojoname}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="dv-form-label">
                    Version * <span className="dv-version-hint">(automatisch erhöht)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="z.B. 1.1, 2.0"
                    value={newDokument.version}
                    readOnly
                    className="dv-input-subtle dv-input-disabled"
                  />
                </div>

                <div>
                  <label className="dv-form-label">
                    Inhalt * (HTML möglich)
                  </label>
                  <textarea
                    rows="10"
                    placeholder="Dokumenteninhalt..."
                    value={newDokument.inhalt}
                    onChange={(e) => setNewDokument({...newDokument, inhalt: e.target.value})}
                    className="dv-input dv-input-mono"
                  />
                </div>

                <div className="u-grid-2col">
                  <div>
                    <label className="dv-form-label">
                      Gültig ab *
                    </label>
                    <input
                      type="date"
                      value={newDokument.gueltig_ab}
                      onChange={(e) => setNewDokument({...newDokument, gueltig_ab: e.target.value})}
                      className="dv-input"
                    />
                  </div>
                  <div>
                    <label className="dv-form-label">
                      Gültig bis (optional)
                    </label>
                    <input
                      type="date"
                      value={newDokument.gueltig_bis || ''}
                      onChange={(e) => setNewDokument({...newDokument, gueltig_bis: e.target.value || null})}
                      className="dv-input"
                    />
                  </div>
                </div>
              </div>

              <div className="dv-modal-actions">
                <button
                  onClick={() => {
                    setShowNewVersion(false);
                  }}
                  className="dv-btn-cancel"
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
                  className="dv-btn-submit"
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 20px rgba(255, 215, 0, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 15px rgba(255, 215, 0, 0.3)';
                  }}
                >
                  ✨ Version erstellen
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
              <Suspense fallback={
                <div className="dv-loading-center">
                  <div className="loading-spinner"></div>
                  <span className="u-ml-sm">Template-Editor wird geladen...</span>
                </div>
              }>
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
              </Suspense>
            ) : (
              <div>
                {/* Header mit Button */}
                <div className="dv-vorlagen-header">
                  <h3 className="dv-modal-title">
                    📝 Vertragsvorlagen
                  </h3>
                  <button
                    onClick={() => {
                      setSelectedTemplate(null);
                      setShowTemplateEditor(true);
                    }}
                    className="dv-btn-success"
                    onMouseEnter={(e) => e.target.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
                  >
                    ➕ Neue Vorlage erstellen
                  </button>
                </div>

                {/* Kategorie-Tabs */}
                <div className="dv-subtab-row">
                  {vorlagenKategorien.map((kategorie) => (
                    <button
                      key={kategorie.value}
                      onClick={() => setActiveVorlagenKategorie(kategorie.value)}
                      className={`dv-vorlage-tab-btn${activeVorlagenKategorie === kategorie.value ? ' dv-vorlage-tab-btn--active' : ''}`}
                    >
                      <span>{kategorie.icon}</span>
                      <span>{kategorie.label}</span>
                    </button>
                  ))}
                </div>

                {/* Vorlagen-Liste */}
                {loadingVorlagen ? (
                  <div className="dv-loading-text">
                    Lade Vorlagen...
                  </div>
                ) : vorlagen.length === 0 ? (
                  <div className="dv-empty-box">
                    <p className="dv-empty-text-lg">
                      Noch keine Vorlagen erstellt
                    </p>
                    <p className="dv-empty-hint">
                      Erstellen Sie Ihre erste Vorlage mit dem Button oben
                    </p>
                  </div>
                ) : filteredVorlagen.length === 0 ? (
                  <div className="dv-empty-box">
                    <p className="dv-empty-text-lg">
                      Keine Vorlagen in dieser Kategorie
                    </p>
                    <p className="dv-empty-hint">
                      Erstellen Sie eine neue Vorlage mit dem Button oben
                    </p>
                  </div>
                ) : (
                  <div className="u-grid-gap">
                    {filteredVorlagen.map((vorlage) => (
                      <div
                        key={vorlage.id}
                        className="dv-vorlage-list-card"
                      >
                        {/* Gradient Overlay */}
                        {vorlage.is_default && (
                          <div className="dv-badge-standard-tr">
                            ⭐ STANDARD
                          </div>
                        )}

                        <div className="dv-vorlage-info-row">
                          <div className="u-flex-1">
                            <h4 className="dv-vorlage-title">
                              {vorlage.name}
                            </h4>
                            {vorlage.beschreibung && (
                              <p className="dv-vorlage-description">
                                {vorlage.beschreibung}
                              </p>
                            )}
                            <div className="dv-vorlage-meta">
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

                          <div className="dv-btn-group">
                            <button
                              onClick={() => handleEditVorlage(vorlage.id)}
                              className="dv-btn-primary-outline"
                              onMouseEnter={(e) => {
                                e.target.style.background = 'var(--primary-alpha-10, rgba(255, 215, 0, 0.1))';
                                e.target.style.borderColor = 'var(--primary-alpha-60, rgba(255, 215, 0, 0.6))';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.background = 'transparent';
                                e.target.style.borderColor = 'var(--primary-alpha-30, rgba(255, 215, 0, 0.3))';
                              }}
                            >
                              ✏️ Bearbeiten
                            </button>
                            <button
                              onClick={() => handleDeleteVorlage(vorlage.id)}
                              className="dv-btn-danger-outline"
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
            className="dv-modal-overlay-copy"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="dv-modal-panel-copy"
            >
              <div className="dv-modal-copy-title">
                <h3>Dokumente kopieren</h3>
                <button
                  onClick={() => setShowCopyModal(false)}
                  className="dv-modal-close"
                >
                  ✕
                </button>
              </div>
              <div>
                <label className="dv-modal-label">Ziel-Dojo:</label>
                <select
                  value={targetDojoId || ''}
                  onChange={(e) => setTargetDojoId(parseInt(e.target.value))}
                  className="dv-input-gold dv-select-sm"
                >
                  <option value="">-- Dojo auswählen --</option>
                  {dojos?.filter(d => d.id !== activeDojo?.id).map(dojo => (
                    <option key={dojo.id} value={dojo.id} className="dv-select-option">
                      {dojo.dojoname}
                    </option>
                  ))}
                </select>
              </div>

              <div className="dv-section-gap">
                <label className="dv-modal-label">
                  Dokumente auswählen:
                </label>

                {/* Vertragsvorlagen */}
                <div className="dv-section-gap">
                  <h4 className="dv-category-heading">
                    📝 Vertragsvorlagen
                  </h4>
                  <div className="dv-scroll-box">
                    {vorlagen.length === 0 ? (
                      <p className="dv-empty-centered">
                        Keine Vertragsvorlagen vorhanden
                      </p>
                    ) : (
                      vorlagen.map((vorlage) => (
                    <div
                      key={vorlage.id}
                      className="dv-selectable-item"
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
                        className="dv-checkbox"
                      />
                      <label className="dv-selectable-label">
                        {vorlage.name} ({vorlage.template_type})
                      </label>
                    </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Rechtliche Dokumente */}
                <div className="dv-section-gap">
                  <h4 className="dv-category-heading">
                    📄 Rechtliche Dokumente (AGB, Dojokun, etc.)
                  </h4>
                  <div className="dv-scroll-box">
                    {dokumente.length === 0 ? (
                      <p className="dv-empty-centered">
                        Keine rechtlichen Dokumente vorhanden
                      </p>
                    ) : (
                      dokumente.map((dok) => (
                        <div
                          key={dok.id}
                          className="dv-selectable-item"
                          onClick={() => {
                            setSelectedDokumenteForCopy(prev =>
                              prev.includes(dok.id)
                                ? prev.filter(id => id !== dok.id)
                                : [...prev, dok.id]
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
                            checked={selectedDokumenteForCopy.includes(dok.id)}
                            onChange={() => {}}
                            className="dv-checkbox"
                          />
                          <label className="dv-selectable-label">
                            {getTypIcon(dok.dokumenttyp)} {dok.titel} (v{dok.version})
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="dv-modal-actions">
                <button
                  onClick={handleCopyDocuments}
                  disabled={!targetDojoId || (selectedDocuments.length === 0 && selectedDokumenteForCopy.length === 0)}
                  className="dv-copy-submit-btn"
                >
                  ✅ {selectedDocuments.length + selectedDokumenteForCopy.length} Dokument(e) kopieren
                </button>
                <button
                  onClick={() => {
                    setShowCopyModal(false);
                    setSelectedDocuments([]);
                    setSelectedDokumenteForCopy([]);
                    setTargetDojoId(null);
                  }}
                  className="dv-btn-cancel"
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
