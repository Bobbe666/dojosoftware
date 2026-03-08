import React, { useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import '../../styles/MitgliedKarte.css';

const MitgliedKarte = ({
  mitglied,
  anwesenheitEintrag = { status: '', bemerkung: '', gespeichert: false },
  isFromSearch = false,
  onClick
}) => {
  const navigate = useNavigate();
  const id = mitglied.mitglied_id || mitglied.id;
  const statusKlasse = anwesenheitEintrag.status ? `status-${anwesenheitEintrag.status}` : "";
  const gespeicherteKlasse =
    anwesenheitEintrag.status === "anwesend" && anwesenheitEintrag.gespeichert
      ? "block-gespeichert"
      : "";
  const checkinStatus = mitglied.checkin_status || 'nicht_eingecheckt';
  const checkinKlasse = `checkin-${checkinStatus}`;
  const searchHighlight = isFromSearch ? 'search-result' : '';

  const [contextMenu, setContextMenu] = useState(null); // { x, y }

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const closeMenu = useCallback(() => setContextMenu(null), []);

  const handleOpenMitglied = useCallback((e) => {
    e.stopPropagation();
    setContextMenu(null);
    navigate(`/dashboard/mitglieder/${id}`);
  }, [navigate, id]);

  return (
    <>
      <div
        className={`mitglied-block ${statusKlasse} ${gespeicherteKlasse} ${checkinKlasse} ${searchHighlight}`}
        onClick={() => onClick(id, mitglied)}
        onContextMenu={handleContextMenu}
        style={isFromSearch ? { borderColor: '#1976d2', backgroundColor: '#e3f2fd' } : undefined}
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
              {isFromSearch && (
                <span className="mk-search-badge">
                  🔍 Suchergebnis
                </span>
              )}
            </strong>
            <div className="mitglied-details-inline">
              {mitglied.gurtfarbe && <span className="gurtfarbe">{mitglied.gurtfarbe}</span>}
              {checkinStatus === 'eingecheckt' && anwesenheitEintrag.status !== "entfernt" && (
                <span className="checkin-badge">📱 Eingecheckt</span>
              )}
            </div>
            {anwesenheitEintrag.status === "entfernt" && (
              <div className="entfernt-hinweis">❌ aus der Stunde entfernt</div>
            )}
          </div>
        </div>
      </div>

      {/* Context-Menü via Portal direkt in document.body */}
      {contextMenu && ReactDOM.createPortal(
        <>
          {/* Transparenter Backdrop – schließt Menü bei Klick außerhalb */}
          <div
            className="mk-backdrop"
            onClick={closeMenu}
            onContextMenu={(e) => { e.preventDefault(); closeMenu(); }}
          />
          {/* Kontext-Menü */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="mk-context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <div className="mk-context-header">
              {mitglied.vorname} {mitglied.nachname}
            </div>
            <button
              onClick={handleOpenMitglied}
              className="mk-context-btn"
            >
              <span>👤</span>
              <span>Mitglied öffnen</span>
            </button>
          </div>
        </>,
        document.body
      )}
    </>
  );
};

export default MitgliedKarte;
