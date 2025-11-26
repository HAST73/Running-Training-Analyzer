import React, { useEffect, useState } from 'react';

const CLEAN_MARKERS = ['Kliknij tutaj', 'ZAKRES WYSZUKIWANIA', 'Dzień:', 'Dzien:', '->', 'ZOBACZ OFERTĘ'];
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
    
    // Domyślne daty "dzisiaj"
    const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
    const [worldFromDate, setWorldFromDate] = useState(new Date().toISOString().split('T')[0]);
    
    const [sortByCity, setSortByCity] = useState(false);
    const [search, setSearch] = useState('');
    const [worldCountry, setWorldCountry] = useState('');
    const [sortWorldByLocation, setSortWorldByLocation] = useState(false);

    useEffect(() => {
        const fetchEvents = async () => {
            setLoading(true);
            try {
                const res = await fetch('http://127.0.0.1:8000/api/events/', { credentials: 'include' });
                const data = await res.json();
                if (data.poland) setPolandEvents(data.poland);
                if (data.world) setWorldEvents(data.world);
            } catch (e) {
                console.error(e);
                setError('Nie udało się pobrać wydarzeń.');
            } finally {
                setLoading(false);
            }
        };
        fetchEvents();
    }, []);

    const filterEvents = (list, dateFrom, filterText) => {
        let out = [...list];
        if (dateFrom) out = out.filter((ev) => ev.date >= dateFrom);
        if (filterText) {
            const low = filterText.toLowerCase();
            out = out.filter((ev) => 
                (ev.name && ev.name.toLowerCase().includes(low)) || 
                (ev.place && ev.place.toLowerCase().includes(low))
            );
        }
        return out;
    };

    const renderList = (list, sortEnabled, defaultLocation) => {
        let display = [...list];
        if (sortEnabled) {
            display.sort((a, b) => (a.place || '').localeCompare(b.place || ''));
        }

        if (display.length === 0) {
            return <p style={{ color: '#64748b', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>Brak wydarzeń.</p>;
        }

        return (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {display.map((ev, i) => (
                    <li key={i} style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '12px',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.03)'
                    }}>
                        {/* --- GÓRA: NAZWA BIEGU (Duży napis) --- */}
                        {/* Dzięki poprawce w backendzie, ev.name to teraz faktycznie nazwa biegu */}
                        <div style={{ 
                            fontWeight: 700, 
                            color: '#0f172a', 
                            fontSize: '1rem',
                            marginBottom: '4px'
                        }}>
                             {cleanEventName(ev.name)}
                        </div>

                        {/* --- DÓŁ: DATA i LOKALIZACJA --- */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#475569', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '6px', fontWeight: 500 }}>
                                    📅 {ev.date}
                                </span>
                            </div>
                            
                            {/* PINEZKA + MIASTO */}
                            {/* Dzięki poprawce w backendzie, ev.place to teraz faktycznie miasto */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: '#334155', textAlign: 'right', maxWidth: '65%' }}>
                                📍 {ev.place && ev.place.trim() !== '' ? ev.place : defaultLocation}
                            </div>
                        </div>

                        {ev.url && (
                            <a href={ev.url} target="_blank" rel="noreferrer" style={{ 
                                fontSize: '0.85rem', color: '#2563eb', marginTop: '8px', 
                                textDecoration: 'none', fontWeight: 600, alignSelf: 'flex-start', borderBottom: '1px dashed #2563eb'
                            }}>
                                Zobacz szczegóły →
                            </a>
                        )}
                    </li>
                ))}
            </ul>
        );
    };

    const filteredPoland = filterEvents(polandEvents, fromDate, search);
    const filteredWorld = filterEvents(
        worldEvents.filter((ev) => !worldCountry || (ev.place && ev.place.toLowerCase().includes(worldCountry.toLowerCase()))),
        worldFromDate,
        ''
    );

    const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', marginTop: '4px', outline: 'none' };
    const labelStyle = { display: 'block', marginBottom: '12px', fontSize: '0.85rem', fontWeight: 600, color: '#475569' };
    const sectionBoxStyle = { background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #e2e8f0' };

    return (
        <div className="post-card" style={{ maxWidth: '1000px', margin: '2rem auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '15px' }}>
                <h2 style={{ margin: 0, color: '#1e293b' }}>📅 Kalendarz Biegowy</h2>
            </div>
            
            {loading && <p style={{ textAlign: 'center', color: '#64748b' }}>Pobieranie listy biegów...</p>}
            {error && <p style={{ color: '#dc2626', textAlign: 'center' }}>{error}</p>}

            {!loading && !error && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '40px' }}>
                    {/* POLSKA */}
                    <div>
                        <h3 style={{ color: '#0f172a', marginTop: 0, marginBottom: '15px' }}>
                            🇵🇱 Polska <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>({filteredPoland.length})</span>
                        </h3>
                        <div style={sectionBoxStyle}>
                            <label style={labelStyle}>Data od: <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={inputStyle} /></label>
                            <label style={labelStyle}>Szukaj: <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="np. Warszawa..." style={inputStyle} /></label>
                            <label style={{ marginTop: '10px', fontSize: '0.85rem', color: '#475569' }}><input type="checkbox" checked={sortByCity} onChange={(e) => setSortByCity(e.target.checked)} /> Sortuj po mieście</label>
                        </div>
                        {renderList(filteredPoland, sortByCity, 'Polska')}
                    </div>

                    {/* ŚWIAT */}
                    <div>
                        <h3 style={{ color: '#0f172a', marginTop: 0, marginBottom: '15px' }}>
                            🌍 Świat <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>({filteredWorld.length})</span>
                        </h3>
                        <div style={sectionBoxStyle}>
                            <label style={labelStyle}>Data od: <input type="date" value={worldFromDate} onChange={(e) => setWorldFromDate(e.target.value)} style={inputStyle} /></label>
                            <label style={labelStyle}>Kraj / Miasto: <input type="text" value={worldCountry} onChange={(e) => setWorldCountry(e.target.value)} placeholder="np. Berlin..." style={inputStyle} /></label>
                            <label style={{ marginTop: '10px', fontSize: '0.85rem', color: '#475569' }}><input type="checkbox" checked={sortWorldByLocation} onChange={(e) => setSortWorldByLocation(e.target.checked)} /> Sortuj po lokalizacji</label>
                        </div>
                        {renderList(filteredWorld, sortWorldByLocation, 'Świat')}
                    </div>
                </div>
            )}
        </div>
    );
}

export default Events;