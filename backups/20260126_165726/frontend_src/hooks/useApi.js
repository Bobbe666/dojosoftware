/**
 * Generic API Hook für standardisierte API-Calls
 */
import { useState, useEffect, useCallback } from 'react';

/**
 * Generic Hook für API-Calls mit Loading/Error State
 * 
 * @param {Function} apiFunction - API-Funktion aus services/api
 * @param {Array} dependencies - Dependencies für useEffect
 * @param {boolean} immediate - Sofort ausführen oder manuell triggern
 */
export const useApi = (apiFunction, dependencies = [], immediate = true) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const execute = useCallback(async (...args) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiFunction(...args);
      setData(response.data);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiFunction]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, dependencies);

  return { data, loading, error, execute };
};
