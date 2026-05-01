import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import '../styles/MarketingHub.css';

const PLATFORM_ICON = { facebook: '📘', instagram: '📸' };
const STATUS_LABEL  = { draft: 'Entwurf', scheduled: 'Geplant', published: 'Veröffentlicht', failed: 'Fehler' };
const STATUS_COLOR  = { draft: '#888', scheduled: '#f59e0b', published: '#22c55e', failed: '#ef4444' };

// ── Kanal-Auswahl-Checkbox ───────────────────────────────────────────────────
function ChannelCheckbox({ account, checked, onChange }) {
  const expiring = account.token_expires_at && new Date(account.token_expires_at) < new Date(Date.now() + 7 * 86400000);
  return (
    <label className={`mh-channel-item${checked ? ' mh-channel-item--checked' : ''}`}>
      <input type="checkbox" checked={checked} onChange={onChange} className="mh-channel-cb" />
      <span className="mh-channel-icon">{PLATFORM_ICON[account.platform]}</span>
      <span className="mh-channel-info">
        <span className="mh-channel-name">{account.label}</span>
        <span className="mh-channel-sub">{account.page_name || account.page_id} · {account.platform}</span>
      </span>
      {expiring && <span className="mh-token-warn" title="Token läuft bald ab">⚠️</span>}
      {!account.is_active && <span className="mh-token-warn" title="Inaktiv">🔴</span>}
    </label>
  );
}

// ── Konto-Einrichtungs-Wizard ─────────────────────────────────────────────────
const WIZARD_STEPS = [
  { id: 'voraussetzungen', label: 'Voraussetzungen' },
  { id: 'app',            label: 'Meta App' },
  { id: 'token',          label: 'Access Token' },
  { id: 'page',           label: 'Page-Daten' },
  { id: 'instagram',      label: 'Instagram' },
  { id: 'verlaengern',    label: 'Token verlängern' },
  { id: 'eintragen',      label: 'Konto eintragen' },
];

