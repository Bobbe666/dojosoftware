import React, { useState, useEffect, useCallback } from "react";

const API_BASE = window.API_BASE || "/api";

/**
 * Verwaltung der Lastschrift-Gruppen eines Dojos (Name + fester Einzugstag).
 * Mitglieder werden in der Detailansicht einer Gruppe zugeordnet und am
 * Einzugstag der Gruppe automatisch eingezogen.
 */
export default function LastschriftGruppenVerwaltung({ dojoId }) {
  const [gruppen, setGruppen] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [neu, setNeu] = useState({ name: "", einzugstag: 1 });
  const numericDojo = dojoId && dojoId !== "all" ? dojoId : null;

  const load = useCallback(() => {
    if (!numericDojo) { setGruppen([]); return; }
    setLoading(true);
    fetch(`${API_BASE}/lastschrift-gruppen?dojo_id=${numericDojo}`)
      .then((r) => r.json())
      .then((d) => setGruppen(d.gruppen || []))
      .catch(() => setGruppen([]))
      .finally(() => setLoading(false));
  }, [numericDojo]);

  useEffect(() => { load(); }, [load]);

  const speichern = async (g, patch) => {
    await fetch(`${API_BASE}/lastschrift-gruppen/${g.id}?dojo_id=${numericDojo}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dojo_id: numericDojo, ...patch }),
    });
    load();
  };

  const anlegen = async () => {
    if (!neu.name.trim()) return;
    await fetch(`${API_BASE}/lastschrift-gruppen?dojo_id=${numericDojo}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dojo_id: numericDojo, name: neu.name.trim(), einzugstag: parseInt(neu.einzugstag, 10) || 1 }),
    });
    setNeu({ name: "", einzugstag: 1 });
    load();
  };

  const loeschen = async (g) => {
    if (g.ist_standard) { alert("Die Standard-Gruppe kann nicht gelöscht werden."); return; }
    if (!window.confirm(`Gruppe "${g.name}" löschen? Zugeordnete Mitglieder werden auf die Standard-Gruppe zurückgesetzt.`)) return;
    await fetch(`${API_BASE}/lastschrift-gruppen/${g.id}?dojo_id=${numericDojo}`, { method: "DELETE" });
    load();
  };

  if (!numericDojo) return null;

  const cell = { padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.07)", fontSize: 14 };

  return (
    <div className="card" style={{ marginBottom: 16, padding: 0, overflow: "hidden" }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", cursor: "pointer", background: "rgba(255,255,255,0.03)" }}
      >
        <span style={{ fontSize: 16 }}>👥</span>
        <strong style={{ flex: 1 }}>Lastschrift-Gruppen ({gruppen.length})</strong>
        <span style={{ color: "#888" }}>{open ? "▲" : "▼"}</span>
      </div>

      {open && (
        <div style={{ padding: "8px 16px 16px" }}>
          <p style={{ color: "#888", fontSize: 13, marginTop: 4 }}>
            Jede Gruppe hat einen festen Einzugstag. Mitglieder werden in der Detailansicht einer Gruppe zugeordnet
            und am Einzugstag automatisch eingezogen (passenden Zeitplan oben mit der Gruppe verknüpfen).
          </p>

          {loading ? (
            <div style={{ color: "#888", padding: 8 }}>Lädt…</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#888", fontSize: 12 }}>
                  <th style={cell}>Name</th>
                  <th style={cell}>Einzugstag</th>
                  <th style={cell}>Mitglieder</th>
                  <th style={cell}>Standard</th>
                  <th style={cell}>Aktiv</th>
                  <th style={cell}></th>
                </tr>
              </thead>
              <tbody>
                {gruppen.map((g) => (
                  <tr key={g.id}>
                    <td style={cell}>
                      <input
                        defaultValue={g.name}
                        onBlur={(e) => e.target.value.trim() && e.target.value !== g.name && speichern(g, { name: e.target.value.trim() })}
                        style={{ width: "100%", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "inherit", padding: "4px 6px" }}
                      />
                    </td>
                    <td style={cell}>
                      <select
                        value={g.einzugstag}
                        onChange={(e) => speichern(g, { einzugstag: parseInt(e.target.value, 10) })}
                        style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "inherit", padding: "4px 6px" }}
                      >
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d} style={{ color: "#000" }}>{d}.</option>
                        ))}
                      </select>
                    </td>
                    <td style={cell}>{g.anzahl_mitglieder ?? 0}</td>
                    <td style={cell}>
                      <input
                        type="radio"
                        name="ls-standard"
                        checked={!!g.ist_standard}
                        onChange={() => speichern(g, { ist_standard: true })}
                        title="Als Standard für neue Mitglieder"
                      />
                    </td>
                    <td style={cell}>
                      <input
                        type="checkbox"
                        checked={g.aktiv !== 0}
                        onChange={(e) => speichern(g, { aktiv: e.target.checked })}
                      />
                    </td>
                    <td style={cell}>
                      <button
                        onClick={() => loeschen(g)}
                        disabled={!!g.ist_standard}
                        title={g.ist_standard ? "Standard-Gruppe kann nicht gelöscht werden" : "Löschen"}
                        style={{ background: "none", border: "none", color: g.ist_standard ? "#555" : "#ef4444", cursor: g.ist_standard ? "default" : "pointer" }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Neue Gruppe */}
          <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
            <input
              placeholder="Neue Gruppe (z.B. Monatsende)"
              value={neu.name}
              onChange={(e) => setNeu((n) => ({ ...n, name: e.target.value }))}
              style={{ flex: 1, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "inherit", padding: "6px 8px" }}
            />
            <select
              value={neu.einzugstag}
              onChange={(e) => setNeu((n) => ({ ...n, einzugstag: e.target.value }))}
              style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "inherit", padding: "6px 8px" }}
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d} style={{ color: "#000" }}>Einzug am {d}.</option>
              ))}
            </select>
            <button className="btn btn-primary ll-btn-sm" onClick={anlegen} disabled={!neu.name.trim()}>
              + Gruppe
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
