import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';

// Module-level singleton so multiple callers share one channel subscription
let _channel = null;
let _refCount = 0;

const LEVEL_CONFIG = {
	high:   { title: 'eLikas Alert',    fallback: 'A new high-severity alert has been issued.'       },
	medium: { title: 'eLikas Advisory', fallback: 'A new moderate-severity advisory has been issued.' },
	low:    { title: 'eLikas Notice',   fallback: 'A new low-severity notice has been issued.'        },
};

/**
 * Fire an OS notification AND dispatch an in-app CustomEvent so the
 * ToastContainer always shows something, even when the OS swallows the
 * browser notification (Focus Assist, permission quirks, etc.).
 * @param {string} title
 * @param {string} body
 * @param {'high'|'medium'|'low'|'info'} [level='info']
 */
export function fireNotification(title, body, level = 'info') {
	// In-app event — always fires regardless of OS permission
	window.dispatchEvent(new CustomEvent('elikas:notification', { detail: { title, body, level } }));

	// OS notification — only when granted, wrapped so failures don't break anything
	if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
	try {
		new Notification(title, { body, icon: '/favicon.ico' });
	} catch (err) {
		console.warn('[eLikas] Notification failed:', err.message);
	}
}

function ensureChannel() {
	if (_channel) return; // already subscribed
	_channel = supabase
		.channel('push-alerts')
		.on(
			'postgres_changes',
			{ event: 'INSERT', schema: 'public', table: 'alerts' },
			(payload) => {
				const alert = payload.new;
				const lvl = alert?.level;
				const cfg = LEVEL_CONFIG[lvl];
				if (!cfg) return; // ignore unknown levels
				fireNotification(cfg.title, alert.title || cfg.fallback, lvl);
			}
		)
		.subscribe();
}

function teardownChannel() {
	if (!_channel) return;
	supabase.removeChannel(_channel);
	_channel = null;
}

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
		_refCount++;
		// Channel opens unconditionally — in-app toasts don't need OS permission
		ensureChannel();
		return () => {
			_refCount--;
			if (_refCount === 0) teardownChannel();
		};
	}, []);

	return { permission, requestPermission };
}
