import React, { useState, useEffect } from 'react';
import { X, UserPlus, Calendar, Mail, Phone, MapPin, CreditCard, Heart, Shield, AlertTriangle, CheckCircle, XCircle, User, FileText, PauseCircle } from 'lucide-react';
import '../styles/AdminRegistrationPopup.css';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';

const CHECK = ({ ok, warn }) => {
  if (warn) return <span className="erstcheck-icon warn"><AlertTriangle size={14} /></span>;
  return ok
    ? <span className="erstcheck-icon ok"><CheckCircle size={14} /></span>
    : <span className="erstcheck-icon missing"><XCircle size={14} /></span>;
};

const Row = ({ label, value, ok, warn }) => (
  <div className="erstcheck-row">
    <span className="erstcheck-label">{label}</span>
    <span className="erstcheck-value">{value || <em>—</em>}</span>
    <CHECK ok={ok !== undefined ? ok : !!value} warn={warn} />
  </div>
);

const Section = ({ icon, title, children }) => (
  <div className="erstcheck-section">
    <div className="erstcheck-section-title">
      {icon}
      <span>{title}</span>
    </div>
    {children}
  </div>
);

const GESCHLECHT = { m: 'Männlich', w: 'Weiblich', d: 'Divers' };
const ZAHLUNGSART = { lastschrift: 'SEPA-Lastschrift', ueberweisung: 'Überweisung', bar: 'Bar' };
const ZYKLUS = { monatlich: 'Monatlich', quartalsweise: 'Quartalsweise', halbjaehrlich: 'Halbjährlich', jaehrlich: 'Jährlich' };

