import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';

export function useNotifications() {
	const [permission, setPermission] = useState(
		typeof Notification !== 'undefined' ? Notification.permission : 'denied'
	);

	const requestPermission = useCallback(async () => {
		if (typeof Notification === 'undefined') return;
		const result = await Notification.requestPermission();
		setPermission(result);
	}, []);

	useEffect(() => {
		if (permission !== 'granted') return;

		const channel = supabase
			.channel('push-alerts')
			.on(
				'postgres_changes',
				{ event: 'INSERT', schema: 'public', table: 'alerts' },
				(payload) => {
					const alert = payload.new;
					if (alert?.level === 'high') {
						new Notification('eLikas Alert', {
							body: alert.title || 'A new high-severity alert has been issued.',
							icon: '/favicon.ico',
						});
					} else if (alert?.level === 'medium') {
						new Notification('eLikas Advisory', {
							body: alert.title || 'A new moderate-severity advisory has been issued.',
							icon: '/favicon.ico',
						});
					}
				}
			)
			.subscribe();

		return () => { supabase.removeChannel(channel); };
	}, [permission]);

	return { permission, requestPermission };
}
