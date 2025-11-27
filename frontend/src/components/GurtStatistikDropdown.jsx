import { useState } from 'react';

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
    <div style={{
      borderRadius: '8px',
      overflow: 'hidden',
      marginBottom: '8px'
    }}>
      {/* Haupt-Gurt-Item */}
      <div
        onClick={toggleExpand}
        style={{
          padding: '12px 15px',
          background: 'rgba(255,255,255,0.05)',
          borderLeft: `4px solid ${grad.farbe_hex || '#FFD700'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          transition: 'transform 0.2s ease, background 0.2s ease',
          cursor: 'pointer'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateX(5px)';
          e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateX(0)';
          e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            {grad.graduierung}
          </span>
          <span style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.5)',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s ease'
          }}>
            ▼
          </span>
        </div>
        <span style={{
          color: '#FFD700',
          fontWeight: 'bold',
          fontSize: '16px'
        }}>
          {grad.anzahl_mitglieder || 0}{' '}
          <span style={{ fontSize: '13px', fontWeight: 'normal', color: 'rgba(255,215,0,0.7)' }}>
            Schüler
          </span>
        </span>
      </div>

      {/* Dropdown mit Mitgliedern */}
      {isExpanded && (
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          padding: '10px 15px',
          borderLeft: `4px solid ${grad.farbe_hex || '#FFD700'}`,
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}>
          {loading ? (
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: 0 }}>
              Lade Mitglieder...
            </p>
          ) : mitglieder.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: 0 }}>
              Keine Mitglieder mit diesem Gürtel
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {mitglieder.map((mitglied) => (
                <div
                  key={mitglied.mitglied_id}
                  style={{
                    padding: '8px 10px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '4px',
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.9)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <span>
                    {mitglied.nachname}, {mitglied.vorname}
                  </span>
                  {mitglied.geburtsdatum && (
                    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
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
