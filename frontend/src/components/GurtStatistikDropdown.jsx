import { useState } from 'react';
import '../styles/GurtStatistikDropdown.css';

/**
 * Komponente für ein einzelnes Gurt-Statistik-Item mit Dropdown
 * Zeigt die Anzahl der Mitglieder an und erlaubt das Aufklappen, um die Mitglieder-Liste zu sehen
 */
const GurtStatistikItem = ({ grad, stilId, API_BASE }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mitglieder, setMitglieder] = useState([]);
  const [loading, setLoading] = useState(false);

  const toggleExpand = async () => {
    if (!isExpanded && mitglieder.length === 0) {
      // Mitglieder laden
      setLoading(true);
      try {
        const response = await fetch(
          `${API_BASE}/stile/${stilId}/graduierungen/${grad.graduierung_id}/mitglieder`
        );
        if (response.ok) {
          const data = await response.json();
          setMitglieder(data.mitglieder || []);
        }
      } catch (err) {
        console.error('Fehler beim Laden der Mitglieder:', err);
      } finally {
        setLoading(false);
      }
    }
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="gurt-item" style={{ '--gurt-color': grad.farbe_hex || '#FFD700' }}>
      {/* Haupt-Gurt-Item */}
      <div
        onClick={toggleExpand}
        className="gurt-item__header"
      >
        <div className="gurt-item__header-left">
          <span className="gurt-item__name">
            {grad.graduierung}
          </span>
          <span className={`gurt-item__chevron${isExpanded ? ' gurt-item__chevron--expanded' : ''}`}>
            ▼
          </span>
        </div>
        <span className="gurt-item__count">
          {grad.anzahl_mitglieder || 0}{' '}
          <span className="gurt-item__count-label">
            Schüler
          </span>
        </span>
      </div>

      {/* Dropdown mit Mitgliedern */}
      {isExpanded && (
        <div
          className="gurt-item__dropdown"
        >
          {loading ? (
            <p className="gurt-item__message">
              Lade Mitglieder...
            </p>
          ) : mitglieder.length === 0 ? (
            <p className="gurt-item__message">
              Keine Mitglieder mit diesem Gürtel
            </p>
          ) : (
            <div className="gurt-item__member-list">
              {mitglieder.map((mitglied) => (
                <div
                  key={mitglied.mitglied_id}
                  className="gurt-item__member-row"
                >
                  <span>
                    {mitglied.nachname}, {mitglied.vorname}
                  </span>
                  {mitglied.geburtsdatum && (
                    <span className="gurt-item__member-age">
                      {new Date().getFullYear() - new Date(mitglied.geburtsdatum).getFullYear()} Jahre
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GurtStatistikItem;
