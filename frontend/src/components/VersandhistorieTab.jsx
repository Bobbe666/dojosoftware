/**
 * VersandhistorieTab.jsx
 * =======================
 * Archiv-Tab in der DokumentenZentrale — zeigt alle gesendeten Vorlagen/E-Mails/PDFs.
 * Filter: Datum von/bis, Versandart, Mitglied-Suche
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Search, Mail, FileText, Paperclip, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import '../styles/VersandhistorieTab.css';

const VERSANDART_LABELS = {
  email:         { label: 'E-Mail',          icon: Mail,        cls: 'vh-art--email' },
  email_mit_pdf: { label: 'E-Mail + PDF',     icon: Paperclip,   cls: 'vh-art--email-pdf' },
  pdf:           { label: 'PDF (Download)',   icon: FileText,    cls: 'vh-art--pdf' },
};

function VersandartBadge({ art }) {
  const info = VERSANDART_LABELS[art] || { label: art, icon: FileText, cls: '' };
  const Icon = info.icon;
  return (
    <span className={`vh-art-badge ${info.cls}`}>
      <Icon size={11} />
      {info.label}
    </span>
  );
}

function StatusBadge({ status }) {
  if (status === 'gesendet') return (
    <span className="vh-status-badge vh-status--ok"><CheckCircle size={12} /> Gesendet</span>
  );
  return (
    <span className="vh-status-badge vh-status--err"><XCircle size={12} /> Fehler</span>
  );
}

export default function VersandhistorieTab({ withDojo }) {
  const [eintraege, setEintraege] = useState([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(true);
  const [filterVon, setFilterVon] = useState('');
  const [filterBis, setFilterBis] = useState('');
  const [filterArt, setFilterArt] = useState('');
  const [suche, setSuche]         = useState('');
  const [page, setPage]           = useState(0);
  const LIMIT = 50;

  const ladeHistorie = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/versandhistorie?limit=${LIMIT}&offset=${page * LIMIT}`;
      if (filterVon) url += `&von=${filterVon}`;
      if (filterBis) url += `&bis=${filterBis}`;
      const res = await axios.get(withDojo(url));
      setEintraege(res.data.eintraege || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.warn('Versandhistorie:', err.message);
    } finally {
      setLoading(false);
    }
  }, [withDojo, filterVon, filterBis, page]);

  useEffect(() => { ladeHistorie(); }, [ladeHistorie]);

  // Client-seitige Filterung nach Art + Suche
  const gefiltert = eintraege.filter(e => {
    if (filterArt && e.versand_art !== filterArt) return false;
    if (suche) {
      const s = suche.toLowerCase();
      return (
        (e.mitglied_name || '').toLowerCase().includes(s) ||
        (e.empfaenger_email || '').toLowerCase().includes(s) ||
        (e.vorlage_name || '').toLowerCase().includes(s) ||
        (e.betreff || '').toLowerCase().includes(s)
      );
    }
    return true;
  });

  const formatDatum = (ts) =>
    ts ? new Date(ts).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';

  return (
    <div className="vh-tab">
      {/* Filterleiste */}
      <div className="vh-filters">
        <div className="vh-filter-group">
          <label>Von</label>
          <input type="date" value={filterVon} onChange={e => { setFilterVon(e.target.value); setPage(0); }} className="vh-date-input" />
        </div>
        <div className="vh-filter-group">
          <label>Bis</label>
          <input type="date" value={filterBis} onChange={e => { setFilterBis(e.target.value); setPage(0); }} className="vh-date-input" />
        </div>
        <div className="vh-filter-group">
          <label>Art</label>
          <select value={filterArt} onChange={e => setFilterArt(e.target.value)} className="vh-select">
            <option value="">Alle</option>
            <option value="email">E-Mail</option>
            <option value="email_mit_pdf">E-Mail + PDF</option>
            <option value="pdf">PDF Download</option>
          </select>
        </div>
        <div className="vh-filter-group vh-filter-search">
          <label>Suche</label>
          <div className="vh-search-wrap">
            <Search size={14} />
            <input
              type="text"
              placeholder="Mitglied, E-Mail, Vorlage..."
              value={suche}
              onChange={e => setSuche(e.target.value)}
              className="vh-search-input"
            />
          </div>
        </div>
        <button className="vh-refresh-btn" onClick={ladeHistorie} title="Aktualisieren">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Tabelle */}
      {loading ? (
        <div className="vh-loading">Lade Versandhistorie...</div>
      ) : gefiltert.length === 0 ? (
        <div className="vh-empty">
          {eintraege.length === 0
            ? 'Noch keine Dokumente gesendet. Der Versandverlauf erscheint hier sobald Vorlagen versendet werden.'
            : 'Keine Einträge für die gewählten Filter.'}
        </div>
      ) : (
        <>
          <div className="vh-count">
            {gefiltert.length} von {total} Einträgen
          </div>
          <div className="vh-table-wrap">
            <table className="vh-table">
              <thead>
                <tr>
                  <th>Datum & Zeit</th>
                  <th>Empfänger</th>
                  <th>Vorlage</th>
                  <th>Betreff</th>
                  <th>Art</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {gefiltert.map(e => (
                  <tr key={e.id} className={e.status === 'fehler' ? 'vh-row--err' : ''}>
                    <td className="vh-td-date">{formatDatum(e.gesendet_am)}</td>
                    <td className="vh-td-empf">
                      <div className="vh-empf-name">{e.mitglied_name?.trim() || e.empfaenger_name || '—'}</div>
                      {e.empfaenger_email && <div className="vh-empf-email">{e.empfaenger_email}</div>}
                    </td>
                    <td className="vh-td-vorlage">{e.vorlage_name || '—'}</td>
                    <td className="vh-td-betreff">{e.betreff || '—'}</td>
                    <td><VersandartBadge art={e.versand_art} /></td>
                    <td>
                      <StatusBadge status={e.status} />
                      {e.fehler_text && <div className="vh-err-text">{e.fehler_text}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > LIMIT && (
            <div className="vh-pagination">
              <button
                className="vh-page-btn"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >← Zurück</button>
              <span className="vh-page-info">Seite {page + 1} / {Math.ceil(total / LIMIT)}</span>
              <button
                className="vh-page-btn"
                disabled={(page + 1) * LIMIT >= total}
                onClick={() => setPage(p => p + 1)}
              >Weiter →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