const calcAge = (dob) => {
  if (!dob) return null;
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const formatDate = (d) => {
  if (!d) return null;
  return new Date(d).toLocaleDateString('de-DE');
};

const AdminRegistrationPopup = () => {
  const [notifications, setNotifications] = useState([]);
  const [showPopup, setShowPopup] = useState(false);
  const [currentNotification, setCurrentNotification] = useState(null);
  const [regData, setRegData] = useState(null);
  const [loadingReg, setLoadingReg] = useState(false);
  const [ablehnenKommentar, setAblehnenKommentar] = useState('');
  const [showAblehnenForm, setShowAblehnenForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const checkForNewRegistrations = async () => {
      try {
        const response = await fetchWithAuth(`${config.apiBaseUrl}/notifications/admin/unread`);
        const data = await response.json();
        if (data.success && data.notifications) {
          const adminAlerts = data.notifications.filter(n => n.type === 'admin_alert');
          if (adminAlerts.length > 0) {
            setNotifications(adminAlerts);
            setCurrentNotification(adminAlerts[0]);
            setShowPopup(true);
          }
        }
      } catch (error) {
        console.error('Fehler beim Abrufen der Benachrichtigungen:', error);
      }
    };

    checkForNewRegistrations();
    const interval = setInterval(checkForNewRegistrations, 10000);
    return () => clearInterval(interval);
  }, []);

  // Lade vollständige Registrierungsdaten wenn Popup sich öffnet
  useEffect(() => {
    setAblehnenKommentar('');
    setShowAblehnenForm(false);
    if (!currentNotification) return;

    let meta = null;
    try { meta = currentNotification.metadata ? JSON.parse(currentNotification.metadata) : null; } catch {}

    // Ruhepause-Anträge brauchen keine extra Daten
    if (meta?.type === 'ruhepause_antrag') return;

    let email = meta?.email || null;

    // Fallback: Email aus HTML-Nachricht parsen
    if (!email && currentNotification.message) {
      const match = currentNotification.message.match(/<strong>Email:<\/strong>\s*([^\s<]+)/);
      if (match) email = match[1];
    }

    if (!email) return;

    setLoadingReg(true);
    fetchWithAuth(`${config.apiBaseUrl}/notifications/admin/registration-check/${encodeURIComponent(email)}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setRegData(d);
      })
      .catch(console.error)
      .finally(() => setLoadingReg(false));
  }, [currentNotification]);

  const handleClose = async () => {
    if (currentNotification) {
      try {
        await fetchWithAuth(`${config.apiBaseUrl}/notifications/admin/${currentNotification.id}/read`, {
          method: 'PUT'
        });
        const remaining = notifications.filter(n => n.id !== currentNotification.id);
        setNotifications(remaining);
        if (remaining.length > 0) {
          setCurrentNotification(remaining[0]);
          setRegData(null);
        } else {
          setShowPopup(false);
          setCurrentNotification(null);
          setRegData(null);
        }
      } catch {
        setShowPopup(false);
      }
    }
  };

  const handleRuhepauseGenehmigen = async (antragId) => {
    setActionLoading(true);
    try {
      await fetchWithAuth(`${config.apiBaseUrl}/vertrag-anpassungen/${antragId}/genehmigen`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      await handleClose();
    } catch (e) {
      console.error('Genehmigen-Fehler:', e);
    }
    setActionLoading(false);
  };

  const handleRuhepauseAblehnen = async (antragId) => {
    setActionLoading(true);
    try {
      await fetchWithAuth(`${config.apiBaseUrl}/vertrag-anpassungen/${antragId}/ablehnen`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anmerkung_admin: ablehnenKommentar })
      });
      await handleClose();
    } catch (e) {
      console.error('Ablehnen-Fehler:', e);
    }
    setActionLoading(false);
  };

  const handleGoToMember = () => {
    if (regData?.mitglied?.mitglied_id) {
      window.location.href = `/mitglieder/${regData.mitglied.mitglied_id}`;
    }
    handleClose();
  };

  if (!showPopup || !currentNotification) return null;

  // Parse metadata für alle Notification-Typen
  let currentMeta = null;
  try { currentMeta = currentNotification.metadata ? JSON.parse(currentNotification.metadata) : null; } catch {}

  // Ruhepause-Antrag Popup
  if (currentMeta?.type === 'ruhepause_antrag') {
    const vonDE = currentMeta.gueltig_von ? new Date(currentMeta.gueltig_von).toLocaleDateString('de-DE') : '—';
    const bisDE = currentMeta.gueltig_bis ? new Date(currentMeta.gueltig_bis).toLocaleDateString('de-DE') : '—';
    const name = `${currentMeta.vorname || ''} ${currentMeta.nachname || ''}`.trim() || `Mitglied #${currentMeta.mitglied_id}`;
    return (
      <div className="admin-registration-popup-overlay">
        <div className="admin-registration-popup erstcheck-popup">
          <div className="popup-header">
            <div className="header-content">
              <PauseCircle size={26} className="header-icon" />
              <div>
                <h2>Ruhepause beantragt</h2>
                <p className="timestamp">
                  {new Date(currentNotification.created_at).toLocaleString('de-DE')}
                  {notifications.length > 1 && (
                    <span className="badge-inline">{notifications.length} ausstehend</span>
                  )}
                </p>
              </div>
            </div>
            <button className="close-btn" onClick={handleClose}>
              <X size={22} />
            </button>
          </div>
          <div className="popup-content">
            <Section icon={<User size={16} />} title="Mitglied">
              <Row label="Name" value={name} />
            </Section>
            <Section icon={<Calendar size={16} />} title="Ruhepause">
              <Row label="Von" value={vonDE} />
              <Row label="Bis" value={bisDE} />
              {currentMeta.grund && <Row label="Grund" value={currentMeta.grund} />}
            </Section>
            {showAblehnenForm ? (
              <div className="ruhepause-ablehnen-form">
                <label className="erstcheck-label">Begründung für Ablehnung</label>
                <textarea
                  className="ruhepause-kommentar"
                  value={ablehnenKommentar}
                  onChange={e => setAblehnenKommentar(e.target.value)}
                  placeholder="Kommentar (optional)..."
                  rows={3}
                />
              </div>
            ) : null}
          </div>
          <div className="popup-footer erstcheck-footer">
            {showAblehnenForm ? (
              <>
                <button className="btn-ablehnen-confirm" onClick={() => handleRuhepauseAblehnen(currentMeta.antrag_id)} disabled={actionLoading}>
                  {actionLoading ? '…' : 'Ablehnen bestätigen'}
                </button>
                <button className="btn-secondary" onClick={() => setShowAblehnenForm(false)} disabled={actionLoading}>
                  Zurück
                </button>
              </>
            ) : (
              <>
                <button className="btn-genehmigen" onClick={() => handleRuhepauseGenehmigen(currentMeta.antrag_id)} disabled={actionLoading}>
                  {actionLoading ? '…' : '✅ Genehmigen'}
                </button>
                <button className="btn-ablehnen" onClick={() => setShowAblehnenForm(true)} disabled={actionLoading}>
                  ❌ Nicht genehmigen
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  const reg = regData?.registration;
  const mitglied = regData?.mitglied;
  const age = reg ? calcAge(reg.geburtsdatum) : null;
  const isMinor = age !== null && age < 18;
  const gesundheit = reg?.gesundheitsfragen || {};
  const hasGesundheitsWarnung = gesundheit.vorerkrankungen === 'ja' ||
    gesundheit.herzprobleme === 'ja' ||
    gesundheit.rueckenprobleme === 'ja' ||
    gesundheit.gelenkprobleme === 'ja' ||
    gesundheit.medikamente === 'ja';

  return (
    <div className="admin-registration-popup-overlay">
      <div className="admin-registration-popup erstcheck-popup">
        {/* Header */}
        <div className="popup-header">
          <div className="header-content">
            <UserPlus size={26} className="header-icon" />
            <div>
              <h2>Neue Registrierung – Erstcheck</h2>
              <p className="timestamp">
                {new Date(currentNotification.created_at).toLocaleString('de-DE')}
                {notifications.length > 1 && (
                  <span className="badge-inline">{notifications.length} ausstehend</span>
                )}
              </p>
            </div>
          </div>
          <button className="close-btn" onClick={handleClose}>
            <X size={22} />
          </button>
        </div>

        {/* Content */}
        <div className="popup-content">
          {loadingReg ? (
            <div className="erstcheck-loading">Lade Mitgliedsdaten…</div>
          ) : reg ? (
            <>
              {/* Mitgliedstatus-Banner */}
              {mitglied && (
                <div className={`erstcheck-status-banner ${mitglied.status === 'aktiv' ? 'aktiv' : 'pending'}`}>
                  <CheckCircle size={16} />
                  Mitglied angelegt #{mitglied.mitgliedsnummer || mitglied.mitglied_id} — Status: {mitglied.status || 'ausstehend'}
                </div>
              )}

              {isMinor && (
                <div className="erstcheck-warning-banner">
                  <AlertTriangle size={16} />
                  Minderjährig ({age} Jahre) – Erziehungsberechtigter prüfen!
                </div>
              )}

              {hasGesundheitsWarnung && (
                <div className="erstcheck-warning-banner orange">
                  <AlertTriangle size={16} />
                  Gesundheitshinweise angegeben – bitte prüfen!
                </div>
              )}

              <Section icon={<User size={16} />} title="Persönliche Daten">
                <Row label="Name" value={`${reg.vorname || ''} ${reg.nachname || ''}`.trim()} />
                <Row label="Geburtsdatum" value={reg.geburtsdatum ? `${formatDate(reg.geburtsdatum)} (${age} Jahre)` : null} />
                <Row label="Geschlecht" value={GESCHLECHT[reg.geschlecht] || reg.geschlecht} ok={!!reg.geschlecht} />
              </Section>

              <Section icon={<Phone size={16} />} title="Kontaktdaten">
                <Row label="E-Mail" value={reg.email} />
                <Row label="Telefon" value={reg.telefon} warn={!reg.telefon} />
                <Row
                  label="Adresse"
                  value={reg.strasse ? `${reg.strasse} ${reg.hausnummer}, ${reg.plz} ${reg.ort}` : null}
                />
              </Section>

              <Section icon={<CreditCard size={16} />} title="Mitgliedschaft">
                <Row label="Tarif" value={reg.tarif_name ? `${reg.tarif_name} (${reg.price_cents ? (reg.price_cents / 100).toFixed(2) + ' €' : ''} / ${reg.duration_months} Monate)` : null} />
                <Row label="Vertragsbeginn" value={formatDate(reg.vertragsbeginn)} />
                <Row label="Zahlungsart" value={ZAHLUNGSART[reg.payment_method] || reg.payment_method} />
                <Row label="Zahlungszyklus" value={ZYKLUS[reg.billing_cycle] || reg.billing_cycle} />
              </Section>

              {reg.payment_method === 'lastschrift' && (
                <Section icon={<FileText size={16} />} title="Bankdaten (SEPA)">
                  <Row label="IBAN" value={reg.iban} />
                  <Row label="BIC" value={reg.bic} warn={!reg.bic} />
                  <Row label="Kontoinhaber" value={reg.kontoinhaber} />
                  <Row label="Bank" value={reg.bank_name} warn={!reg.bank_name} />
                </Section>
              )}

              {isMinor && (
                <Section icon={<Shield size={16} />} title="Erziehungsberechtigter">
                  <Row label="Name" value={reg.vertreter1_name} />
                  <Row label="Telefon" value={reg.vertreter1_telefon} />
                  <Row label="E-Mail" value={reg.vertreter1_email} warn={!reg.vertreter1_email} />
                </Section>
              )}

              <Section icon={<Heart size={16} />} title="Gesundheit & Notfall">
                {gesundheit.notfallkontakt_name ? (
                  <>
                    <Row label="Notfallkontakt" value={gesundheit.notfallkontakt_name} />
                    <Row label="Notfall-Tel." value={gesundheit.notfallkontakt_telefon} />
                  </>
                ) : (
                  <Row label="Notfallkontakt" value={null} />
                )}
                {gesundheit.vorerkrankungen === 'ja' && <Row label="Vorerkrankungen" value="Ja – bitte nachfragen" warn />}
                {gesundheit.herzprobleme === 'ja' && <Row label="Herzprobleme" value="Ja – bitte nachfragen" warn />}
                {gesundheit.rueckenprobleme === 'ja' && <Row label="Rückenprobleme" value="Ja – bitte nachfragen" warn />}
                {gesundheit.gelenkprobleme === 'ja' && <Row label="Gelenkprobleme" value="Ja – bitte nachfragen" warn />}
                {gesundheit.medikamente === 'ja' && <Row label="Medikamente" value="Ja – bitte nachfragen" warn />}
                {gesundheit.sonstige_einschraenkungen && (
                  <Row label="Sonstige Einschr." value={gesundheit.sonstige_einschraenkungen} warn />
                )}
              </Section>

              <Section icon={<Shield size={16} />} title="Rechtliches">
                <Row label="AGB akzeptiert" value={reg.agb_accepted ? 'Ja' : 'Nein'} ok={reg.agb_accepted} />
                <Row label="DSGVO akzeptiert" value={reg.dsgvo_accepted ? 'Ja' : 'Nein'} ok={reg.dsgvo_accepted} />
                <Row label="Widerrufsrecht" value={reg.widerrufsrecht_acknowledged ? 'Bestätigt' : 'Nein'} ok={reg.widerrufsrecht_acknowledged} />
                <Row label="Kündigungshinweis" value={reg.kuendigungshinweise_acknowledged ? 'Bestätigt' : 'Nein'} ok={reg.kuendigungshinweise_acknowledged} />
              </Section>
            </>
          ) : (
            // Fallback: Nachrichtentext ohne HTML
            <div className="erstcheck-html-fallback">
              {(currentNotification.message || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="popup-footer erstcheck-footer">
          {mitglied?.mitglied_id && (
            <button className="btn-goto-member" onClick={handleGoToMember}>
              Zum Mitglied →
            </button>
          )}
          <button className="btn-primary" onClick={handleClose}>
            OK, verstanden
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminRegistrationPopup;
