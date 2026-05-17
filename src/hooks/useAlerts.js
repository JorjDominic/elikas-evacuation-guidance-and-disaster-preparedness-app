import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';

export function useAlerts({ limit = 50 } = {}) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAlerts = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (err) setError(err.message);
    else { setAlerts(data || []); setError(''); }
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    fetchAlerts();
    const channel = supabase
      .channel('alerts-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, (payload) => {
        setAlerts((prev) => [payload.new, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'alerts' }, (payload) => {
        setAlerts((prev) => prev.map((a) => (a.id === payload.new.id ? payload.new : a)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'alerts' }, (payload) => {
        setAlerts((prev) => prev.filter((a) => a.id !== payload.old.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAlerts]);

  return { alerts, loading, error, refetch: fetchAlerts };
}
