/**
 * MitgliedsAusweis.jsx
 * Digitaler Mitgliedsausweis mit QR-Code
 * Kann als Modal oder eingebettet verwendet werden
 */
import React, { useRef } from 'react';
import { X, Download, Printer } from 'lucide-react';
import '../styles/MitgliedsAusweis.css';

const MitgliedsAusweis = ({ mitglied, dojo, onClose, isModal = true }) => {
  const ausweisRef = useRef(null);

  if (!mitglied) return null;

  // QR-Code Daten: Mitgliedsnummer + Dojo-ID für Verifizierung
  const qrData = `DOJO-MEMBER:${mitglied.mitglied_id}:${dojo?.id || 0}:${mitglied.mitgliedsnummer || mitglied.mitglied_id}`;
  const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(qrData)}&size=150&dark=1a1a2e&light=ffffff`;

  // Formatierung
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  // Gültigkeitsstatus
  const getValidityStatus = () => {
    // Mitglied ist aktiv wenn status = 'aktiv' oder Vertrag aktiv
    const isActive = mitglied.status === 'aktiv' || mitglied.vertrag_status === 'aktiv';
    return isActive;
  };

  // Drucken
  const handlePrint = () => {
    window.print();
  };

  const content = (
    <div className="mitglieds-ausweis-container" ref={ausweisRef}>
      <div className="mitglieds-ausweis">
        {/* Header */}
        <div className="ausweis-header">
          {dojo?.logo_url ? (
            <img src={dojo.logo_url} alt="Dojo Logo" className="dojo-logo" />
          ) : (
            <div className="dojo-logo-placeholder">🥋</div>
          )}
          <div className="ausweis-title">
            <h3>{dojo?.dojoname || 'Kampfkunstschule'}</h3>
            <p>Mitgliedsausweis</p>
          </div>
        </div>

        {/* Foto */}
        <div className="ausweis-foto">
          {mitglied.foto_url ? (
            <img src={mitglied.foto_url} alt="Mitgliedsfoto" />
          ) : (
            <span className="foto-placeholder">👤</span>
          )}
        </div>

        {/* Name */}
        <div className="ausweis-name">
          {mitglied.vorname} {mitglied.nachname}
        </div>

        {/* Graduierung */}
        {mitglied.graduierung && (
          <div className="ausweis-graduierung">
            {mitglied.graduierung}
          </div>
        )}

        {/* Details Grid */}
        <div className="ausweis-details">
          <div className="ausweis-detail">
            <label>Mitgliedsnr.</label>
            <span>{mitglied.mitgliedsnummer || `M-${mitglied.mitglied_id}`}</span>
          </div>
          <div className="ausweis-detail">
            <label>Mitglied seit</label>
            <span>{formatDate(mitglied.eintrittsdatum || mitglied.created_at)}</span>
          </div>
          <div className="ausweis-detail">
            <label>Geburtsdatum</label>
            <span>{formatDate(mitglied.geburtsdatum)}</span>
          </div>
          <div className="ausweis-detail">
            <label>Stil</label>
            <span>{mitglied.stil || mitglied.kampfkunst || '-'}</span>
          </div>
        </div>

        {/* QR Code */}
        <div className="ausweis-qr">
          <img src={qrUrl} alt="QR Code" width="150" height="150" />
        </div>

        {/* Gültigkeitsstatus */}
        <div className={`ausweis-status ${getValidityStatus() ? 'valid' : 'invalid'}`}>
          {getValidityStatus() ? (
            <>✓ Aktives Mitglied</>
          ) : (
            <>⚠ Mitgliedschaft inaktiv</>
          )}
        </div>

        {/* Dojo Kontakt */}
        <div className="ausweis-footer">
          {dojo?.telefon && <span>📞 {dojo.telefon}</span>}
          {dojo?.email && <span>✉️ {dojo.email}</span>}
        </div>
      </div>

      {/* Aktionen */}
      <div className="ausweis-actions no-print">
        <button onClick={handlePrint} className="btn-ausweis">
          <Printer size={16} />
          Drucken
        </button>
      </div>
    </div>
  );

  if (!isModal) {
    return content;
  }

  return (
    <div className="ausweis-modal-overlay" onClick={onClose}>
      <div className="ausweis-modal" onClick={e => e.stopPropagation()}>
        <button className="ausweis-close" onClick={onClose}>
          <X size={24} />
        </button>
        {content}
      </div>
    </div>
  );
};

export default MitgliedsAusweis;
