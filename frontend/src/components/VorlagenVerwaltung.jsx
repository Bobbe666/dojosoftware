/**
 * VorlagenVerwaltung.jsx
 * =======================
 * Hauptseite für das Dokument-Vorlagen-System.
 * Zeigt System- und eigene Vorlagen nach Kategorie-Tabs, Absender-Profile-Verwaltung.
 */

import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';
import {
  Plus, Settings, Eye, Edit, Copy, Trash2, Send,
  Building2, FileText, AlertCircle, RefreshCw, Download, History, Users, FileDown
} from 'lucide-react';
import VorlagenEditor from './VorlagenEditor';
import AbsenderProfileModal from './AbsenderProfileModal';
import VorlagenSendenModal from './VorlagenSendenModal';
import BriefEinstellungenTab from './BriefEinstellungenTab';
import SerienBriefModal from './SerienBriefModal';
import '../styles/VorlagenVerwaltung.css';

// ── Kategorie-Filter-Tabs ──────────────────────────────────────────────────────
const FILTER_TABS = [
  { id: 'alle', label: 'Alle' },
  { id: 'mitgliedschaft', label: 'Mitgliedschaft', kategorien: ['begruessung','geburtstag','kuendigung_bestaetigung','ruhezeit','vertrag_verlaengerung','vertrag_bestaetigung','kursanmeldung','info_brief','rundschreiben'] },
  { id: 'finanzen', label: 'Finanzen', kategorien: ['rechnung','zahlungserinnerung','mahnung','mahnbescheid','ruecklastschrift_info'] },
  { id: 'pruefungen', label: 'Prüfungen', kategorien: ['pruefung_einladung','pruefung_ergebnis','guertelvergabe'] },
  { id: 'lizenzen', label: 'Lizenzen & Verband', kategorien: ['lizenz_ausstellung','lizenz_verlaengerung','verband_info'] },
  { id: 'personal', label: 'Personal & Trainer', kategorien: ['trainer_vereinbarung','trainer_infoblatt'] },
  { id: 'sonstiges', label: 'Sonstiges', kategorien: ['sonstiges'] },
];

const KATEGORIE_LABEL = {
  begruessung: 'Begrüßung', geburtstag: 'Geburtstag',
  kuendigung_bestaetigung: 'Kündigung', ruhezeit: 'Ruhezeit',
  vertrag_verlaengerung: 'Vertragsverlängerung', vertrag_bestaetigung: 'Vertragsbestätigung',
  zahlungserinnerung: 'Zahlungserinnerung', mahnung: 'Mahnung',
  mahnbescheid: 'Mahnbescheid', ruecklastschrift_info: 'Rücklastschrift',
  rechnung: 'Rechnung', kursanmeldung: 'Kursanmeldung',
  pruefung_einladung: 'Prüfungs-Einladung', pruefung_ergebnis: 'Prüfungsergebnis',
  guertelvergabe: 'Gürtelvergabe', info_brief: 'Infobrief',
  rundschreiben: 'Rundschreiben',
  lizenz_ausstellung: 'Lizenz-Ausstellung', lizenz_verlaengerung: 'Lizenzverlängerung',
  verband_info: 'Verbandsinfo', sonstiges: 'Sonstiges',
  trainer_vereinbarung: 'Trainervereinbarung',
  trainer_infoblatt: 'Trainer-Infoblatt',
};

