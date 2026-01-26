import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

// ============ MITGLIED QUERIES ============

export const useMitglied = (id) => {
  return useQuery({
    queryKey: ['mitglied', id],
    queryFn: async () => {
      const res = await axios.get(`/mitglieddetail/${id}`);
      return res.data;
    },
    staleTime: 15 * 60 * 1000,  // 15 Min für Mitgliederdaten
    enabled: !!id,
  });
};

export const useMitgliederListe = (dojoId) => {
  return useQuery({
    queryKey: ['mitglieder', dojoId],
    queryFn: async () => {
      const res = await axios.get('/mitglieder', {
        params: { dojo_id: dojoId }
      });
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

// ============ TARIFE & STAMMDATEN ============

export const useTarife = (dojoId) => {
  return useQuery({
    queryKey: ['tarife', dojoId],
    queryFn: async () => {
      const res = await axios.get('/tarife');
      return res.data;
    },
    staleTime: 30 * 60 * 1000,  // 30 Min - ändert sich selten
  });
};

export const useZahlungszyklen = () => {
  return useQuery({
    queryKey: ['zahlungszyklen'],
    queryFn: async () => {
      const res = await axios.get('/zahlungszyklen');
      return res.data;
    },
    staleTime: 60 * 60 * 1000,  // 1 Stunde - Stammdaten
  });
};

export const useStile = () => {
  return useQuery({
    queryKey: ['stile'],
    queryFn: async () => {
      const res = await axios.get('/stile');
      return res.data;
    },
    staleTime: 60 * 60 * 1000,
  });
};

export const useRabatte = (dojoId) => {
  return useQuery({
    queryKey: ['rabatte', dojoId],
    queryFn: async () => {
      const res = await axios.get('/tarife/rabatte');
      return res.data;
    },
    staleTime: 30 * 60 * 1000,
  });
};

// ============ FINANZEN ============

export const useBeitraege = (mitgliedId) => {
  return useQuery({
    queryKey: ['beitraege', mitgliedId],
    queryFn: async () => {
      const res = await axios.get('/beitraege', {
        params: { mitglied_id: mitgliedId }
      });
      return res.data;
    },
    staleTime: 2 * 60 * 1000,  // 2 Min - Finanzdaten aktueller
    enabled: !!mitgliedId,
  });
};

export const useVertraege = (mitgliedId) => {
  return useQuery({
    queryKey: ['vertraege', mitgliedId],
    queryFn: async () => {
      const res = await axios.get(`/vertraege/mitglied/${mitgliedId}`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!mitgliedId,
  });
};

// ============ ANWESENHEIT ============

export const useAnwesenheit = (mitgliedId) => {
  return useQuery({
    queryKey: ['anwesenheit', mitgliedId],
    queryFn: async () => {
      const res = await axios.get(`/anwesenheit/${mitgliedId}`);
      return res.data;
    },
    staleTime: 1 * 60 * 1000,  // 1 Min - ändert sich häufig
    enabled: !!mitgliedId,
  });
};

// ============ PRÜFUNGEN ============

export const usePruefungen = (mitgliedId) => {
  return useQuery({
    queryKey: ['pruefungen', mitgliedId],
    queryFn: async () => {
      const res = await axios.get(`/pruefungen/mitglied/${mitgliedId}`);
      return res.data;
    },
    staleTime: 10 * 60 * 1000,
    enabled: !!mitgliedId,
  });
};

// ============ DOKUMENTE ============

export const useDokumente = (mitgliedId) => {
  return useQuery({
    queryKey: ['dokumente', mitgliedId],
    queryFn: async () => {
      const res = await axios.get(`/dokumente/mitglied/${mitgliedId}`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!mitgliedId,
  });
};

// ============ ADMIN STATS ============

export const useAdminStats = () => {
  return useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [tdaRes, globalRes, dojosRes] = await Promise.all([
        axios.get('/admin/tda-stats'),
        axios.get('/admin/global-stats'),
        axios.get('/admin/dojos')
      ]);
      return {
        tda: tdaRes.data,
        global: globalRes.data,
        dojos: dojosRes.data
      };
    },
    staleTime: 5 * 60 * 1000,
  });
};

// ============ MUTATIONS MIT CACHE INVALIDIERUNG ============

export const useUpdateMitglied = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await axios.put(`/mitglieder/${id}`, data);
      return res.data;
    },
    onSuccess: (data, variables) => {
      // Cache invalidieren
      queryClient.invalidateQueries({ queryKey: ['mitglied', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['mitglieder'] });
    },
  });
};

export const useCreateVertrag = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      const res = await axios.post('/vertraege', data);
      return res.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vertraege', variables.mitglied_id] });
      queryClient.invalidateQueries({ queryKey: ['mitglied', variables.mitglied_id] });
    },
  });
};

export const useCheckAnwesenheit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mitgliedId, stilId, datum }) => {
      const res = await axios.post('/anwesenheit/check', {
        mitglied_id: mitgliedId,
        stil_id: stilId,
        datum: datum
      });
      return res.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['anwesenheit', variables.mitgliedId] });
    },
  });
};

// ============ CACHE UTILS ============

export const useInvalidateCache = () => {
  const queryClient = useQueryClient();

  return {
    invalidateMitglied: (id) => {
      queryClient.invalidateQueries({ queryKey: ['mitglied', id] });
    },
    invalidateMitglieder: () => {
      queryClient.invalidateQueries({ queryKey: ['mitglieder'] });
    },
    invalidateAll: () => {
      queryClient.invalidateQueries();
    },
  };
};
