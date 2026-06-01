import React, { useState, useEffect } from 'react';
import axios from 'axios';
import openApiBlob from '../../../utils/openApiBlob';

function toInputDate(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toISOString().split('T')[0];
}

function Versandhistorie({ mitgliedId, activeDojo }) {
  const [eintraege, setEintraege] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mitgliedId) return;
    setLoading(true);
    const dojoParam = activeDojo?.id ? `?dojo_id=${activeDojo.id}` : '';
    axios.get(`/api/versandhistorie/mitglied/${mitgliedId}${dojoParam}`)
      .then(res => setEintraege(res.data.eintraege || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [mitgliedId, activeDojo]);

  const VERSANDART = { email: 'E-Mail', email_mit_pdf: 'E-Mail + PDF', pdf: 'PDF Download' };
  const fmt = ts => ts ? new Date(ts).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="field-group card">
      <h3 className="mds2-section-heading">Versandhistorie (Vorlagen)</h3>
      {loading ? (
        <div className="info-box"><p>Lade...</p></div>
      ) : eintraege.length === 0 ? (
        <div className="info-box"><p>ℹ️ Noch keine Vorlagen an dieses Mitglied gesendet.</p></div>
      ) : (
        <div className="mds-flex-col">
          {eintraege.map(e => (
            <div key={e.id} className="mds-saved-doc-row">
              <div className="u-flex-1">
                <div className="mds2-fw600-mb025">{e.vorlage_name || '—'}</div>
                {e.betreff && e.betreff !== e.vorlage_name && (
                  <div className="mds-saved-doc-meta">{e.betreff}</div>
                )}
                <div className="mds-saved-doc-meta">
                  {fmt(e.gesendet_am)} · {VERSANDART[e.versand_art] || e.versand_art}
                  {e.empfaenger_email && ` · ${e.empfaenger_email}`}
                </div>
              </div>
              <span style={{
                fontSize: '0.75rem', fontWeight: 600, borderRadius: 4, padding: '2px 8px',
                background: e.status === 'gesendet' ? 'rgba(72,187,120,0.15)' : 'rgba(248,113,113,0.15)',
                color: e.status === 'gesendet' ? '#68d391' : '#f87171',
              }}>
                {e.status === 'gesendet' ? '✓ Gesendet' : '✗ Fehler'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const DokumenteTab = ({
  mitglied,
  verträge,
  updatedData,
  handleChange,
  editMode,
  isAdmin,
  sepaMandate,
  archivierteMandate,
  confirmedNotifications,
  verfügbareVorlagen,
  generatingDocument,
  mitgliedDokumente,
  rechnungen,
  mitgliedId,
  activeDojo,
  downloadSepaMandate,
  downloadArchiviertesMandat,
  generateDocumentFromTemplate,
  downloadTemplateAsPDF,
  downloadMitgliedDokument,
  deleteMitgliedDokument,
  deleteRechnung,
}) => {
  const activeContract = verträge.find(v => v.status === 'aktiv') || verträge[0];
  const docSource = activeContract || mitglied || {};

  const hausordnung_akzeptiert = docSource.hausordnung_akzeptiert_am ? true : (mitglied?.hausordnung_akzeptiert || false);
  const datenschutz_akzeptiert = docSource.datenschutz_akzeptiert_am ? true : (mitglied?.datenschutz_akzeptiert || false);
  const foto_einverstaendnis = docSource.foto_einverstaendnis_datum ? docSource.foto_einverstaendnis : mitglied?.foto_einverstaendnis;
  const agb_akzeptiert = docSource.agb_akzeptiert_am ? true : (mitglied?.agb_akzeptiert || false);
  const haftungsausschluss_akzeptiert = docSource.haftungsausschluss_datum ? docSource.haftungsausschluss_akzeptiert : mitglied?.haftungsausschluss_akzeptiert;
  const gesundheitserklaerung = docSource.gesundheitserklaerung_datum ? docSource.gesundheitserklaerung : mitglied?.gesundheitserklaerung;

  const docs = [
    { key: 'hausordnung_akzeptiert', label: 'Hausordnung', ok: hausordnung_akzeptiert, okLabel: 'Akzeptiert', date: docSource.hausordnung_akzeptiert_am || mitglied?.hausordnung_akzeptiert_am },
    { key: 'datenschutz_akzeptiert', label: 'Datenschutz', ok: datenschutz_akzeptiert, okLabel: 'Akzeptiert', date: docSource.datenschutz_akzeptiert_am || mitglied?.datenschutz_akzeptiert_am },
    { key: 'foto_einverstaendnis', label: 'Foto-Einverständnis', ok: foto_einverstaendnis, okLabel: 'Erteilt', date: docSource.foto_einverstaendnis_datum || mitglied?.foto_einverstaendnis_datum },
    { key: 'agb_akzeptiert', label: 'AGB', ok: agb_akzeptiert, okLabel: 'Akzeptiert', date: docSource.agb_akzeptiert_am || mitglied?.agb_akzeptiert_am },
    { key: 'haftungsausschluss_akzeptiert', label: 'Haftungsausschluss', ok: haftungsausschluss_akzeptiert, okLabel: 'Akzeptiert', date: docSource.haftungsausschluss_datum || mitglied?.haftungsausschluss_datum },
    { key: 'gesundheitserklaerung', label: 'Gesundheitserklärung', ok: gesundheitserklaerung, okLabel: 'Abgegeben', date: docSource.gesundheitserklaerung_datum || mitglied?.gesundheitserklaerung_datum },
  ];

  return (
    <div className="dok-wrap">

      {/* Einverständnisse */}
      <div className="dok-card">
        <h3 className="dok-section-title">📋 Dokumente & Einverständnisse</h3>
        {activeContract && (
          <div className="dok-hint">
            ℹ️ Daten aus aktivem Vertrag #{activeContract.personenVertragNr ?? activeContract.id}
          </div>
        )}
        <div className="dok-consent-grid">
          {docs.map(({ key, label, ok, okLabel, date }) => (
            <div key={key} className={`dok-doc-card${ok ? ' dok-doc-card--ok' : ' dok-doc-card--miss'}`}>
              <div className="dok-doc-top">
                <span className="dok-doc-label">{label}</span>
                {editMode && isAdmin
                  ? <input type="checkbox" className="dok-checkbox" checked={updatedData[key] || false} onChange={(e) => handleChange(e, key)} />
                  : <span className={`dok-doc-badge${ok ? ' dok-doc-badge--ok' : ' dok-doc-badge--miss'}`}>{ok ? okLabel : 'Fehlt'}</span>
                }
              </div>
              {date && <div className="dok-doc-date">{new Date(date).toLocaleDateString('de-DE')}</div>}
            </div>
          ))}
          <div className="dok-doc-card">
            <div className="dok-doc-top">
              <span className="dok-doc-label">Vereinsordnung Datum</span>
              {editMode && isAdmin && (
                <input type="date" className="dok-date-input" value={toInputDate(updatedData.vereinsordnung_datum)} onChange={(e) => handleChange(e, 'vereinsordnung_datum')} />
              )}
            </div>
            {!editMode && (
              <div className="dok-doc-date">
                {mitglied?.vereinsordnung_datum
                  ? new Date(mitglied.vereinsordnung_datum).toLocaleDateString('de-DE')
                  : '15.1.2023'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bestätigte Dokumente */}
      {confirmedNotifications.length > 0 && (
        <div className="dok-card">
          <h3 className="dok-section-title">✅ Bestätigte Dokumente</h3>
          <div className="dok-confirmed-list">
            {confirmedNotifications.map((notification) => {
              const metadata = notification.metadata || {};
              return (
                <div key={notification.id} className="dok-confirmed-row">
                  <div className="dok-confirmed-left">
                    <div className="dok-confirmed-subject">{notification.subject}</div>
                    {(metadata.document_title || metadata.document_version) && (
                      <div className="dok-confirmed-sub">
                        {metadata.document_title}
                        {metadata.document_version && ` (Version ${metadata.document_version})`}
                      </div>
                    )}
                  </div>
                  <div className="dok-confirmed-right">
                    <span className="dok-confirmed-badge">✓ Bestätigt</span>
                    <span className="dok-confirmed-time">
                      {new Date(notification.confirmed_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="dok-info-note">ℹ️ Alle vom Mitglied bestätigten Dokumente mit Datum und Uhrzeit der Bestätigung.</p>
        </div>
      )}

      {/* Aktives SEPA-Mandat */}
      {isAdmin && sepaMandate && (
        <div className="dok-card">
          <div className="dok-sepa-head">
            <h3 className="dok-section-title">🏦 Aktuelles SEPA-Lastschriftmandat</h3>
            <span className="dok-sepa-status-badge">AKTIV</span>
          </div>
          <div className="dok-sepa-body">
            <div className="dok-sepa-grid">
              <span className="dok-kv-label">Mandatsreferenz</span>
              <span className="dok-kv-value dok-mono">{sepaMandate.mandatsreferenz}</span>
              <span className="dok-kv-label">Erstellt</span>
              <span className="dok-kv-value">{new Date(sepaMandate.erstellungsdatum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
              <span className="dok-kv-label">Gläubiger-ID</span>
              <span className="dok-kv-value dok-mono">{sepaMandate.glaeubiger_id || 'N/A'}</span>
              <span className="dok-kv-label">IBAN</span>
              <span className="dok-kv-value dok-mono">{sepaMandate.iban ? `${sepaMandate.iban.slice(0, 4)} **** ${sepaMandate.iban.slice(-4)}` : 'N/A'}</span>
              <span className="dok-kv-label">Kontoinhaber</span>
              <span className="dok-kv-value">{sepaMandate.kontoinhaber || 'N/A'}</span>
              <span className="dok-kv-label">BIC</span>
              <span className="dok-kv-value dok-mono">{sepaMandate.bic || 'N/A'}</span>
            </div>
            <button className="dok-pdf-btn" onClick={downloadSepaMandate} title="PDF herunterladen">PDF</button>
          </div>
          <p className="dok-info-note">Dieses Mandat ist aktiv und wird für SEPA-Lastschriften verwendet.</p>
        </div>
      )}

      {/* Archivierte SEPA-Mandate */}
      {isAdmin && archivierteMandate.length > 0 && (
        <div className="dok-card">
          <h3 className="dok-section-title">📦 Archivierte & Widerrufene Mandate</h3>
          <div className="dok-archived-list">
            {archivierteMandate.map((mandat) => (
              <div key={mandat.mandat_id} className="dok-archived-row">
                <div className="dok-archived-info">
                  <div className="dok-archived-ref">🔖 {mandat.mandatsreferenz}</div>
                  <div className="dok-archived-meta">
                    Erstellt: {new Date(mandat.erstellungsdatum).toLocaleDateString('de-DE')}
                    {' · '}
                    {mandat.archiviert_am
                      ? `Archiviert: ${new Date(mandat.archiviert_am).toLocaleDateString('de-DE')}`
                      : mandat.widerruf_datum
                        ? `Widerrufen: ${new Date(mandat.widerruf_datum).toLocaleDateString('de-DE')}`
                        : 'Nicht mehr aktiv'}
                  </div>
                  <div className="dok-archived-sub">
                    <span>IBAN: {mandat.iban ? `${mandat.iban.slice(0, 4)}****${mandat.iban.slice(-4)}` : 'N/A'}</span>
                    <span>{mandat.kontoinhaber}</span>
                    <span className={`dok-archived-badge${mandat.status === 'widerrufen' ? ' dok-archived-badge--rev' : ''}`}>
                      {mandat.status === 'widerrufen' ? 'Widerrufen' : 'Archiviert'}
                    </span>
                    {mandat.archiviert_grund && <span>Grund: {mandat.archiviert_grund}</span>}
                  </div>
                </div>
                <button className="dok-pdf-btn" onClick={() => downloadArchiviertesMandat(mandat.mandat_id, mandat.vorname, mandat.nachname, mandat.erstellungsdatum)} title="PDF herunterladen">PDF</button>
              </div>
            ))}
          </div>
          <p className="dok-info-note">Archivierte und widerrufene Mandate bleiben dauerhaft gespeichert und können als PDF heruntergeladen werden.</p>
        </div>
      )}

      {/* Dokumente aus Vorlagen generieren */}
      {isAdmin && (
        <div className="dok-card">
          <h3 className="dok-section-title">🖨️ Dokumente aus Vorlagen generieren</h3>
          {verfügbareVorlagen.length === 0 ? (
            <p className="dok-info-note">ℹ️ Keine Vorlagen verfügbar. Erstellen Sie zuerst Vorlagen im Bereich "Vertragsdokumente".</p>
          ) : (
            <>
              <p className="dok-info-note" style={{ marginBottom: '0.85rem' }}>Wählen Sie eine Vorlage, um ein PDF mit den aktuellen Mitgliedsdaten zu erstellen.</p>
              <div className="dok-vorlage-grid">
                {verfügbareVorlagen.map((vorlage) => (
                  <div key={vorlage.id} className="dok-vorlage-card">
                    <div className="dok-vorlage-top">
                      <div className="dok-vorlage-name">{vorlage.name}</div>
                      {vorlage.beschreibung && <div className="dok-vorlage-desc">{vorlage.beschreibung}</div>}
                      <div className="dok-vorlage-badges">
                        <span className="dok-vorlage-type-badge">{vorlage.template_type || 'vertrag'}</span>
                        {vorlage.is_default && <span className="dok-vorlage-default-badge">⭐ Standard</span>}
                      </div>
                    </div>
                    <div className="dok-vorlage-actions">
                      <button className="dok-action-btn dok-action-btn--primary" onClick={() => generateDocumentFromTemplate(vorlage.id, vorlage.name)} disabled={generatingDocument}>
                        {generatingDocument ? 'Generiere…' : 'PDF erstellen'}
                      </button>
                      <button className="dok-action-btn" onClick={() => downloadTemplateAsPDF(vorlage.id, vorlage.name)} title="Vorlage als PDF">
                        Vorlage
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Gespeicherte Dokumente */}
      <div className="dok-card">
        <h3 className="dok-section-title">📁 Gespeicherte Dokumente</h3>
        {mitgliedDokumente.length === 0 ? (
          <p className="dok-info-note">ℹ️ Keine Dokumente vorhanden. {isAdmin ? 'Generieren Sie Dokumente aus den Vorlagen oben.' : 'Es wurden noch keine Dokumente für Sie erstellt.'}</p>
        ) : (
          <div className="dok-file-list">
            {mitgliedDokumente.filter(dok => !dok.dokumentname.startsWith('Rechnung')).map((dok) => (
              <div key={dok.id} className="dok-file-row">
                <div className="dok-file-info">
                  <div className="dok-file-name">{dok.dokumentname}</div>
                  <div className="dok-file-meta">
                    Erstellt: {new Date(dok.erstellt_am).toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    {dok.erstellt_von_name && ` von ${dok.erstellt_von_name}`}
                  </div>
                </div>
                <div className="dok-file-actions">
                  <button className="dok-action-btn" onClick={() => downloadMitgliedDokument(dok.id, dok.dokumentname)}>Download</button>
                  {isAdmin && <button className="dok-action-btn dok-action-btn--danger" onClick={() => deleteMitgliedDokument(dok)}>Löschen</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Versandhistorie */}
      {isAdmin && <Versandhistorie mitgliedId={mitgliedId} activeDojo={activeDojo} />}

      {/* Rechnungen */}
      <div className="dok-card">
        <h3 className="dok-section-title">🧾 Rechnungen</h3>
        {rechnungen.length === 0 ? (
          <p className="dok-info-note">ℹ️ Keine Rechnungen vorhanden.</p>
        ) : (
          <div className="dok-file-list">
            {rechnungen.map((rechnung) => (
              <div key={rechnung.rechnung_id} className="dok-file-row">
                <div className="dok-file-info">
                  <div className="dok-file-name">{rechnung.rechnungsnummer}</div>
                  <div className="dok-file-meta">
                    {new Date(rechnung.datum).toLocaleDateString('de-DE')} · {Number(rechnung.betrag).toFixed(2)} € · {rechnung.status_text || rechnung.status}
                  </div>
                </div>
                <div className="dok-file-actions">
                  <button className="dok-action-btn" onClick={() => openApiBlob(`/api/rechnungen/${rechnung.rechnung_id}/pdf`)}>PDF anzeigen</button>
                  {isAdmin && <button className="dok-action-btn dok-action-btn--danger" onClick={() => deleteRechnung(rechnung)}>Löschen</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default DokumenteTab;
