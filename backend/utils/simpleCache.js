/**
 * simpleCache — In-Memory TTL-Cache + Response-Caching-Middleware.
 *
 * Zweck: Endpunkte, die für ALLE Nutzer eines Dojos dasselbe liefern
 * (news/public, stile, standorte, trainer, gruppen, dojo-theme, subscription),
 * werden beim Login-Sturm der Member-App nicht für jeden Nutzer neu aus der DB
 * berechnet, sondern für einen kurzen TTL aus dem Speicher bedient.
 *
 * Nur für GET-Routen ohne nutzerspezifische Antwort verwenden.
 */

const store = new Map(); // key -> { value, expires }

function get(key) {
  const e = store.get(key);
  if (!e) return undefined;
  if (e.expires < Date.now()) { store.delete(key); return undefined; }
  return e.value;
}

function set(key, value, ttlMs) {
  store.set(key, { value, expires: Date.now() + ttlMs });
}

/** Alle Keys löschen, die mit prefix beginnen (für gezielte Invalidierung nach Writes). */
function invalidate(prefix) {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}

function clearAll() { store.clear(); }

// Periodisches Aufräumen abgelaufener Einträge (leichtgewichtig).
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [k, e] of store) if (e.expires < now) store.delete(k);
}, 5 * 60 * 1000);
if (cleanupTimer.unref) cleanupTimer.unref();

/**
 * Cache-Key: URL (inkl. Query) + Dojo-Scope. Zwei Mitglieder desselben Dojos
 * teilen denselben Key; verschiedene Dojos / Super-Admin-Scopes nicht.
 */
function defaultKey(req) {
  const scope = req.user?.dojo_id ?? req.query?.dojo_id ?? 'sa';
  return `${req.originalUrl}::${scope}`;
}

/**
 * Express-Middleware: cached die 200-JSON-Antwort einer GET-Route für ttlMs.
 * Einsatz: router.get('/path', cacheGet(60000), handler)
 */
function cacheGet(ttlMs = 60000, keyFn = defaultKey) {
  return (req, res, next) => {
    if (req.method !== 'GET') return next();
    const key = keyFn(req);
    const cached = get(key);
    if (cached !== undefined) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }
    const origJson = res.json.bind(res);
    res.json = (body) => {
      try { if (res.statusCode === 200) set(key, body, ttlMs); } catch { /* ignore */ }
      res.set('X-Cache', 'MISS');
      return origJson(body);
    };
    next();
  };
}

module.exports = { get, set, invalidate, clearAll, cacheGet, defaultKey };
