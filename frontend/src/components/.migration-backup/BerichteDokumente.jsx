import React, { useState, useEffect } from 'react';
import { FileText, Download, Trash2, Edit, Plus, FileCheck, Calendar, Users, TrendingUp, DollarSign, Award } from 'lucide-react';
import '../styles/BerichteDokumente.css';
import config from '../config/config.js';

const BerichteDokumente = () => {
  const [documents, setDocuments] = useState([]);
  const [selectedDocType, setSelectedDocType] = useState('all');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Dokumenttypen
  const documentTypes = [
    { id: 'all', label: 'Alle Dokumente', icon: <FileText size={18} /> },
    { id: 'vertrag', label: 'Mitgliedschaftsvertrag', icon: <FileText size={18} />, color: '#DC2626', featured: true },
    { id: 'mitgliederliste', label: 'Mitgliederliste', icon: <Users size={18} />, color: '#3B82F6' },
    { id: 'anwesenheit', label: 'Anwesenheitsberichte', icon: <FileCheck size={18} />, color: '#10B981' },
    { id: 'beitraege', label: 'Beitragsübersicht', icon: <DollarSign size={18} />, color: '#F59E0B' },
    { id: 'statistiken', label: 'Statistiken', icon: <TrendingUp size={18} />, color: '#8B5CF6' },
    { id: 'pruefungen', label: 'Prüfungsurkunden', icon: <Award size={18} />, color: '#EF4444' },
    { id: 'custom', label: 'Benutzerdefiniert', icon: <FileText size={18} />, color: '#6B7280' }
  ];

  // Dokumente von API laden
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/dokumente?status=erstellt`);

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Dokumente');
      }

      const data = await response.json();

      // Formatiere Daten für Frontend
      const formattedDocs = data.map(doc => ({
        id: doc.id,
        name: doc.name,
        type: doc.typ,
        created: new Date(doc.erstellt_am).toLocaleDateString('de-DE'),
        size: formatBytes(doc.dateigroesse),
        format: doc.dateityp,
        downloads: doc.downloads
      }));

      setDocuments(formattedDocs);
    } catch (error) {
      setMessage('❌ Fehler beim Laden der Dokumente');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Formatiere Bytes zu lesbarer Größe
  const formatBytes = (bytes) => {
    if (!bytes) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  // Dokument erstellen
  const handleCreateDocument = async (docType) => {
    const docTypeObj = documentTypes.find(dt => dt.label === docType);
    if (!docTypeObj) return;

    setMessage(`✨ PDF-Erstellung für "${docType}" wird gestartet...`);
    setLoading(true);

    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const name = `${docType}_${timestamp}`;

      const response = await fetch(`${config.apiBaseUrl}/dokumente/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          typ: docTypeObj.id,
          name: name,
          parameter: {
            // Zusätzliche Parameter können hier übergeben werden
            generatedAt: new Date().toISOString()
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Fehler bei der PDF-Generierung');
      }

      const result = await response.json();
      setMessage(`✅ ${docType} erfolgreich erstellt!`);

      // Dokumente neu laden
      await loadDocuments();
      setShowCreateModal(false);

    } catch (error) {
      setMessage(`❌ Fehler: ${error.message}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Dokument herunterladen
  const handleDownload = async (doc) => {
    setMessage(`📥 Download "${doc.name}" wird gestartet...`);

    try {
      const response = await fetch(`/dokumente/${doc.id}/download`);

      if (!response.ok) {
        throw new Error('Download fehlgeschlagen');
      }

      // Erstelle Blob aus Response
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.name}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setMessage(`✅ "${doc.name}" erfolgreich heruntergeladen`);

      // Dokumente neu laden um Download-Counter zu aktualisieren
      await loadDocuments();

    } catch (error) {
      setMessage(`❌ Download-Fehler: ${error.message}`);
      console.error(error);
    }
  };

  // Dokument löschen
  const handleDelete = async (docId) => {
    if (!window.confirm('Möchten Sie dieses Dokument wirklich löschen?')) return;

    setLoading(true);
    try {
      const response = await fetch(`/dokumente/${docId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Löschen fehlgeschlagen');
      }

      setMessage('✅ Dokument erfolgreich gelöscht');

      // Dokumente neu laden
      await loadDocuments();

    } catch (error) {
      setMessage(`❌ Fehler beim Löschen: ${error.message}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Filter-Funktion
  const filteredDocuments = selectedDocType === 'all'
    ? documents
    : documents.filter(doc => doc.type === selectedDocType);

  // Icon für Dokumenttyp
  const getDocTypeIcon = (type) => {
    const docType = documentTypes.find(dt => dt.id === type);
    return docType?.icon || <FileText size={18} />;
  };

  return (
    <div className="berichte-dokumente">
      <div className="page-header">
        <h1>📄 Berichte & Dokumente</h1>
        <p>PDF-Berichte erstellen, verwalten und herunterladen</p>
      </div>

      {message && (
        <div className={`message ${message.includes('✅') ? 'success' : message.includes('❌') ? 'error' : 'info'}`}>
          {message}
        </div>
      )}

      {/* Schnellaktionen */}
      <div className="quick-create-section">
        <h2>⚡ Neues Dokument erstellen</h2>
        <div className="quick-create-grid">
          {documentTypes.filter(dt => dt.id !== 'all').map(docType => (
            <div
              key={docType.id}
              className={`quick-create-card ${docType.featured ? 'featured' : ''}`}
              onClick={() => handleCreateDocument(docType.label)}
              style={{ borderLeftColor: docType.color }}
            >
              <div className="quick-create-icon" style={{ color: docType.color }}>
                {docType.icon}
              </div>
              <div className="quick-create-content">
                <h3>{docType.label}</h3>
                <button className="btn-create">
                  <Plus size={16} />
                  Erstellen
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dokumenten-Filter */}
      <div className="document-filter">
        <h2>📚 Gespeicherte Dokumente</h2>
        <div className="filter-buttons">
          {documentTypes.map(type => (
            <button
              key={type.id}
              className={`filter-btn ${selectedDocType === type.id ? 'active' : ''}`}
              onClick={() => setSelectedDocType(type.id)}
            >
              {type.icon}
              <span>{type.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Dokumenten-Liste */}
      <div className="documents-list">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Laden...</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="empty-state">
            <FileText size={64} />
            <h3>Keine Dokumente vorhanden</h3>
            <p>Erstellen Sie Ihr erstes Dokument mit den Schnellaktionen oben.</p>
          </div>
        ) : (
          <div className="documents-grid">
            {filteredDocuments.map(doc => (
              <div key={doc.id} className="document-card">
                <div className="document-header">
                  <div className="document-icon">
                    {getDocTypeIcon(doc.type)}
                  </div>
                  <div className="document-info">
                    <h3>{doc.name}</h3>
                    <div className="document-meta">
                      <span><Calendar size={14} /> {doc.created}</span>
                      <span>• {doc.size}</span>
                      <span>• {doc.format}</span>
                    </div>
                  </div>
                </div>
                <div className="document-actions">
                  <button
                    className="btn-action btn-download"
                    onClick={() => handleDownload(doc)}
                    title="Herunterladen"
                  >
                    <Download size={18} />
                  </button>
                  <button
                    className="btn-action btn-edit"
                    onClick={() => setMessage(`✏️ Bearbeiten von "${doc.name}" wird vorbereitet...`)}
                    title="Bearbeiten"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    className="btn-action btn-delete"
                    onClick={() => handleDelete(doc.id)}
                    title="Löschen"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal für Dokumenten-Erstellung (Platzhalter) */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>📄 Dokument erstellen</h2>
            <p>Diese Funktion wird in Kürze verfügbar sein.</p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BerichteDokumente;
