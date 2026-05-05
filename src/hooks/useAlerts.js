import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';

export function useAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAlerts = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('alerts')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    else { setAlerts(data || []); setError(''); }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAlerts();
    const channel = supabase
      .channel('alerts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, fetchAlerts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchAlerts]);

  return { alerts, loading, error, refetch: fetchAlerts };
}