function CopyBox({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  return (
    <div className="wz-copybox">
      <code className="wz-code">{text}</code>
      <button className="wz-copy-btn" onClick={copy} title="Kopieren">{copied ? '✓' : '📋'}</button>
    </div>
  );
}

function AccountWizard({ onSaved, onClose }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    label: '', platform: 'facebook', page_id: '', page_name: '',
    instagram_business_account_id: '', access_token: '', token_expires_at: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const total = WIZARD_STEPS.length;
  const isLast = step === total - 1;

  const next = () => setStep(s => Math.min(s + 1, total - 1));
  const prev = () => setStep(s => Math.max(s - 1, 0));

  const setField = (name, val) => setForm(f => ({ ...f, [name]: val }));

  const handleSave = async () => {
    if (!form.label || !form.page_id || !form.access_token) {
      setError('Bezeichnung, Page-ID und Access Token sind Pflichtfelder.');
      return;
    }
    setSaving(true); setError('');
    try {
      await axios.post('/marketing-hub/accounts/hub', form);
      onSaved();
    } catch (e) { setError(e.response?.data?.error || 'Fehler beim Speichern'); }
    finally { setSaving(false); }
  };

  const stepContent = () => {
    switch (WIZARD_STEPS[step].id) {

      case 'voraussetzungen':
        return (
          <div className="wz-step-body">
            <p className="wz-intro">Bevor du startest, stelle sicher dass du Folgendes hast:</p>
            <div className="wz-checklist">
              <div className="wz-check-item">
                <span className="wz-check-icon">👤</span>
                <div>
                  <strong>Facebook-Konto mit Admin-Rechten</strong>
                  <p>Du musst Admin der Facebook-Seite sein, die du verbinden möchtest (z.B. TDA International oder TDA Systems).</p>
                </div>
              </div>
              <div className="wz-check-item">
                <span className="wz-check-icon">🏢</span>
                <div>
                  <strong>Meta Business Account (empfohlen)</strong>
                  <p>Unter <strong>business.facebook.com</strong> — erlaubt dir, Apps und Seiten zentral zu verwalten.</p>
                </div>
              </div>
              <div className="wz-check-item">
                <span className="wz-check-icon">📱</span>
                <div>
                  <strong>Für Instagram: Profil muss Business- oder Creator-Konto sein</strong>
                  <p>Privat-Profile können nicht über die API angesprochen werden. In den Instagram-Einstellungen → Konto → Zu Business-Konto wechseln.</p>
                </div>
              </div>
            </div>
            <div className="wz-link-row">
              <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="wz-ext-link">🔗 Meta Developer Portal öffnen</a>
              <a href="https://business.facebook.com" target="_blank" rel="noreferrer" className="wz-ext-link">🔗 Meta Business Suite öffnen</a>
            </div>
          </div>
        );

      case 'app':
        return (
          <div className="wz-step-body">
            <p className="wz-intro">Du brauchst eine Meta-App um API-Zugriff zu erhalten. Falls du bereits eine App hast, überspringe Schritt 2–4.</p>
            <div className="wz-steps-inner">
              <div className="wz-inner-step">
                <span className="wz-inner-num">1</span>
                <div>Gehe zu <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="wz-link">developers.facebook.com/apps</a> und klicke <strong>„App erstellen"</strong>.</div>
              </div>
              <div className="wz-inner-step">
                <span className="wz-inner-num">2</span>
                <div>Wähle den App-Typ <strong>„Business"</strong> und vergib einen Namen (z.B. „TDA Marketing").</div>
              </div>
              <div className="wz-inner-step">
                <span className="wz-inner-num">3</span>
                <div>Füge im Dashboard unter <strong>„Produkte hinzufügen"</strong> folgendes hinzu:
                  <ul className="wz-list">
                    <li>Facebook Login for Business</li>
                    <li>Instagram Graph API (nur wenn du Instagram verbinden willst)</li>
                  </ul>
                </div>
              </div>
              <div className="wz-inner-step">
                <span className="wz-inner-num">4</span>
                <div>Notiere dir <strong>App-ID</strong> und <strong>App-Geheimnis</strong> — du brauchst sie in Schritt 6.</div>
              </div>
            </div>
            <div className="wz-info-box">
              ℹ️ Eine App kann für mehrere Seiten (TDA Intl + TDA Systems) verwendet werden — du musst sie nicht doppelt anlegen.
            </div>
          </div>
        );

      case 'token':
        return (
          <div className="wz-step-body">
            <p className="wz-intro">Im Graph API Explorer generierst du den Access Token für deine Seiten.</p>
            <div className="wz-steps-inner">
              <div className="wz-inner-step">
                <span className="wz-inner-num">1</span>
                <div>Öffne den <a href="https://developers.facebook.com/tools/explorer" target="_blank" rel="noreferrer" className="wz-link">Graph API Explorer</a>.</div>
              </div>
              <div className="wz-inner-step">
                <span className="wz-inner-num">2</span>
                <div>Wähle oben rechts deine App aus dem Dropdown.</div>
              </div>
              <div className="wz-inner-step">
                <span className="wz-inner-num">3</span>
                <div>Klicke auf <strong>„Generate Access Token"</strong> und wähle folgende Berechtigungen:
                  <div className="wz-perms">
                    <span className="wz-perm">pages_manage_posts</span>
                    <span className="wz-perm">pages_read_engagement</span>
                    <span className="wz-perm">pages_show_list</span>
                    {form.platform === 'instagram' && <>
                      <span className="wz-perm wz-perm--ig">instagram_basic</span>
                      <span className="wz-perm wz-perm--ig">instagram_content_publish</span>
                    </>}
                  </div>
                </div>
              </div>
              <div className="wz-inner-step">
                <span className="wz-inner-num">4</span>
                <div>Bestätige im Facebook-Dialog und kopiere den generierten <strong>User Access Token</strong>. Du brauchst ihn im nächsten Schritt.</div>
              </div>
            </div>
            <div className="wz-warn-box">
              ⚠️ Dieser Token gilt nur kurz (1–2 Stunden). In Schritt 6 verlängerst du ihn auf 60 Tage.
            </div>
          </div>
        );

      case 'page':
        return (
          <div className="wz-step-body">
            <p className="wz-intro">Mit dem User Access Token holst du jetzt die Daten deiner Seiten.</p>
            <div className="wz-steps-inner">
              <div className="wz-inner-step">
                <span className="wz-inner-num">1</span>
                <div>Gib im Graph API Explorer folgende Anfrage ein:</div>
              </div>
            </div>
            <CopyBox text="GET /me/accounts" />
            <div className="wz-steps-inner" style={{ marginTop: 12 }}>
              <div className="wz-inner-step">
                <span className="wz-inner-num">2</span>
                <div>Du siehst eine Liste aller deiner Seiten. Suche <strong>TDA International</strong> bzw. <strong>TDA Systems</strong> und notiere:
                  <ul className="wz-list">
                    <li><strong>id</strong> → das ist die Page-ID</li>
                    <li><strong>access_token</strong> → das ist der Page Access Token (nicht der User Token!)</li>
                    <li><strong>name</strong> → Seitenname</li>
                  </ul>
                </div>
              </div>
              <div className="wz-inner-step">
                <span className="wz-inner-num">3</span>
                <div>Trage Page-ID und Seitenname unten bereits ein — oder warte bis Schritt 7.</div>
              </div>
            </div>
            <div className="wz-info-box">
              ℹ️ Der <strong>Page Access Token</strong> (aus <code>/me/accounts</code>) ist anders als der User Access Token — verwende immer den Page-spezifischen.
            </div>
          </div>
        );

      case 'instagram':
        return (
          <div className="wz-step-body">
            <p className="wz-intro">Nur ausfüllen wenn du auch Instagram-Posts senden möchtest — sonst kannst du diesen Schritt überspringen.</p>
            <div className="wz-steps-inner">
              <div className="wz-inner-step">
                <span className="wz-inner-num">1</span>
                <div>Das Instagram-Konto muss mit der Facebook-Seite verknüpft sein. Prüfe das unter: Facebook-Seite → Einstellungen → Verknüpfte Konten → Instagram.</div>
              </div>
              <div className="wz-inner-step">
                <span className="wz-inner-num">2</span>
                <div>Gib im Graph API Explorer ein (ersetze <code>PAGE_ID</code> mit deiner Page-ID):</div>
              </div>
            </div>
            <CopyBox text="GET /{PAGE_ID}?fields=instagram_business_account" />
            <div className="wz-steps-inner" style={{ marginTop: 12 }}>
              <div className="wz-inner-step">
                <span className="wz-inner-num">3</span>
                <div>Notiere die <strong>id</strong> aus dem Feld <code>instagram_business_account</code> — das ist die Instagram Business Account-ID.</div>
              </div>
            </div>
            <div className="wz-warn-box">
              ⚠️ Instagram unterstützt keine reinen Text-Posts. Der Composer fordert automatisch ein Bild an wenn Instagram-Kanäle ausgewählt sind. 1 Bild = normaler Post, 2–10 Bilder = Carousel.
            </div>
            <div className="wz-skip-note">Kein Instagram? → Einfach auf „Weiter" klicken und das Feld leer lassen.</div>
          </div>
        );

      case 'verlaengern':
        return (
          <div className="wz-step-body">
            <p className="wz-intro">Page Access Tokens aus <code>/me/accounts</code> sind bereits langlebig (60 Tage) — aber du kannst sie im Token Debugger prüfen und ggf. verlängern.</p>
            <div className="wz-steps-inner">
              <div className="wz-inner-step">
                <span className="wz-inner-num">1</span>
                <div>Öffne den <a href="https://developers.facebook.com/tools/debug/accesstoken" target="_blank" rel="noreferrer" className="wz-link">Access Token Debugger</a> und füge deinen Page Access Token ein.</div>
              </div>
              <div className="wz-inner-step">
                <span className="wz-inner-num">2</span>
                <div>Prüfe unter <strong>„Expires"</strong> wann der Token abläuft. Wenn er „Never" zeigt oder 60 Tage hat, ist alles in Ordnung.</div>
              </div>
              <div className="wz-inner-step">
                <span className="wz-inner-num">3</span>
                <div>Falls du einen kurzen Token verlängern willst, rufe auf (ersetze die Platzhalter):
                </div>
              </div>
            </div>
            <CopyBox text="GET /oauth/access_token?grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={APP_SECRET}&fb_exchange_token={USER_ACCESS_TOKEN}" />
            <div className="wz-info-box" style={{ marginTop: 12 }}>
              ℹ️ Token-Erneuerung: Trage das Ablaufdatum unten im Formular ein — der Hub zeigt dir 7 Tage vor Ablauf eine Warnung ⚠️.
            </div>
          </div>
        );

      case 'eintragen':
        return (
          <div className="wz-step-body">
            <p className="wz-intro">Trage jetzt alle gesammelten Daten ein.</p>
            {error && <div className="mh-error">{error}</div>}
            <div className="mh-field">
              <label className="mh-lbl">Bezeichnung *</label>
              <input className="mh-input" placeholder="z.B. TDA International" value={form.label}
                onChange={e => setField('label', e.target.value)} />
            </div>
            <div className="mh-field">
              <label className="mh-lbl">Plattform *</label>
              <select className="mh-input" value={form.platform} onChange={e => setField('platform', e.target.value)}>
                <option value="facebook">📘 Facebook</option>
                <option value="instagram">📸 Instagram</option>
              </select>
            </div>
            <div className="wz-form-row">
              <div className="mh-field">
                <label className="mh-lbl">Page-ID * <span className="wz-field-hint">(aus /me/accounts → id)</span></label>
                <input className="mh-input" placeholder="z.B. 123456789" value={form.page_id}
                  onChange={e => setField('page_id', e.target.value)} />
              </div>
              <div className="mh-field">
                <label className="mh-lbl">Seitenname <span className="wz-field-hint">(aus /me/accounts → name)</span></label>
                <input className="mh-input" placeholder="z.B. Tiger Dragon Association" value={form.page_name}
                  onChange={e => setField('page_name', e.target.value)} />
              </div>
            </div>
            {form.platform === 'instagram' && (
              <div className="mh-field">
                <label className="mh-lbl">Instagram Business Account-ID <span className="wz-field-hint">(aus /{"{PAGE_ID}"}?fields=instagram_business_account)</span></label>
                <input className="mh-input" placeholder="z.B. 987654321" value={form.instagram_business_account_id}
                  onChange={e => setField('instagram_business_account_id', e.target.value)} />
              </div>
            )}
            <div className="mh-field">
              <label className="mh-lbl">Page Access Token * <span className="wz-field-hint">(aus /me/accounts → access_token)</span></label>
              <input className="mh-input" placeholder="EAAxxxxxx…" value={form.access_token}
                onChange={e => setField('access_token', e.target.value)} />
            </div>
            <div className="mh-field">
              <label className="mh-lbl">Token läuft ab am <span className="wz-field-hint">(aus Token Debugger)</span></label>
              <input className="mh-input" type="date" value={form.token_expires_at}
                onChange={e => setField('token_expires_at', e.target.value)} />
            </div>
          </div>
        );

      default: return null;
    }
  };

  return (
    <div className="mh-modal-overlay">
      <div className="mh-modal mh-modal--wizard">
        {/* Header */}
        <div className="mh-modal-head">
          <div>
            <span className="mh-modal-title">Neuen Kanal einrichten</span>
            <span className="wz-step-label"> — Schritt {step + 1} von {total}: {WIZARD_STEPS[step].label}</span>
          </div>
          <button className="mh-close" onClick={onClose}>✕</button>
        </div>

        {/* Progress bar */}
        <div className="wz-progress-bar">
          {WIZARD_STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`wz-progress-seg${i < step ? ' wz-done' : i === step ? ' wz-active' : ''}`}
              onClick={() => i <= step && setStep(i)}
              title={s.label}
            >
              <span className="wz-prog-dot">{i < step ? '✓' : i + 1}</span>
              <span className="wz-prog-lbl">{s.label}</span>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="mh-modal-body wz-body">
          {stepContent()}
        </div>

        {/* Footer */}
        <div className="mh-modal-foot">
          <button className="mh-btn mh-btn--ghost" onClick={step === 0 ? onClose : prev}>
            {step === 0 ? 'Abbrechen' : '← Zurück'}
          </button>
          {!isLast ? (
            <button className="mh-btn mh-btn--primary" onClick={next}>Weiter →</button>
          ) : (
            <button className="mh-btn mh-btn--primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Speichern…' : '✓ Konto speichern'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Post-Karte ────────────────────────────────────────────────────────────────
function PostCard({ post, onDelete }) {
  const channels = typeof post.channels === 'string' ? JSON.parse(post.channels) : (post.channels || []);
  const published = channels.filter(c => c.status === 'published').length;
  const failed    = channels.filter(c => c.status === 'failed').length;

  return (
    <div className="mh-post-card">
      <div className="mh-post-meta">
        <span className="mh-post-status" style={{ color: STATUS_COLOR[post.status] }}>● {STATUS_LABEL[post.status]}</span>
        <span className="mh-post-date">{new Date(post.created_at).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</span>
      </div>
      <p className="mh-post-content">{post.content.length > 200 ? post.content.slice(0, 200) + '…' : post.content}</p>
      <div className="mh-post-channels">
        {channels.map((c, i) => (
          <span key={i} className={`mh-post-ch mh-post-ch--${c.status}`}>
            {PLATFORM_ICON[c.platform]} {c.status === 'published' ? '✓' : c.status === 'failed' ? '✗' : '…'}
          </span>
        ))}
        {channels.length > 0 && (
          <span className="mh-post-ch-summary">{published}/{channels.length} gepostet{failed > 0 ? `, ${failed} Fehler` : ''}</span>
        )}
      </div>
      <button className="mh-btn mh-btn--danger mh-btn--sm" onClick={() => onDelete(post.id)}>🗑</button>
    </div>
  );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function MarketingHub() {
  const [tab, setTab] = useState('composer');
  const [hubAccounts, setHubAccounts]   = useState([]);
  const [dojoAccounts, setDojoAccounts] = useState([]);
  const [posts, setPosts]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showAddAccount, setShowAddAccount] = useState(false);

  // Composer state
  const [content, setContent]           = useState('');
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [scheduledAt, setScheduledAt]   = useState('');
  const [posting, setPosting]           = useState(false);
  const [postFlash, setPostFlash]       = useState(null);
  const [images, setImages]             = useState([]); // [{ url, name }]
  const [uploading, setUploading]       = useState(false);
  const [dragOver, setDragOver]         = useState(false);

  // KI state
  const [kiLoading, setKiLoading]       = useState(false);
  const [kiTheme, setKiTheme]           = useState('');
  const [kiPlatform, setKiPlatform]     = useState('facebook');
  const [kiTonality, setKiTonality]     = useState('motivierend');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [accRes, postRes] = await Promise.all([
        axios.get('/marketing-hub/accounts'),
        axios.get('/marketing-hub/posts'),
      ]);
      setHubAccounts(accRes.data.hubAccounts || []);
      setDojoAccounts(accRes.data.dojoAccounts || []);
      setPosts(postRes.data.posts || []);
    } catch (e) { console.error('Marketing Hub load error', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const allAccounts = [
    ...hubAccounts.map(a => ({ ...a, _key: `hub-${a.id}`, account_type: 'hub' })),
    ...dojoAccounts.map(a => ({ ...a, _key: `dojo-${a.id}`, account_type: 'dojo' })),
  ];

  const toggleChannel = (acc) => {
    const key = acc._key;
    setSelectedChannels(prev =>
      prev.find(c => c._key === key) ? prev.filter(c => c._key !== key) : [...prev, acc]
    );
  };

  const generateKI = async () => {
    if (!kiTheme) return;
    setKiLoading(true);
    try {
      const res = await axios.post('/marketing-ki/generate', {
        thema: kiTheme, plattform: kiPlatform, tonalitaet: kiTonality,
        zielgruppe: 'Kampfkunst-Interessierte und Mitglieder',
        kontext: 'TDA — Tiger & Dragon Association',
      });
      if (res.data.content) setContent(res.data.content);
    } catch { /* silent */ }
    finally { setKiLoading(false); }
  };

  const uploadFiles = async (files) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach(f => fd.append('images', f));
      const { data } = await axios.post('/marketing-hub/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const newImgs = data.urls.map((url, i) => ({ url, name: files[i]?.name || url.split('/').pop() }));
      setImages(prev => [...prev, ...newImgs]);
    } catch (e) {
      setPostFlash({ type: 'error', msg: e.response?.data?.error || 'Upload fehlgeschlagen' });
      setTimeout(() => setPostFlash(null), 4000);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length) uploadFiles(files);
  };

  const handlePost = async (publishNow = false) => {
    if (!content.trim()) { setPostFlash({ type: 'error', msg: 'Kein Inhalt eingegeben.' }); return; }
    if (!selectedChannels.length) { setPostFlash({ type: 'error', msg: 'Bitte mindestens einen Kanal wählen.' }); return; }
    const igChannels = selectedChannels.filter(c => c.platform === 'instagram');
    if (igChannels.length && !images.length) {
      setPostFlash({ type: 'error', msg: 'Instagram-Kanäle ausgewählt — bitte mindestens ein Bild hochladen.' });
      return;
    }
    setPosting(true);
    try {
      const channels = selectedChannels.map(a => ({
        account_type: a.account_type,
        account_id: a.id,
        platform: a.platform,
      }));
      const { data } = await axios.post('/marketing-hub/posts', {
        content, channels,
        media_urls: images.map(i => i.url),
        scheduled_at: (!publishNow && scheduledAt) ? scheduledAt : null,
      });
      if (publishNow) {
        await axios.post(`/marketing-hub/posts/${data.id}/publish`);
        setPostFlash({ type: 'success', msg: `Gepostet auf ${selectedChannels.length} Kanal${selectedChannels.length > 1 ? 'en' : ''} ✓` });
      } else {
        setPostFlash({ type: 'success', msg: scheduledAt ? 'Geplant ✓' : 'Entwurf gespeichert ✓' });
      }
      setContent(''); setSelectedChannels([]); setScheduledAt(''); setImages([]);
      load();
    } catch (e) {
      setPostFlash({ type: 'error', msg: e.response?.data?.error || 'Fehler beim Posten' });
    } finally {
      setPosting(false);
      setTimeout(() => setPostFlash(null), 4000);
    }
  };

  const handleDeletePost = async (id) => {
    if (!window.confirm('Post löschen?')) return;
    await axios.delete(`/marketing-hub/posts/${id}`);
    load();
  };

  const handleDeleteAccount = async (id) => {
    if (!window.confirm('Konto entfernen?')) return;
    await axios.delete(`/marketing-hub/accounts/hub/${id}`);
    load();
  };

  if (loading) return <div className="mh-loading"><div className="mh-spinner" /> Lade Marketing Hub…</div>;

  const tabItems = [
    { id: 'composer', label: '✏️ Composer' },
    { id: 'posts',    label: '📋 Posts' },
    { id: 'kanaele',  label: '🔗 Kanäle' },
  ];

  return (
    <div className="mh-root">
      <div className="mh-header">
        <h1 className="mh-title">📣 Marketing Hub</h1>
        <p className="mh-sub">Plattformweites Social-Media-Management — TDA-Kanäle &amp; alle Dojos</p>
      </div>

      {/* Stats */}
      <div className="mh-stats">
        <div className="mh-stat"><span className="mh-stat-num">{hubAccounts.length}</span><span className="mh-stat-lbl">TDA-Kanäle</span></div>
        <div className="mh-stat"><span className="mh-stat-num">{dojoAccounts.length}</span><span className="mh-stat-lbl">Dojo-Kanäle</span></div>
        <div className="mh-stat"><span className="mh-stat-num" style={{ color: '#22c55e' }}>{posts.filter(p => p.status === 'published').length}</span><span className="mh-stat-lbl">Veröffentlicht</span></div>
        <div className="mh-stat"><span className="mh-stat-num" style={{ color: '#f59e0b' }}>{posts.filter(p => p.status === 'scheduled').length}</span><span className="mh-stat-lbl">Geplant</span></div>
        <div className="mh-stat"><span className="mh-stat-num">{posts.filter(p => p.status === 'draft').length}</span><span className="mh-stat-lbl">Entwürfe</span></div>
      </div>

      {/* Tabs */}
      <div className="mh-tabs">
        {tabItems.map(t => (
          <button key={t.id} className={`mh-tab${tab === t.id ? ' mh-tab--active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* ── COMPOSER ────────────────────────────────────────────────── */}
      {tab === 'composer' && (
        <div className="mh-composer-layout">
          <div className="mh-composer-main">
            {/* KI Generator */}
            <div className="mh-ki-bar">
              <span className="mh-ki-label">🤖 KI-Vorschlag:</span>
              <input className="mh-ki-input" placeholder="Thema eingeben…" value={kiTheme}
                onChange={e => setKiTheme(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && generateKI()} />
              <select className="mh-ki-sel" value={kiPlatform} onChange={e => setKiPlatform(e.target.value)}>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="beide">Beide</option>
              </select>
              <select className="mh-ki-sel" value={kiTonality} onChange={e => setKiTonality(e.target.value)}>
                <option value="motivierend">Motivierend</option>
                <option value="professionell">Professionell</option>
                <option value="freundlich">Freundlich</option>
                <option value="humorvoll">Humorvoll</option>
              </select>
              <button className="mh-btn mh-btn--ki" onClick={generateKI} disabled={kiLoading || !kiTheme}>
                {kiLoading ? '…' : '✨ Generieren'}
              </button>
            </div>

            {/* Textfeld */}
            <textarea
              className="mh-textarea"
              placeholder="Was möchtest du posten? Schreib direkt oder lass die KI einen Vorschlag generieren…"
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={8}
            />
            <div className="mh-char-count" style={{ color: content.length > 2000 ? '#ef4444' : undefined }}>
              {content.length} Zeichen
            </div>

            {/* Bild-Upload */}
            <div
              className={`mh-upload-zone${dragOver ? ' mh-upload-zone--over' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {uploading ? (
                <div className="mh-upload-spinner-row"><div className="mh-spinner" /><span>Bilder werden hochgeladen…</span></div>
              ) : (
                <>
                  <span className="mh-upload-icon">🖼️</span>
                  <span className="mh-upload-text">Bilder hierher ziehen oder</span>
                  <label className="mh-btn mh-btn--ghost mh-btn--sm mh-upload-pick">
                    Datei wählen
                    <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                      onChange={e => { uploadFiles(e.target.files); e.target.value = ''; }} />
                  </label>
                  <span className="mh-upload-hint">JPG, PNG, GIF · max. 10 MB pro Bild</span>
                </>
              )}
            </div>

            {/* Bild-Vorschau */}
            {images.length > 0 && (
              <div className="mh-img-preview-strip">
                {images.map((img, i) => (
                  <div key={i} className="mh-img-thumb">
                    <img src={img.url} alt={img.name} />
                    <button className="mh-img-remove" onClick={() => setImages(prev => prev.filter((_, j) => j !== i))} title="Entfernen">✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* Scheduling + Aktionen */}
            <div className="mh-actions-row">
              <div className="mh-schedule-wrap">
                <label className="mh-lbl">Planen (optional)</label>
                <input className="mh-input mh-input--sm" type="datetime-local" value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)} />
              </div>
              <div className="mh-post-btns">
                <button className="mh-btn mh-btn--ghost" onClick={() => handlePost(false)} disabled={posting}>
                  {scheduledAt ? '📅 Planen' : '💾 Entwurf'}
                </button>
                <button className="mh-btn mh-btn--primary" onClick={() => handlePost(true)} disabled={posting || !selectedChannels.length}>
                  {posting ? 'Posting…' : `🚀 Jetzt posten${selectedChannels.length ? ` (${selectedChannels.length})` : ''}`}
                </button>
              </div>
            </div>

            {postFlash && (
              <div className={`mh-flash mh-flash--${postFlash.type}`}>{postFlash.msg}</div>
            )}
          </div>

          {/* Kanal-Auswahl */}
          <div className="mh-channel-panel">
            <div className="mh-panel-head">
              Kanäle wählen
              <button className="mh-select-all" onClick={() => setSelectedChannels(selectedChannels.length === allAccounts.length ? [] : allAccounts)}>
                {selectedChannels.length === allAccounts.length ? 'Alle abwählen' : 'Alle wählen'}
              </button>
            </div>

            {allAccounts.length === 0 ? (
              <div className="mh-empty-channels">Noch keine Kanäle verbunden.<br />Gehe zu "Kanäle" um TDA-Konten hinzuzufügen.</div>
            ) : (
              <>
                {hubAccounts.length > 0 && (
                  <div className="mh-channel-group">
                    <div className="mh-channel-group-label">TDA-Kanäle</div>
                    {hubAccounts.map(a => {
                      const acc = { ...a, _key: `hub-${a.id}`, account_type: 'hub' };
                      return <ChannelCheckbox key={a.id} account={acc} checked={!!selectedChannels.find(c => c._key === acc._key)} onChange={() => toggleChannel(acc)} />;
                    })}
                  </div>
                )}
                {dojoAccounts.length > 0 && (
                  <div className="mh-channel-group">
                    <div className="mh-channel-group-label">Dojo-Kanäle</div>
                    {dojoAccounts.map(a => {
                      const acc = { ...a, _key: `dojo-${a.id}`, account_type: 'dojo' };
                      return <ChannelCheckbox key={a.id} account={acc} checked={!!selectedChannels.find(c => c._key === acc._key)} onChange={() => toggleChannel(acc)} />;
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── POSTS ────────────────────────────────────────────────────── */}
      {tab === 'posts' && (
        <div>
          {posts.length === 0 ? (
            <div className="mh-empty">Noch keine Posts erstellt.</div>
          ) : (
            <div className="mh-posts-grid">
              {posts.map(p => <PostCard key={p.id} post={p} onDelete={handleDeletePost} />)}
            </div>
          )}
        </div>
      )}

      {/* ── KANÄLE ───────────────────────────────────────────────────── */}
      {tab === 'kanaele' && (
        <div>
          <div className="mh-kanaele-toolbar">
            <button className="mh-btn mh-btn--primary" onClick={() => setShowAddAccount(true)}>+ TDA-Konto hinzufügen</button>
            <span className="mh-hint">Dojo-Konten werden automatisch aus den jeweiligen Dojo-Einstellungen eingelesen.</span>
          </div>

          <h3 className="mh-section-title">TDA-eigene Kanäle</h3>
          {hubAccounts.length === 0 ? (
            <div className="mh-empty">Noch keine TDA-Kanäle verbunden. Klicke "+ TDA-Konto hinzufügen".</div>
          ) : (
            <div className="mh-accounts-list">
              {hubAccounts.map(a => (
                <div key={a.id} className="mh-account-row">
                  <span className="mh-account-icon">{PLATFORM_ICON[a.platform]}</span>
                  <div className="mh-account-info">
                    <span className="mh-account-name">{a.label}</span>
                    <span className="mh-account-sub">{a.page_name || a.page_id} · {a.platform}</span>
                    {a.token_expires_at && (
                      <span className={`mh-token-exp ${new Date(a.token_expires_at) < new Date() ? 'mh-token-exp--expired' : ''}`}>
                        Token bis {new Date(a.token_expires_at).toLocaleDateString('de-DE')}
                      </span>
                    )}
                  </div>
                  <span className={`mh-account-badge ${a.is_active ? 'mh-account-badge--active' : 'mh-account-badge--inactive'}`}>
                    {a.is_active ? 'Aktiv' : 'Inaktiv'}
                  </span>
                  <button className="mh-btn mh-btn--danger mh-btn--sm" onClick={() => handleDeleteAccount(a.id)}>🗑</button>
                </div>
              ))}
            </div>
          )}

          <h3 className="mh-section-title" style={{ marginTop: 28 }}>Dojo-Kanäle (schreibgeschützt)</h3>
          {dojoAccounts.length === 0 ? (
            <div className="mh-empty">Keine Dojos haben Social-Media verbunden.</div>
          ) : (
            <div className="mh-accounts-list">
              {dojoAccounts.map(a => (
                <div key={a.id} className="mh-account-row mh-account-row--readonly">
                  <span className="mh-account-icon">{PLATFORM_ICON[a.platform]}</span>
                  <div className="mh-account-info">
                    <span className="mh-account-name">{a.label}</span>
                    <span className="mh-account-sub">{a.page_name || a.page_id} · {a.platform}</span>
                  </div>
                  <span className="mh-account-badge mh-account-badge--dojo">Dojo</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showAddAccount && <AccountWizard onSaved={() => { setShowAddAccount(false); load(); }} onClose={() => setShowAddAccount(false)} />}
    </div>
  );
}
