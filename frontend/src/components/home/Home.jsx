// Feature version of Home component (migrated from root Home.jsx)
import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function formatPace(durationMs, distanceM) {
    if (!durationMs || !distanceM || distanceM === 0) return null;
    const totalSeconds = durationMs / 1000;
    const paceSecondsPerKm = totalSeconds / (distanceM / 1000);
    const minutes = Math.floor(paceSecondsPerKm / 60);
    const seconds = Math.round(paceSecondsPerKm % 60)
        .toString()
        .padStart(2, '0');
    return `${minutes}:${seconds} min/km`;
}

function Home() {
    const [lastWorkout, setLastWorkout] = useState(null);
    const [loading, setLoading] = useState(true);
    const [recentWorkouts, setRecentWorkouts] = useState([]);
    
    // Wczytanie zapisanego ID trasy z localStorage
    const [selectedRouteId, setSelectedRouteId] = useState(() => {
        const saved = localStorage.getItem('home_selected_route_id');
        return saved ? Number(saved) : null;
    });

    const [routePoints, setRoutePoints] = useState([]); // nieużywane bezpośrednio w tym kodzie, ale zostawiam dla zgodności
    const [routeError, setRouteError] = useState('');
    const [weekly, setWeekly] = useState(null);

    // Wczytanie okresu podsumowania z localStorage (domyślnie '7d')
    const [period, setPeriod] = useState(() => localStorage.getItem('home_summary_period') || '7d');

    // Wczytanie celu z localStorage
    const [goalDistance, setGoalDistance] = useState(() => Number(localStorage.getItem('home_goal_distance')) || 100);
    const [goalPeriod, setGoalPeriod] = useState(() => localStorage.getItem('home_goal_period') || 'month');

    // Inicjalizacja inputów wartościami zapisanymi
    const [goalInput, setGoalInput] = useState(() => localStorage.getItem('home_goal_distance') || '100');
    const [goalPeriodInput, setGoalPeriodInput] = useState(() => localStorage.getItem('home_goal_period') || 'month');

    const [goalSummary, setGoalSummary] = useState(null);
    const [rangeStart, setRangeStart] = useState(null);
    const [rangeEnd, setRangeEnd] = useState(null);

    // Funkcja pomocnicza do zmiany okresu i zapisu w localStorage
    const handlePeriodChange = (newPeriod) => {
        setPeriod(newPeriod);
        localStorage.setItem('home_summary_period', newPeriod);
        fetchWeekly(newPeriod);
    };

    // Funkcja pomocnicza do zmiany trasy i zapisu w localStorage
    const handleRouteChange = (routeId) => {
        const id = Number(routeId);
        setSelectedRouteId(id);
        localStorage.setItem('home_selected_route_id', id);
    };

    const fetchWeekly = async (currentPeriod) => {
        try {
            const res = await fetch(
                `http://127.0.0.1:8000/api/workouts/weekly_summary/?period=${currentPeriod}`,
                { credentials: 'include' }
            );
            if (!res.ok) throw new Error('Błąd pobierania podsumowania okresu');
            const data = await res.json();
            setWeekly(data);
        } catch (e) {
            console.error(e);
            setWeekly(null);
        }
    };

    const fetchGoalSummary = async (goalPeriodValue) => {
        const p = goalPeriodValue === 'week' ? '7d' : goalPeriodValue === 'month' ? '30d' : 'year';
        try {
            const res = await fetch(
                `http://127.0.0.1:8000/api/workouts/weekly_summary/?period=${p}`,
                { credentials: 'include' }
            );
            if (!res.ok) throw new Error('Błąd pobierania celu');
            const data = await res.json();
            setGoalSummary(data);
        } catch (e) {
            console.error(e);
            setGoalSummary(null);
        }
    };

    useEffect(() => {
        const fetchLastWorkout = async () => {
            try {
                const res = await fetch('http://127.0.0.1:8000/api/workouts/last/', {
                    credentials: 'include',
                });
                if (!res.ok) throw new Error('Błąd pobierania ostatniego treningu');
                const data = await res.json();
                setLastWorkout(data.workout || null);
            } catch (e) {
                console.error(e);
                setLastWorkout(null);
            } finally {
                setLoading(false);
            }
        };

        const fetchRecent = async () => {
            try {
                const res = await fetch('http://127.0.0.1:8000/api/workouts/', {
                    credentials: 'include',
                });
                if (!res.ok) return;
                const data = await res.json();
                const all = data.workouts || [];
                const sorted = [...all].sort((a, b) => {
                    const da = new Date(a.performed_at || a.created_at || 0).getTime();
                    const db = new Date(b.performed_at || b.created_at || 0).getTime();
                    return db - da;
                });
                const top3 = sorted.slice(0, 3);
                setRecentWorkouts(top3);

                // Logika wyboru trasy z uwzględnieniem zapisanego stanu
                const savedId = Number(localStorage.getItem('home_selected_route_id'));
                const isSavedIdAvailable = top3.some(w => w.id === savedId);

                if (isSavedIdAvailable) {
                    setSelectedRouteId(savedId);
                } else {
                    // Fallback: pierwszy z GPX lub pierwszy z listy
                    const firstWithGpx = top3.find((w) => !!w.gpx_file);
                    const defaultId = firstWithGpx ? firstWithGpx.id : top3[0]?.id ?? null;
                    setSelectedRouteId(defaultId);
                }
            } catch (e) {
                console.error(e);
            }
        };

        fetchLastWorkout();
        fetchRecent();
        
        // Pobieramy dane dla zapamiętanych ustawień
        fetchWeekly(period);
        fetchGoalSummary(goalPeriod);
    }, []); // Pusta tablica zależności - uruchamia się raz po montażu, używając stanów początkowych

    const handleGoalSubmit = (e) => {
        e.preventDefault();
        const parsed = parseFloat(goalInput.replace(',', '.'));
        if (!isNaN(parsed) && parsed > 0) {
            setGoalDistance(parsed);
            setGoalPeriod(goalPeriodInput);
            
            // Zapisz do localStorage
            localStorage.setItem('home_goal_distance', parsed);
            localStorage.setItem('home_goal_period', goalPeriodInput);

            fetchGoalSummary(goalPeriodInput);
        }
    };

    const totalThisPeriodM = goalSummary ? goalSummary.total_distance_m : 0;
    const totalThisPeriodKmNumber = totalThisPeriodM / 1000;
    // const totalThisPeriodKm = totalThisPeriodKmNumber.toFixed(3); // nieużywane
    const goalProgress = goalDistance > 0 ? Math.min(totalThisPeriodKmNumber / goalDistance, 1) : 0;
    const remainingKm = goalDistance - totalThisPeriodKmNumber;
    
    // Zmiana etykiety z "Ostatni rok" na "Ostatnie 365 dni"
    const periodHeader = period === '7d' ? 'Ostatnie 7 dni' : period === '30d' ? 'Ostatnie 30 dni' : 'Ostatnie 365 dni';

    return (
        <div className="home-hero">
            <div className="home-hero-grid">
                <div className="home-col home-col-left">
                    <div className="home-recent-wrapper">
                        <div className="home-recent-header">
                            <span className="home-last-workout-label">Ostatnie treningi</span>
                        </div>
                        {recentWorkouts.length === 0 ? (
                            <p className="home-recent-empty">Brak danych – dodaj trening.</p>
                        ) : (
                            <ul className="home-recent-list">
                                {recentWorkouts.map((w, index) => {
                                    const date = w.performed_at || w.created_at;
                                    const dateStrRecent = date
                                        ? new Date(date).toLocaleDateString('pl-PL', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric',
                                            })
                                        : '';
                                    const kmRecent = w.distance_m ? (w.distance_m / 1000).toFixed(2) : null;
                                    const paceRecent = formatPace(w.duration_ms, w.distance_m);
                                    let sourceLabel = '';
                                    if (w.source === 'adidas' || w.source === 'json') sourceLabel = 'Adidas Running';
                                    else if (w.source === 'strava') sourceLabel = 'Strava';
                                    else if (w.manual) sourceLabel = 'Ręcznie dodany';
                                    return (
                                        <li
                                            key={w.id}
                                            className={'home-recent-item' + (index === 0 ? ' home-recent-item-main' : '')}
                                        >
                                            <div className="home-recent-date">{dateStrRecent}</div>
                                            <div className="home-recent-main">
                                                <div className="home-recent-main-top">
                                                    <span className="home-recent-title">{w.title}</span>
                                                    {kmRecent && <span className="home-recent-distance">{kmRecent} km</span>}
                                                </div>
                                                <div className="home-recent-meta">
                                                    <span className="home-recent-meta-label">Tempo</span>
                                                    <span className="home-recent-meta-value">{paceRecent ?? '--'}</span>
                                                </div>
                                                {sourceLabel && (
                                                    <div className="home-recent-meta">
                                                        <span className="home-recent-meta-label">Źródło</span>
                                                        <span className="home-recent-meta-value">{sourceLabel}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                    <div className="home-route-card">
                        <div className="home-recent-header">
                            <span className="home-last-workout-label">Trasa (ostatnie 3)</span>
                        </div>
                        {recentWorkouts.length === 0 ? (
                            <p className="home-recent-empty">Brak danych – dodaj trening.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <select
                                    value={selectedRouteId ?? ''}
                                    onChange={(e) => handleRouteChange(e.target.value)}
                                    style={{ borderRadius: 8, padding: '0.35rem 0.5rem' }}
                                >
                                    {recentWorkouts.map((w) => {
                                        const d = w.performed_at || w.created_at;
                                        const dateStr = d
                                            ? new Date(d).toLocaleDateString('pl-PL', {
                                                    day: '2-digit',
                                                    month: 'short',
                                                    year: 'numeric',
                                                })
                                            : '';
                                        return (
                                            <option key={w.id} value={w.id}>
                                                {dateStr} {w.gpx_file ? '' : '(brak GPS)'}
                                            </option>
                                        );
                                    })}
                                </select>
                                <RouteMap
                                    workoutId={selectedRouteId}
                                    hasGpx={Boolean(recentWorkouts.find((w) => w.id === selectedRouteId)?.gpx_file)}
                                />
                            </div>
                        )}
                    </div>
                </div>
                <div className="home-col home-col-center">
                    <div className="home-hero-inner">
                        <div className="home-hero-video-wrapper">
                            <video autoPlay muted loop playsInline>
                                <source src="/materials/running.mp4" type="video/mp4" />
                            </video>
                        </div>
                        <section className="home-hero-content">
                            <h2>Witaj w aplikacji do analizy treningów biegowych!</h2>
                            <p>Monitoruj swoje postępy, analizuj statystyki i dziel się wynikami z innymi biegaczami.</p>
                        </section>
                    </div>
                </div>
                <div className="home-col home-col-right">
                    <div className="home-goal-week-wrapper">
                        <div className="home-goal-card">
                            <div className="home-goal-header">
                                <span className="home-last-workout-label">Cel biegowy</span>
                                <span className="home-goal-period">
                                    {goalDistance} km /{' '}
                                    {goalPeriod === 'week' ? 'tydzień' : goalPeriod === 'month' ? 'miesiąc' : 'Rok'}
                                </span>
                            </div>
                            <div className="home-goal-inner">
                                <div className="goal-ring">
                                    <div className="goal-ring-fill" style={{ '--goal-progress': goalProgress }} />
                                    <div className="goal-ring-center">
                                        <div className="goal-ring-value">{(totalThisPeriodM / 1000).toFixed(2)}</div>
                                        <div className="goal-ring-label">km w tym okresie</div>
                                    </div>
                                </div>
                                <div className="home-goal-details">
                                    <div className="stat-pill stat-pill-light">
                                        <span className="stat-pill-label">Do celu</span>
                                        <span className="stat-pill-value">
                                            {remainingKm > 0 ? `${remainingKm.toFixed(1)} km` : 'Cel osiągnięty 🎉'}
                                        </span>
                                    </div>
                                    <form className="home-goal-form" onSubmit={handleGoalSubmit}>
                                        <label>
                                            <span>Twój cel (km)</span>
                                            <input
                                                type="number"
                                                value={goalInput}
                                                onChange={(e) => setGoalInput(e.target.value)}
                                            />
                                        </label>
                                        <label>
                                            <span>Okres</span>
                                            <select
                                                value={goalPeriodInput}
                                                onChange={(e) => setGoalPeriodInput(e.target.value)}
                                            >
                                                <option value="week">Tydzień</option>
                                                <option value="month">Miesiąc</option>
                                                <option value="year">Rok</option>
                                            </select>
                                        </label>
                                        <button className="btn-goal-save">Zapisz cel</button>
                                    </form>
                                </div>
                            </div>
                        </div>
                        <div className="home-weekly-card">
                            <div className="home-weekly-header">
                                <span className="home-last-workout-label">{periodHeader}</span>
                                <span className="home-weekly-total">
                                    {weekly
                                        ? weekly.total_distance_m >= 1000
                                            ? `${(weekly.total_distance_m / 1000).toFixed(2)} km`
                                            : `${weekly.total_distance_m.toFixed(0)} m`
                                        : '0 m'}
                                </span>
                            </div>
                            <div className="home-weekly-period-toggle">
                                <button
                                    type="button"
                                    className={period === '7d' ? 'weekly-toggle active' : 'weekly-toggle'}
                                    onClick={() => handlePeriodChange('7d')}
                                >
                                    7 dni
                                </button>
                                <button
                                    type="button"
                                    className={period === '30d' ? 'weekly-toggle active' : 'weekly-toggle'}
                                    onClick={() => handlePeriodChange('30d')}
                                >
                                    30 dni
                                </button>
                                <button
                                    type="button"
                                    className={period === 'year' ? 'weekly-toggle active' : 'weekly-toggle'}
                                    onClick={() => handlePeriodChange('year')}
                                >
                                    365 dni
                                </button>
                            </div>
                            <div className="home-weekly-chart">
                                {(() => {
                                    const items = (weekly && weekly.items) || [];
                                    const maxM = items.reduce((mx, it) => {
                                        const v = Number(it.distance_m) || 0;
                                        return v > mx ? v : mx;
                                    }, 0);
                                    const ticks = maxM > 0 ? [1, 0.75, 0.5, 0.25].map((r) => r * maxM) : [];
                                    const formatTick = (m) => {
                                        if (m >= 1000) {
                                            const km = m / 1000;
                                            return km >= 10 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
                                        }
                                        return `${Math.round(m)} m`;
                                    };
                                    const labelFor = (it) => {
                                        if (period === 'year') {
                                            return new Date(it.label + '-01').toLocaleDateString('pl-PL', { month: 'short' });
                                        } else if (period === '30d') {
                                            return new Date(it.label).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short' });
                                        }
                                        return new Date(it.label).toLocaleDateString('pl-PL', { weekday: 'short' });
                                    };
                                    return (
                                        <>
                                            <div className="home-weekly-yaxis">
                                                <span>{maxM ? formatTick(maxM) : ''}</span>
                                                <span>{maxM ? formatTick(ticks[1]) : ''}</span>
                                                <span>{maxM ? formatTick(ticks[2]) : ''}</span>
                                                <span>{maxM ? formatTick(ticks[3]) : ''}</span>
                                                <span>0</span>
                                            </div>
                                            <div className="home-weekly-grid">
                                                {[1, 0.75, 0.5, 0.25].map((r) => (
                                                    <div key={r} className="home-weekly-grid-line" style={{ top: `${(1 - r) * 100}%` }} />
                                                ))}
                                            </div>
                                            <div className="home-weekly-bars">
                                                {items.map((it) => {
                                                    const m = Number(it.distance_m) || 0;
                                                    const height = maxM > 0 ? (m / maxM) * 100 : 0;
                                                    const label = labelFor(it);
                                                    const isEmpty = m === 0;
                                                    const isSelected =
                                                        period === '30d' &&
                                                        (it.label === rangeStart ||
                                                            it.label === rangeEnd ||
                                                            (rangeStart && rangeEnd && it.label >= rangeStart && it.label <= rangeEnd));
                                                    const barClass = ['home-weekly-bar', isEmpty ? 'empty' : '', isSelected ? 'selected' : '']
                                                        .filter(Boolean)
                                                        .join(' ');
                                                    const handleClick = () => {
                                                        if (period !== '30d') return;
                                                        if (!rangeStart) {
                                                            setRangeStart(it.label);
                                                            setRangeEnd(null);
                                                        } else if (rangeStart && !rangeEnd) {
                                                            if (it.label < rangeStart) {
                                                                setRangeEnd(rangeStart);
                                                                setRangeStart(it.label);
                                                            } else {
                                                                setRangeEnd(it.label);
                                                            }
                                                        } else {
                                                            setRangeStart(it.label);
                                                            setRangeEnd(null);
                                                        }
                                                    };
                                                    return (
                                                        <div
                                                            key={it.label}
                                                            className="home-weekly-bar-wrapper"
                                                            onClick={handleClick}
                                                            style={{ cursor: period === '30d' ? 'pointer' : 'default' }}
                                                        >
                                                            <div
                                                                className={barClass}
                                                                title={`${m >= 1000 ? (m / 1000).toFixed(2) + ' km' : m.toFixed(0) + ' m'}`}
                                                                style={{ height: `${Math.max(height, m > 0 ? 8 : 3)}%` }}
                                                            />
                                                            <span className="home-weekly-bar-label">{label}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {period === '30d' && rangeStart && rangeEnd && (
                                                (() => {
                                                    const startDate = new Date(rangeStart);
                                                    const endDate = new Date(rangeEnd);
                                                    const rangeDistanceM = items.reduce((sum, it) => {
                                                        if (it.label >= rangeStart && it.label <= rangeEnd) return sum + (Number(it.distance_m) || 0);
                                                        return sum;
                                                    }, 0);
                                                    const rangeLabelStart = startDate.toLocaleDateString('pl-PL', { day: '2-digit', month: 'short' });
                                                    const rangeLabelEnd = endDate.toLocaleDateString('pl-PL', { day: '2-digit', month: 'short' });
                                                    const rangeKm = rangeDistanceM >= 1000 ? (rangeDistanceM / 1000).toFixed(2) + ' km' : rangeDistanceM.toFixed(0) + ' m';
                                                    return (
                                                        <div className="home-weekly-range-pill">
                                                            <span>Zakres: {rangeLabelStart} – {rangeLabelEnd}</span>
                                                            <span>{rangeKm}</span>
                                                            <button type="button" onClick={() => { setRangeStart(null); setRangeEnd(null); }}>Reset</button>
                                                        </div>
                                                    );
                                                })()
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Home;

// Helper components and functions
function RouteMap({ workoutId, hasGpx }) {
    const [points, setPoints] = useState([]);
    const [segments, setSegments] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        setPoints([]);
        setSegments([]);
        setError('');
        if (!workoutId) return;
        if (!hasGpx) {
            setError('Brak dołączonych danych GPS dla wybranego treningu.');
            return;
        }
        const fetchGpx = async () => {
            try {
                const res = await fetch(`http://127.0.0.1:8000/api/workouts/${workoutId}/gpx/`, { credentials: 'include' });
                if (!res.ok) throw new Error('Brak dołączonych danych GPS');
                const text = await res.text();
                const parsed = parseGpxTrack(text);
                setPoints(parsed);
            } catch (e) {
                console.error(e);
                setError('Brak dołączonych danych GPS dla wybranego treningu.');
            }
        };
        fetchGpx();
    }, [workoutId, hasGpx]);

    useEffect(() => {
        if (!points || points.length < 2) return;
        const segs = [];
        for (let i = 1; i < points.length; i++) {
            const a = points[i - 1];
            const b = points[i];
            const dist = haversineM(a.lat, a.lon, b.lat, b.lon);
            let speed = null;
            if (a.time && b.time) {
                const dt = (b.time - a.time) / 1000;
                if (dt > 0) speed = dist / dt;
            }
            segs.push({ coords: [[a.lat, a.lon], [b.lat, b.lon]], speed });
        }
        const validSpeeds = segs.filter((s) => typeof s.speed === 'number' && s.speed > 0).map((s) => s.speed).sort((a, b) => a - b);
        if (validSpeeds.length > 0) {
            const min = validSpeeds[0];
            const max = validSpeeds[validSpeeds.length - 1] || min;
            const speedToColor = (v) => {
                if (!max || max === min) return 'hsl(50, 85%, 50%)';
                const t = Math.min(1, Math.max(0, (v - min) / (max - min)));
                const hue = 120 - 120 * t;
                return `hsl(${hue}, 85%, 50%)`;
            };
            segs.forEach((s) => { s.color = s.speed && s.speed > 0 ? speedToColor(s.speed) : '#6b7280'; });
        } else {
            segs.forEach((s) => { s.color = '#22c55e'; });
        }
        setSegments(segs);
    }, [points]);

    const bounds = useMemo(() => {
        if (!points || points.length === 0) return null;
        const lats = points.map((p) => p.lat);
        const lngs = points.map((p) => p.lon);
        return [
            [Math.min(...lats), Math.min(...lngs)],
            [Math.max(...lats), Math.max(...lngs)],
        ];
    }, [points]);

    if (error) return <p className="home-recent-empty" style={{ marginTop: 6 }}>{error}</p>;
    if (!points || points.length < 2) return <p className="home-recent-empty" style={{ marginTop: 6 }}>Ładowanie trasy...</p>;

    return (
        <div className="route-map">
            <MapContainer bounds={bounds || undefined} boundsOptions={{ padding: [20, 20] }} scrollWheelZoom={false} style={{ height: 300, width: '100%', borderRadius: 12 }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {segments.map((s, idx) => (
                    <Polyline key={idx} positions={s.coords} pathOptions={{ color: s.color, weight: 5, opacity: 0.85 }} />
                ))}
            </MapContainer>
        </div>
    );
}

function parseGpxTrack(xmlText) {
    try {
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlText, 'application/xml');
        let pts = Array.from(xml.getElementsByTagName('trkpt'));
        if (pts.length === 0) pts = Array.from(xml.getElementsByTagName('rtept'));
        const out = pts
            .map((pt) => {
                const lat = parseFloat(pt.getAttribute('lat'));
                const lon = parseFloat(pt.getAttribute('lon'));
                let timeNode = pt.getElementsByTagName('time')[0];
                let time = null;
                if (timeNode) {
                    const t = Date.parse(timeNode.textContent.trim());
                    if (!isNaN(t)) time = new Date(t);
                }
                return { lat, lon, time };
            })
            .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
        return out;
    } catch (e) {
        console.error('parseGpxTrack error', e);
        return [];
    }
}

function haversineM(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}