import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import '../styles/CommunityBoard.css';

const CATEGORIES = [
  { id: 'all',         label: 'Alle',             icon: '🗂️',  color: '#64748b' },
  { id: 'bulletin',    label: 'Schwarzes Brett',   icon: '📌',  color: '#3b82f6' },
  { id: 'marketplace', label: 'Marktplatz',        icon: '🛒',  color: '#f59e0b' },
  { id: 'training',    label: 'Trainingspartner',  icon: '🥋',  color: '#ec4899' },
  { id: 'event',       label: 'Community Events',  icon: '📅',  color: '#22c55e' },
];

const PRICE_TYPE_LABEL = { fixed: 'Festpreis', negotiable: 'VB', free: 'Gratis', exchange: 'Tausch' };
const STATUS_COLOR = { pending: '#f59e0b', active: '#22c55e', closed: '#64748b', rejected: '#ef4444' };
const STATUS_LABEL = { pending: 'Ausstehend', active: 'Aktiv', closed: 'Geschlossen', rejected: 'Abgelehnt' };

const DOW = ['So','Mo','Di','Mi','Do','Fr','Sa'];

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return 'gerade eben';
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.floor(h / 24);
  if (d < 7) return `vor ${d} Tag${d > 1 ? 'en' : ''}`;
  return new Date(dateStr).toLocaleDateString('de-DE');
}

function catInfo(id) { return CATEGORIES.find(c => c.id === id) || CATEGORIES[0]; }

