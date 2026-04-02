import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import api from '../api.js'

const TYPES = [
  { key: 'direct', label: '💬 Direktnachricht', desc: '1:1 Gespräch mit einer Person', adminOnly: false },
  { key: 'group', label: '🥋 Kurs-Chat / Gruppe', desc: 'Gruppenraum mit mehreren Teilnehmern', adminOnly: false },
  { key: 'announcement', label: '📢 Ankündigung', desc: 'Kanal wo nur du schreiben kannst', adminOnly: true },
]

export default function NewRoomModal({ onClose, onCreated, dojoId, isAdmin }) {
  const [step, setStep] = useState('type')  // type | name | members | confirm
  const [type, setType] = useState('direct')
  const [name, setName] = useState('')
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [selectedMembers, setSelectedMembers] = useState([])
  const [creating, setCreating] = useState(false)

  const availableTypes = TYPES.filter(t => !t.adminOnly || isAdmin)

  const handleSearch = async (q) => {
    setSearch(q)
    if (q.length < 2) { setSearchResults([]); return }
    try {
      const params = new URLSearchParams({ q })
      if (dojoId) params.set('dojo_id', dojoId)
      const res = await api.get(`/chat/members/search?${params}`)
      setSearchResults(res.data?.results || [])
    } catch {}
  }

  const toggleMember = (m) => {
    setSelectedMembers(prev =>
      prev.find(p => p.member_id === m.member_id && p.member_type === m.member_type)
        ? prev.filter(p => !(p.member_id === m.member_id && p.member_type === m.member_type))
        : [...prev, m]
    )
  }

  const handleCreate = async () => {
    if (selectedMembers.length === 0 && type === 'direct') return
    setCreating(true)
    try {
      const roomName = type === 'direct' ? null : (name || `${type === 'announcement' ? 'Ankündigung' : 'Gruppe'} ${new Date().toLocaleDateString('de-DE')}`)
      // Super-Admin hat keine eigene dojo_id → dojo_id vom ersten ausgewählten Mitglied nehmen
      const effectiveDojoId = dojoId || selectedMembers[0]?.dojo_id || null
      const res = await api.post('/chat/rooms', {
        type,
        name: roomName,
        members: selectedMembers.map(m => ({ member_id: m.member_id, member_type: m.member_type })),
        dojo_id: effectiveDojoId
      })
      // Backend gibt { success: true, room_id } zurück → vollständiges Room-Objekt bauen
      const roomId = res.data?.room_id || res.data?.id
      const roomObj = {
        id: roomId,
        type,
        name: type === 'direct'
          ? (selectedMembers[0]?.name || 'Direktnachricht')
          : roomName,
        last_message: null,
        last_message_at: null,
        unread_count: 0
      }
      onCreated(roomObj)
    } catch (e) {
      alert(e.response?.data?.message || e.response?.data?.error || 'Fehler beim Erstellen')
    }
    setCreating(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">Neues Gespräch</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Schritt 1: Typ wählen */}
        {step === 'type' && (
          <div className="modal-body">
            {availableTypes.map(t => (
              <button
                key={t.key}
                className={`type-option${type === t.key ? ' type-option--active' : ''}`}
                onClick={() => { setType(t.key); setStep(t.key === 'announcement' ? 'name' : 'members') }}
              >
                <span className="type-option-label">{t.label}</span>
                <span className="type-option-desc">{t.desc}</span>
              </button>
            ))}
          </div>
        )}

        {/* Schritt 2: Name (bei Gruppe / Ankündigung) */}
        {step === 'name' && (
          <div className="modal-body">
            <label className="modal-label">Name</label>
            <input
              type="text"
              className="modal-input"
              placeholder={type === 'announcement' ? 'z.B. Wichtige Infos' : 'z.B. Karate Montag'}
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
            <div className="modal-footer">
              <button className="modal-btn modal-btn--secondary" onClick={() => setStep('type')}>Zurück</button>
              <button className="modal-btn modal-btn--primary" onClick={() => setStep(type === 'announcement' ? 'members' : 'members')}>Weiter</button>
            </div>
          </div>
        )}

        {/* Schritt 3: Mitglieder wählen */}
        {step === 'members' && (
          <div className="modal-body">
            {type !== 'announcement' && (
              <>
                <label className="modal-label">{type === 'direct' ? 'Person wählen' : 'Teilnehmer hinzufügen'}</label>
                <input
                  type="text"
                  className="modal-input"
                  placeholder="Name suchen…"
                  value={search}
                  onChange={e => handleSearch(e.target.value)}
                  autoFocus
                />
                {searchResults.length > 0 && (
                  <div className="modal-search-results">
                    {searchResults.map(m => {
                      const isSelected = selectedMembers.find(p => p.member_id === m.member_id && p.member_type === m.member_type)
                      return (
                        <div
                          key={`${m.member_type}_${m.member_id}`}
                          className={`search-result${isSelected ? ' search-result--selected' : ''}`}
                          onClick={() => toggleMember(m)}
                        >
                          <span className="search-result-name">{m.name}</span>
                          <span className="search-result-role">{m.member_type}</span>
                          {isSelected && <span className="search-result-check">✓</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
                {selectedMembers.length > 0 && (
                  <div className="modal-selected">
                    {selectedMembers.map(m => (
                      <span key={`${m.member_type}_${m.member_id}`} className="selected-chip">
                        {m.name} <button onClick={() => toggleMember(m)}>✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
            {type === 'announcement' && (
              <p className="modal-hint">Alle Mitglieder deines Dojos können Ankündigungen lesen.</p>
            )}
            <div className="modal-footer">
              <button className="modal-btn modal-btn--secondary" onClick={() => setStep(type === 'direct' ? 'type' : 'name')}>Zurück</button>
              <button
                className="modal-btn modal-btn--primary"
                onClick={handleCreate}
                disabled={creating || (type === 'direct' && selectedMembers.length === 0)}
              >
                {creating ? 'Erstellen…' : 'Gespräch starten'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
