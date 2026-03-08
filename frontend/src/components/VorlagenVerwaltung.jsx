/**
 * VorlagenVerwaltung.jsx
 * =======================
 * Hauptseite für das Dokument-Vorlagen-System.
 * Zeigt System- und eigene Vorlagen nach Kategorie-Tabs, Absender-Profile-Verwaltung.
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';
import {
  Plus, Settings, Eye, Edit, Copy, Trash2, Send,
  Building2, FileText, AlertCircle, RefreshCw
} from 'lucide-react';
import VorlagenEditor from './VorlagenEditor';
import AbsenderProfileModal from './AbsenderProfileModal';
import VorlagenSendenModal from './VorlagenSendenModal';
import '../styles/VorlagenVerwaltung.css';

// ── Kategorie-Filter-Tabs ──────────────────────────────────────────────────────
const FILTER_TABS = [
  { id: 'alle', label: 'Alle' },
  { id: 'mitgliedschaft', label: 'Mitgliedschaft', kategorien: ['begruessung','geburtstag','kuendigung_bestaetigung','ruhezeit','kursanmeldung','info_brief','rundschreiben'] },
  { id: 'finanzen', label: 'Finanzen', kategorien: ['zahlungserinnerung','mahnung','mahnbescheid','ruecklastschrift_info'] },
  { id: 'pruefungen', label: 'Prüfungen', kategorien: ['pruefung_einladung','pruefung_ergebnis','guertelvergabe'] },
  { id: 'sonstiges', label: 'Sonstiges', kategorien: ['sonstiges'] },
];

const KATEGORIE_LABEL = {
  begruessung: 'Begrüßung', geburtstag: 'Geburtstag',
  kuendigung_bestaetigung: 'Kündigung', ruhezeit: 'Ruhezeit',
  zahlungserinnerung: 'Zahlungserinnerung', mahnung: 'Mahnung',
  mahnbescheid: 'Mahnbescheid', ruecklastschrift_info: 'Rücklastschrift',
  kursanmeldung: 'Kursanmeldung', pruefung_einladung: 'Prüfungs-Einladung',
  pruefung_ergebnis: 'Prüfungsergebnis', guertelvergabe: 'Gürtelvergabe',
  info_brief: 'Infobrief', rundschreiben: 'Rundschreiben',
  sonstiges: 'Sonstiges',
};

export default function VorlagenVerwaltung({ embedded = false }) {
  const { activeDojo } = useDojoContext();
  const withDojo = (url) => activeDojo?.id ? `${url}${url.includes('?') ? '&' : '?'}dojo_id=${activeDojo.id}` : url;
  const [vorlagen, setVorlagen] = useState([]);
  const [profile, setProfile] = useState([]);
  const [ladeVorlagen, setLadeVorlagen] = useState(true);
  const [fehler, setFehler] = useState('');
  const [aktiverTab, setAktiverTab] = useState('alle');
  const [ansicht, setAnsicht] = useState('vorlagen'); // 'vorlagen' | 'profile'

  // Modals
  const [editorVorlage, setEditorVorlage] = useState(null); // null = kein Modal, objekt = bearbeiten
  const [editorOffen, setEditorOffen] = useState(false);
  const [profileModalOffen, setProfileModalOffen] = useState(false);
  const [editProfil, setEditProfil] = useState(null);
  const [sendenVorlagenId, setSendenVorlagenId] = useState(null);
  const [toast, setToast] = useState('');

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

  async function handleProfilLoeschen(profil) {
    if (!window.confirm(`Profil "${profil.name}" wirklich löschen?`)) return;
    try {
      await axios.delete(withDojo(`/absender-profile/${profil.id}`));
      zeigeToast('Profil gelöscht');
      ladeAlles();
    } catch (err) {
      zeigeToast('Fehler beim Löschen');
    }
  }

  function handleVorschau(vorlage) {
    window.open(`/api/vorlagen/${vorlage.id}/preview-html${activeDojo?.id ? `?dojo_id=${activeDojo.id}` : ''}`, '_blank');
  }

  // Gefilterte Vorlagen
  const aktiveTabObj = FILTER_TABS.find(t => t.id === aktiverTab);
  const gefilterteVorlagen = aktiverTab === 'alle'
    ? vorlagen
    : vorlagen.filter(v => aktiveTabObj?.kategorien?.includes(v.kategorie));

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
          <button onClick={() => { setAnsicht('profile'); }} className={`vv-btn-profile-nav${ansicht === 'profile' ? ' vv-btn-profile-nav--active' : ''}`}>
            <Building2 size={14} /> Absender-Profile
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

                      {/* Name */}
                      <h3 className="vv-card-title">
                        {v.name}
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
                      <ActionBtn icon={<Eye size={13} />} label="Vorschau" onClick={() => handleVorschau(v)} />
                      <ActionBtn icon={<Edit size={13} />} label="Bearbeiten" onClick={() => { setEditorVorlage(v); setEditorOffen(true); }} />
                      <ActionBtn icon={<Copy size={13} />} label="Kopieren" onClick={() => handleDuplizieren(v)} />
                      <ActionBtn icon={<Send size={13} />} label="Senden" primary color={profilFarbe} onClick={() => setSendenVorlagenId(v.id)} />
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

      {/* ── ANSICHT: PROFILE ── */}
      {ansicht === 'profile' && (
        <>
          <div className="vv-profil-header-bar">
            <div>
              <h2 className="vv-profil-section-title">Absender-Profile</h2>
              <p className="vv-profil-subtitle">Briefköpfe und Absender-Daten für Ihre Korrespondenz.</p>
            </div>
            <div className="vv-profil-btns">
              <button onClick={() => setAnsicht('vorlagen')} className="vv-btn-back">&#8592; Zur&#252;ck zu Vorlagen</button>
              <button onClick={() => { setEditProfil(null); setProfileModalOffen(true); }} className="vv-btn-primary">
                <Plus size={13} /> Neues Profil
              </button>
            </div>
          </div>

          {profile.length === 0 ? (
            <div className="vv-empty-666">
              <Building2 size={40} className="vv-icon-fade" />
              <p>Noch keine Absender-Profile angelegt.</p>
              <button onClick={() => { setEditProfil(null); setProfileModalOffen(true); }} className="vv-btn-primary vv-btn-primary-mt">
                Erstes Profil erstellen
              </button>
            </div>
          ) : (
            <div className="vv-profile-grid">
              {profile.map(p => (
                <div key={p.id} className="vv-profil-card">
                  <div className="vv-color-bar-lg" style={{ '--pc': p.farbe_primaer || 'var(--primary, #ffd700)' }} />
                  <div className="vv-card-body">
                    <div className="vv-profil-card-header">
                      <div>
                        <div className="vv-profil-name">{p.name}</div>
                        <span className="vv-profil-type-badge" style={{ '--pc': p.farbe_primaer || 'var(--primary, #ffd700)', '--pc22': p.farbe_primaer ? `${p.farbe_primaer}22` : 'var(--primary-alpha-10, rgba(255,215,0,0.1))' }}>{p.typ}</span>
                      </div>
                      <div className="vv-profil-icon-btns">
                        <button onClick={() => { setEditProfil(p); setProfileModalOffen(true); }}
                          className="vv-icon-btn-neutral">
                          <Edit size={14} />
                        </button>
                        <button onClick={() => handleProfilLoeschen(p)}
                          className="vv-icon-btn-danger">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="vv-profil-info">
                      {p.organisation && <div>{p.organisation}</div>}
                      {p.inhaber && <div>Inhaber: {p.inhaber}</div>}
                      {(p.strasse || p.ort) && <div>{[p.strasse, p.hausnummer, p.plz, p.ort].filter(Boolean).join(' ')}</div>}
                      {p.email && <div>{p.email}</div>}
                      {p.bank_iban && <div className="vv-monospace">IBAN: {p.bank_iban}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Modals ── */}
      {editorOffen && (
        <VorlagenEditor
          vorlage={editorVorlage}
          profile={profile}
          onClose={() => setEditorOffen(false)}
          onSaved={() => { ladeAlles(); zeigeToast('Vorlage gespeichert'); }}
        />
      )}

      {profileModalOffen && (
        <AbsenderProfileModal
          profil={editProfil}
          onClose={() => setProfileModalOffen(false)}
          onSaved={() => { ladeAlles(); zeigeToast('Profil gespeichert'); }}
        />
      )}

      {sendenVorlagenId && (
        <VorlagenSendenModal
          vorlagenId={sendenVorlagenId}
          onClose={() => setSendenVorlagenId(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="vv-toast">
          {toast}
        </div>
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
