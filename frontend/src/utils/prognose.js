// ============================================================================
// ZENTRALE Prognose-Methode (eine Engine für alle Dashboards)
// Identisch zur Backend-Implementierung in /api/admin/prognose:
// Ø monatliches Wachstum, Spike-Filter via Median (Ausreißer > 3×Median gekappt).
// Für Zeitreihen (z.B. Umsatz-Timeline) wird das Ø-Delta fortgeschrieben.
// ============================================================================

/** Ø-Wachstum einer Werte-Reihe mit Median-Spike-Filter */
export function avgGrowthMedianFiltered(deltas) {
  const werte = deltas.map(v => Number(v) || 0);
  if (werte.length === 0) return 0;
  const sortiert = [...werte].sort((a, b) => a - b);
  const median = sortiert[Math.floor(sortiert.length / 2)];
  const gefiltert = werte.map(v => (median > 0 && v > median * 3) ? median : v);
  return gefiltert.reduce((a, b) => a + b, 0) / gefiltert.length;
}

/**
 * Hängt an eine monatliche Zeitreihe Prognose-Punkte an (zentrale Methode).
 * @param {Array<{label?:string}>} data  Zeitreihe (alt → neu)
 * @param {string} valueKey  Feld mit dem Monatswert (z.B. 'umsatz')
 * @param {number} monate    Anzahl Prognose-Monate (default 6)
 * @returns Kopie der Reihe + Prognose-Punkte { label, prognose, prognoseMin, prognoseMax, isPrognose }
 */
export function appendPrognose(data, valueKey = 'umsatz', monate = 6) {
  if (!data || data.length < 3) return data;
  const werte = data.map(p => Number(p[valueKey]) || 0);
  // Monatliche Deltas, Ø-Wachstum mit Spike-Filter
  const deltas = werte.slice(1).map((v, i) => v - werte[i]);
  const avgDelta = avgGrowthMedianFiltered(deltas.map(d => Math.abs(d))) *
    Math.sign(deltas.reduce((a, b) => a + b, 0) || 1);
  const letzter = werte[werte.length - 1];

  const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const result = [...data];
  for (let i = 1; i <= monate; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() + i);
    const wert = Math.max(0, letzter + avgDelta * i);
    result.push({
      label: `${months[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`,
      [valueKey]: null,
      prognose: wert,
      prognoseMin: wert * 0.85,
      prognoseMax: wert * 1.15,
      isPrognose: true
    });
  }
  return result;
}
