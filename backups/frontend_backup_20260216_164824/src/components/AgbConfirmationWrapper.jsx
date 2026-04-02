import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import FirstLoginConfirmation from './FirstLoginConfirmation';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';

/**
 * AgbConfirmationWrapper
 * Prueft ob der eingeloggte User die aktuellen AGB/DSGVO-Versionen akzeptiert hat.
 * Zeigt das FirstLoginConfirmation Modal wenn:
 * - Erstmaliger Login nach Import (import_bestaetigt = false)
 * - Neue AGB/DSGVO-Version verfuegbar (Versionen stimmen nicht ueberein)
 */
const AgbConfirmationWrapper = ({ children }) => {
  const { user, token } = useAuth();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [checkComplete, setCheckComplete] = useState(false);

  const checkAgbVersions = useCallback(async () => {
    if (!user || !token || !user.mitglied_id) {
      setCheckComplete(true);
      return;
    }

    // Nur fuer Mitglieder pruefen, nicht fuer Admins
    if (user.role === 'admin') {
      setCheckComplete(true);
      return;
    }

    try {
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/agb/check-versions/${user.mitglied_id}`
      );

      if (response.ok) {
        const data = await response.json();

        // Modal anzeigen wenn:
        // - Erstmalige Bestaetigung nach Import noetig
        // - Oder neue Version eines der 4 Dokumente verfuegbar
        if (data.needsConfirmation || data.needsAgbUpdate || data.needsDsgvoUpdate ||
            data.needsDojoRegelnUpdate || data.needsHausordnungUpdate) {
          console.log('Dokument-Bestaetigung erforderlich:', data);
          setShowConfirmation(true);
        }
      }
    } catch (error) {
      console.error('Fehler beim Pruefen der AGB-Versionen:', error);
      // Bei Fehler trotzdem weitermachen
    }

    setCheckComplete(true);
  }, [user, token]);

  useEffect(() => {
    checkAgbVersions();
  }, [checkAgbVersions]);

  const handleConfirmed = () => {
    setShowConfirmation(false);
  };

  const handleClose = () => {
    // Nicht schliessen ohne Bestaetigung - Modal bleibt offen
    // User muss bestaetigen um fortzufahren
  };

  // Zeige nichts bis Check abgeschlossen
  if (!checkComplete) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div className="loading-spinner-large"></div>
        <div>Pruefe Zugangsberechtigung...</div>
      </div>
    );
  }

  return (
    <>
      {children}
      {showConfirmation && user && (
        <FirstLoginConfirmation
          isOpen={showConfirmation}
          onClose={handleClose}
          user={user}
          onConfirmed={handleConfirmed}
        />
      )}
    </>
  );
};

export default AgbConfirmationWrapper;
