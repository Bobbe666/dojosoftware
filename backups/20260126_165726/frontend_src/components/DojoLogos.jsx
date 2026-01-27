import React, { useState, useEffect } from 'react';
import { Upload, Trash2, AlertCircle, CheckCircle, Image as ImageIcon } from 'lucide-react';
import axios from 'axios';
import '../styles/DojoLogos.css';

const DojoLogos = ({ dojoId }) => {
  const [logos, setLogos] = useState({});
  const [loading, setLoading] = useState(false);
  const [uploadingType, setUploadingType] = useState(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const logoTypes = [
    { key: 'haupt', label: 'Haupt-Logo', description: 'Primäres Dojo-Logo' },
    { key: 'alternativ', label: 'Alternatives Logo', description: 'Alternative Version' },
    { key: 'partner1', label: 'Partner-Logo 1', description: 'Erster Partner' },
    { key: 'partner2', label: 'Partner-Logo 2', description: 'Zweiter Partner' },
    { key: 'social', label: 'Social Media Logo', description: 'Für Social Media' }
  ];

  useEffect(() => {
    if (dojoId && dojoId !== 'new') {
      loadLogos();
    }
  }, [dojoId]);

  const loadLogos = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/dojos/${dojoId}/logos`);

      // Convert array to object keyed by logo_type
      const logosObj = {};
      response.data.forEach(logo => {
        logosObj[logo.logo_type] = logo;
      });

      setLogos(logosObj);
    } catch (error) {
      console.error('Fehler beim Laden der Logos:', error);
      showMessage('error', 'Fehler beim Laden der Logos');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (logoType, file) => {
    // Validation
    if (!file) return;

    // Check file size (2 MB)
    if (file.size > 2 * 1024 * 1024) {
      showMessage('error', 'Datei zu groß. Maximum: 2 MB');
      return;
    }

    // Check file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      showMessage('error', 'Ungültiges Format. Erlaubt: PNG, JPG, SVG, WebP');
      return;
    }

    await uploadLogo(logoType, file);
  };

  const uploadLogo = async (logoType, file) => {
    try {
      setUploadingType(logoType);

      const formData = new FormData();
      formData.append('logo', file);
      // logoType jetzt in URL statt Body (wegen multer filename callback)

      const response = await axios.post(
        `/dojos/${dojoId}/logos/${logoType}`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      showMessage('success', response.data.message || 'Logo erfolgreich hochgeladen');

      // Reload logos
      await loadLogos();
    } catch (error) {
      console.error('Fehler beim Hochladen:', error);
      showMessage('error', error.response?.data?.error || 'Fehler beim Hochladen');
    } finally {
      setUploadingType(null);
    }
  };

  const handleDelete = async (logoId, logoType) => {
    if (!window.confirm('Logo wirklich löschen?')) return;

    try {
      setLoading(true);
      await axios.delete(`/dojos/${dojoId}/logos/${logoId}`);

      showMessage('success', 'Logo erfolgreich gelöscht');

      // Remove from state
      const newLogos = { ...logos };
      delete newLogos[logoType];
      setLogos(newLogos);
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      showMessage('error', 'Fehler beim Löschen des Logos');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e, logoType) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files[0];
    handleFileSelect(logoType, file);
  };

  if (dojoId === 'new') {
    return (
      <div className="logo-section-disabled">
        <AlertCircle size={48} color="#ffd700" />
        <p>Logo-Verwaltung ist nur für gespeicherte Dojos verfügbar.</p>
        <p className="hint">Bitte speichern Sie zuerst die Grunddaten.</p>
      </div>
    );
  }

  return (
    <div className="dojo-logos-container">
      {message.text && (
        <div className={`message-banner ${message.type}`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="logos-grid">
        {logoTypes.map((type) => {
          const existingLogo = logos[type.key];
          const isUploading = uploadingType === type.key;

          return (
            <div key={type.key} className="logo-upload-card">
              <div className="logo-card-header">
                <h3>{type.label}</h3>
                <span className="logo-description">{type.description}</span>
              </div>

              <div
                className={`logo-dropzone ${existingLogo ? 'has-logo' : ''} ${isUploading ? 'uploading' : ''}`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, type.key)}
              >
                {existingLogo ? (
                  <>
                    <div className="logo-preview">
                      <img
                        src={existingLogo.url}
                        alt={type.label}
                        className="logo-image"
                      />
                    </div>
                    <div className="logo-info">
                      <p className="logo-filename">{existingLogo.file_name}</p>
                      <p className="logo-size">{(existingLogo.file_size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      className="btn-delete-logo"
                      onClick={() => handleDelete(existingLogo.logo_id, type.key)}
                      disabled={loading}
                    >
                      <Trash2 size={18} />
                      Löschen
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      type="file"
                      id={`file-${type.key}`}
                      accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                      onChange={(e) => handleFileSelect(type.key, e.target.files[0])}
                      className="file-input"
                      disabled={isUploading}
                    />
                    <label htmlFor={`file-${type.key}`} className="upload-label">
                      {isUploading ? (
                        <>
                          <div className="spinner"></div>
                          <p>Wird hochgeladen...</p>
                        </>
                      ) : (
                        <>
                          <Upload size={48} color="rgba(255, 215, 0, 0.4)" />
                          <p className="upload-title">Logo hochladen</p>
                          <p className="upload-hint">Klicken oder Drag & Drop</p>
                          <p className="upload-format">PNG, JPG, SVG, WebP • Max 2 MB</p>
                        </>
                      )}
                    </label>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="logos-info-box">
        <ImageIcon size={20} color="#ffd700" />
        <div>
          <p><strong>Unterstützte Formate:</strong> PNG, JPG, SVG, WebP</p>
          <p><strong>Maximale Größe:</strong> 2 MB pro Logo</p>
          <p><strong>Verwendung:</strong> Logos werden automatisch im System verfügbar gemacht</p>
        </div>
      </div>
    </div>
  );
};

export default DojoLogos;
