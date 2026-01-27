import React from 'react';

/**
 * MitgliedKarte - Einzelne Mitgliedskarte in der Anwesenheitsliste
 *
 * Props:
 * - mitglied: Das Mitglied-Objekt
 * - anwesenheitEintrag: Der Anwesenheits-Eintrag { status, bemerkung, gespeichert, checkin_status }
 * - isFromSearch: Ob das Mitglied aus der Suche stammt
 * - onClick: Callback beim Klick auf die Karte
 */
const MitgliedKarte = ({
  mitglied,
  anwesenheitEintrag = { status: '', bemerkung: '', gespeichert: false },
  isFromSearch = false,
  onClick
}) => {
  const id = mitglied.mitglied_id || mitglied.id;
  const statusKlasse = anwesenheitEintrag.status ? `status-${anwesenheitEintrag.status}` : "";
  const gespeicherteKlasse =
    anwesenheitEintrag.status === "anwesend" && anwesenheitEintrag.gespeichert
      ? "block-gespeichert"
      : "";

  // Check-in Status
  const checkinStatus = mitglied.checkin_status || 'nicht_eingecheckt';
  const checkinKlasse = `checkin-${checkinStatus}`;

  // Such-Hervorhebung
  const searchHighlight = isFromSearch ? 'search-result' : '';

  return (
    <div
      key={id}
      className={`mitglied-block ${statusKlasse} ${gespeicherteKlasse} ${checkinKlasse} ${searchHighlight}`}
      onClick={() => onClick(id, mitglied)}
      style={{
        ...(isFromSearch && {
          borderColor: '#1976d2',
          backgroundColor: '#e3f2fd'
        })
      }}
    >
      <div className="mitglied-header">
        <img
          src={mitglied.profilbild || "/default-user.png"}
          alt="Profil"
          className="mitglied-profilbild"
        />
        <div className="mitglied-info">
          <strong>
            {mitglied.vorname} {mitglied.nachname}
            {/* Suchindikator */}
            {isFromSearch && (
              <span
                style={{
                  color: '#1976d2',
                  fontSize: '12px',
                  marginLeft: '8px',
                  background: '#bbdefb',
                  padding: '2px 6px',
                  borderRadius: '10px'
                }}
              >
                🔍 Suchergebnis
              </span>
            )}
          </strong>
          <div className="mitglied-details-inline">
            {mitglied.gurtfarbe && (
              <span className="gurtfarbe">{mitglied.gurtfarbe}</span>
            )}
            {checkinStatus === 'eingecheckt' && anwesenheitEintrag.status !== "entfernt" && (
              <span className="checkin-badge">
                📱 Eingecheckt
              </span>
            )}
          </div>
          {anwesenheitEintrag.status === "entfernt" && (
            <div className="entfernt-hinweis">
              ❌ aus der Stunde entfernt
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MitgliedKarte;
