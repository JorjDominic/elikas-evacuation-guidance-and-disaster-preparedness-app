import React, { useState } from 'react';
import { useGuides } from '../../hooks/useGuides';
import '../../styles/shared/sentinel.css';

function GuidesPage() {
	const { guides, loading, error } = useGuides();
	const [search, setSearch] = useState('');

	const filtered = search
		? guides.filter((g) =>
				(g.title || '').toLowerCase().includes(search.toLowerCase()) ||
				(g.content || '').toLowerCase().includes(search.toLowerCase())
		  )
		: guides;

	const typeGuides = filtered.filter((g) => g.type === 'Guide');
	const typeRoutes = filtered.filter((g) => g.type === 'Route');

	return (
		<section className="app-page">
			<div className="app-shell">
				<div className="page-hero">
					<h1>Safety Guides</h1>
					<p>Practical playbooks for typhoon, flood, and earthquake response tailored to community conditions.</p>
					<div className="hero-meta">
						<span className="hero-pill">Resident Learning Hub</span>
						<span className="hero-pill">Translated and Localized</span>
					</div>
				</div>

				<div className="sub-grid" style={{ marginBottom: '0.9rem' }}>
					<div className="subtle-card" style={{ gridColumn: 'span 8' }}>
						<h3>Featured Protocol</h3>
						<p>72-hour flood readiness protocol now includes child-safe packing checklist and evacuation buddy process for senior citizens.</p>
					</div>
					<div className="subtle-card" style={{ gridColumn: 'span 4' }}>
						<h3>Estimated Prep Time</h3>
						<p>Most households can complete baseline kit setup in 25 to 40 minutes.</p>
					</div>
				</div>

				{loading && <p>Loading guides…</p>}
				{error && <p style={{ color: 'var(--color-danger, red)' }}>{error}</p>}

				{/* Search */}
				{!loading && !error && (
					<div style={{ marginBottom: '1rem' }}>
						<input
							type="search"
							placeholder="Search guides and routes…"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							style={{ padding: '0.45rem 0.75rem', borderRadius: '0.4rem', border: '1px solid var(--border-color, #ddd)', fontSize: '0.9rem', width: '100%', maxWidth: '360px' }}
							aria-label="Search guides"
						/>
					</div>
				)}

				{!loading && !error && (
					<>
						<h2 className="section-title">Preparedness Guides</h2>
						{typeGuides.length === 0 ? (
							<p>No guides available yet.</p>
						) : (
							<div className="soft-grid" style={{ marginBottom: '0.9rem' }}>
								{typeGuides.map((guide) => (
									<div key={guide.id} className="soft-card">
										<h3>{guide.title}</h3>
										{guide.content && <p>{guide.content}</p>}
									</div>
								))}
							</div>
						)}

						<h2 className="section-title">Evacuation Routes</h2>
						{typeRoutes.length === 0 ? (
							<p>No routes available yet.</p>
						) : (
							<div className="soft-grid">
								{typeRoutes.map((route) => (
									<div key={route.id} className="soft-card">
										<h4>{route.title}</h4>
										{route.content && <p>{route.content}</p>}
									</div>
								))}
							</div>
						)}
					</>
				)}
			</div>
		</section>
	);
}

export default GuidesPage;

