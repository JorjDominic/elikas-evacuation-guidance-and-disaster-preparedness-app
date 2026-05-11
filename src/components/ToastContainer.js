import React, { useState, useEffect, useCallback } from 'react';
import './ToastContainer.css';

let _toastId = 0;

export default function ToastContainer() {
	const [toasts, setToasts] = useState([]);

	const dismiss = useCallback((id) => {
		setToasts((t) => t.map((x) => x.id === id ? { ...x, leaving: true } : x));
		setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 350);
	}, []);

	useEffect(() => {
		const handler = (e) => {
			const { title, body, level } = e.detail || {};
			const id = ++_toastId;
			setToasts((t) => [...t, { id, title, body, level: level || 'info', leaving: false }]);
			setTimeout(() => dismiss(id), 6000);
		};

		window.addEventListener('elikas:notification', handler);
		return () => window.removeEventListener('elikas:notification', handler);
	}, [dismiss]);

	if (toasts.length === 0) return null;

	return (
		<div className="elikas-toast-stack" role="region" aria-label="Notifications" aria-live="polite">
			{toasts.map((t) => (
				<div
					key={t.id}
					className={`elikas-toast elikas-toast--${t.level} ${t.leaving ? 'elikas-toast--leave' : ''}`}
					role="alert"
				>
					<div className="elikas-toast__icon">
						{t.level === 'high'   ? '🔴' :
						 t.level === 'medium' ? '🟠' :
						 t.level === 'low'    ? '🟢' : '🔔'}
					</div>
					<div className="elikas-toast__body">
						<span className="elikas-toast__title">{t.title}</span>
						{t.body && <span className="elikas-toast__msg">{t.body}</span>}
					</div>
					<button
						className="elikas-toast__close"
						onClick={() => dismiss(t.id)}
						aria-label="Dismiss notification"
					>
						✕
					</button>
				</div>
			))}
		</div>
	);
}
