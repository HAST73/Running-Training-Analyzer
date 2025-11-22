// Feature version of Events component (migrated from root Events.jsx)
import React, { useEffect, useState } from 'react';

const CLEAN_MARKERS = ['Kliknij tutaj', 'ZAKRES WYSZUKIWANIA', 'Dzień:', 'Dzien:', '->'];

const cleanEventName = (name = '') => {
	let result = name;
	CLEAN_MARKERS.forEach((marker) => {
		const idx = result.indexOf(marker);
		if (idx !== -1) result = result.slice(0, idx).trim();
	});
	return result;
};

function Events() {
	const [polandEvents, setPolandEvents] = useState([]);
	const [worldEvents, setWorldEvents] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [fromDate, setFromDate] = useState('');
	const [sortByCity, setSortByCity] = useState(false);
	const [search, setSearch] = useState('');
	const [worldFromDate, setWorldFromDate] = useState('');
	const [worldCountry, setWorldCountry] = useState('');

	useEffect(() => {
		const fetchEvents = async () => {
			setLoading(true);
			try {
				const res = await fetch('http://127.0.0.1:8000/api/events/?limit=100', { credentials: 'include' });
				const data = await res.json();
				if (!res.ok) throw new Error(data.error || 'Nie udało się pobrać wydarzeń.');
				setPolandEvents(data.poland || []);
				setWorldEvents(data.world || []);
				setError('');
			} catch (e) {
				console.error(e);
				setError('Nie udało się pobrać wydarzeń biegowych.');
			} finally {
				setLoading(false);
			}
		};
		fetchEvents();
		const interval = setInterval(fetchEvents, 1000 * 60 * 30);
		return () => clearInterval(interval);
	}, []);

	const applyFilters = (items) => {
		let filtered = [...items];
		if (fromDate) {
			const from = new Date(fromDate);
			filtered = filtered.filter((ev) => {
				if (!ev.date) return false;
				const d = new Date(ev.date);
				return d >= from;
			});
		}
		if (search.trim()) {
			const q = search.trim().toLowerCase();
			filtered = filtered.filter((ev) => {
				const name = (ev.name || '').toLowerCase();
				const city = (ev.city || '').toLowerCase();
				return name.includes(q) || city.includes(q);
			});
		}
		if (sortByCity) filtered.sort((a, b) => (a.city || '').localeCompare(b.city || ''));
		return filtered;
	};

	const applyWorldFilters = (items) => {
		let filtered = [...items];
		if (worldFromDate) {
			const from = new Date(worldFromDate);
			filtered = filtered.filter((ev) => {
				if (!ev.date) return false;
				const d = new Date(ev.date);
				return d >= from;
			});
		}
		if (worldCountry.trim()) {
			const q = worldCountry.trim().toLowerCase();
			filtered = filtered.filter((ev) => {
				const name = (ev.name || '').toLowerCase();
				const city = (ev.city || '').toLowerCase();
				return name.includes(q) || city.includes(q);
			});
		}
		return filtered;
	};

	const renderList = (items) => {
		if (!items.length) return <p style={{ fontSize: '0.9em', color: '#555' }}>Brak nadchodzących biegów.</p>;
		const prepared = applyFilters(items).map((ev) => ({ ...ev, name: cleanEventName(ev.name) }));
		if (!prepared.length) return <p style={{ fontSize: '0.9em', color: '#555' }}>Brak nadchodzących biegów.</p>;
		return (
			<ul style={{ listStyle: 'none', padding: 0, marginTop: '0.5em' }}>
				{prepared.map((ev, idx) => (
					<li
						key={idx}
						style={{
							display: 'grid',
							gridTemplateColumns: '120px 90px minmax(0, 1fr)',
							gap: '1.25em',
							padding: '0.4em 0',
							borderBottom: '1px solid #eee',
							alignItems: 'center',
						}}
					>
						<span style={{ fontWeight: 500 }}>{ev.date ? new Date(ev.date).toLocaleDateString('pl-PL') : ''}</span>
						<span style={{ color: '#111827' }}>{ev.city}</span>
						<span style={{ fontWeight: 500 }}>
							{ev.url ? (
								<a href={ev.url} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', textDecoration: 'none' }}>
									{ev.name}
								</a>
							) : (
								<span style={{ color: '#1d4ed8' }}>{ev.name}</span>
							)}
						</span>
					</li>
				))}
			</ul>
		);
	};

	const renderWorldList = (items) => {
		if (!items.length) return <p style={{ fontSize: '0.9em', color: '#555' }}>Brak nadchodzących biegów.</p>;
		const prepared = applyWorldFilters(items).map((ev) => ({ ...ev, name: cleanEventName(ev.name) }));
		if (!prepared.length) return <p style={{ fontSize: '0.9em', color: '#555' }}>Brak nadchodzących biegów.</p>;
		return (
			<ul style={{ listStyle: 'none', padding: 0, marginTop: '0.5em' }}>
				{prepared.map((ev, idx) => (
					<li
						key={idx}
						style={{
							display: 'grid',
							gridTemplateColumns: '120px 120px minmax(0, 1fr)',
							gap: '2.5em',
							padding: '0.4em 0',
							borderBottom: '1px solid #eee',
							alignItems: 'center',
						}}
					>
						<span style={{ fontWeight: 500 }}>{ev.date ? new Date(ev.date).toLocaleDateString('pl-PL') : ''}</span>
						<span style={{ color: '#111827' }}>{ev.city}</span>
						<span style={{ fontWeight: 500 }}>
							{ev.url ? (
								<a href={ev.url} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8', textDecoration: 'none' }}>
									{ev.name}
								</a>
							) : (
								<span style={{ color: '#1d4ed8' }}>{ev.name}</span>
							)}
						</span>
					</li>
				))}
			</ul>
		);
	};

	return (
		<section>
			<h2 style={{ textAlign: 'center', marginBottom: '1.5em' }}>Wydarzenia biegowe</h2>
			{error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}
			{loading && !error && <p style={{ textAlign: 'center' }}>Ładowanie aktualnych biegów...</p>}
			{!loading && !error && (
				<div
					style={{
						display: 'grid',
						gridTemplateColumns: 'repeat(2, minmax(320px, 1fr))',
						gap: '5rem',
						justifyContent: 'center',
						margin: '0 auto',
						maxWidth: '1100px',
					}}
				>
					<div>
						<h3>Polska</h3>
						<div style={{ marginBottom: '0.75em', fontSize: '0.85em' }}>
							<label style={{ display: 'block', marginBottom: '0.25em' }}>
								Data od:
								<input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ marginLeft: '0.5em' }} />
							</label>
							<label style={{ display: 'block', marginBottom: '0.25em' }}>
								<input
									type="checkbox"
									checked={sortByCity}
									onChange={(e) => setSortByCity(e.target.checked)}
									style={{ marginRight: '0.35em' }}
								/>
								Sortuj po miejscowości
							</label>
							<label style={{ display: 'block' }}>
								Szukaj (miasto / nazwa):
								<input
									type="text"
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									placeholder="np. Katowice, maraton..."
									style={{ width: '100%', marginTop: '0.25em' }}
								/>
							</label>
						</div>
						{renderList(polandEvents)}
					</div>
					<div>
						<h3>Świat</h3>
						<div style={{ marginBottom: '0.75em', fontSize: '0.85em' }}>
							<label style={{ display: 'block', marginBottom: '0.25em' }}>
								Data od:
								<input
									type="date"
									value={worldFromDate}
									onChange={(e) => setWorldFromDate(e.target.value)}
									style={{ marginLeft: '0.5em' }}
								/>
							</label>
							<label style={{ display: 'block', marginBottom: '0.25em' }}>
								Kraj (według listy na stronie):
								<input
									type="text"
									value={worldCountry}
									onChange={(e) => setWorldCountry(e.target.value)}
									placeholder="np. Włochy, ITA, USA..."
									style={{ width: '100%', marginTop: '0.25em' }}
								/>
							</label>
						</div>
						{renderWorldList(worldEvents)}
					</div>
				</div>
			)}
		</section>
	);
}

export default Events;