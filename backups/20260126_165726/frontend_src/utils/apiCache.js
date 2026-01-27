// Frontend API Cache Utility für Performance-Optimierung
import config from '../config/config.js';

class APICache {
    constructor() {
        this.cache = new Map();
        this.defaultDuration = 5 * 60 * 1000; // 5 Minuten
    }

    // Cache-Schlüssel generieren
    generateKey(url, params = {}) {
        const paramString = Object.keys(params).sort()
            .map(key => `${key}=${params[key]}`)
            .join('&');
        if (!paramString) return url;

        // Prüfe ob URL bereits Query-Parameter hat
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}${paramString}`;
    }

    // Daten aus Cache abrufen
    get(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;

        if (Date.now() - cached.timestamp > cached.duration) {
            this.cache.delete(key);
            return null;
        }

        console.log('🟢 Cache Hit:', key);
        return cached.data;
    }

    // Daten in Cache speichern
    set(key, data, duration = this.defaultDuration) {
        console.log('🔵 Cache Set:', key);
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            duration
        });
    }

    // Cache leeren
    clear(keyPattern = null) {
        if (keyPattern) {
            // Spezifisches Pattern löschen
            for (const key of this.cache.keys()) {
                if (key.includes(keyPattern)) {
                    this.cache.delete(key);
                }
            }
        } else {
            // Kompletten Cache leeren
            this.cache.clear();
        }
        console.log('🗑️ Cache cleared:', keyPattern || 'all');
    }

    // Cache-Status anzeigen
    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
            memory: JSON.stringify(Array.from(this.cache.entries())).length
        };
    }
}

// Singleton Instance
const apiCache = new APICache();

// Fetch with Cache Function
export const fetchWithCache = async (url, options = {}, cacheDuration = undefined) => {
    const {
        headers = {},
        method = 'GET',
        body,
        bypassCache = false,
        ...fetchOptions
    } = options;

    const cacheKey = apiCache.generateKey(url, { method, body });

    // Cache nur für GET-Requests verwenden
    if (method === 'GET' && !bypassCache) {
        const cached = apiCache.get(cacheKey);
        if (cached) {
            return cached;
        }
    }

    try {
        console.log('🔴 API Call:', method, url);
        // Wenn URL relativ ist, füge baseURL hinzu
        const fullUrl = url.startsWith('http') ? url : `${config.apiBaseUrl}${url}`;
        const response = await fetch(fullUrl, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            body: body ? JSON.stringify(body) : undefined,
            ...fetchOptions
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Cache nur für erfolgreiche GET-Requests
        if (method === 'GET' && response.ok) {
            apiCache.set(cacheKey, data, cacheDuration);
        }

        return data;

    } catch (error) {
        console.error('❌ API Error:', error);
        throw error;
    }
};

// Dashboard-spezifische Fetch-Funktionen
// 🔒 TAX COMPLIANCE: Alle Dashboard-Funktionen unterstützen dojo_id Filterung
export const fetchDashboardBatch = async (token, dojoFilterParam = '') => {
    const url = dojoFilterParam
        ? `/dashboard/batch?${dojoFilterParam}`
        : '/dashboard/batch';
    return fetchWithCache(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        },
        bypassCache: true // TEMPORÄR: Cache deaktiviert zum Debuggen
    }, 3 * 60 * 1000); // 3 Minuten Cache für Dashboard
};

export const fetchDashboardStats = async (token, dojoFilterParam = '') => {
    const url = dojoFilterParam
        ? `/dashboard?${dojoFilterParam}`
        : '/dashboard';
    return fetchWithCache(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    }, 2 * 60 * 1000); // 2 Minuten Cache für Stats
};

export const fetchRecentActivities = async (token, dojoFilterParam = '') => {
    const url = dojoFilterParam
        ? `/dashboard/recent?${dojoFilterParam}`
        : '/dashboard/recent';
    return fetchWithCache(url, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    }, 1 * 60 * 1000); // 1 Minute Cache für Activities
};

// Tarife und Zahlungszyklen (länger cachen, da sich seltener ändern)
export const fetchTarife = async (token) => {
    return fetchWithCache('/tarife', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    }, 10 * 60 * 1000); // 10 Minuten Cache
};

export const fetchZahlungszyklen = async (token) => {
    return fetchWithCache('/zahlungszyklen', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    }, 10 * 60 * 1000); // 10 Minuten Cache
};

// Cache-Management Funktionen
export const invalidateCache = (pattern) => {
    apiCache.clear(pattern);
};

export const clearAllCache = () => {
    apiCache.clear();
};

export const getCacheStats = () => {
    return apiCache.getStats();
};

// Hook für React-Komponenten
export const useAPICache = () => {
    return {
        fetchWithCache,
        fetchDashboardBatch,
        fetchDashboardStats,
        fetchRecentActivities,
        fetchTarife,
        fetchZahlungszyklen,
        invalidateCache,
        clearAllCache,
        getCacheStats
    };
};

export default apiCache;