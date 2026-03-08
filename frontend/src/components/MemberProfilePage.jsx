/**
 * MemberProfilePage.jsx
 * Komplett neu aufgebaute mobile-first "Meine Daten" Seite.
 * Ersetzt den MitgliedDetailShared-Wrapper für /member/profile.
 * MitgliedDetailShared.jsx wird NICHT verwendet.
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useDojoContext } from '../context/DojoContext.jsx'
import { fetchWithAuth } from '../utils/fetchWithAuth'
import config from '../config/config.js'
import '../styles/MemberProfilePage.css'

// ── Hilfsfunktionen ──────────────────────────────────────────────────
const fmt = (v) => v || '–'
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '–'

const BELT_COLORS = {
  weiss: '#e8e8e8', gelb: '#f5c800', orange: '#f07800',
  gruen: '#28a428', blau: '#1464c8', lila: '#8c14c8',
  braun: '#784014', schwarz: '#333', rot: '#c81414',
}
const beltColor = (g) => BELT_COLORS[(g || '').toLowerCase()] || '#666'

// ── Avatar-Initialen ─────────────────────────────────────────────────
const AvatarCircle = ({ vorname, nachname, fotoPfad, size = 80 }) => {
  const initials = `${(vorname || '?')[0]}${(nachname || '')[0] || ''}`.toUpperCase()
  if (fotoPfad) {
    const src = fotoPfad.startsWith('http') ? fotoPfad : `${config.imageBaseUrl}/${fotoPfad}`
    return (
      <img
        src={src}
        alt="Profilfoto"
        className="mp-avatar-img"
        style={{ width: size, height: size }}
        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
      />
    )
  }
  return (
    <div className="mp-avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.35 }}>
      {initials}
    </div>
  )
}

// ── Sektion-Karte ────────────────────────────────────────────────────
const Section = ({ title, icon, children, action }) => (
  <div className="mp-section">
    <div className="mp-section-header">
      <span className="mp-section-icon">{icon}</span>
      <span className="mp-section-title">{title}</span>
      {action}
    </div>
    <div className="mp-section-body">{children}</div>
  </div>
)

// ── Datenzeile ───────────────────────────────────────────────────────
const Row = ({ label, value, children }) => (
  <div className="mp-row">
    <span className="mp-row-label">{label}</span>
    <span className="mp-row-value">{children ?? fmt(value)}</span>
  </div>
)

// ── Push-Helper ──────────────────────────────────────────────────────
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)))
}

// ── Edit-Input ───────────────────────────────────────────────────────
const EditField = ({ label, value, onChange, type = 'text', placeholder }) => (
  <div className="mp-edit-field">
    <label className="mp-edit-label">{label}</label>
    <input
      className="mp-edit-input"
      type={type}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || label}
      autoComplete="off"
    />
  </div>
)

// ════════════════════════════════════════════════════════════════════
const MemberProfilePage = () => {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { activeDojo } = useDojoContext()

  const [data, setData]         = useState(null)
  const [attendance, setAtt]    = useState([])
  const [vertraege, setVertr]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [toast, setToast]       = useState(null)

  // Edit-States
  const [editContact, setEditContact]   = useState(false)
  const [editPw, setEditPw]             = useState(false)
  const [editNotfall, setEditNotfall]   = useState(false)
  const [contactDraft, setContactDraft] = useState({})
  const [pwForm, setPwForm]             = useState({ old: '', neu: '', confirm: '' })
  const [notfallDraft, setNotfallDraft] = useState({
    notfallkontakt_name: '', notfallkontakt_telefon: '', notfallkontakt_verhaeltnis: '',
    allergien: '', medizinische_hinweise: ''
  })
  const [saving, setSaving]             = useState(false)

  const fileRef = useRef()

  // ── Push-Notification State ───────────────────────────────────────
  const [pushStatus, setPushStatus] = useState('unknown') // 'unknown'|'granted'|'denied'|'unsupported'
  const [pushLoading, setPushLoading] = useState(false)

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('unsupported')
    } else {
      setPushStatus(Notification.permission)
    }
  }, [])

  const handlePushSubscribe = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      showToast('Push-Benachrichtigungen werden von diesem Browser nicht unterstützt', 'error')
      return
    }
    setPushLoading(true)
    try {
      const permission = await Notification.requestPermission()
      setPushStatus(permission)
      if (permission !== 'granted') {
        showToast('Push-Benachrichtigungen wurden abgelehnt', 'error')
        return
      }
      const registration = await navigator.serviceWorker.ready
      const vapidPublicKey = 'BKzKRA_Tojs8YsxKH5yR2oToWDm5uI8QvMjZNLCP6hSMBxyA3pwOIk2rc80a8kyd04T4stIUIrLXMj2O_CMCnfc'
      const convertedKey = urlBase64ToUint8Array(vapidPublicKey)
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey
        })
      }
      const subJson = subscription.toJSON()
      const res = await fetchWithAuth(`${config.apiBaseUrl}/notifications/push/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
          userAgent: navigator.userAgent
        })
      })
      const resData = await res.json()
      if (resData.success) {
        showToast('Push-Benachrichtigungen aktiviert ✓')
      } else {
        showToast(resData.message || 'Fehler beim Aktivieren', 'error')
      }
    } catch (err) {
      showToast('Fehler: ' + err.message, 'error')
    } finally {
      setPushLoading(false)
    }
  }

  // ── Daten laden ──────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const id = user?.mitglied_id
      if (!id) { setError('Kein Mitgliedsprofil gefunden.'); setLoading(false); return }
      try {
        const [mRes, aRes, vRes] = await Promise.all([
          fetchWithAuth(`${config.apiBaseUrl}/mitglieddetail/${id}`),
          fetchWithAuth(`${config.apiBaseUrl}/anwesenheit/${id}`),
          fetchWithAuth(`${config.apiBaseUrl}/vertraege?mitglied_id=${id}`),
        ])
        if (!mRes.ok) throw new Error(`HTTP ${mRes.status}`)
        const mJson = await mRes.json()
        const m = mJson.data || mJson
        setData(m)
        setContactDraft({
          email: m.email, telefon: m.telefon, telefon_mobil: m.telefon_mobil,
          strasse: m.strasse, hausnummer: m.hausnummer, plz: m.plz, ort: m.ort,
        })
        setNotfallDraft({
          notfallkontakt_name: m.notfallkontakt_name || '',
          notfallkontakt_telefon: m.notfallkontakt_telefon || '',
          notfallkontakt_verhaeltnis: m.notfallkontakt_verhaeltnis || '',
          allergien: m.allergien || '',
          medizinische_hinweise: m.medizinische_hinweise || '',
        })
        if (aRes.ok) { try { setAtt(await aRes.json()) } catch (_) {} }
        if (vRes.ok) {
          const vJson = await vRes.json()
          const list = Array.isArray(vJson?.data) ? vJson.data : Array.isArray(vJson) ? vJson : []
          setVertr(list.filter(v => v.mitglied_id === id))
        }
      } catch (err) {
        if (err.message?.includes('401')) { logout(); navigate('/login') }
        else setError('Daten konnten nicht geladen werden.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user?.mitglied_id])

  // ── Toast ────────────────────────────────────────────────────────
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2800)
  }

  // ── Notfallkontakt + Medizinisches speichern ─────────────────────
  const saveNotfall = async () => {
    setSaving(true)
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/mitglieder/${data.mitglied_id}/medizinisch`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notfallkontakt_name: notfallDraft.notfallkontakt_name || null,
          notfallkontakt_telefon: notfallDraft.notfallkontakt_telefon || null,
          notfallkontakt_verhaeltnis: notfallDraft.notfallkontakt_verhaeltnis || null,
          allergien: notfallDraft.allergien || null,
          medizinische_hinweise: notfallDraft.medizinische_hinweise || null,
        })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setData(prev => ({ ...prev, ...notfallDraft }))
      setEditNotfall(false)
      showToast('Notfallkontakt gespeichert ✓')
    } catch (err) {
      showToast('Fehler beim Speichern', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Kontaktdaten speichern ───────────────────────────────────────
  const saveContact = async () => {
    setSaving(true)
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/mitglieddetail/${data.mitglied_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactDraft),
      })
      if (!res.ok) throw new Error()
      setData(prev => ({ ...prev, ...contactDraft }))
      setEditContact(false)
      showToast('Gespeichert ✓')
    } catch {
      showToast('Fehler beim Speichern', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Passwort ändern ──────────────────────────────────────────────
  const savePassword = async () => {
    if (pwForm.neu !== pwForm.confirm) { showToast('Passwörter stimmen nicht überein', 'error'); return }
    if (pwForm.neu.length < 8) { showToast('Mindestens 8 Zeichen', 'error'); return }
    setSaving(true)
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwForm.old, newPassword: pwForm.neu }),
      })
      if (!res.ok) { const j = await res.json(); throw new Error(j.message || 'Fehler') }
      setEditPw(false)
      setPwForm({ old: '', neu: '', confirm: '' })
      showToast('Passwort geändert ✓')
    } catch (err) {
      showToast(err.message || 'Fehler beim Ändern', 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Foto hochladen ───────────────────────────────────────────────
  const handleFotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('foto', file)
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/mitglieddetail/${data.mitglied_id}/foto`, {
        method: 'POST', body: fd,
      })
      if (!res.ok) throw new Error()
      const j = await res.json()
      setData(prev => ({ ...prev, foto_pfad: j.foto_pfad || prev.foto_pfad }))
      showToast('Foto gespeichert ✓')
    } catch {
      showToast('Fehler beim Hochladen', 'error')
    }
  }

  // ── Anwesenheits-Statistik ───────────────────────────────────────
  const attCount = Array.isArray(attendance)
    ? attendance.reduce((sum, s) => sum + (s.trainings_count || s.anzahl || 0), 0)
    : 0

  // ── Aktiver Vertrag ──────────────────────────────────────────────
  const aktVertr = vertraege.find(v =>
    v.status === 'aktiv' || v.vertrags_status === 'aktiv' || v.status === 'Aktiv'
  )

  // ── QR-Daten ─────────────────────────────────────────────────────
  const qrData = data
    ? `DOJO-MEMBER:${data.mitglied_id}:${activeDojo?.id || 0}:${data.mitglied_id}`
    : ''
  const qrUrl = qrData
    ? `https://quickchart.io/qr?text=${encodeURIComponent(qrData)}&size=200&dark=111111&light=ffffff&margin=2`
    : ''

  // ── Render ───────────────────────────────────────────────────────
  if (loading) return (
    <div className="mp-page">
      <div className="mp-loading"><div className="mp-spinner" /><span>Lade Profil…</span></div>
    </div>
  )

  if (error) return (
    <div className="mp-page">
      <div className="mp-error">
        <span>⚠️</span>
        <p>{error}</p>
        <button className="mp-btn mp-btn--outline" onClick={() => navigate('/member/dashboard')}>
          Zurück
        </button>
      </div>
    </div>
  )

  return (
    <div className="mp-page">

      {/* ── Top-Bar ─────────────────────────────────────────────── */}
      <header className="mp-topbar">
        <button className="mp-back" onClick={() => navigate('/member/dashboard')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span className="mp-topbar-title">Mein Profil</span>
        <button className="mp-logout-btn" onClick={() => { logout(); navigate('/login') }} title="Abmelden">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </header>

      {/* ── Scrollbarer Inhalt ───────────────────────────────────── */}
      <main className="mp-scroll">

        {/* ── Profil-Header ───────────────────────────────────── */}
        <div className="mp-hero">
          <button className="mp-avatar-wrap" onClick={() => fileRef.current?.click()} title="Foto ändern">
            <AvatarCircle vorname={data.vorname} nachname={data.nachname} fotoPfad={data.foto_pfad} size={90} />
            <span className="mp-avatar-edit">📷</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="mp-hidden" onChange={handleFotoUpload} />

          <div className="mp-hero-info">
            <h1 className="mp-hero-name">{data.vorname} {data.nachname}</h1>
            {data.gurtfarbe && (
              <span className="mp-belt-badge" style={{ '--belt-color': beltColor(data.gurtfarbe) }}>
                <span className="mp-belt-dot" />
                {data.gurtfarbe.charAt(0).toUpperCase() + data.gurtfarbe.slice(1).toLowerCase()} Gurt
              </span>
            )}
            <span className="mp-member-num">Mitglied #{String(data.mitglied_id).padStart(5, '0')}</span>
          </div>
        </div>

        {/* ── Schnellübersicht ─────────────────────────────────── */}
        <div className="mp-stats-row">
          <div className="mp-stat-card">
            <span className="mp-stat-num">{attCount}</span>
            <span className="mp-stat-label">Trainings</span>
          </div>
          <div className="mp-stat-card">
            <span className="mp-stat-num">{fmtDate(data.eintrittsdatum)}</span>
            <span className="mp-stat-label">Mitglied seit</span>
          </div>
          <div className="mp-stat-card">
            <span className={`mp-stat-num mp-stat-num--${aktVertr ? 'green' : 'muted'}`}>
              {aktVertr ? 'Aktiv' : '–'}
            </span>
            <span className="mp-stat-label">Vertrag</span>
          </div>
        </div>

        {/* ── Mitgliedsausweis ─────────────────────────────────── */}
        <Section title="Mitgliedsausweis" icon="🪪">
          <div className="mp-ausweis">
            <div className="mp-ausweis-card">
              <div className="mp-ausweis-top">
                <div>
                  <div className="mp-ausweis-dojo">{activeDojo?.dojoname || 'Kampfkunstschule'}</div>
                  <div className="mp-ausweis-name">{data.vorname} {data.nachname}</div>
                  <div className="mp-ausweis-meta">Nr. {String(data.mitglied_id).padStart(5, '0')}</div>
                  {data.gurtfarbe && (
                    <div className="mp-ausweis-belt" style={{ '--belt-color': beltColor(data.gurtfarbe) }}>
                      {data.gurtfarbe.charAt(0).toUpperCase() + data.gurtfarbe.slice(1).toLowerCase()} Gurt
                    </div>
                  )}
                </div>
                {qrUrl && <img src={qrUrl} alt="QR" className="mp-ausweis-qr" />}
              </div>
            </div>
            <p className="mp-ausweis-hint">QR-Code beim Check-In vorzeigen</p>
          </div>
        </Section>

        {/* ── Kontaktdaten ─────────────────────────────────────── */}
        <Section
          title="Kontaktdaten"
          icon="📋"
          action={
            !editContact
              ? <button className="mp-edit-btn" onClick={() => setEditContact(true)}>Bearbeiten</button>
              : null
          }
        >
          {!editContact ? (
            <>
              <Row label="E-Mail" value={data.email} />
              <Row label="Telefon" value={data.telefon} />
              <Row label="Mobil" value={data.telefon_mobil} />
              <Row label="Adresse">
                {(data.strasse || data.hausnummer || data.plz || data.ort)
                  ? `${data.strasse || ''} ${data.hausnummer || ''}, ${data.plz || ''} ${data.ort || ''}`
                  : '–'}
              </Row>
              <Row label="Geburtsdatum" value={fmtDate(data.geburtsdatum)} />
            </>
          ) : (
            <div className="mp-edit-form">
              <EditField label="E-Mail" type="email" value={contactDraft.email} onChange={v => setContactDraft(p => ({ ...p, email: v }))} />
              <EditField label="Telefon" type="tel" value={contactDraft.telefon} onChange={v => setContactDraft(p => ({ ...p, telefon: v }))} />
              <EditField label="Mobil" type="tel" value={contactDraft.telefon_mobil} onChange={v => setContactDraft(p => ({ ...p, telefon_mobil: v }))} />
              <div className="mp-edit-row-2">
                <EditField label="Straße" value={contactDraft.strasse} onChange={v => setContactDraft(p => ({ ...p, strasse: v }))} />
                <EditField label="Nr." value={contactDraft.hausnummer} onChange={v => setContactDraft(p => ({ ...p, hausnummer: v }))} />
              </div>
              <div className="mp-edit-row-2">
                <EditField label="PLZ" value={contactDraft.plz} onChange={v => setContactDraft(p => ({ ...p, plz: v }))} />
                <EditField label="Ort" value={contactDraft.ort} onChange={v => setContactDraft(p => ({ ...p, ort: v }))} />
              </div>
              <div className="mp-edit-actions">
                <button className="mp-btn mp-btn--outline" onClick={() => { setEditContact(false); setContactDraft({ email: data.email, telefon: data.telefon, telefon_mobil: data.telefon_mobil, strasse: data.strasse, hausnummer: data.hausnummer, plz: data.plz, ort: data.ort }) }}>
                  Abbrechen
                </button>
                <button className="mp-btn mp-btn--primary" onClick={saveContact} disabled={saving}>
                  {saving ? 'Speichert…' : 'Speichern'}
                </button>
              </div>
            </div>
          )}
        </Section>

        {/* ── Mein Training ────────────────────────────────────── */}
        <Section title="Mein Training" icon="🥋">
          {data.gurtfarbe && (
            <div className="mp-belt-row">
              <span className="mp-belt-swatch" style={{ '--belt-color': beltColor(data.gurtfarbe) }} />
              <div>
                <div className="mp-belt-name">{data.gurtfarbe.charAt(0).toUpperCase() + data.gurtfarbe.slice(1).toLowerCase()} Gurt</div>
                {data.letzte_pruefung && <div className="mp-belt-date">Letzte Prüfung: {fmtDate(data.letzte_pruefung)}</div>}
              </div>
            </div>
          )}
          <Row label="Trainings gesamt" value={attCount > 0 ? attCount : '–'} />
          {Array.isArray(attendance) && attendance.length > 0 && attendance.map((s, i) => (
            s.stil_name && <Row key={i} label={s.stil_name} value={`${s.trainings_count || s.anzahl || 0} Einheiten`} />
          ))}
        </Section>

        {/* ── Vertrag ──────────────────────────────────────────── */}
        <Section title="Mein Vertrag" icon="📄">
          {vertraege.length === 0
            ? <p className="mp-empty">Kein Vertrag gefunden</p>
            : vertraege.slice(0, 3).map((v, i) => (
              <div key={i} className="mp-vertrag-row">
                <div className="mp-vertrag-info">
                  <span className="mp-vertrag-name">{v.tarif_name || v.vertragsart || `Vertrag ${i + 1}`}</span>
                  {v.monatsbeitrag && <span className="mp-vertrag-price">{Number(v.monatsbeitrag).toFixed(2)} €/Monat</span>}
                </div>
                <span className={`mp-vertrag-status mp-vertrag-status--${(v.status || v.vertrags_status || '').toLowerCase()}`}>
                  {v.status || v.vertrags_status || '–'}
                </span>
              </div>
            ))
          }
        </Section>

        {/* ── Notfallkontakt & Gesundheit ──────────────────────── */}
        <Section
          title="Notfallkontakt & Gesundheit"
          icon="🆘"
          action={
            !editNotfall
              ? <button className="mp-edit-btn" onClick={() => setEditNotfall(true)}>Bearbeiten</button>
              : null
          }
        >
          {!editNotfall ? (
            <>
              <Row label="Notfallkontakt" value={data.notfallkontakt_name} />
              <Row label="Telefon" value={data.notfallkontakt_telefon} />
              <Row label="Verhältnis" value={data.notfallkontakt_verhaeltnis} />
              {(data.allergien || data.medizinische_hinweise) && (
                <div className="mp-medizin-section">
                  <Row label="Allergien" value={data.allergien} />
                  <Row label="Med. Hinweise" value={data.medizinische_hinweise} />
                </div>
              )}
              {!data.notfallkontakt_name && (
                <p className="mp-empty mp-empty--sm">Noch kein Notfallkontakt hinterlegt.</p>
              )}
            </>
          ) : (
            <div className="mp-edit-form">
              <EditField label="Name des Notfallkontakts" value={notfallDraft.notfallkontakt_name} onChange={v => setNotfallDraft(p => ({ ...p, notfallkontakt_name: v }))} />
              <EditField label="Telefon" type="tel" value={notfallDraft.notfallkontakt_telefon} onChange={v => setNotfallDraft(p => ({ ...p, notfallkontakt_telefon: v }))} />
              <div className="mp-edit-field">
                <label className="mp-edit-label">Verhältnis</label>
                <select
                  className="mp-edit-input"
                  value={notfallDraft.notfallkontakt_verhaeltnis}
                  onChange={e => setNotfallDraft(p => ({ ...p, notfallkontakt_verhaeltnis: e.target.value }))}
                >
                  <option value="">Bitte wählen</option>
                  {['Mutter','Vater','Partner/in','Geschwister','Freund/in','Sonstige/r'].map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="mp-medizin-section">
                <div className="mp-edit-field">
                  <label className="mp-edit-label">Allergien (optional)</label>
                  <textarea
                    className="mp-edit-input mp-edit-input--textarea"
                    rows={2}
                    value={notfallDraft.allergien}
                    onChange={e => setNotfallDraft(p => ({ ...p, allergien: e.target.value }))}
                    placeholder="z.B. Bienenallergie, Laktoseintoleranz…"
                  />
                </div>
                <div className="mp-edit-field">
                  <label className="mp-edit-label">Medizinische Hinweise (optional)</label>
                  <textarea
                    className="mp-edit-input mp-edit-input--textarea"
                    rows={2}
                    value={notfallDraft.medizinische_hinweise}
                    onChange={e => setNotfallDraft(p => ({ ...p, medizinische_hinweise: e.target.value }))}
                    placeholder="z.B. Asthma, Knieprobleme…"
                  />
                </div>
              </div>
              <div className="mp-edit-actions">
                <button className="mp-btn mp-btn--outline" onClick={() => {
                  setEditNotfall(false)
                  setNotfallDraft({
                    notfallkontakt_name: data.notfallkontakt_name || '',
                    notfallkontakt_telefon: data.notfallkontakt_telefon || '',
                    notfallkontakt_verhaeltnis: data.notfallkontakt_verhaeltnis || '',
                    allergien: data.allergien || '',
                    medizinische_hinweise: data.medizinische_hinweise || '',
                  })
                }}>Abbrechen</button>
                <button className="mp-btn mp-btn--primary" onClick={saveNotfall} disabled={saving}>
                  {saving ? 'Speichert…' : 'Speichern'}
                </button>
              </div>
            </div>
          )}
        </Section>

        {/* ── Sicherheit ───────────────────────────────────────── */}
        <Section
          title="Sicherheit"
          icon="🔒"
          action={
            !editPw
              ? <button className="mp-edit-btn" onClick={() => setEditPw(true)}>Ändern</button>
              : null
          }
        >
          {!editPw
            ? <Row label="Passwort" value="••••••••" />
            : (
              <div className="mp-edit-form">
                <EditField label="Aktuelles Passwort" type="password" value={pwForm.old} onChange={v => setPwForm(p => ({ ...p, old: v }))} />
                <EditField label="Neues Passwort" type="password" value={pwForm.neu} onChange={v => setPwForm(p => ({ ...p, neu: v }))} />
                <EditField label="Passwort bestätigen" type="password" value={pwForm.confirm} onChange={v => setPwForm(p => ({ ...p, confirm: v }))} />
                <div className="mp-edit-actions">
                  <button className="mp-btn mp-btn--outline" onClick={() => { setEditPw(false); setPwForm({ old: '', neu: '', confirm: '' }) }}>Abbrechen</button>
                  <button className="mp-btn mp-btn--primary" onClick={savePassword} disabled={saving}>{saving ? 'Speichert…' : 'Speichern'}</button>
                </div>
              </div>
            )
          }
        </Section>

        {/* ── Benachrichtigungen ───────────────────────────────── */}
        <Section title="Benachrichtigungen" icon="🔔">
          {pushStatus === 'unsupported' ? (
            <p className="mp-empty">Push-Benachrichtigungen werden von diesem Browser nicht unterstützt.</p>
          ) : pushStatus === 'denied' ? (
            <p className="mp-empty">Push-Benachrichtigungen wurden blockiert. Bitte erlaube sie in den Browser-Einstellungen.</p>
          ) : pushStatus === 'granted' ? (
            <div>
              <Row label="Push-Benachrichtigungen"><span className="mp-push-active">Aktiviert ✓</span></Row>
              <button className="mp-btn mp-btn--outline mp-btn--mt" onClick={handlePushSubscribe} disabled={pushLoading}>
                {pushLoading ? 'Wird aktualisiert…' : 'Dieses Gerät neu registrieren'}
              </button>
            </div>
          ) : (
            <div>
              <p className="mp-empty mp-empty--mb">Erhalte Benachrichtigungen über Neuigkeiten vom Dojo direkt auf diesem Gerät.</p>
              <button className="mp-btn mp-btn--primary" onClick={handlePushSubscribe} disabled={pushLoading}>
                {pushLoading ? 'Wird aktiviert…' : '🔔 Push-Benachrichtigungen aktivieren'}
              </button>
            </div>
          )}
        </Section>

        <div className="mp-bottom-space" />
      </main>

      {/* ── Toast ────────────────────────────────────────────────── */}
      {toast && (
        <div className={`mp-toast mp-toast--${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  )
}

export default MemberProfilePage
