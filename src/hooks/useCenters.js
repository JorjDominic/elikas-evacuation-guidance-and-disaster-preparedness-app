import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';

export function useCenters({ limit = 200 } = {}) {
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCenters = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('evacuation_centers')
      .select('*')
      .order('municipality', { ascending: true })
      .limit(limit);
    if (err) setError(err.message);
    else { setCenters(data || []); setError(''); }
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    fetchCenters();
    const channel = supabase
      .channel('centers-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'evacuation_centers' }, (payload) => {
        setCenters((prev) => [...prev, payload.new].sort((a, b) => (a.municipality || '').localeCompare(b.municipality || '')));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'evacuation_centers' }, (payload) => {
        setCenters((prev) => prev.map((c) => (c.id === payload.new.id ? payload.new : c)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'evacuation_centers' }, (payload) => {
        setCenters((prev) => prev.filter((c) => c.id !== payload.old.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchCenters]);

  return { centers, loading, error, refetch: fetchCenters };
}
