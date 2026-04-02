import React from 'react';

/**
 * AnwesenheitPopup - Modal für Mitglied-Aktionen in der Anwesenheitsverwaltung
 *
 * Props:
 * - member: Das ausgewählte Mitglied-Objekt
 * - anwesenheitEintrag: Der aktuelle Anwesenheits-Eintrag { status, bemerkung }
 * - onClose: Callback zum Schließen des Popups
 * - onAction: Callback für Aktionen (status: 'entfernt' | 'verspätet' | 'abgebrochen')
 * - onBemerkungChange: Callback für Bemerkungsänderung
 */
const AnwesenheitPopup = ({
  member,
  anwesenheitEintrag = { status: '', bemerkung: '' },
  onClose,
  onAction,
  onBemerkungChange
}) => {
  if (!member) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="anwesenheit-popup-overlay" onClick={handleOverlayClick}>
      <div className="anwesenheit-popup" onClick={(e) => e.stopPropagation()}>
        {/* Header mit Profilbild und Name */}
        <div className="popup-header">
          <img
            src={member.profilbild || "/default-user.png"}
            alt="Profil"
            className="popup-profilbild"
          />
          <div className="popup-name">
            <strong>{member.vorname} {member.nachname}</strong>
            {member.gurtfarbe && (
              <span className="popup-gurt">{member.gurtfarbe}</span>
            )}
          </div>
          <button className="popup-close" onClick={onClose}>✕</button>
        </div>

        {/* Status-Anzeige */}
        <div className="popup-status">
          {anwesenheitEintrag.status === 'anwesend' && '✅ Aktuell als anwesend markiert'}
          {anwesenheitEintrag.status === 'verspätet' && '🕐 Als verspätet markiert'}
          {anwesenheitEintrag.status === 'abgebrochen' && '🚪 Hat abgebrochen'}
          {anwesenheitEintrag.status === 'entfernt' && '❌ Aus Stunde entfernt'}
          {!anwesenheitEintrag.status && '⏳ Noch nicht anwesend'}
        </div>

        {/* Aktions-Buttons */}
        <div className="popup-actions">
          <button
            className="popup-btn popup-btn-red"
            onClick={() => onAction('entfernt')}
          >
            ❌ Aus Stunde entfernen
          </button>
          <button
            className="popup-btn popup-btn-yellow"
            onClick={() => onAction('verspätet')}
          >
            🕐 Verspätet
          </button>
          <button
            className="popup-btn popup-btn-orange"
            onClick={() => onAction('abgebrochen')}
          >
            🚪 Abgebrochen
          </button>
        </div>

        {/* Bemerkungsfeld */}
        <div className="popup-bemerkung">
          <input
            type="text"
            placeholder="Bemerkung hinzufügen..."
            value={anwesenheitEintrag.bemerkung ?? ""}
            onChange={(e) => onBemerkungChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};

export default AnwesenheitPopup;
