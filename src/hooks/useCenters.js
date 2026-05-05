import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';

export function useCenters() {
  const [centers, setCenters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCenters = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('evacuation_centers')
      .select('*')
      .order('municipality', { ascending: true });
    if (err) setError(err.message);
    else { setCenters(data || []); setError(''); }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCenters();
    const channel = supabase
      .channel('centers-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'evacuation_centers' }, fetchCenters)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchCenters]);

  return { centers, loading, error, refetch: fetchCenters };
}
