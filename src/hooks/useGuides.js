import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';

export function useGuides() {
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchGuides = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('guides')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    else { setGuides(data || []); setError(''); }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchGuides();
    const channel = supabase
      .channel('guides-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'guides' }, (payload) => {
        setGuides((prev) => [payload.new, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'guides' }, (payload) => {
        setGuides((prev) => prev.map((g) => (g.id === payload.new.id ? payload.new : g)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'guides' }, (payload) => {
        setGuides((prev) => prev.filter((g) => g.id !== payload.old.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchGuides]);

  return { guides, loading, error, refetch: fetchGuides };
}
