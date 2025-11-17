// src/components/Home.jsx
import React, { useEffect, useState } from 'react';

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
  const [weekly, setWeekly] = useState(null);
  const [period, setPeriod] = useState('7d'); // 7d, 30d, year

  const [goalDistance, setGoalDistance] = useState(100);
  const [goalPeriod, setGoalPeriod] = useState('month');       // week/month/year
  const [goalInput, setGoalInput] = useState('100');
  const [goalPeriodInput, setGoalPeriodInput] = useState('month');

  const fetchWeekly = async (currentPeriod = '7d') => {
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/workouts/weekly_summary/?period=${currentPeriod}`,
        {
          credentials: 'include',
        }
      );
      if (!res.ok) {
        throw new Error('Błąd pobierania podsumowania okresu');
      }
      const data = await res.json();
      setWeekly(data);
    } catch (e) {
      console.error(e);
      setWeekly(null);
    }
  };

  useEffect(() => {
    const fetchLastWorkout = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/workouts/last/', {
          credentials: 'include',
        });
        if (!res.ok) {
          throw new Error('Błąd pobierania ostatniego treningu');
        }
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
        setRecentWorkouts(all.slice(0, 3));
      } catch (e) {
        console.error(e);
      }
    };

    // domyślnie bierzemy 7 dni
    fetchLastWorkout();
    fetchWeekly('7d');
    setPeriod('7d');
    fetchRecent();
  }, []);

  const syncGoalPeriodWithWeekly = (gp) => {
    // mapowanie okresu celu -> param "period" w API
    let p = '7d';
    if (gp === 'week') p = '7d';
    else if (gp === 'month') p = '30d';
    else if (gp === 'year') p = 'year';

    setPeriod(p);
    fetchWeekly(p);
  };

  const handleGoalSubmit = (e) => {
    e.preventDefault();
    const parsed = parseFloat(goalInput.replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0) {
      setGoalDistance(parsed);
      setGoalPeriod(goalPeriodInput);
      // po zmianie celu zsynchronizuj zakres z wykresem / ringiem
      syncGoalPeriodWithWeekly(goalPeriodInput);
    }
  };

  const totalThisPeriodKmNumber = weekly ? weekly.total_distance_m / 1000 : 0;
  const totalThisPeriodKm = totalThisPeriodKmNumber.toFixed(1);
  const goalProgress =
    goalDistance > 0 ? Math.min(totalThisPeriodKmNumber / goalDistance, 1) : 0;
  const remainingKm = goalDistance - totalThisPeriodKmNumber;

  const periodHeader =
    period === '7d'
      ? 'Ostatnie 7 dni'
      : period === '30d'
      ? 'Ostatnie 30 dni'
      : 'Ostatni rok';

  return (
    <div className="home-hero">
      {/* TRZY-KOLUMNOWY GRID */}
      <div className="home-hero-grid">
        {/* LEWY WIDGET – ostatnie treningi */}
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

                  const kmRecent = w.distance_m
                    ? (w.distance_m / 1000).toFixed(2)
                    : null;
                  const paceRecent = formatPace(w.duration_ms, w.distance_m);

                  let sourceLabel = '';
                  if (w.source === 'adidas' || w.source === 'json') {
                    sourceLabel = 'Adidas Running';
                  } else if (w.source === 'strava') {
                    sourceLabel = 'Strava';
                  } else if (w.manual) {
                    sourceLabel = 'Ręcznie dodany';
                  }

                  return (
                    <li
                      key={w.id}
                      className={
                        'home-recent-item' +
                        (index === 0 ? ' home-recent-item-main' : '')
                      }
                    >
                      <div className="home-recent-date">{dateStrRecent}</div>
                      <div className="home-recent-main">
                        <div className="home-recent-main-top">
                          <span className="home-recent-title">{w.title}</span>
                          {kmRecent && (
                            <span className="home-recent-distance">
                              {kmRecent} km
                            </span>
                          )}
                        </div>
                        <div className="home-recent-meta">
                          <span className="home-recent-meta-label">Tempo</span>
                          <span className="home-recent-meta-value">
                            {paceRecent ?? '--'}
                          </span>
                        </div>
                        {sourceLabel && (
                          <div className="home-recent-meta">
                            <span className="home-recent-meta-label">
                              Źródło
                            </span>
                            <span className="home-recent-meta-value">
                              {sourceLabel}
                            </span>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* ŚRODEK – FILMIK */}
        <div className="home-col home-col-center">
          <div className="home-hero-inner">
            <div className="home-hero-video-wrapper">
              <video autoPlay muted loop playsInline>
                <source src="/materials/running.mp4" type="video/mp4" />
              </video>
            </div>

            <section className="home-hero-content">
              <h2>Witaj w aplikacji do analizy treningów biegowych!</h2>
              <p>
                Monitoruj swoje postępy, analizuj statystyki i dziel się
                wynikami z innymi biegaczami.
              </p>
            </section>
          </div>
        </div>

        {/* PRAWO – CEL + PODSUMOWANIA */}
        <div className="home-col home-col-right">
          <div className="home-goal-week-wrapper">
            {/* CEL */}
            <div className="home-goal-card">
              <div className="home-goal-header">
                <span className="home-last-workout-label">Cel biegowy</span>
                <span className="home-goal-period">
                  {goalDistance} km /{' '}
                  {goalPeriod === 'week'
                    ? 'tydzień'
                    : goalPeriod === 'month'
                    ? 'miesiąc'
                    : 'rok'}
                </span>
              </div>

              <div className="home-goal-inner">
                <div className="goal-ring">
                  <div
                    className="goal-ring-fill"
                    style={{ '--goal-progress': goalProgress }}
                  />
                  <div className="goal-ring-center">
                    <div className="goal-ring-value">{totalThisPeriodKm}</div>
                    <div className="goal-ring-label">km w tym okresie</div>
                  </div>
                </div>

                <div className="home-goal-details">
                  <div className="stat-pill stat-pill-light">
                    <span className="stat-pill-label">Do celu</span>
                    <span className="stat-pill-value">
                      {remainingKm > 0
                        ? `${remainingKm.toFixed(1)} km`
                        : 'Cel osiągnięty 🎉'}
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

            {/* PODSUMOWANIE OKRESU – 7/30/rok */}
            <div className="home-weekly-card">
              <div className="home-weekly-header">
                <span className="home-last-workout-label">{periodHeader}</span>
                <span className="home-weekly-total">
                  {weekly
                    ? `${(weekly.total_distance_m / 1000).toFixed(1)} km`
                    : '0 km'}
                </span>
              </div>

              <div className="home-weekly-period-toggle">
                <button
                  type="button"
                  className={
                    period === '7d' ? 'weekly-toggle active' : 'weekly-toggle'
                  }
                  onClick={() => {
                    setPeriod('7d');
                    fetchWeekly('7d');
                  }}
                >
                  7 dni
                </button>
                <button
                  type="button"
                  className={
                    period === '30d' ? 'weekly-toggle active' : 'weekly-toggle'
                  }
                  onClick={() => {
                    setPeriod('30d');
                    fetchWeekly('30d');
                  }}
                >
                  30 dni
                </button>
                <button
                  type="button"
                  className={
                    period === 'year'
                      ? 'weekly-toggle active'
                      : 'weekly-toggle'
                  }
                  onClick={() => {
                    setPeriod('year');
                    fetchWeekly('year');
                  }}
                >
                  Rok
                </button>
              </div>

              <div className="home-weekly-chart">
                {weekly &&
                  weekly.items &&
                  weekly.items.map((it) => {
                    const km = it.distance_m / 1000;
                    const height = weekly.total_distance_m
                      ? (km / (weekly.total_distance_m / 1000)) * 100
                      : 0;

                    let label;

                    if (period === 'year') {
                      // it.label = "YYYY-MM"  -> miesiąc
                      label = new Date(it.label + '-01').toLocaleDateString('pl-PL', {
                        month: 'short',
                      });
                    } else if (period === '30d') {
                      // it.label = "YYYY-MM-DD" (poniedziałek tygodnia) -> np. "01 sty"
                      label = new Date(it.label).toLocaleDateString('pl-PL', {
                        day: '2-digit',
                        month: 'short',
                      });
                    } else {
                      // 7 dni – etykieta = dzień tygodnia
                      label = new Date(it.label).toLocaleDateString('pl-PL', {
                        weekday: 'short',
                      });
                    }


                    return (
                      <div
                        key={it.label}
                        className="home-weekly-bar-wrapper"
                      >
                        <div
                          className="home-weekly-bar"
                          style={{
                            height: `${Math.max(height, km > 0 ? 18 : 4)}%`,
                          }}
                        />
                        <span className="home-weekly-bar-label">{label}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
