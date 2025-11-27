import React, { useState, useEffect } from 'react';
import axios from 'axios';
import TemplateEditor from '../components/TemplateEditor';
import { useDojoContext } from '../context/DojoContext';
import '../styles/Vertragsdokumente.css';

const Vertragsdokumente = () => {
  const { activeDojo, filter, dojos } = useDojoContext();
  const [vorlagen, setVorlagen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [targetDojoId, setTargetDojoId] = useState(null);
  const [activeTab, setActiveTab] = useState('dokumente'); // 'dokumente' oder 'editor'
  const [subTab, setSubTab] = useState('alle'); // 'alle', 'neumitglied', 'vertrag', 'sepa', etc.

  const dojoId = activeDojo?.id || localStorage.getItem('dojo_id') || 1;

  useEffect(() => {
    loadVorlagen();
  }, [filterType, activeDojo, filter]);

  const loadVorlagen = async () => {
    try {
      setLoading(true);
      const params = {
        dojo_id: dojoId,
        aktiv: 'true'
      };

      if (filterType !== 'all') {
        params.template_type = filterType;
      }

      const response = await axios.get('/vertragsvorlagen', { params });
      setVorlagen(response.data.data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Vorlagen:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setSelectedTemplate(null);
    setShowEditor(true);
  };

  const handleEdit = (template) => {
    setSelectedTemplate(template.id);
    setShowEditor(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Möchten Sie diese Vorlage wirklich löschen?')) {
      return;
    }

    try {
      await axios.delete(`/vertragsvorlagen/${id}`);
      alert('✅ Vorlage gelöscht');
      loadVorlagen();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      alert('❌ Fehler beim Löschen der Vorlage');
    }
  };

  const handlePreview = async (id) => {
    try {
      const response = await axios.get(`/vertragsvorlagen/${id}/preview`);
      const blob = new Blob([response.data], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (error) {
      console.error('Fehler bei der Vorschau:', error);
      alert('❌ Fehler bei der Vorschau');
    }
  };

  const handleSetDefault = async (id, templateType) => {
    try {
      await axios.put(`/vertragsvorlagen/${id}`, { is_default: true });
      alert('✅ Standard-Vorlage gesetzt');
      loadVorlagen();
    } catch (error) {
      console.error('Fehler:', error);
      alert('❌ Fehler beim Setzen der Standard-Vorlage');
    }
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
      // Kopiere alle ausgewählten Dokumente
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

  const handleCloseEditor = () => {
    setShowEditor(false);
    setSelectedTemplate(null);
    loadVorlagen();
  };

  const getTypeLabel = (type) => {
    const labels = {
      vertrag: '📄 Vertrag',
      sepa: '💳 SEPA-Mandat',
      agb: '📋 AGB',
      datenschutz: '🔒 Datenschutz',
      custom: '✨ Custom'
    };
    return labels[type] || type;
  };

  if (showEditor) {
    return (
      <TemplateEditor
        templateId={selectedTemplate}
        dojoId={dojoId}
        onSave={handleCloseEditor}
        onClose={handleCloseEditor}
      />
    );
  }

  return (
    <div className="vertragsdokumente-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>📝 Vertragsdokumente</h1>
          <p className="subtitle">Erstellen und verwalten Sie Ihre Vertragsvorlagen</p>
        </div>
        <button className="btn btn-primary" onClick={handleCreateNew}>
          ➕ Neue Vorlage erstellen
        </button>
      </div>

      {/* Main Tabs */}
      <div className="tabs-container">
        <button
          className={`tab-button ${activeTab === 'dokumente' ? 'active' : ''}`}
          onClick={() => setActiveTab('dokumente')}
        >
          📄 Dokumente & Versionen
        </button>
        <button
          className={`tab-button ${activeTab === 'editor' ? 'active' : ''}`}
          onClick={() => setActiveTab('editor')}
        >
          ✏️ Editor
        </button>
        {dojos && dojos.length > 1 && activeTab === 'dokumente' && (
          <button
            className="btn btn-info"
            style={{ marginLeft: 'auto' }}
            onClick={handleOpenCopyModal}
          >
            📋 Dokumente kopieren
          </button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === 'dokumente' && (
        <>
          {/* Sub-Tabs */}
          <div className="subtabs-container">
            <button
              className={`subtab-button ${subTab === 'alle' ? 'active' : ''}`}
              onClick={() => setSubTab('alle')}
            >
              Alle Vorlagen
            </button>
            <button
              className={`subtab-button ${subTab === 'neumitglied' ? 'active' : ''}`}
              onClick={() => setSubTab('neumitglied')}
            >
              Neumitglied
            </button>
            <button
              className={`subtab-button ${subTab === 'vertrag' ? 'active' : ''}`}
              onClick={() => setSubTab('vertrag')}
            >
              Verträge
            </button>
            <button
              className={`subtab-button ${subTab === 'sepa' ? 'active' : ''}`}
              onClick={() => setSubTab('sepa')}
            >
              SEPA-Mandate
            </button>
            <button
              className={`subtab-button ${subTab === 'agb' ? 'active' : ''}`}
              onClick={() => setSubTab('agb')}
            >
              AGB
            </button>
            <button
              className={`subtab-button ${subTab === 'datenschutz' ? 'active' : ''}`}
              onClick={() => setSubTab('datenschutz')}
            >
              Datenschutz
            </button>
          </div>

          {/* Vorlagen Liste */}
          {loading ? (
            <div className="loading">Lade Vorlagen...</div>
          ) : vorlagen.filter(v => subTab === 'alle' || v.template_type === subTab).length === 0 ? (
            <div className="empty-state">
              <h3>🎨 Noch keine Vorlagen vorhanden</h3>
              <p>Erstellen Sie Ihre erste Vertragsvorlage mit dem visuellen Editor</p>
              <button className="btn btn-primary" onClick={handleCreateNew}>
                Erste Vorlage erstellen
              </button>
            </div>
          ) : (
            <div className="vorlagen-grid">
              {vorlagen
                .filter(v => subTab === 'alle' || v.template_type === subTab || (subTab === 'neumitglied' && v.name.toLowerCase().includes('neumitglied')))
                .map((vorlage) => (
                <div key={vorlage.id} className={`vorlage-card ${vorlage.is_default ? 'default' : ''}`}>
                  {vorlage.is_default && (
                    <div className="default-badge">⭐ Standard</div>
                  )}

                  <div className="vorlage-header">
                    <h3>{vorlage.name}</h3>
                    <span className="type-badge">{getTypeLabel(vorlage.template_type)}</span>
                  </div>

                  {vorlage.beschreibung && (
                    <p className="vorlage-description">{vorlage.beschreibung}</p>
                  )}

                  <div className="vorlage-meta">
                    <small>🏢 {getDojoName(vorlage.dojo_id)}</small>
                    <small>Version {vorlage.version}</small>
                    <small>Erstellt: {new Date(vorlage.erstellt_am).toLocaleDateString('de-DE')}</small>
                  </div>

                  <div className="vorlage-actions">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleEdit(vorlage)}
                    >
                      ✏️ Bearbeiten
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => handlePreview(vorlage.id)}
                    >
                      👁️ Vorschau
                    </button>
                    {!vorlage.is_default && (
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleSetDefault(vorlage.id, vorlage.template_type)}
                      >
                        ⭐ Als Standard
                      </button>
                    )}
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(vorlage.id)}
                    >
                      🗑️ Löschen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'editor' && (
        <TemplateEditor
          templateId={selectedTemplate}
          dojoId={dojoId}
          onSave={() => {
            setActiveTab('dokumente');
            loadVorlagen();
          }}
          onClose={() => {
            setActiveTab('dokumente');
          }}
        />
      )}

      {/* Vorschau Modal */}
      {previewUrl && (
        <div className="preview-modal" onClick={() => setPreviewUrl(null)}>
          <div className="preview-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setPreviewUrl(null)}>✕</button>
            <iframe src={previewUrl} title="Vorschau" />
          </div>
        </div>
      )}

      {/* Kopieren Modal */}
      {showCopyModal && (
        <div className="preview-modal" onClick={() => setShowCopyModal(false)}>
          <div className="copy-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowCopyModal(false)}>✕</button>
            <h3>📋 Dokumente kopieren</h3>
            <p>Wählen Sie die Dokumente aus, die Sie in ein anderes Dojo kopieren möchten</p>

            <div className="form-group">
              <label>Ziel-Dojo:</label>
              <select
                className="form-control"
                value={targetDojoId || ''}
                onChange={(e) => setTargetDojoId(parseInt(e.target.value))}
              >
                <option value="">-- Dojo auswählen --</option>
                {dojos?.filter(d => d.id !== dojoId).map(dojo => (
                  <option key={dojo.id} value={dojo.id}>
                    {dojo.dojoname}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Dokumente auswählen:</label>
              <div className="documents-selection">
                {vorlagen.map((vorlage) => (
                  <div key={vorlage.id} className="document-checkbox">
                    <input
                      type="checkbox"
                      id={`doc-${vorlage.id}`}
                      checked={selectedDocuments.includes(vorlage.id)}
                      onChange={() => handleToggleDocument(vorlage.id)}
                    />
                    <label htmlFor={`doc-${vorlage.id}`}>
                      {vorlage.name} ({getTypeLabel(vorlage.template_type)})
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-primary"
                onClick={handleCopyDocuments}
                disabled={!targetDojoId || selectedDocuments.length === 0}
              >
                ✅ {selectedDocuments.length} Dokument(e) kopieren
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowCopyModal(false);
                  setSelectedDocuments([]);
                  setTargetDojoId(null);
                }}
              >
                ❌ Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="info-box">
        <h4>💡 Verwendung von Platzhaltern</h4>
        <p>In Ihren Vorlagen können Sie dynamische Platzhalter verwenden:</p>
        <ul>
          <li><code>{'{{mitglied.vorname}}'}</code> - Vorname des Mitglieds</li>
          <li><code>{'{{vertrag.monatsbeitrag}}'}</code> - Monatlicher Beitrag</li>
          <li><code>{'{{dojo.dojoname}}'}</code> - Name Ihres Dojos</li>
          <li><code>{'{{system.datum}}'}</code> - Heutiges Datum</li>
        </ul>
        <p>Diese werden automatisch beim Generieren des PDFs ersetzt.</p>
      </div>
    </div>
  );
};

export default Vertragsdokumente;