export default function VorlagenVerwaltung({ embedded = false }) {
  const { activeDojo } = useDojoContext();
  const withDojo = (url) => activeDojo?.id ? `${url}${url.includes('?') ? '&' : '?'}dojo_id=${activeDojo.id}` : url;
  const [vorlagen, setVorlagen] = useState([]);
  const [profile, setProfile] = useState([]);
  const [ladeVorlagen, setLadeVorlagen] = useState(true);
  const [fehler, setFehler] = useState('');
  const [aktiverTab, setAktiverTab] = useState('alle');
  const [ansicht, setAnsicht] = useState('vorlagen'); // 'vorlagen' | 'einstellungen' | 'verlauf'

  // Modals
  const [editorVorlage, setEditorVorlage] = useState(null);
  const [editorOffen, setEditorOffen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewName, setPreviewName] = useState('');
  const [sendenVorlagenId, setSendenVorlagenId] = useState(null);
  const [serienbriefVorlage, setSerienbriefVorlage] = useState(null); // { id, name }
  const [toast, setToast] = useState('');
  const [pdfModal, setPdfModal] = useState(null); // { name, blobUrl, dataUri }
  const [verlauf, setVerlauf] = useState([]);
  const [verlaufLaden, setVerlaufLaden] = useState(false);

  function zeigeToast(msg, dauer = 3000) {
    setToast(msg);
    setTimeout(() => setToast(''), dauer);
  }

  const ladeAlles = useCallback(async () => {
    setLadeVorlagen(true);
    setFehler('');
    try {
      const [vRes, pRes] = await Promise.all([
        axios.get(withDojo('/vorlagen')),
        axios.get(withDojo('/absender-profile')),
      ]);
      setVorlagen(vRes.data.vorlagen || []);
      setProfile(pRes.data.profile || []);
    } catch (err) {
      setFehler('Fehler beim Laden der Vorlagen');
    } finally {
      setLadeVorlagen(false);
    }
  }, [activeDojo]);

  useEffect(() => { ladeAlles(); }, [ladeAlles]);

  const ladeVerlauf = useCallback(async () => {
    setVerlaufLaden(true);
    try {
      const res = await axios.get(withDojo('/vorlagen/dokument-verlauf'));
      setVerlauf(res.data.dokumente || []);
    } catch (err) {
      // ignore
    } finally {
      setVerlaufLaden(false);
    }
  }, [activeDojo]);

  async function handleDuplizieren(vorlage) {
    try {
      await axios.post(withDojo(`/vorlagen/${vorlage.id}/kopieren`));
      zeigeToast(`"${vorlage.name}" dupliziert`);
      ladeAlles();
    } catch (err) {
      zeigeToast('Fehler beim Duplizieren');
    }
  }

  async function handleLoeschen(vorlage) {
    if (!window.confirm(`Vorlage "${vorlage.name}" wirklich löschen?`)) return;
    try {
      await axios.delete(withDojo(`/vorlagen/${vorlage.id}`));
      zeigeToast('Vorlage gelöscht');
      ladeAlles();
    } catch (err) {
      zeigeToast(err.response?.data?.error || 'Fehler beim Löschen');
    }
  }

  async function handleVorschau(vorlage) {
    setPreviewLoading(true);
    setPreviewHtml(null);
    setPreviewName(vorlage.name || 'Vorschau');
    try {
      const res = await axios.get(withDojo(`/vorlagen/${vorlage.id}/preview-html`), { responseType: 'text' });
      setPreviewHtml(res.data);
    } catch (err) {
      zeigeToast('Fehler bei der Vorschau');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handlePdfVorschau(vorlage) {
    zeigeToast('PDF wird generiert…', 10000);
    try {
      const res = await axios.get(withDojo(`/vorlagen/${vorlage.id}/preview-pdf`), { responseType: 'arraybuffer' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      // data URI für den Download-Link
      const bytes = new Uint8Array(res.data);
      let binary = '';
      for (let i = 0; i < bytes.length; i += 1024) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 1024));
      }
      const dataUri = `data:application/pdf;base64,${window.btoa(binary)}`;
      setPdfModal({ name: vorlage.name, blobUrl, dataUri });
    } catch (err) {
      zeigeToast('Fehler beim Laden des PDFs');
    }
  }

  function closePdfModal() {
    if (pdfModal?.blobUrl) URL.revokeObjectURL(pdfModal.blobUrl);
    setPdfModal(null);
  }

  async function handleVerlaufPdf(dok) {
    try {
      const res = await axios.get(withDojo(`/vorlagen/dokument-verlauf/${dok.id}/pdf`), { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dok.dokumentname || 'Dokument'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      zeigeToast('Fehler beim PDF-Download');
    }
  }

  // Gefilterte Vorlagen
  const aktiveTabObj = FILTER_TABS.find(t => t.id === aktiverTab);
  const gefilterteVorlagen = aktiverTab === 'alle'
    ? vorlagen
    : vorlagen.filter(v => aktiveTabObj?.kategorien?.includes(v.kategorie));

  // Editor als Vollseite anzeigen (wie TemplateEditorTipTap)
  if (editorOffen) {
    return (
      <>
        <VorlagenEditor
          asPage={true}
          vorlage={editorVorlage}
          profile={profile}
          onClose={() => setEditorOffen(false)}
          onSaved={() => { ladeAlles(); zeigeToast('Vorlage gespeichert'); setEditorOffen(false); }}
        />
      </>
    );
  }

  return (
    <div className={`vv-page${embedded ? ' vv-page--embedded' : ''}`}>
      {/* Header */}
      <div className="vv-header-bar">
        {!embedded && (
        <div>
          <h1 className="vv-page-title">
            Dokument-Vorlagen
          </h1>
          <p className="vv-page-subtitle">
            E-Mail- und PDF-Vorlagen mit WYSIWYG-Editor, Platzhaltern und einheitlichem Briefkopf.
          </p>
        </div>
        )}
        <div className="vv-action-row">
          <button onClick={() => { setAnsicht('verlauf'); ladeVerlauf(); }} className={`vv-btn-profile-nav${ansicht === 'verlauf' ? ' vv-btn-profile-nav--active' : ''}`}>
            <History size={14} /> Verlauf
          </button>
          <button onClick={() => { setAnsicht('einstellungen'); }} className={`vv-btn-profile-nav${ansicht === 'einstellungen' ? ' vv-btn-profile-nav--active' : ''}`}>
            <Settings size={14} /> Einstellungen
          </button>
          <button onClick={() => { setEditorVorlage(null); setEditorOffen(true); }} className="vv-btn-primary">
            <Plus size={14} /> Neue Vorlage
          </button>
        </div>
      </div>

      {fehler && (
        <div className="vv-error-box">
          <AlertCircle size={16} /> {fehler}
          <button onClick={ladeAlles} className="vv-error-retry-btn">
            <RefreshCw size={12} /> Erneut versuchen
          </button>
        </div>
      )}

      {/* ── ANSICHT: VORLAGEN ── */}
      {ansicht === 'vorlagen' && (
        <>
          {/* Tab-Leiste */}
          <div className="vv-tab-bar">
            {FILTER_TABS.map(tab => (
              <button key={tab.id} onClick={() => setAktiverTab(tab.id)} className={`vv-tab-btn${aktiverTab === tab.id ? ' vv-tab-btn--active' : ''}`}>
                {tab.label}
                <span className={`vv-tab-count${aktiverTab === tab.id ? ' vv-tab-count--active' : ''}`}>
                  {tab.id === 'alle' ? vorlagen.length : (vorlagen.filter(v => tab.kategorien?.includes(v.kategorie)).length)}
                </span>
              </button>
            ))}
          </div>

          {/* Vorlage-Karten */}
          {ladeVorlagen ? (
            <div className="vv-empty-888">
              Vorlagen werden geladen...
            </div>
          ) : gefilterteVorlagen.length === 0 ? (
            <div className="vv-empty-666">
              <FileText size={40} className="vv-icon-fade" />
              <p>Keine Vorlagen in dieser Kategorie.</p>
              <button onClick={() => { setEditorVorlage(null); setEditorOffen(true); }} className="vv-btn-primary vv-btn-primary-mt">
                Erste Vorlage erstellen
              </button>
            </div>
          ) : (
            <div className="vv-vorlage-grid">
              {gefilterteVorlagen.map(v => {
                const profilObj = profile.find(p => p.id === v.absender_profil_id);
                const profilFarbe = profilObj?.farbe_primaer || null;
                return (
                  <div key={v.id} className="vv-vorlage-card"
                    onMouseEnter={e => e.currentTarget.style.borderColor = profilFarbe ? `${profilFarbe}66` : 'var(--border-accent, var(--primary, #ffd700))'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default, #2a2a3a)'}
                  >
                    {/* Farb-Balken oben */}
                    <div className="vv-color-bar-sm" style={{ '--pc': profilFarbe || 'var(--primary, #ffd700)' }} />

                    <div className="vv-card-body-flex">
                      {/* Badges */}
                      <div className="vv-tag-row">
                        {v.system_vorlage === 1 && (
                          <span className="vv-badge-system">System</span>
                        )}
                        <span className="vv-kategorie-badge" style={{ '--pc': profilFarbe || 'var(--primary, #ffd700)', '--pc22': profilFarbe ? `${profilFarbe}22` : 'var(--primary-alpha-10, rgba(255,215,0,0.1))' }}>
                          {KATEGORIE_LABEL[v.kategorie] || v.kategorie}
                        </span>
                        {v.mit_pdf_anhang === 1 && (
                          <span className="vv-pdf-badge">PDF-Anhang</span>
                        )}
                      </div>

                      {/* Name – in Title Case normalisieren (DB speichert ALL CAPS) */}
                      <h3 className="vv-card-title">
                        {v.name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}
                      </h3>

                      {/* Absender-Profil */}
                      {profilObj && (
                        <div className="vv-vorlage-meta-row">
                          <span className="vv-dot" style={{ '--pc': profilFarbe || 'var(--primary, #ffd700)' }} />
                          {profilObj.name}
                        </div>
                      )}

                      {/* Betreff-Vorschau */}
                      {v.email_betreff && (
                        <div className="vv-description">
                          "{v.email_betreff.length > 60 ? v.email_betreff.slice(0, 60) + '…' : v.email_betreff}"
                        </div>
                      )}
                    </div>

                    {/* Aktionen */}
                    <div className="vv-card-actions">
                      {['trainer_vereinbarung', 'trainer_infoblatt'].includes(v.kategorie) ? (
                        <ActionBtn icon={<Eye size={13} />} label="Vorschau" onClick={() => handlePdfVorschau(v)} />
                      ) : (
                        <ActionBtn icon={<Eye size={13} />} label="Vorschau" onClick={() => handleVorschau(v)} />
                      )}
                      <ActionBtn icon={<Edit size={13} />} label="Bearbeiten" onClick={() => { setEditorVorlage(v); setEditorOffen(true); }} />
                      <ActionBtn icon={<Copy size={13} />} label="Kopieren" onClick={() => handleDuplizieren(v)} />
                      <ActionBtn icon={<Send size={13} />} label="Senden" primary color={profilFarbe} onClick={() => setSendenVorlagenId(v.id)} />
                      {v.email_html && (
                        <ActionBtn icon={<Users size={13} />} label="Serienbrief" onClick={() => setSerienbriefVorlage({ id: v.id, name: v.name })} />
                      )}
                      {v.system_vorlage !== 1 && (
                        <ActionBtn icon={<Trash2 size={13} />} label="Löschen" danger onClick={() => handleLoeschen(v)} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── ANSICHT: EINSTELLUNGEN ── */}
      {ansicht === 'einstellungen' && (
        <>
          <div className="vv-profil-header-bar">
            <div>
              <h2 className="vv-profil-section-title">Einstellungen</h2>
              <p className="vv-profil-subtitle">DIN-Format, Schrift, Fußzeile und Absender-Profile für Ihre Briefvorlagen.</p>
            </div>
            <div className="vv-profil-btns">
              <button onClick={() => setAnsicht('vorlagen')} className="vv-btn-back">&#8592; Zurück zu Vorlagen</button>
            </div>
          </div>
          <BriefEinstellungenTab
            profile={profile}
            onProfileChanged={() => { ladeAlles(); zeigeToast('Profil gespeichert'); }}
          />
        </>
      )}

      {/* ── ANSICHT: VERLAUF ── */}
      {ansicht === 'verlauf' && (
        <>
          <div className="vv-profil-header-bar">
            <div>
              <h2 className="vv-profil-section-title">Dokument-Verlauf</h2>
              <p className="vv-profil-subtitle">Alle erstellten und versendeten Dokumente des Dojos.</p>
            </div>
            <div className="vv-profil-btns">
              <button onClick={() => setAnsicht('vorlagen')} className="vv-btn-back">&#8592; Zur&#252;ck zu Vorlagen</button>
              <button onClick={ladeVerlauf} className="vv-btn-back" title="Aktualisieren"><RefreshCw size={13} /></button>
            </div>
          </div>

          {verlaufLaden ? (
            <div className="vv-empty-888">Verlauf wird geladen...</div>
          ) : verlauf.length === 0 ? (
            <div className="vv-empty-666">
              <History size={40} className="vv-icon-fade" />
              <p>Noch keine Dokumente erstellt oder versendet.</p>
            </div>
          ) : (
            <div className="vv-verlauf-table-wrap">
              <table className="vv-verlauf-table">
                <thead>
                  <tr>
                    <th>Mitglied</th>
                    <th>Dokument</th>
                    <th>Versand</th>
                    <th>Betreff</th>
                    <th>Erstellt</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {verlauf.map(dok => (
                    <tr key={dok.id}>
                      <td>
                        <span className="vv-tbl-name">{dok.vorname} {dok.nachname}</span>
                        {dok.mitglied_email && <span className="vv-tbl-email">{dok.mitglied_email}</span>}
                      </td>
                      <td>{dok.dokumentname}</td>
                      <td>
                        <span className={`vv-versand-badge vv-versand-${dok.versand_art || 'unbekannt'}`}>
                          {dok.versand_art === 'pdf' ? 'PDF' : dok.versand_art === 'email' ? 'E-Mail' : dok.versand_art === 'email_mit_pdf' ? 'E-Mail+PDF' : dok.versand_art || '–'}
                        </span>
                      </td>
                      <td className="vv-td-betreff">{dok.betreff || '–'}</td>
                      <td className="vv-td-date">
                        {new Date(dok.erstellt_am).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        <button
                          className="vv-action-btn vv-action-btn--default"
                          title="PDF herunterladen"
                          onClick={() => handleVerlaufPdf(dok)}
                        >
                          <Download size={13} /> PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Modals ── */}
      {sendenVorlagenId && (
        <VorlagenSendenModal
          vorlagenId={sendenVorlagenId}
          onClose={() => setSendenVorlagenId(null)}
        />
      )}

      {serienbriefVorlage && (
        <SerienBriefModal
          vorlagenId={serienbriefVorlage.id}
          vorlagenName={serienbriefVorlage.name}
          onClose={() => setSerienbriefVorlage(null)}
        />
      )}

      {/* PDF-Viewer Modal */}
      {pdfModal && ReactDOM.createPortal(
        <div className="vv-pdf-overlay" onClick={closePdfModal}>
          <div className="vv-pdf-modal" onClick={e => e.stopPropagation()}>
            <div className="vv-pdf-modal-bar">
              <span>{pdfModal.name}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <a
                  href={pdfModal.dataUri}
                  download={`${pdfModal.name.replace(/\s+/g, '_')}.pdf`}
                  className="vv-pdf-download-btn"
                  onClick={e => e.stopPropagation()}
                >
                  <Download size={13} /> Herunterladen
                </a>
                <button className="vv-pdf-close-btn" onClick={closePdfModal}>✕ Schließen</button>
              </div>
            </div>
            <object
              data={pdfModal.blobUrl}
              type="application/pdf"
              className="vv-pdf-iframe"
            >
              <embed src={pdfModal.blobUrl} type="application/pdf" className="vv-pdf-iframe" />
            </object>
          </div>
        </div>,
        document.body
      )}

      {/* Toast */}
      {toast && (
        <div className="vv-toast">
          {toast}
        </div>
      )}

      {/* Vorschau-Modal via Portal */}
      {(previewLoading || previewHtml) && ReactDOM.createPortal(
        <div className="ve-preview-overlay" onClick={() => setPreviewHtml(null)}>
          <div className="ve-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="ve-preview-modal-bar">
              <span>Vorschau — {previewName}</span>
              <button onClick={() => setPreviewHtml(null)} className="ve-preview-modal-close">✕ Schließen</button>
            </div>
            {previewLoading
              ? <div className="ve-preview-modal-loading">Vorschau wird geladen…</div>
              : <iframe srcDoc={previewHtml} title="Vorschau" className="ve-preview-modal-iframe" sandbox="allow-scripts" />
            }
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ── Hilfs-Komponente: Action-Button ───────────────────────────────────────────
function ActionBtn({ icon, label, onClick, primary, danger, color }) {
  const hasCustomColor = !!color;
  const variant = danger ? 'danger' : primary ? (hasCustomColor ? 'primary-custom' : 'primary') : 'default';

  return (
    <button
      onClick={onClick}
      title={label}
      className={`vv-action-btn vv-action-btn--${variant}`}
      style={hasCustomColor ? { '--c': color, '--c22': `${color}22` } : undefined}
    >
      {icon} {label}
    </button>
  );
}
