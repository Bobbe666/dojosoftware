/**
 * AnhangBibliothek.jsx
 * =====================
 * Phase 5: Anhang-Bibliothek
 * Wiederkehrende Dateien (PDFs, Bilder) hochladen und verwalten.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';
import { Upload, Trash2, Download, FileText, Image, File, AlertCircle, RefreshCw } from 'lucide-react';
import '../styles/AnhangBibliothek.css';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getFileIcon(mimeType) {
  if (!mimeType) return <File size={18} />;
  if (mimeType.includes('pdf')) return <FileText size={18} className="ab-icon-pdf" />;
  if (mimeType.includes('image')) return <Image size={18} className="ab-icon-img" />;
  return <File size={18} className="ab-icon-file" />;
}

export default function AnhangBibliothek() {
  const { activeDojo } = useDojoContext();
  const withDojo = (url) => activeDojo?.id ? `${url}${url.includes('?') ? '&' : '?'}dojo_id=${activeDojo.id}` : url;

  const [anhaenge, setAnhaenge] = useState([]);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFortschritt, setUploadFortschritt] = useState(0);
  const fileInputRef = useRef(null);

  const ladeAnhaenge = useCallback(async () => {
    setLaedt(true);
    setFehler('');
    try {
      const res = await axios.get(withDojo('/dokument-anhaenge'));
      setAnhaenge(res.data.anhaenge || []);
    } catch {
      setFehler('Fehler beim Laden der Anhang-Bibliothek');
    } finally {
      setLaedt(false);
    }
  }, [activeDojo]);

  useEffect(() => { ladeAnhaenge(); }, [ladeAnhaenge]);

  async function handleUpload(files) {
    if (!files?.length) return;
    setUploading(true);
    setFehler('');
    setUploadFortschritt(0);

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append('datei', file);
        formData.append('name', file.name.replace(/\.[^.]+$/, '')); // Name ohne Extension

        const res = await axios.post(withDojo('/dokument-anhaenge'), formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            setUploadFortschritt(Math.round((e.loaded * 100) / e.total));
          },
        });

        if (res.data.anhang) {
          setAnhaenge(prev => [res.data.anhang, ...prev]);
        }
      } catch (err) {
        setFehler(`Fehler beim Upload von "${file.name}": ${err.response?.data?.error || err.message}`);
      }
    }

    setUploading(false);
    setUploadFortschritt(0);
  }

  async function handleLoeschen(anhang) {
    if (!window.confirm(`"${anhang.name}" wirklich löschen?`)) return;
    try {
      await axios.delete(withDojo(`/dokument-anhaenge/${anhang.id}`));
      setAnhaenge(prev => prev.filter(a => a.id !== anhang.id));
    } catch {
      setFehler('Fehler beim Löschen');
    }
  }

  async function handleDownload(anhang) {
    try {
      const res = await axios.get(withDojo(`/dokument-anhaenge/${anhang.id}/download`), { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = anhang.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setFehler('Download fehlgeschlagen');
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleUpload(e.dataTransfer.files);
  }

  return (
    <div className="ab-container">
      <div className="ab-header">
        <div>
          <h2 className="ab-title">Anhang-Bibliothek</h2>
          <p className="ab-subtitle">
            Dateien (PDFs, Bilder) hochladen und an E-Mail-Vorlagen anhängen.
          </p>
        </div>
        <button onClick={() => fileInputRef.current?.click()} className="ab-btn-upload">
          <Upload size={14} /> Dateien hochladen
        </button>
      </div>

      {fehler && (
        <div className="ab-error">
          <AlertCircle size={15} /> {fehler}
          <button onClick={() => setFehler('')} className="ab-error-close">×</button>
        </div>
      )}

      {/* Dropzone */}
      <div
        className={`ab-dropzone ${dragging ? 'ab-dropzone--drag' : ''} ${uploading ? 'ab-dropzone--uploading' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        {uploading ? (
          <div className="ab-upload-progress">
            <div className="ab-upload-bar">
              <div className="ab-upload-fill" style={{ width: `${uploadFortschritt}%` }} />
            </div>
            <div className="ab-upload-text">Wird hochgeladen... {uploadFortschritt}%</div>
          </div>
        ) : (
          <>
            <Upload size={28} className="ab-dropzone-icon" />
            <div className="ab-dropzone-text">
              Dateien hier reinziehen oder klicken
            </div>
            <div className="ab-dropzone-hint">
              PDF, Bilder, Word, Excel · max. 10 MB
            </div>
          </>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.gif,.docx,.xlsx"
        style={{ display: 'none' }}
        onChange={e => handleUpload(e.target.files)}
      />

      {/* Datei-Liste */}
      {laedt ? (
        <div className="ab-loading">Anhänge werden geladen...</div>
      ) : anhaenge.length === 0 ? (
        <div className="ab-empty">
          <File size={36} className="ab-empty-icon" />
          <p>Noch keine Dateien in der Bibliothek.</p>
        </div>
      ) : (
        <div className="ab-list">
          <div className="ab-list-header">
            <span>{anhaenge.length} {anhaenge.length === 1 ? 'Datei' : 'Dateien'}</span>
            <button onClick={ladeAnhaenge} className="ab-refresh-btn" title="Aktualisieren">
              <RefreshCw size={13} />
            </button>
          </div>
          <div className="ab-file-list">
            {anhaenge.map(anhang => (
              <div key={anhang.id} className="ab-file-row">
                <div className="ab-file-icon">
                  {getFileIcon(anhang.mime_type)}
                </div>
                <div className="ab-file-info">
                  <div className="ab-file-name">{anhang.name}</div>
                  <div className="ab-file-meta">
                    <span>{formatBytes(anhang.dateigroesse || anhang.dateigrösse)}</span>
                    <span className="ab-meta-sep">·</span>
                    <span>{new Date(anhang.erstellt_am).toLocaleDateString('de-DE')}</span>
                  </div>
                </div>
                <div className="ab-file-actions">
                  <button onClick={() => handleDownload(anhang)} className="ab-btn-action ab-btn-dl" title="Download">
                    <Download size={13} />
                  </button>
                  <button onClick={() => handleLoeschen(anhang)} className="ab-btn-action ab-btn-del" title="Löschen">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
