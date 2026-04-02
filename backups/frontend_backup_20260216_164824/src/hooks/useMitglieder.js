/**
 * Custom Hook für Mitglieder-Verwaltung
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export const useMitglieder = (initialFilter = {}) => {
  const [mitglieder, setMitglieder] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState(initialFilter);

  const fetchMitglieder = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.mitglieder.getAll(filter);
      setMitglieder(response.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const createMitglied = useCallback(async (data) => {
    try {
      const response = await api.mitglieder.create(data);
      setMitglieder(prev => [...prev, response.data]);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const updateMitglied = useCallback(async (id, data) => {
    try {
      const response = await api.mitglieder.update(id, data);
      setMitglieder(prev => 
        prev.map(m => m.id === id ? response.data : m)
      );
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  const deleteMitglied = useCallback(async (id) => {
    try {
      await api.mitglieder.delete(id);
      setMitglieder(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      setError(err.response?.data?.message || err.message);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchMitglieder();
  }, [fetchMitglieder]);

  return {
    mitglieder,
    loading,
    error,
    filter,
    setFilter,
    refresh: fetchMitglieder,
    create: createMitglied,
    update: updateMitglied,
    delete: deleteMitglied,
  };
};
