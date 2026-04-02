/**
 * openApiBlob.js
 * ===============
 * Öffnet oder lädt API-Antworten (PDF, HTML, CSV, XML) korrekt herunter.
 * Axios schickt dabei automatisch den Auth-Token (Bearer), was window.open() nicht kann.
 *
 * @param {string} url       — relativer Pfad OHNE /api-Prefix (Axios fügt ihn automatisch hinzu)
 * @param {object} [opts]
 * @param {boolean} [opts.download=false]  — true = Datei-Download statt neuer Tab
 * @param {string}  [opts.filename]        — Dateiname für Download
 */

import axios from 'axios';

export default async function openApiBlob(url, { download = false, filename } = {}) {
  // Führenden /api-Prefix entfernen, da Axios baseURL schon /api enthält
  const cleanUrl = url.replace(/^\/api\//, '/').replace(/^\/api$/, '/');

  const res = await axios.get(cleanUrl, { responseType: 'blob' });
  const mimeType = res.headers['content-type'] || 'application/octet-stream';
  const blob = new Blob([res.data], { type: mimeType });
  const blobUrl = URL.createObjectURL(blob);

  if (download) {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } else {
    const win = window.open(blobUrl, '_blank');
    if (win) win.addEventListener('load', () => URL.revokeObjectURL(blobUrl));
  }
}
