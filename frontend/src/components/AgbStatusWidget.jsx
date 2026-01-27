import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, FileText, Shield, Users, ChevronDown, ChevronUp, Scroll, Home } from 'lucide-react';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import { useDojoContext } from '../context/DojoContext';

/**
 * AgbStatusWidget
 * Zeigt im Admin-Dashboard an, welche Mitglieder die aktuellen
 * AGB/DSGVO-Versionen noch nicht akzeptiert haben.
 */
const AgbStatusWidget = () => {
  const { selectedDojo } = useDojoContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadAgbStatus();
  }, [selectedDojo]);

  const loadAgbStatus = async () => {
    // Dojo-ID aus Context oder localStorage
    const dojoId = selectedDojo?.id || localStorage.getItem('activeDojoId');

    // Kein Dojo ausgewählt = Widget nicht laden
    if (!dojoId || dojoId === 'null' || dojoId === 'undefined') {
      setData({ count: 0, members: [], noDojoSelected: true });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/agb/${dojoId}/members-need-acceptance`
      );

      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        setError('Konnte AGB-Status nicht laden');
      }
    } catch (err) {
      console.error('Fehler beim Laden des AGB-Status:', err);
      setError('Verbindungsfehler');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={widgetStyle}>
        <div style={headerStyle}>
          <FileText size={20} />
          <span>AGB/DSGVO Status</span>
        </div>
        <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
          Lade...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={widgetStyle}>
        <div style={headerStyle}>
          <FileText size={20} />
          <span>AGB/DSGVO Status</span>
        </div>
        <div style={{ padding: '1rem', color: '#FCA5A5' }}>
          {error}
        </div>
      </div>
    );
  }

  const count = data?.count || 0;
  const members = data?.members || [];
  const allGood = count === 0 && !data?.noDojoSelected;

  // Wenn kein Dojo ausgewählt, Widget nicht anzeigen
  if (data?.noDojoSelected) {
    return null;
  }

  return (
    <div style={widgetStyle}>
      <div style={headerStyle}>
        {allGood ? (
          <CheckCircle size={20} style={{ color: '#86EFAC' }} />
        ) : (
          <AlertTriangle size={20} style={{ color: '#FBBF24' }} />
        )}
        <span>AGB/DSGVO Status</span>
        {count > 0 && (
          <span style={badgeStyle}>{count}</span>
        )}
      </div>

      <div style={contentStyle}>
        {allGood ? (
          <div style={{ color: '#86EFAC', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={16} />
            Alle Mitglieder haben die aktuellen Versionen akzeptiert
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '0.75rem', color: 'rgba(255,255,255,0.9)' }}>
              <strong>{count} Mitglied{count !== 1 ? 'er' : ''}</strong> {count !== 1 ? 'haben' : 'hat'} noch nicht die aktuelle Version akzeptiert:
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <div style={statBoxStyle}>
                <FileText size={14} style={{ color: '#FFD700' }} />
                <span>{members.filter(m => m.agb_akzeptanz_fehlt).length} AGB</span>
              </div>
              <div style={statBoxStyle}>
                <Shield size={14} style={{ color: '#60A5FA' }} />
                <span>{members.filter(m => m.dsgvo_akzeptanz_fehlt).length} DSGVO</span>
              </div>
              <div style={statBoxStyle}>
                <Scroll size={14} style={{ color: '#34D399' }} />
                <span>{members.filter(m => m.dojo_regeln_akzeptanz_fehlt).length} Regeln</span>
              </div>
              <div style={statBoxStyle}>
                <Home size={14} style={{ color: '#F472B6' }} />
                <span>{members.filter(m => m.hausordnung_akzeptanz_fehlt).length} Hausordnung</span>
              </div>
            </div>

            {/* Expandierbarer Bereich mit Mitgliederliste */}
            <button
              onClick={() => setExpanded(!expanded)}
              style={expandButtonStyle}
            >
              <Users size={14} />
              {expanded ? 'Liste ausblenden' : 'Mitglieder anzeigen'}
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {expanded && (
              <div style={memberListStyle}>
                {members.slice(0, 10).map((member) => (
                  <div key={member.mitglied_id} style={memberRowStyle}>
                    <a
                      href={`/dashboard/mitglieder/${member.mitglied_id}`}
                      style={{ color: '#FFD700', textDecoration: 'none' }}
                    >
                      {member.vorname} {member.nachname}
                    </a>
                    <div style={{ display: 'flex', gap: '0.25rem', fontSize: '0.7rem', flexWrap: 'wrap' }}>
                      {member.agb_akzeptanz_fehlt === 1 && (
                        <span style={{ color: '#FBBF24', padding: '0 0.25rem', background: 'rgba(251,191,36,0.1)', borderRadius: '3px' }}>AGB</span>
                      )}
                      {member.dsgvo_akzeptanz_fehlt === 1 && (
                        <span style={{ color: '#60A5FA', padding: '0 0.25rem', background: 'rgba(96,165,250,0.1)', borderRadius: '3px' }}>DSGVO</span>
                      )}
                      {member.dojo_regeln_akzeptanz_fehlt === 1 && (
                        <span style={{ color: '#34D399', padding: '0 0.25rem', background: 'rgba(52,211,153,0.1)', borderRadius: '3px' }}>Regeln</span>
                      )}
                      {member.hausordnung_akzeptanz_fehlt === 1 && (
                        <span style={{ color: '#F472B6', padding: '0 0.25rem', background: 'rgba(244,114,182,0.1)', borderRadius: '3px' }}>Haus</span>
                      )}
                    </div>
                  </div>
                ))}
                {members.length > 10 && (
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.5rem' }}>
                    ...und {members.length - 10} weitere
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Styles
const widgetStyle = {
  background: 'rgba(255, 255, 255, 0.05)',
  borderRadius: '12px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  overflow: 'hidden',
  marginTop: '1rem'
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1rem',
  background: 'rgba(255, 255, 255, 0.05)',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  fontWeight: '600',
  fontSize: '0.9rem'
};

const badgeStyle = {
  marginLeft: 'auto',
  background: '#FBBF24',
  color: '#000',
  padding: '0.15rem 0.5rem',
  borderRadius: '9999px',
  fontSize: '0.75rem',
  fontWeight: '700'
};

const contentStyle = {
  padding: '1rem'
};

const statBoxStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.5rem 0.75rem',
  background: 'rgba(255, 255, 255, 0.05)',
  borderRadius: '6px',
  fontSize: '0.85rem'
};

const expandButtonStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.5rem 0.75rem',
  background: 'transparent',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: '6px',
  color: 'rgba(255, 255, 255, 0.8)',
  cursor: 'pointer',
  fontSize: '0.85rem',
  width: '100%',
  justifyContent: 'center'
};

const memberListStyle = {
  marginTop: '0.75rem',
  maxHeight: '200px',
  overflowY: 'auto',
  padding: '0.5rem',
  background: 'rgba(0, 0, 0, 0.2)',
  borderRadius: '6px'
};

const memberRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.5rem',
  borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
};

export default AgbStatusWidget;
