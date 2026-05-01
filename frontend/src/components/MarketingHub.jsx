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

// ── Konto-Formular (TDA-Ebene) ───────────────────────────────────────────────
function AccountForm({ onSaved, onClose }) {
  const [form, setForm] = useState({ label: '', platform: 'facebook', page_id: '', page_name: '', instagram_business_account_id: '', access_token: '', token_expires_at: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form.label || !form.page_id || !form.access_token) { setError('Label, Page-ID und Token erforderlich'); return; }
    setSaving(true); setError('');
    try {
      await axios.post('/marketing-hub/accounts/hub', form);
      onSaved();
    } catch (e) { setError(e.response?.data?.error || 'Fehler'); }
    finally { setSaving(false); }
  };

  const field = (name, label, placeholder, type = 'text') => (
    <div className="mh-field">
      <label className="mh-lbl">{label}</label>
      <input className="mh-input" type={type} value={form[name]} placeholder={placeholder}
        onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))} />
    </div>
  );

  return (
    <div className="mh-modal-overlay">
      <div className="mh-modal">
        <div className="mh-modal-head">
          <span className="mh-modal-title">TDA-Konto hinzufügen</span>
          <button className="mh-close" onClick={onClose}>✕</button>
        </div>
        <div className="mh-modal-body">
          {error && <div className="mh-error">{error}</div>}
          {field('label', 'Bezeichnung *', 'z.B. TDA International')}
          <div className="mh-field">
            <label className="mh-lbl">Plattform</label>
            <select className="mh-input" value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
            </select>
          </div>
          {field('page_id', 'Page-ID *', 'z.B. 123456789')}
          {field('page_name', 'Seitenname', 'z.B. Tiger Dragon Association')}
          {form.platform === 'instagram' && field('instagram_business_account_id', 'Instagram Business Account-ID', 'z.B. 987654321')}
          {field('access_token', 'Page Access Token *', 'EAAxxxxxx...')}
          <div className="mh-field">
            <label className="mh-lbl">Token läuft ab am (optional)</label>
            <input className="mh-input" type="date" value={form.token_expires_at}
              onChange={e => setForm(f => ({ ...f, token_expires_at: e.target.value }))} />
          </div>
          <p className="mh-hint">Den Page Access Token findest du im Meta Developer Portal unter deiner App → Graph API Explorer → Page Access Token generieren.</p>
        </div>
        <div className="mh-modal-foot">
          <button className="mh-btn mh-btn--ghost" onClick={onClose}>Abbrechen</button>
          <button className="mh-btn mh-btn--primary" onClick={handleSave} disabled={saving}>{saving ? 'Speichern…' : 'Speichern'}</button>
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

  const handlePost = async (publishNow = false) => {
    if (!content.trim()) { setPostFlash({ type: 'error', msg: 'Kein Inhalt eingegeben.' }); return; }
    if (!selectedChannels.length) { setPostFlash({ type: 'error', msg: 'Bitte mindestens einen Kanal wählen.' }); return; }
    setPosting(true);
    try {
      const channels = selectedChannels.map(a => ({
        account_type: a.account_type,
        account_id: a.id,
        platform: a.platform,
      }));
      const { data } = await axios.post('/marketing-hub/posts', {
        content, channels, scheduled_at: (!publishNow && scheduledAt) ? scheduledAt : null,
      });
      if (publishNow) {
        await axios.post(`/marketing-hub/posts/${data.id}/publish`);
        setPostFlash({ type: 'success', msg: `Gepostet auf ${selectedChannels.length} Kanal${selectedChannels.length > 1 ? 'en' : ''} ✓` });
      } else {
        setPostFlash({ type: 'success', msg: scheduledAt ? 'Geplant ✓' : 'Entwurf gespeichert ✓' });
      }
      setContent(''); setSelectedChannels([]); setScheduledAt('');
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

      {showAddAccount && <AccountForm onSaved={() => { setShowAddAccount(false); load(); }} onClose={() => setShowAddAccount(false)} />}
    </div>
  );
}
