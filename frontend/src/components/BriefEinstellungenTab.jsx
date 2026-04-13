/**
 * BriefEinstellungenTab.jsx
 * ==========================
 * Einstellungen-Tab der Dokumentenzentrale.
 * Sections: Dojo-Stammdaten · Logo · DIN-Layout · Fußzeile (TipTap) · Absender-Profile · Standard-Einstellungen
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import axios from 'axios';
import {
  Settings, Layout, PanelBottom, UserCircle, Star,
  Bold, Italic, Link as LinkIcon, Plus, Edit, Trash2,
  Check, AlertCircle, Settings2, Eye, X,
  Camera, Upload, Building2, CreditCard, Phone, Globe, ChevronDown
} from 'lucide-react';
import { useDojoContext } from '../context/DojoContext';
import AbsenderProfileModal from './AbsenderProfileModal';
import '../styles/BriefEinstellungenTab.css';

// ── DIN-Presets ────────────────────────────────────────────────────────────────
const DIN_PRESETS = {
  din5008a: { margin_top_mm: 27.00, margin_bottom_mm: 26.46, margin_left_mm: 25.00, margin_right_mm: 20.00 },
  din5008b: { margin_top_mm: 45.00, margin_bottom_mm: 26.46, margin_left_mm: 25.00, margin_right_mm: 20.00 },
};

const FONT_FAMILIES = ['Helvetica', 'Arial', 'Times New Roman', 'Georgia', 'Courier New'];
const FONT_SIZES = [8, 9, 10, 11, 12, 14];
const FARBE_SWATCHES = ['#8B0000', '#c9a227', '#1a5276', '#1e8449', '#424242', '#5d4037'];

const DOJO_FORM_EMPTY = {
  dojoname: '', inhaber: '',
  strasse: '', hausnummer: '', plz: '', ort: '',
  telefon: '', email: '', internet: '',
  steuernummer: '', ust_id: '', sepa_glaeubiger_id: '',
};

const BANK_FORM_EMPTY = { bezeichnung: '', bank_name: '', bank_iban: '', bank_bic: '', bank_inhaber: '' };

// ── DIN-Diagramm (CSS-only Miniatur) ──────────────────────────────────────────
function DinDiagram({ format }) {
  const headerHeight = format === 'din5008b' ? 18 : 9;
  const addrTop = format === 'din5008b' ? 22 : 13;

  if (format === 'custom') {
    return (
      <div className="be-din-diagram" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2a2a3a' }}>
        <Settings2 size={20} className="be-din-card-icon" />
      </div>
    );
  }

  return (
    <div className="be-din-diagram">
      <div className="be-din-diagram-header" style={{ height: `${headerHeight}px` }} />
      <div className="be-din-diagram-addr" style={{ top: `${addrTop}px`, height: '9px' }} />
      <div className="be-din-diagram-lines" style={{ top: `${addrTop + 14}px` }}>
        <div className="be-din-diagram-line" />
        <div className="be-din-diagram-line" />
        <div className="be-din-diagram-line" />
      </div>
      <div className="be-din-diagram-footer" />
    </div>
  );
}

// ── TipTap Footer-Toolbar ──────────────────────────────────────────────────────
function FooterToolbar({ editor }) {
  if (!editor) return null;

  const btn = (active, onClick, title, icon) => (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      title={title}
      className={`be-tiptap-btn${active ? ' be-tiptap-btn--active' : ''}`}
    >{icon}</button>
  );

  return (
    <div className="be-tiptap-toolbar">
      {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Fett', <Bold size={13} />)}
      {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Kursiv', <Italic size={13} />)}
      {btn(editor.isActive('link'), () => {
        const url = window.prompt('URL:');
        if (url) editor.chain().focus().setLink({ href: url }).run();
        else editor.chain().focus().unsetLink().run();
      }, 'Link', <LinkIcon size={13} />)}
    </div>
  );
}

// ── Status-Badge ───────────────────────────────────────────────────────────────
function StatusBadge({ msg, err }) {
  if (!msg) return null;
  return (
    <span className={`be-save-status${err ? ' be-save-status--error' : ''}`}>
      {err ? <AlertCircle size={14} /> : <Check size={14} />}
      {msg}
    </span>
  );
}

// ── Auf-/Einklappbare Section ─────────────────────────────────────────────────
function CollapsibleSection({ icon, title, open, onToggle, children }) {
  return (
    <div className="be-section">
      <button
        type="button"
        className="be-section-header be-section-header--toggle"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="be-section-header-left">
          {icon}
          {title}
        </span>
        <ChevronDown
          size={16}
          className={`be-section-chevron${open ? ' be-section-chevron--open' : ''}`}
        />
      </button>
      {open && <div className="be-section-body">{children}</div>}
    </div>
  );
}

// ── Haupt-Komponente ───────────────────────────────────────────────────────────
export default function BriefEinstellungenTab({ profile, onProfileChanged }) {
  const { activeDojo } = useDojoContext();
  const withDojo = (url) => activeDojo?.id ? `${url}${url.includes('?') ? '&' : '?'}dojo_id=${activeDojo.id}` : url;

  // ── Dojo-Stammdaten-State ────────────────────────────────────────────────────
  const [dojoForm, setDojoForm] = useState(DOJO_FORM_EMPTY);
  const [dojoLaden, setDojoLaden] = useState(true);
  const [dojoSpeichern, setDojoSpeichern] = useState(false);
  const [dojoStatus, setDojoStatus] = useState({ msg: '', err: false });

  // ── Bankverbindungen-State ────────────────────────────────────────────────────
  const [banken, setBanken] = useState([]);
  const [bankForm, setBankForm] = useState(null); // null = nicht aktiv, obj = editieren/anlegen

  // ── Logo-State ────────────────────────────────────────────────────────────────
  const [logo, setLogo] = useState(null); // { logo_id, file_name, url }
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef(null);

  // ── Brief-Einstellungen-State ─────────────────────────────────────────────────
  const [form, setForm] = useState({
    din_format: 'din5008a',
    margin_top_mm: 27.00,
    margin_bottom_mm: 26.46,
    margin_left_mm: 25.00,
    margin_right_mm: 20.00,
    font_family: 'Helvetica',
    font_size_pt: 10.0,
    line_height: 1.60,
    footer_show_contact: true,
    footer_show_inhaber: true,
    footer_inhaber_aus_stammdaten: false,
    footer_bank_ids: [],
    standard_profil_id: '',
    farbe_primaer: null, // null = Profilfarbe, 'none' = keine Farbe, '#rrggbb' = eigene Farbe
    logo_position: 'rechts',
  });
  const [laden, setLaden] = useState(true);
  const [speichern, setSpeichern] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [statusErr, setStatusErr] = useState(false);

  // ── Vorschau ──────────────────────────────────────────────────────────────────
  const [previewHtml, setPreviewHtml] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [vorschauProfilId, setVorschauProfilId] = useState('');

  // ── Absender-Profile Modal ────────────────────────────────────────────────────
  const [profileModalOffen, setProfileModalOffen] = useState(false);
  const [editProfil, setEditProfil] = useState(null);

  // ── Auf-/Eingeklappt-State (alle Sections standardmäßig offen) ───────────────
  const [open, setOpen] = useState({
    stammdaten: true,
    logo: true,
    layout: false,
    fusszeile: false,
    profile: false,
    standard: false,
  });
  const toggle = (key) => setOpen(o => ({ ...o, [key]: !o[key] }));

  // ── TipTap für freien Footer-Text ─────────────────────────────────────────────
  const footerEditor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false })],
    content: '',
  });

  // ── Daten laden ───────────────────────────────────────────────────────────────
  const ladeDojo = useCallback(async () => {
    if (!activeDojo?.id) return;
    setDojoLaden(true);
    try {
      const res = await axios.get(withDojo('/dojo-einstellungen'));
      const d = res.data.dojo || {};
      setDojoForm({
        dojoname: d.dojoname || '',
        inhaber: d.inhaber || '',
        strasse: d.strasse || '',
        hausnummer: d.hausnummer || '',
        plz: d.plz || '',
        ort: d.ort || '',
        telefon: d.telefon || '',
        email: d.email || '',
        internet: d.internet || '',
        steuernummer: d.steuernummer || '',
        ust_id: d.ust_id || '',
        sepa_glaeubiger_id: d.sepa_glaeubiger_id || '',
      });
    } catch {
      // silent
    } finally {
      setDojoLaden(false);
    }
  }, [activeDojo]);

  const ladeBanken = useCallback(async () => {
    if (!activeDojo?.id) return;
    try {
      const res = await axios.get(withDojo('/dojo-einstellungen/banken'));
      setBanken(res.data.banken || []);
    } catch {
      // silent
    }
  }, [activeDojo]);

  const ladeLogo = useCallback(async () => {
    if (!activeDojo?.id) return;
    try {
      const res = await axios.get(`/dojos/${activeDojo.id}/logos`);
      const haupt = (res.data || []).find(l => l.logo_type === 'haupt');
      setLogo(haupt ? { logo_id: haupt.logo_id, file_name: haupt.file_name, url: haupt.url } : null);
    } catch {
      // silent — kein Logo vorhanden
    }
  }, [activeDojo]);

  const ladeEinstellungen = useCallback(async () => {
    setLaden(true);
    try {
      const res = await axios.get(withDojo('/brief-einstellungen'));
      const e = res.data.einstellungen || {};
      let bankIds = [];
      try {
        bankIds = typeof e.footer_bank_ids === 'string'
          ? JSON.parse(e.footer_bank_ids || '[]')
          : (e.footer_bank_ids || []);
      } catch { /* ignore */ }
      setForm({
        din_format: e.din_format || 'din5008a',
        margin_top_mm: e.margin_top_mm ?? 27.00,
        margin_bottom_mm: e.margin_bottom_mm ?? 26.46,
        margin_left_mm: e.margin_left_mm ?? 25.00,
        margin_right_mm: e.margin_right_mm ?? 20.00,
        font_family: e.font_family || 'Helvetica',
        font_size_pt: e.font_size_pt ?? 10.0,
        line_height: e.line_height ?? 1.60,
        footer_show_contact: e.footer_show_contact !== 0,
        footer_show_inhaber: e.footer_show_inhaber !== 0,
        footer_inhaber_aus_stammdaten: !!e.footer_inhaber_aus_stammdaten,
        footer_bank_ids: bankIds,
        standard_profil_id: e.standard_profil_id ?? '',
        farbe_primaer: e.farbe_primaer ?? null,
        logo_position: e.logo_position || 'rechts',
      });
      if (footerEditor && e.footer_custom_html) {
        footerEditor.commands.setContent(e.footer_custom_html || '');
      }
    } catch {
      // Defaults bleiben
    } finally {
      setLaden(false);
    }
  }, [activeDojo, footerEditor]);

  useEffect(() => {
    ladeDojo();
    ladeBanken();
    ladeLogo();
    ladeEinstellungen();
  }, [ladeDojo, ladeBanken, ladeLogo, ladeEinstellungen]);

  // ── Handlers: Dojo-Stammdaten ─────────────────────────────────────────────────
  function handleDojoChange(e) {
    const { name, value } = e.target;
    setDojoForm(f => ({ ...f, [name]: value }));
  }

  async function handleDojoSpeichern() {
    setDojoSpeichern(true);
    setDojoStatus({ msg: '', err: false });
    try {
      await axios.put(withDojo('/dojo-einstellungen'), dojoForm);
      setDojoStatus({ msg: 'Stammdaten gespeichert', err: false });
    } catch (err) {
      setDojoStatus({ msg: err.response?.data?.error || 'Fehler beim Speichern', err: true });
    } finally {
      setDojoSpeichern(false);
      setTimeout(() => setDojoStatus({ msg: '', err: false }), 4000);
    }
  }

  // ── Handlers: Bankverbindungen ────────────────────────────────────────────────
  async function handleSaveBank() {
    if (!bankForm) return;
    try {
      if (bankForm.id) {
        await axios.put(withDojo(`/dojo-einstellungen/banken/${bankForm.id}`), bankForm);
      } else {
        await axios.post(withDojo('/dojo-einstellungen/banken'), bankForm);
      }
      setBankForm(null);
      await ladeBanken();
    } catch {
      alert('Fehler beim Speichern der Bankverbindung');
    }
  }

  async function handleDeleteBank(id) {
    if (!window.confirm('Bankverbindung wirklich löschen?')) return;
    try {
      await axios.delete(withDojo(`/dojo-einstellungen/banken/${id}`));
      setBanken(bs => bs.filter(b => b.id !== id));
      // Aus footer_bank_ids entfernen
      setForm(f => ({ ...f, footer_bank_ids: (f.footer_bank_ids || []).filter(bid => bid !== id) }));
    } catch {
      alert('Löschen fehlgeschlagen');
    }
  }

  // ── Handlers: Logo ────────────────────────────────────────────────────────────
  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !activeDojo?.id) return;
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      await axios.post(`/dojos/${activeDojo.id}/logos/haupt`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await ladeLogo();
    } catch (err) {
      alert(err.response?.data?.error || 'Logo-Upload fehlgeschlagen');
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  }

  async function handleLogoLoeschen() {
    if (!logo || !window.confirm('Logo wirklich löschen?')) return;
    try {
      await axios.delete(`/dojos/${activeDojo.id}/logos/${logo.logo_id}`);
      setLogo(null);
    } catch {
      alert('Löschen fehlgeschlagen');
    }
  }

  // ── Handlers: Brief-Einstellungen ─────────────────────────────────────────────
  function waehleDin(format) {
    const preset = DIN_PRESETS[format];
    setForm(f => ({ ...f, din_format: format, ...(preset || {}) }));
  }

  async function handleSpeichern() {
    setSpeichern(true);
    setStatusMsg('');
    setStatusErr(false);
    try {
      const payload = {
        ...form,
        footer_show_bank: 1, // backward compat
        footer_show_contact: form.footer_show_contact ? 1 : 0,
        footer_show_inhaber: form.footer_show_inhaber ? 1 : 0,
        footer_inhaber_aus_stammdaten: form.footer_inhaber_aus_stammdaten ? 1 : 0,
        footer_custom_html: footerEditor ? footerEditor.getHTML() : '',
        footer_bank_ids: form.footer_bank_ids || [],
        standard_profil_id: form.standard_profil_id || null,
        farbe_primaer: form.farbe_primaer || null,
      };
      await axios.put(withDojo('/brief-einstellungen'), payload);
      setStatusMsg('Einstellungen gespeichert');
    } catch (err) {
      setStatusMsg(err.response?.data?.error || 'Fehler beim Speichern');
      setStatusErr(true);
    } finally {
      setSpeichern(false);
      setTimeout(() => setStatusMsg(''), 4000);
    }
  }

  function handleReset() {
    waehleDin('din5008a');
    setForm(f => ({ ...f, font_family: 'Helvetica', font_size_pt: 10.0, line_height: 1.60, footer_show_contact: true, footer_show_inhaber: true, farbe_primaer: null }));
    footerEditor?.commands.clearContent();
  }

  async function handleVorschau(profilIdOverride) {
    setPreviewLoading(true);
    try {
      const settings = {
        ...form,
        footer_show_bank: 1,
        footer_show_contact: form.footer_show_contact ? 1 : 0,
        footer_show_inhaber: form.footer_show_inhaber ? 1 : 0,
        footer_inhaber_aus_stammdaten: form.footer_inhaber_aus_stammdaten ? 1 : 0,
        footer_custom_html: footerEditor ? footerEditor.getHTML() : '',
        footer_bank_ids: form.footer_bank_ids || [],
        farbe_primaer: form.farbe_primaer || null,
      };
      const pid = profilIdOverride !== undefined ? profilIdOverride : vorschauProfilId;
      const res = await axios.post(withDojo('/brief-einstellungen/vorschau'), {
        settings,
        absender_profil_id: pid || null,
      }, { responseType: 'text' });
      setPreviewHtml(res.data);
    } catch {
      alert('Vorschau konnte nicht geladen werden');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleProfilLoeschen(profil) {
    if (!window.confirm(`Profil "${profil.name}" wirklich löschen?`)) return;
    try {
      await axios.delete(withDojo(`/absender-profile/${profil.id}`));
      onProfileChanged && onProfileChanged();
    } catch {
      alert('Löschen fehlgeschlagen');
    }
  }

  // ── Primärfarbe-Modus ─────────────────────────────────────────────────────────
  function farbeModus() {
    if (form.farbe_primaer === null) return 'profile';
    if (form.farbe_primaer === 'none') return 'none';
    return 'custom';
  }

  function setFarbeModus(modus) {
    if (modus === 'profile') setForm(f => ({ ...f, farbe_primaer: null }));
    else if (modus === 'none') setForm(f => ({ ...f, farbe_primaer: 'none' }));
    else setForm(f => ({ ...f, farbe_primaer: f.farbe_primaer && f.farbe_primaer !== 'none' ? f.farbe_primaer : '#8B0000' }));
  }

  if (laden && dojoLaden) {
    return <div style={{ padding: '2rem', color: 'var(--text-secondary, #aaa)' }}>Einstellungen werden geladen…</div>;
  }

  return (
    <div className="be-root">

      {/* ── Dojo-Indikator: zeigt welches Dojo gerade konfiguriert wird ── */}
      {activeDojo && activeDojo.id !== 'all' && (
        <div className="be-dojo-indicator">
          <Building2 size={14} />
          Einstellungen für: <strong>{activeDojo.dojoname || activeDojo.name || `Dojo ${activeDojo.id}`}</strong>
        </div>
      )}

      {/* ── Zweispaltige Oberfläche: Links Stammdaten, Rechts Logo + Layout ── */}
      <div className="be-cols-top">
      <div className="be-col-left">

      {/* ── Section 0: Dojo-Stammdaten ───────────────────────────────────────── */}
      <CollapsibleSection
        icon={<Building2 size={16} className="be-section-icon" />}
        title="Dojo-Stammdaten"
        open={open.stammdaten}
        onToggle={() => toggle('stammdaten')}
      >

          {/* Allgemein */}
          <div className="be-subsection-title">Allgemein</div>
          <div className="be-grid-2">
            <div>
              <label className="be-field-label">Dojo- / Vereinsname</label>
              <input name="dojoname" value={dojoForm.dojoname} onChange={handleDojoChange} className="be-input" placeholder="z.B. Kampfkunstschule Muster e.V." />
            </div>
            <div>
              <label className="be-field-label">Inhaber / Vorstand</label>
              <input name="inhaber" value={dojoForm.inhaber} onChange={handleDojoChange} className="be-input" placeholder="Max Mustermann" />
            </div>
          </div>

          {/* Adresse */}
          <div className="be-subsection-title">Adresse</div>
          <div className="be-grid-addr-zeile1">
            <div>
              <label className="be-field-label">Straße</label>
              <input name="strasse" value={dojoForm.strasse} onChange={handleDojoChange} className="be-input" placeholder="Hauptstraße" />
            </div>
            <div>
              <label className="be-field-label">Nr.</label>
              <input name="hausnummer" value={dojoForm.hausnummer} onChange={handleDojoChange} className="be-input" placeholder="12" />
            </div>
          </div>
          <div className="be-grid-addr-zeile2">
            <div>
              <label className="be-field-label">PLZ</label>
              <input name="plz" value={dojoForm.plz} onChange={handleDojoChange} className="be-input" placeholder="80333" />
            </div>
            <div>
              <label className="be-field-label">Ort</label>
              <input name="ort" value={dojoForm.ort} onChange={handleDojoChange} className="be-input" placeholder="München" />
            </div>
          </div>

          {/* Kontakt */}
          <div className="be-subsection-title">
            <Phone size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Kontakt
          </div>
          <div className="be-grid-3">
            <div>
              <label className="be-field-label">Telefon</label>
              <input name="telefon" value={dojoForm.telefon} onChange={handleDojoChange} className="be-input" placeholder="+49 89 12345678" />
            </div>
            <div>
              <label className="be-field-label">E-Mail</label>
              <input name="email" type="email" value={dojoForm.email} onChange={handleDojoChange} className="be-input" placeholder="info@mein-dojo.de" />
            </div>
            <div>
              <label className="be-field-label">
                <Globe size={12} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                Website
              </label>
              <input name="internet" value={dojoForm.internet} onChange={handleDojoChange} className="be-input" placeholder="www.mein-dojo.de" />
            </div>
          </div>

          {/* Bankverbindungen */}
          <div className="be-subsection-title">
            <CreditCard size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Bankverbindungen
          </div>

          {banken.map(b => (
            <div key={b.id} className="be-bank-item">
              <div className="be-bank-item-info">
                <span className="be-bank-item-bezeichnung">{b.bezeichnung}</span>
                <span className="be-bank-item-detail">
                  {b.bank_name || ''}
                  {b.bank_iban ? ` · IBAN: ${b.bank_iban}` : ''}
                </span>
              </div>
              <div className="be-bank-item-btns">
                <button className="be-profil-icon-btn" title="Bearbeiten" onClick={() => setBankForm({ ...b })}>
                  <Edit size={13} />
                </button>
                <button className="be-profil-icon-btn be-profil-icon-btn--danger" title="Löschen" onClick={() => handleDeleteBank(b.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}

          {bankForm && (
            <div className="be-bank-form">
              <div>
                <label className="be-field-label">Bezeichnung</label>
                <input className="be-input" placeholder="z.B. Hauptkonto, Sonderkonto" value={bankForm.bezeichnung || ''} onChange={e => setBankForm(f => ({ ...f, bezeichnung: e.target.value }))} />
              </div>
              <div className="be-grid-2">
                <div>
                  <label className="be-field-label">Bank / Institut</label>
                  <input className="be-input" placeholder="Sparkasse München" value={bankForm.bank_name || ''} onChange={e => setBankForm(f => ({ ...f, bank_name: e.target.value }))} />
                </div>
                <div>
                  <label className="be-field-label">Kontoinhaber</label>
                  <input className="be-input" placeholder="Muster e.V." value={bankForm.bank_inhaber || ''} onChange={e => setBankForm(f => ({ ...f, bank_inhaber: e.target.value }))} />
                </div>
              </div>
              <div className="be-grid-2">
                <div>
                  <label className="be-field-label">IBAN</label>
                  <input className="be-input be-input--mono" placeholder="DE89 3704 0044 …" value={bankForm.bank_iban || ''} onChange={e => setBankForm(f => ({ ...f, bank_iban: e.target.value }))} />
                </div>
                <div>
                  <label className="be-field-label">BIC</label>
                  <input className="be-input be-input--mono" placeholder="COBADEFFXXX" value={bankForm.bank_bic || ''} onChange={e => setBankForm(f => ({ ...f, bank_bic: e.target.value }))} />
                </div>
              </div>
              <div className="be-bank-form-btns">
                <button className="be-btn be-btn--ghost" onClick={() => setBankForm(null)}>Abbrechen</button>
                <button className="be-btn be-btn--primary" onClick={handleSaveBank}><Check size={14} /> Speichern</button>
              </div>
            </div>
          )}

          {!bankForm && (
            <button className="be-add-bank-btn" onClick={() => setBankForm({ ...BANK_FORM_EMPTY })}>
              <Plus size={14} /> Bankverbindung hinzufügen
            </button>
          )}

          {/* Steuer */}
          <div className="be-subsection-title">Steuer & Rechtliches</div>
          <div className="be-grid-3">
            <div>
              <label className="be-field-label">Steuernummer</label>
              <input name="steuernummer" value={dojoForm.steuernummer} onChange={handleDojoChange} className="be-input" placeholder="123/456/78901" />
            </div>
            <div>
              <label className="be-field-label">USt-IdNr.</label>
              <input name="ust_id" value={dojoForm.ust_id} onChange={handleDojoChange} className="be-input" placeholder="DE123456789" />
            </div>
            <div>
              <label className="be-field-label">SEPA-Gläubiger-ID</label>
              <input name="sepa_glaeubiger_id" value={dojoForm.sepa_glaeubiger_id} onChange={handleDojoChange} className="be-input" placeholder="DE98ZZZ09999999999" />
            </div>
          </div>

          {/* Speichern-Leiste */}
          <div className="be-inline-save">
            <StatusBadge msg={dojoStatus.msg} err={dojoStatus.err} />
            <button className="be-btn be-btn--primary" onClick={handleDojoSpeichern} disabled={dojoSpeichern}>
              <Check size={14} />
              {dojoSpeichern ? 'Speichern…' : 'Stammdaten speichern'}
            </button>
          </div>

      </CollapsibleSection>

      </div>{/* end be-col-left */}
      <div className="be-col-right">

      {/* ── Section 1: Logo ──────────────────────────────────────────────────── */}
      <CollapsibleSection
        icon={<Camera size={16} className="be-section-icon" />}
        title="Dojo-Logo"
        open={open.logo}
        onToggle={() => toggle('logo')}
      >
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
            style={{ display: 'none' }}
            onChange={handleLogoUpload}
          />

          {logo ? (
            <div className="be-logo-preview-wrap">
              <div className="be-logo-preview">
                <img src={logo.url} alt="Dojo-Logo" className="be-logo-img" />
              </div>
              <div className="be-logo-actions">
                <button className="be-btn be-btn--ghost" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}>
                  <Upload size={14} /> {logoUploading ? 'Lädt…' : 'Logo ändern'}
                </button>
                <button className="be-btn be-btn--ghost be-btn--danger" onClick={handleLogoLoeschen}>
                  <Trash2 size={14} /> Löschen
                </button>
              </div>
              <p className="be-field-hint">Erscheint im Briefkopf der PDFs. Empfohlen: PNG mit transparentem Hintergrund, mind. 300×100 px.</p>
            </div>
          ) : (
            <div>
              <div
                className={`be-logo-zone${logoUploading ? ' be-logo-zone--uploading' : ''}`}
                onClick={() => !logoUploading && logoInputRef.current?.click()}
              >
                <Camera size={28} className="be-logo-zone-icon" />
                <span className="be-logo-zone-title">{logoUploading ? 'Wird hochgeladen…' : 'Logo hochladen'}</span>
                <span className="be-logo-zone-hint">PNG, JPG, SVG oder WebP — max. 2 MB</span>
              </div>
              <p className="be-field-hint">Das Logo erscheint im Briefkopf aller PDFs und Vorlagen.</p>
            </div>
          )}

          {/* ── Logo-Position ───────────────────────────────────────────────── */}
          <div className="be-field-group" style={{ marginTop: '12px' }}>
            <label className="be-label">Logo-Position im Briefkopf</label>
            <div className="be-logo-pos-row">
              {[
                { val: 'links',  label: '← Links'  },
                { val: 'mitte',  label: '⊙ Mitte'  },
                { val: 'rechts', label: 'Rechts →' },
              ].map(({ val, label }) => (
                <button
                  key={val}
                  type="button"
                  className={`be-logo-pos-btn${form.logo_position === val ? ' be-logo-pos-btn--active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, logo_position: val }))}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
      </CollapsibleSection>

      {/* ── Section 2: Briefbogen-Layout ─────────────────────────────────────── */}
      <CollapsibleSection
        icon={<Layout size={16} className="be-section-icon" />}
        title="Briefbogen-Layout (DIN 5008)"
        open={open.layout}
        onToggle={() => toggle('layout')}
      >

          <div className="be-din-cards">
            {[
              { id: 'din5008a', title: 'DIN 5008 A', desc: 'Oben 27mm\nAnschriftfeld ab 45mm' },
              { id: 'din5008b', title: 'DIN 5008 B', desc: 'Oben 45mm\nAnschriftfeld ab 70mm' },
              { id: 'custom', title: 'Benutzerdefiniert', desc: 'Eigene Ränder\nfrei wählen' },
            ].map(({ id, title, desc }) => (
              <div
                key={id}
                className={`be-din-card${form.din_format === id ? ' be-din-card--active' : ''}`}
                onClick={() => waehleDin(id)}
              >
                <DinDiagram format={id} />
                <div className="be-din-card-title">{title}</div>
                <div className="be-din-card-desc">{desc}</div>
              </div>
            ))}
          </div>

          {form.din_format === 'custom' && (
            <div className="be-margin-grid">
              {[
                { key: 'margin_top_mm', label: 'Oben (mm)' },
                { key: 'margin_right_mm', label: 'Rechts (mm)' },
                { key: 'margin_bottom_mm', label: 'Unten (mm)' },
                { key: 'margin_left_mm', label: 'Links (mm)' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="be-field-label">{label}</label>
                  <input
                    type="number" step="0.5" min="0" max="100"
                    className="be-input"
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="be-font-row">
            <div>
              <label className="be-field-label">Schriftart</label>
              <select className="be-select" value={form.font_family} onChange={e => setForm(f => ({ ...f, font_family: e.target.value }))}>
                {FONT_FAMILIES.map(ff => <option key={ff} value={ff}>{ff}</option>)}
              </select>
            </div>
            <div>
              <label className="be-field-label">Größe (pt)</label>
              <select className="be-select" value={form.font_size_pt} onChange={e => setForm(f => ({ ...f, font_size_pt: parseFloat(e.target.value) }))}>
                {FONT_SIZES.map(s => <option key={s} value={s}>{s} pt</option>)}
              </select>
            </div>
            <div>
              <label className="be-field-label">Zeilenabstand: {Number(form.line_height).toFixed(2)}</label>
              <div className="be-slider-row">
                <input
                  type="range" className="be-slider"
                  min="1.0" max="2.5" step="0.05"
                  value={form.line_height}
                  onChange={e => setForm(f => ({ ...f, line_height: parseFloat(e.target.value) }))}
                />
              </div>
            </div>
          </div>

          {/* Primärfarbe */}
          <div>
            <label className="be-field-label">Briefkopf-Primärfarbe</label>
            <div className="be-farbe-swatches-row">
              {/* Profilfarbe-Kreis */}
              <button
                type="button"
                title="Profilfarbe verwenden"
                className={`be-swatch be-swatch--profile${farbeModus() === 'profile' ? ' be-swatch--active' : ''}`}
                onClick={() => setFarbeModus('profile')}
              />
              {/* Keine-Farbe-Kreis */}
              <button
                type="button"
                title="Keine Farbe"
                className={`be-swatch be-swatch--none${farbeModus() === 'none' ? ' be-swatch--active' : ''}`}
                onClick={() => setFarbeModus('none')}
              />
              {/* Farb-Swatches */}
              {FARBE_SWATCHES.map(c => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  onClick={() => { setFarbeModus('custom'); setForm(f => ({ ...f, farbe_primaer: c })); }}
                  className={`be-swatch${farbeModus() === 'custom' && form.farbe_primaer === c ? ' be-swatch--active' : ''}`}
                  style={{ background: c }}
                />
              ))}
              {/* Eigene Farbe: Color-Picker-Kreis */}
              <input
                type="color"
                title="Eigene Farbe wählen"
                value={farbeModus() === 'custom' && form.farbe_primaer && form.farbe_primaer !== 'none' ? form.farbe_primaer : '#8B0000'}
                onChange={e => { setFarbeModus('custom'); setForm(f => ({ ...f, farbe_primaer: e.target.value })); }}
                className={`be-swatch be-color-swatch-input${farbeModus() === 'custom' && !FARBE_SWATCHES.includes(form.farbe_primaer) ? ' be-swatch--active' : ''}`}
              />
            </div>
            <p className="be-field-hint">
              {farbeModus() === 'profile' && 'Profilfarbe — Farbe aus dem Absender-Profil wird verwendet.'}
              {farbeModus() === 'none' && 'Keine Farbe — keine Farbbalken im Briefkopf und Fußzeile.'}
              {farbeModus() === 'custom' && `Eigene Farbe: ${form.farbe_primaer || ''} — überschreibt die Profilfarbe.`}
            </p>
          </div>

      </CollapsibleSection>

      </div>{/* end be-col-right */}
      </div>{/* end be-cols-top */}

      {/* ── Section 3: Fußzeile ──────────────────────────────────────────────── */}
      <CollapsibleSection
        icon={<PanelBottom size={16} className="be-section-icon" />}
        title="Fußzeile konfigurieren"
        open={open.fusszeile}
        onToggle={() => toggle('fusszeile')}
      >

          {/* Bankverbindungen — Dropdown + Tags */}
          <div>
            <label className="be-field-label">Bankverbindungen in Fußzeile</label>
            {banken.length === 0 ? (
              <p className="be-field-hint">Keine Bankverbindungen hinterlegt — bitte zuerst in den Stammdaten anlegen.</p>
            ) : (
              <div>
                {(form.footer_bank_ids || []).length > 0 && (
                  <div className="be-bank-tags">
                    {(form.footer_bank_ids || []).map(id => {
                      const bank = banken.find(b => b.id === id);
                      if (!bank) return null;
                      return (
                        <span key={id} className="be-bank-tag">
                          {bank.bezeichnung}
                          {bank.bank_iban ? ` · ${bank.bank_iban.slice(0, 8)}…` : ''}
                          <button
                            type="button"
                            className="be-bank-tag-remove"
                            onClick={() => setForm(f => ({ ...f, footer_bank_ids: (f.footer_bank_ids || []).filter(bid => bid !== id) }))}
                            title="Entfernen"
                          >×</button>
                        </span>
                      );
                    })}
                  </div>
                )}
                {banken.filter(b => !(form.footer_bank_ids || []).includes(b.id)).length > 0 ? (
                  <select
                    className="be-select be-bank-add-select"
                    value=""
                    onChange={e => {
                      const id = parseInt(e.target.value);
                      if (id && !(form.footer_bank_ids || []).includes(id)) {
                        setForm(f => ({ ...f, footer_bank_ids: [...(f.footer_bank_ids || []), id] }));
                      }
                    }}
                  >
                    <option value="">+ Bankverbindung zur Fußzeile hinzufügen…</option>
                    {banken.filter(b => !(form.footer_bank_ids || []).includes(b.id)).map(b => (
                      <option key={b.id} value={b.id}>
                        {b.bezeichnung}{b.bank_iban ? ` (${b.bank_iban.slice(0, 8)}…)` : ''}
                      </option>
                    ))}
                  </select>
                ) : (form.footer_bank_ids || []).length > 0 ? (
                  <p className="be-field-hint">Alle Bankverbindungen sind bereits in der Fußzeile.</p>
                ) : null}
              </div>
            )}
          </div>

          {/* Kontakt & Inhaber */}
          <div>
            <label className="be-field-label">Weitere Fußzeilen-Elemente</label>
            <div className="be-toggle-row">
              <label className="be-toggle-label">
                <input type="checkbox" checked={!!form.footer_show_contact} onChange={e => setForm(f => ({ ...f, footer_show_contact: e.target.checked }))} />
                Kontakt (Tel./E-Mail)
              </label>
              <label className="be-toggle-label">
                <input type="checkbox" checked={!!form.footer_show_inhaber} onChange={e => setForm(f => ({ ...f, footer_show_inhaber: e.target.checked }))} />
                Inhaber / Signatur
              </label>
            </div>
            {form.footer_show_inhaber && (
              <div className="be-inhaber-source-row">
                <span className="be-field-hint" style={{ marginTop: 0, alignSelf: 'center' }}>Inhaber-Name:</span>
                <label className="be-toggle-label">
                  <input type="radio" name="inhaber_source" checked={!form.footer_inhaber_aus_stammdaten} onChange={() => setForm(f => ({ ...f, footer_inhaber_aus_stammdaten: false }))} />
                  Aus Profil
                </label>
                <label className="be-toggle-label">
                  <input type="radio" name="inhaber_source" checked={!!form.footer_inhaber_aus_stammdaten} onChange={() => setForm(f => ({ ...f, footer_inhaber_aus_stammdaten: true }))} />
                  Aus Stammdaten{dojoForm.inhaber ? ` (${dojoForm.inhaber})` : ''}
                </label>
              </div>
            )}
          </div>

          <div>
            <label className="be-field-label">Freier Text in der Fußzeile (optional)</label>
            <div className="be-tiptap-wrapper">
              <FooterToolbar editor={footerEditor} />
              <div className="be-tiptap-content">
                <EditorContent editor={footerEditor} />
              </div>
            </div>
            <p className="be-field-hint">Erscheint auf jeder PDF-Seite — z.B. Haftungsausschluss, Vereinsregisternummer.</p>
          </div>

      </CollapsibleSection>

      {/* ── Section 4: Absender-Profile ──────────────────────────────────────── */}
      <CollapsibleSection
        icon={<UserCircle size={16} className="be-section-icon" />}
        title="Absender-Profile"
        open={open.profile}
        onToggle={() => toggle('profile')}
      >
          <div className="be-profile-header">
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #aaa)' }}>
              Briefköpfe und Absender-Daten für Ihre Korrespondenz
            </span>
            <button className="be-new-profil-btn" onClick={() => { setEditProfil(null); setProfileModalOffen(true); }}>
              <Plus size={14} /> Neues Profil
            </button>
          </div>

          {profile.length === 0 ? (
            <div className="be-profil-empty">Noch keine Absender-Profile angelegt.</div>
          ) : (
            <div className="be-profile-grid">
              {profile.map(p => (
                <div key={p.id} className="be-profil-card" style={{ '--pc': p.farbe_primaer || 'var(--primary, #c9a227)', '--pc22': p.farbe_primaer ? `${p.farbe_primaer}22` : 'rgba(201,162,39,0.15)' }}>
                  <div className="be-profil-card-top" />
                  <div className="be-profil-card-header">
                    <div>
                      <div className="be-profil-name">{p.name}</div>
                      <span className="be-profil-type-badge">{p.typ}</span>
                    </div>
                    <div className="be-profil-icon-btns">
                      <button className="be-profil-icon-btn" title="Bearbeiten" onClick={() => { setEditProfil(p); setProfileModalOffen(true); }}>
                        <Edit size={13} />
                      </button>
                      <button className="be-profil-icon-btn be-profil-icon-btn--danger" title="Löschen" onClick={() => handleProfilLoeschen(p)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="be-profil-info">
                    {p.organisation && <div className="be-profil-info-row">{p.organisation}</div>}
                    {p.strasse && <div className="be-profil-info-row">{p.strasse}, {p.plz} {p.ort}</div>}
                    {p.telefon && <div className="be-profil-info-row">{p.telefon}</div>}
                    {p.email && <div className="be-profil-info-row">{p.email}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
      </CollapsibleSection>

      {/* ── Section 5: Standard-Einstellungen ────────────────────────────────── */}
      <CollapsibleSection
        icon={<Star size={16} className="be-section-icon" />}
        title="Standard-Einstellungen"
        open={open.standard}
        onToggle={() => toggle('standard')}
      >
          <div>
            <label className="be-field-label">Standard-Absender-Profil</label>
            <div className="be-default-row">
              <select className="be-select" value={form.standard_profil_id} onChange={e => setForm(f => ({ ...f, standard_profil_id: e.target.value }))}>
                <option value="">— Kein Standard —</option>
                {profile.map(p => <option key={p.id} value={p.id}>{p.name} ({p.typ})</option>)}
              </select>
            </div>
            <p className="be-field-hint">Wird bei neuen Vorlagen und neuen Dokumenten automatisch vorbelegt.</p>
          </div>
      </CollapsibleSection>

      {/* ── Globale Speichern-Leiste (Brief-Einstellungen) ────────────────────── */}
      <div className="be-save-bar">
        <div>
          {statusMsg && (
            <span className={`be-save-status${statusErr ? ' be-save-status--error' : ''}`}>
              {statusErr ? <AlertCircle size={14} /> : <Check size={14} />}
              {statusMsg}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="be-btn be-btn--ghost" onClick={handleReset}>Zurücksetzen</button>
          <div className="be-vorschau-group">
            {profile.length > 0 && (
              <select
                className="be-select be-vorschau-profil-select"
                value={vorschauProfilId}
                onChange={e => setVorschauProfilId(e.target.value)}
                title="Absender-Profil für Vorschau"
              >
                <option value="">— Dojo-Stammdaten —</option>
                {profile.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.typ})</option>
                ))}
              </select>
            )}
            <button className="be-btn be-btn--ghost" onClick={() => handleVorschau()} disabled={previewLoading}>
              <Eye size={14} /> {previewLoading ? 'Lädt…' : 'Vorschau'}
            </button>
          </div>
          <button className="be-btn be-btn--primary" onClick={handleSpeichern} disabled={speichern}>
            <Settings size={14} /> {speichern ? 'Speichern…' : 'Briefeinstellungen speichern'}
          </button>
        </div>
      </div>

      {/* ── Absender-Profil Modal ─────────────────────────────────────────────── */}
      {profileModalOffen && (
        <AbsenderProfileModal
          profil={editProfil}
          onClose={() => { setProfileModalOffen(false); setEditProfil(null); }}
          onSaved={() => { setProfileModalOffen(false); setEditProfil(null); onProfileChanged && onProfileChanged(); }}
        />
      )}

      {/* ── Vorschau-Modal via Portal ─────────────────────────────────────────── */}
      {(previewLoading || previewHtml) && ReactDOM.createPortal(
        <div className="be-preview-overlay" onClick={() => { setPreviewHtml(null); }}>
          <div className="be-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="be-preview-bar">
              <span className="be-preview-bar-title">Brief-Vorschau</span>
              {profile.length > 0 && (
                <div className="be-preview-profil-row">
                  <span className="be-preview-profil-label">Absender:</span>
                  <select
                    className="be-select be-preview-profil-select"
                    value={vorschauProfilId}
                    onChange={e => {
                      setVorschauProfilId(e.target.value);
                      handleVorschau(e.target.value);
                    }}
                  >
                    <option value="">— Dojo-Stammdaten —</option>
                    {profile.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.typ})</option>
                    ))}
                  </select>
                </div>
              )}
              <button onClick={() => setPreviewHtml(null)} className="be-preview-close">
                <X size={16} /> Schließen
              </button>
            </div>
            {previewLoading
              ? <div className="be-preview-loading">Vorschau wird generiert…</div>
              : <iframe srcDoc={previewHtml} title="Brief-Vorschau" className="be-preview-iframe" sandbox="allow-scripts" />
            }
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