// ── Image upload helper ───────────────────────────────────────────────────────
async function uploadImages(files) {
  const fd = new FormData();
  Array.from(files).forEach(f => fd.append('images', f));
  const { data } = await axios.post('/community/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  return data.urls;
}

// ── Post Card ─────────────────────────────────────────────────────────────────
function PostCard({ post, currentUserId, isAdmin, dojoId, onEdit, onDelete, onModerate, onContact }) {
  const cat = catInfo(post.category);
  const images = post.images ? (typeof post.images === 'string' ? JSON.parse(post.images) : post.images) : [];
  const isOwn = post.mitglied_id === currentUserId;

  return (
    <div className="cb-card" style={{ '--cat-color': cat.color }}>
      <div className="cb-card-cat-bar" />
      <div className="cb-card-head">
        <span className="cb-cat-badge" style={{ background: cat.color + '22', color: cat.color }}>
          {cat.icon} {cat.label}
        </span>
        <span className="cb-card-time">{timeAgo(post.created_at)}</span>
      </div>

      {images.length > 0 && (
        <div className={`cb-images cb-images--${Math.min(images.length, 3)}`}>
          {images.slice(0, 3).map((url, i) => (
            <img key={i} src={url} alt="" className="cb-img" />
          ))}
          {images.length > 3 && <div className="cb-img-more">+{images.length - 3}</div>}
        </div>
      )}

      <h3 className="cb-card-title">{post.title}</h3>
      <p className="cb-card-desc">{post.description.length > 180 ? post.description.slice(0, 180) + '…' : post.description}</p>

      {/* Category-specific details */}
      {post.category === 'marketplace' && (
        <div className="cb-detail-row">
          {post.price != null && (
            <span className="cb-price">
              {post.price_type === 'free' ? 'Gratis' : post.price_type === 'exchange' ? 'Tausch' : `${parseFloat(post.price).toFixed(2).replace('.', ',')} €`}
              {post.price_type && post.price_type !== 'free' && post.price_type !== 'exchange' && (
                <span className="cb-price-type"> ({PRICE_TYPE_LABEL[post.price_type]})</span>
              )}
            </span>
          )}
          {post.item_condition && <span className="cb-condition">{post.item_condition}</span>}
        </div>
      )}

      {post.category === 'training' && (
        <div className="cb-training-details">
          {post.training_style && <span className="cb-pill">🥊 {post.training_style}</span>}
          {post.training_days && <span className="cb-pill">📅 {post.training_days}</span>}
          {post.training_time && <span className="cb-pill">🕐 {post.training_time}</span>}
          {post.training_level && <span className="cb-pill">🎖️ {post.training_level}</span>}
        </div>
      )}

      {post.category === 'event' && post.event_date && (
        <div className="cb-detail-row">
          <span className="cb-pill">📅 {new Date(post.event_date).toLocaleString('de-DE', { weekday:'short', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</span>
          {post.event_location && <span className="cb-pill">📍 {post.event_location}</span>}
        </div>
      )}

      <div className="cb-card-footer">
        <div className="cb-author">
          {post.avatar_url
            ? <img src={post.avatar_url} alt="" className="cb-avatar" />
            : <div className="cb-avatar cb-avatar--initials">{(post.vorname?.[0] || '?')}{(post.nachname?.[0] || '')}</div>
          }
          <span className="cb-author-name">{post.vorname} {post.nachname}</span>
          {post.views > 0 && <span className="cb-views">👁 {post.views}</span>}
        </div>
        <div className="cb-card-actions">
          {isOwn && <button className="cb-btn cb-btn--ghost cb-btn--sm" onClick={() => onEdit(post)}>Bearbeiten</button>}
          {(isOwn || isAdmin) && <button className="cb-btn cb-btn--danger cb-btn--sm" onClick={() => onDelete(post.id)}>Löschen</button>}
          {isAdmin && post.status === 'pending' && (
            <>
              <button className="cb-btn cb-btn--success cb-btn--sm" onClick={() => onModerate(post.id, 'active')}>✓ Freigeben</button>
              <button className="cb-btn cb-btn--warn cb-btn--sm" onClick={() => onModerate(post.id, 'rejected')}>✗ Ablehnen</button>
            </>
          )}
          {!isOwn && <button className="cb-btn cb-btn--primary cb-btn--sm" onClick={() => onContact(post)}>💬 Kontakt</button>}
        </div>
      </div>
    </div>
  );
}

// ── Post-Formular Modal ───────────────────────────────────────────────────────
function PostForm({ editPost, dojoId, onSaved, onClose }) {
  const isEdit = !!editPost;
  const initImages = editPost?.images ? (typeof editPost.images === 'string' ? JSON.parse(editPost.images) : editPost.images) : [];

  const [step, setStep] = useState(isEdit ? 1 : 0);
  const [category, setCategory] = useState(editPost?.category || '');
  const [form, setForm] = useState({
    title: editPost?.title || '',
    description: editPost?.description || '',
    price: editPost?.price || '',
    price_type: editPost?.price_type || 'fixed',
    item_condition: editPost?.item_condition || '',
    training_style: editPost?.training_style || '',
    training_days: editPost?.training_days || '',
    training_time: editPost?.training_time || '',
    training_level: editPost?.training_level || '',
    event_date: editPost?.event_date ? editPost.event_date.slice(0, 16) : '',
    event_location: editPost?.event_location || '',
    show_contact_info: editPost?.show_contact_info || false,
    contact_phone: editPost?.contact_phone || '',
    contact_email: editPost?.contact_email || '',
    expires_at: editPost?.expires_at ? editPost.expires_at.slice(0, 10) : '',
  });
  const [images, setImages] = useState(initImages);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleUpload = async (files) => {
    setUploading(true);
    try {
      const urls = await uploadImages(files);
      setImages(prev => [...prev, ...urls]);
    } catch { setError('Bild-Upload fehlgeschlagen'); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      setError('Titel und Beschreibung sind Pflichtfelder');
      return;
    }
    setSaving(true); setError('');
    try {
      const payload = { ...form, category, images, dojo_id: dojoId };
      if (isEdit) {
        await axios.put(`/community/${editPost.id}`, payload);
      } else {
        await axios.post('/community', payload);
      }
      onSaved();
    } catch (e) {
      setError(e.response?.data?.error || 'Fehler beim Speichern');
    } finally { setSaving(false); }
  };

  const CAT_CHOICES = CATEGORIES.filter(c => c.id !== 'all');

  return (
    <div className="cb-modal-overlay">
      <div className="cb-modal">
        <div className="cb-modal-head">
          <span className="cb-modal-title">{isEdit ? 'Beitrag bearbeiten' : 'Neuer Beitrag'}</span>
          <button className="cb-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="cb-modal-body">
          {error && <div className="cb-error">{error}</div>}

          {/* Step 0: Kategorie wählen */}
          {step === 0 && (
            <div className="cb-cat-grid">
              {CAT_CHOICES.map(c => (
                <button key={c.id} className={`cb-cat-choice${category === c.id ? ' cb-cat-choice--active' : ''}`}
                  style={{ '--cc': c.color }} onClick={() => setCategory(c.id)}>
                  <span className="cb-cat-choice-icon">{c.icon}</span>
                  <span className="cb-cat-choice-label">{c.label}</span>
                  <span className="cb-cat-choice-desc">{
                    c.id === 'bulletin' ? 'Ankündigungen, Infos, Gesuche' :
                    c.id === 'marketplace' ? 'Ausrüstung kaufen, verkaufen, tauschen' :
                    c.id === 'training' ? 'Trainingspartner oder Gruppe finden' :
                    'Treffen, Seminare, Ausflüge'
                  }</span>
                </button>
              ))}
            </div>
          )}

          {/* Step 1: Details */}
          {step === 1 && (
            <div className="cb-form">
              <div className="cb-field">
                <label className="cb-lbl">Titel *</label>
                <input className="cb-input" value={form.title} onChange={e => set('title', e.target.value)}
                  placeholder={
                    category === 'marketplace' ? 'z.B. Kampfsporthandschuhe Gr. M, kaum getragen' :
                    category === 'training' ? 'z.B. Suche BJJ-Sparringspartner Anfänger' :
                    category === 'event' ? 'z.B. Gemeinsames Turnier-Watching am Samstag' :
                    'z.B. Wichtige Info für alle Mitglieder'
                  } />
              </div>
              <div className="cb-field">
                <label className="cb-lbl">Beschreibung *</label>
                <textarea className="cb-input cb-textarea" rows={4} value={form.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder="Beschreibe deinen Beitrag so genau wie möglich…" />
              </div>

              {category === 'marketplace' && (
                <div className="cb-field-row">
                  <div className="cb-field">
                    <label className="cb-lbl">Preis (€)</label>
                    <input className="cb-input" type="number" min="0" step="0.50" value={form.price}
                      onChange={e => set('price', e.target.value)} placeholder="0,00" />
                  </div>
                  <div className="cb-field">
                    <label className="cb-lbl">Preisart</label>
                    <select className="cb-input" value={form.price_type} onChange={e => set('price_type', e.target.value)}>
                      <option value="fixed">Festpreis</option>
                      <option value="negotiable">Verhandelbar</option>
                      <option value="free">Gratis / zu verschenken</option>
                      <option value="exchange">Tausch</option>
                    </select>
                  </div>
                  <div className="cb-field">
                    <label className="cb-lbl">Zustand</label>
                    <select className="cb-input" value={form.item_condition} onChange={e => set('item_condition', e.target.value)}>
                      <option value="">– wählen –</option>
                      <option value="Neu">Neu</option>
                      <option value="Wie neu">Wie neu</option>
                      <option value="Gut erhalten">Gut erhalten</option>
                      <option value="Gebraucht">Gebraucht</option>
                      <option value="Bastlerware">Bastlerware</option>
                    </select>
                  </div>
                </div>
              )}

              {category === 'training' && (
                <div className="cb-field-row">
                  <div className="cb-field">
                    <label className="cb-lbl">Kampfkunst / Stil</label>
                    <input className="cb-input" value={form.training_style} onChange={e => set('training_style', e.target.value)} placeholder="z.B. BJJ, Karate, MMA…" />
                  </div>
                  <div className="cb-field">
                    <label className="cb-lbl">Bevorzugte Tage</label>
                    <input className="cb-input" value={form.training_days} onChange={e => set('training_days', e.target.value)} placeholder="z.B. Mo, Mi, Do" />
                  </div>
                  <div className="cb-field">
                    <label className="cb-lbl">Uhrzeit</label>
                    <input className="cb-input" value={form.training_time} onChange={e => set('training_time', e.target.value)} placeholder="z.B. 18:00–20:00" />
                  </div>
                  <div className="cb-field">
                    <label className="cb-lbl">Niveau</label>
                    <select className="cb-input" value={form.training_level} onChange={e => set('training_level', e.target.value)}>
                      <option value="">– egal –</option>
                      <option value="Anfänger">Anfänger</option>
                      <option value="Fortgeschritten">Fortgeschritten</option>
                      <option value="Alle Niveaus">Alle Niveaus</option>
                    </select>
                  </div>
                </div>
              )}

              {category === 'event' && (
                <div className="cb-field-row">
                  <div className="cb-field">
                    <label className="cb-lbl">Datum &amp; Uhrzeit</label>
                    <input className="cb-input" type="datetime-local" value={form.event_date}
                      onChange={e => set('event_date', e.target.value)} />
                  </div>
                  <div className="cb-field">
                    <label className="cb-lbl">Ort</label>
                    <input className="cb-input" value={form.event_location} onChange={e => set('event_location', e.target.value)} placeholder="z.B. Dojohalle, Zoom-Link…" />
                  </div>
                </div>
              )}

              {/* Bilder */}
              <div className="cb-field">
                <label className="cb-lbl">Bilder (optional, max. 5)</label>
                <label className="cb-upload-zone">
                  {uploading ? '⏳ Wird hochgeladen…' : '🖼️ Bilder auswählen'}
                  <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                    onChange={e => { handleUpload(e.target.files); e.target.value = ''; }} />
                </label>
                {images.length > 0 && (
                  <div className="cb-img-strip">
                    {images.map((url, i) => (
                      <div key={i} className="cb-img-thumb">
                        <img src={url} alt="" />
                        <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Kontakt & Ablauf */}
              <div className="cb-field-row">
                <div className="cb-field">
                  <label className="cb-lbl">Läuft ab am (optional)</label>
                  <input className="cb-input" type="date" value={form.expires_at}
                    onChange={e => set('expires_at', e.target.value)} />
                </div>
              </div>

              <div className="cb-contact-toggle">
                <label className="cb-check-label">
                  <input type="checkbox" checked={form.show_contact_info}
                    onChange={e => set('show_contact_info', e.target.checked)} />
                  Kontaktdaten zusätzlich anzeigen (Telefon / E-Mail)
                </label>
              </div>
              {form.show_contact_info && (
                <div className="cb-field-row">
                  <div className="cb-field">
                    <label className="cb-lbl">Telefon</label>
                    <input className="cb-input" value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="+49 …" />
                  </div>
                  <div className="cb-field">
                    <label className="cb-lbl">E-Mail</label>
                    <input className="cb-input" type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="deine@email.de" />
                  </div>
                </div>
              )}
              <div className="cb-contact-hint">
                💬 Mitglieder können dich immer über den internen Chat kontaktieren.
              </div>
            </div>
          )}
        </div>

        <div className="cb-modal-foot">
          {step === 0 ? (
            <>
              <button className="cb-btn cb-btn--ghost" onClick={onClose}>Abbrechen</button>
              <button className="cb-btn cb-btn--primary" disabled={!category} onClick={() => setStep(1)}>Weiter →</button>
            </>
          ) : (
            <>
              {!isEdit && <button className="cb-btn cb-btn--ghost" onClick={() => setStep(0)}>← Zurück</button>}
              {isEdit && <button className="cb-btn cb-btn--ghost" onClick={onClose}>Abbrechen</button>}
              <button className="cb-btn cb-btn--primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Speichern…' : isEdit ? 'Änderungen speichern' : 'Beitrag einreichen'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Admin-Moderationsbereich ──────────────────────────────────────────────────
function AdminPanel({ dojoId, onClose }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`/community/admin?dojo_id=${dojoId}`);
      setPosts(data.posts || []);
    } finally { setLoading(false); }
  }, [dojoId]);

  useEffect(() => { load(); }, [load]);

  const moderate = async (id, status, reason = '') => {
    await axios.put(`/community/${id}/status`, { status, rejection_reason: reason });
    load();
  };

  const del = async (id) => {
    if (!window.confirm('Beitrag löschen?')) return;
    await axios.delete(`/community/${id}`);
    load();
  };

  const pending = posts.filter(p => p.status === 'pending');
  const others  = posts.filter(p => p.status !== 'pending');

  return (
    <div className="cb-modal-overlay">
      <div className="cb-modal cb-modal--wide">
        <div className="cb-modal-head">
          <span className="cb-modal-title">🛡️ Moderation ({pending.length} ausstehend)</span>
          <button className="cb-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="cb-modal-body">
          {loading ? <div className="cb-loading">Lädt…</div> : (
            <>
              {pending.length > 0 && (
                <>
                  <div className="cb-mod-section-head">Warten auf Freigabe</div>
                  {pending.map(p => <ModRow key={p.id} post={p} onModerate={moderate} onDelete={del} />)}
                </>
              )}
              {others.length > 0 && (
                <>
                  <div className="cb-mod-section-head" style={{ marginTop: 20 }}>Alle Beiträge</div>
                  {others.map(p => <ModRow key={p.id} post={p} onModerate={moderate} onDelete={del} />)}
                </>
              )}
              {posts.length === 0 && <div className="cb-empty">Keine Beiträge vorhanden.</div>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ModRow({ post, onModerate, onDelete }) {
  const cat = catInfo(post.category);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  return (
    <div className="cb-mod-row">
      <span className="cb-cat-badge" style={{ background: cat.color + '22', color: cat.color }}>{cat.icon}</span>
      <div className="cb-mod-info">
        <span className="cb-mod-title">{post.title}</span>
        <span className="cb-mod-meta">{post.vorname} {post.nachname} · {timeAgo(post.created_at)}</span>
        <p className="cb-mod-desc">{post.description.slice(0, 120)}{post.description.length > 120 ? '…' : ''}</p>
        {rejecting && (
          <div className="cb-reject-row">
            <input className="cb-input" placeholder="Ablehnungsgrund (optional)" value={reason}
              onChange={e => setReason(e.target.value)} />
            <button className="cb-btn cb-btn--danger cb-btn--sm" onClick={() => { onModerate(post.id, 'rejected', reason); setRejecting(false); }}>Bestätigen</button>
            <button className="cb-btn cb-btn--ghost cb-btn--sm" onClick={() => setRejecting(false)}>Abbruch</button>
          </div>
        )}
      </div>
      <div className="cb-mod-actions">
        <span className="cb-status-dot" style={{ background: STATUS_COLOR[post.status] }}>{STATUS_LABEL[post.status]}</span>
        {post.status === 'pending' && (
          <>
            <button className="cb-btn cb-btn--success cb-btn--sm" onClick={() => onModerate(post.id, 'active')}>✓ Freigeben</button>
            <button className="cb-btn cb-btn--warn cb-btn--sm" onClick={() => setRejecting(true)}>✗ Ablehnen</button>
          </>
        )}
        {post.status === 'active' && (
          <button className="cb-btn cb-btn--ghost cb-btn--sm" onClick={() => onModerate(post.id, 'closed')}>Schließen</button>
        )}
        <button className="cb-btn cb-btn--danger cb-btn--sm" onClick={() => onDelete(post.id)}>🗑</button>
      </div>
    </div>
  );
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────────
export default function CommunityBoard({ dojoId, currentMitgliedId, isAdmin, onOpenChat }) {
  const [posts, setPosts]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeFilter, setFilter] = useState('all');
  const [showForm, setShowForm]   = useState(false);
  const [editPost, setEditPost]   = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [flash, setFlash]         = useState(null);

  const load = useCallback(async () => {
    if (!dojoId) return;
    setLoading(true);
    try {
      const url = `/community?dojo_id=${dojoId}${activeFilter !== 'all' ? `&category=${activeFilter}` : ''}`;
      const { data } = await axios.get(url);
      setPosts(data.posts || []);
    } finally { setLoading(false); }
  }, [dojoId, activeFilter]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm('Beitrag löschen?')) return;
    await axios.delete(`/community/${id}`);
    showFlash('Beitrag gelöscht.', 'info');
    load();
  };

  const handleModerate = async (id, status) => {
    await axios.put(`/community/${id}/status`, { status });
    load();
  };

  const handleContact = (post) => {
    if (onOpenChat) onOpenChat(post.user_id, post.mitglied_id, post.vorname + ' ' + post.nachname);
  };

  const showFlash = (msg, type = 'success') => {
    setFlash({ msg, type });
    setTimeout(() => setFlash(null), 4000);
  };

  const pending = posts.filter(p => p.status === 'pending').length;

  return (
    <div className="cb-root">
      {/* Header */}
      <div className="cb-header">
        <div>
          <h2 className="cb-title"><span className="cb-title-icon">🏘️</span> Community</h2>
          <p className="cb-subtitle">Schwarzes Brett · Marktplatz · Trainingspartner · Events</p>
        </div>
        <div className="cb-header-actions">
          {isAdmin && (
            <button className="cb-btn cb-btn--ghost" onClick={() => setShowAdmin(true)}>
              🛡️ Moderation{pending > 0 ? ` (${pending})` : ''}
            </button>
          )}
          <button className="cb-btn cb-btn--primary" onClick={() => { setEditPost(null); setShowForm(true); }}>
            + Beitrag erstellen
          </button>
        </div>
      </div>

      {flash && <div className={`cb-flash cb-flash--${flash.type}`}>{flash.msg}</div>}

      {/* Filter tabs */}
      <div className="cb-filters">
        {CATEGORIES.map(c => (
          <button key={c.id}
            className={`cb-filter-btn${activeFilter === c.id ? ' cb-filter-btn--active' : ''}`}
            style={{ '--fc': c.color }}
            onClick={() => setFilter(c.id)}>
            {c.icon} {c.label}
          </button>
        ))}
      </div>

      {/* Posts grid */}
      {loading ? (
        <div className="cb-loading">Lädt…</div>
      ) : posts.length === 0 ? (
        <div className="cb-empty">
          <div className="cb-empty-icon">📋</div>
          <div>Noch keine Beiträge in dieser Kategorie.</div>
          <button className="cb-btn cb-btn--primary" style={{ marginTop: 12 }}
            onClick={() => { setEditPost(null); setShowForm(true); }}>
            Ersten Beitrag erstellen
          </button>
        </div>
      ) : (
        <div className="cb-grid">
          {posts.map(p => (
            <PostCard key={p.id} post={p}
              currentUserId={currentMitgliedId}
              isAdmin={isAdmin}
              dojoId={dojoId}
              onEdit={(post) => { setEditPost(post); setShowForm(true); }}
              onDelete={handleDelete}
              onModerate={handleModerate}
              onContact={handleContact}
            />
          ))}
        </div>
      )}

      {/* Pending-Hinweis für Ersteller */}
      {!isAdmin && (
        <div className="cb-pending-note">
          ℹ️ Neue Beiträge werden nach Erstellung vom Dojo-Admin geprüft und freigeschaltet.
        </div>
      )}

      {showForm && (
        <PostForm
          editPost={editPost}
          dojoId={dojoId}
          onSaved={() => {
            setShowForm(false);
            showFlash(editPost ? 'Beitrag aktualisiert — wartet auf Freigabe.' : 'Beitrag eingereicht — wartet auf Freigabe.');
            load();
          }}
          onClose={() => setShowForm(false)}
        />
      )}

      {showAdmin && <AdminPanel dojoId={dojoId} onClose={() => { setShowAdmin(false); load(); }} />}
    </div>
  );
}
