import React, { useEffect, useState } from 'react';
import { getCSRFToken } from '../../utils/csrf';

function Workouts() {
  const [workouts, setWorkouts] = useState([]);
  const [adidasWorkouts, setAdidasWorkouts] = useState([]);
  const [stravaWorkouts, setStravaWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sourceInfo, setSourceInfo] = useState('');
  const [uploadingGpxId, setUploadingGpxId] = useState(null);
  const [uploadingHrId, setUploadingHrId] = useState(null);

  const fetchWorkouts = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/workouts/', {
        credentials: 'include',
      });
      const data = await res.json();
      const all = data.workouts || [];
      setWorkouts(all);
      setAdidasWorkouts(all.filter((w) => w.source === 'json' || w.source === 'adidas'));
      setStravaWorkouts(all.filter((w) => w.source === 'strava'));
      setError('');
    } catch (e) {
      setError('Nie udało się pobrać treningów.');
    } finally {
      setLoading(false);
    }
  };

  const handleGpxUpload = async (event, workoutId) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingGpxId(workoutId);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`http://127.0.0.1:8000/api/workouts/${workoutId}/gpx/`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Nie udało się dodać pliku GPX.');
      }

      await fetchWorkouts();
      setError('');
      setSourceInfo('Dołączono plik GPX do treningu.');
    } catch (e) {
      console.error(e);
      setError('Nie udało się dołączyć pliku GPX.');
    } finally {
      setUploadingGpxId(null);
      event.target.value = '';
    }
  };

  const handleHrUpload = async (event, workoutId) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingHrId(workoutId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const csrf = getCSRFToken();
      const res = await fetch(`http://127.0.0.1:8000/api/workouts/${workoutId}/attach_hr/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'X-CSRFToken': csrf,
        },
        body: formData,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || 'Nie udało się dodać danych tętna.');
      }
      setWorkouts(prev => prev.map(w => w.id === workoutId ? { ...w, hr_stats: payload.hr_stats } : w));
      setAdidasWorkouts(prev => prev.map(w => w.id === workoutId ? { ...w, hr_stats: payload.hr_stats } : w));
      setStravaWorkouts(prev => prev.map(w => w.id === workoutId ? { ...w, hr_stats: payload.hr_stats } : w));
      setSourceInfo('Dołączono dane tętna.');
      setError('');
    } catch (e) {
      console.error(e);
      setError('Nie udało się dołączyć pliku z tętnem.');
    } finally {
      setUploadingHrId(null);
      event.target.value = '';
    }
  };

  useEffect(() => {
    fetchWorkouts();
  }, []);

  const handleAdidasFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('http://127.0.0.1:8000/api/workouts/upload/', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Błąd przy imporcie treningu.');
      }

      await fetchWorkouts();
      setError('');
      setSourceInfo('Zaimportowano trening z Adidas Running (.json).');
    } catch (e) {
      console.error(e);
      setError('Nie udało się zaimportować pliku Adidas Running. Upewnij się, że to poprawny JSON.');
    } finally {
      event.target.value = '';
    }
  };

  const handleStravaFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('http://127.0.0.1:8000/api/workouts/upload/', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Błąd przy imporcie treningu Strava.');
      }

      await fetchWorkouts();
      setError('');
      setSourceInfo('Zaimportowano trening ze Stravy (.fit).');
    } catch (e) {
      console.error(e);
      setError('Nie udało się zaimportować pliku Strava (.fit).');
    } finally {
      event.target.value = '';
    }
  };

  const handleImportStravaAll = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/workouts/import_strava/', {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Nie udało się zaimportować treningów ze Stravy.');
      }

      const payload = await res.json();
      await fetchWorkouts();
      setError('');
      setSourceInfo(`Zaimportowano treningi ze Stravy (API). Nowe: ${payload.imported ?? 0}.`);
    } catch (e) {
      console.error(e);
      setError('Nie udało się zaimportować wszystkich treningów ze Stravy.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Na pewno usunąć ten trening?')) return;

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/workouts/${id}/`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Błąd przy usuwaniu treningu.');
      }
      setWorkouts((prev) => prev.filter((w) => w.id !== id));
      setAdidasWorkouts((prev) => prev.filter((w) => w.id !== id));
      setStravaWorkouts((prev) => prev.filter((w) => w.id !== id));
    } catch (e) {
      console.error(e);
      setError('Nie udało się usunąć treningu.');
    }
  };

  return (
    <section>
      <h2 style={{ textAlign: 'center', marginBottom: '1.5em' }}>Moje treningi</h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(320px, 1fr))',
          gap: '3rem',
          justifyContent: 'center',
          margin: '0 auto 1.5em auto',
          maxWidth: '1300px',
        }}
      >
        <div>
          <h3>Adidas Running</h3>
          <p style={{ fontSize: '0.9em', color: '#555' }}>
            Wgraj pierwszy plik w formacie <strong>.json</strong> wyeksportowany z aplikacji Adidas Running.
          </p>
          <label
            htmlFor="workout-upload-adidas"
            style={{
              display: 'inline-block',
              background: '#2563eb',
              color: '#fff',
              padding: '0.6em 1.2em',
              borderRadius: 4,
              cursor: 'pointer',
              marginTop: '0.5em',
            }}
          >
            Importuj trening Adidas (.json)
          </label>
          <input
            id="workout-upload-adidas"
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleAdidasFileChange}
          />
        </div>

        <div>
          <h3>Strava</h3>
          <p style={{ fontSize: '0.9em', color: '#555' }}>
            Wgraj plik <strong>.fit</strong> wyeksportowany ze Stravy. Dane zostaną sparsowane po stronie backendu.
          </p>
          <label
            htmlFor="workout-upload-strava"
            style={{
              display: 'inline-block',
              background: '#16a34a',
              color: '#fff',
              padding: '0.6em 1.2em',
              borderRadius: 4,
              cursor: 'pointer',
              marginTop: '0.5em',
            }}
          >
            Importuj trening Strava (.fit)
          </label>
          <input
            id="workout-upload-strava"
            type="file"
            accept=".fit"
            style={{ display: 'none' }}
            onChange={handleStravaFileChange}
          />

          <div style={{ marginTop: '0.75em' }}>
            <button onClick={handleImportStravaAll}>
              Importuj wszystkie treningi Strava (API)
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p style={{ color: 'red', textAlign: 'center', marginTop: '0.75em' }}>
          {error}
        </p>
      )}
      {sourceInfo && !error && (
        <p
          style={{
            color: 'green',
            textAlign: 'center',
            marginTop: '0.75em',
            fontSize: '0.9em',
          }}
        >
          {sourceInfo}
        </p>
      )}

      {loading ? (
        <p style={{ textAlign: 'center' }}>Ładowanie treningów...</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(320px, 1fr))',
            gap: '3rem',
            marginTop: '2em',
            justifyContent: 'center',
            margin: '0 auto',
            maxWidth: '1300px',
          }}
        >
          {/* LISTA ADIDAS */}
          <div>
            <h3>Lista treningów Adidas</h3>
            {adidasWorkouts.length === 0 ? (
              <p style={{ fontSize: '0.9em', color: '#555' }}>
                Brak treningów Adidas. Wgraj plik .json, aby dodać pierwszy.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {adidasWorkouts.map((w) => (
                  <li
                    key={w.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.5em 0',
                      borderBottom: '1px solid #eee',
                    }}
                  >
                    <div>
                      <div>
                        <strong>
                          Bieg{' '}
                          {(w.performed_at || w.created_at)
                            ? new Date(w.performed_at || w.created_at).toLocaleDateString('pl-PL')
                            : ''}
                        </strong>
                      </div>
                      {w.distance_m && (
                        <div style={{ color: '#555', marginTop: '0.1em' }}>
                          {(w.distance_m / 1000).toFixed(1)} km
                        </div>
                      )}
                      {(w.gpx_file || w.manual) && (
                        <div
                          style={{
                            fontSize: '0.8em',
                            marginTop: '0.1em',
                            maxWidth: '180px',   // <–– kluczowe: węższy blok, ładniejsze łamanie
                            lineHeight: 1.25,
                          }}
                        >
                          {w.gpx_file && (
                            <div style={{ color: '#16a34a' }}>
                              GPX dołączony – można wygenerować widok trasy
                            </div>
                          )}
                          {w.manual && (
                            <div style={{ color: '#6b7280' }}>
                              (ręcznie dodany)
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        flex: '0 0 auto',
                        minWidth: 240,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                      }}
                    >
                      {/* 1. GPX + Usuń */}
                      <div style={{ display: 'flex', gap: '0.5em', marginBottom: '0.5em' }}>
                        <label
                          style={{
                            padding: '0.4em 0.8em',
                            fontSize: '0.85em',
                            whiteSpace: 'nowrap',
                            background: '#0ea5e9',
                            color: '#fff',
                            borderRadius: 4,
                            cursor: 'pointer',
                          }}
                        >
                          {uploadingGpxId === w.id
                            ? 'Wgrywanie...'
                            : w.gpx_file
                            ? 'Zmień plik GPX'
                            : 'Dołącz plik GPX'}
                          <input
                            type="file"
                            accept=".gpx,application/gpx+xml,application/xml,text/xml"
                            style={{ display: 'none' }}
                            onChange={(e) => handleGpxUpload(e, w.id)}
                          />
                        </label>
                        <button onClick={() => handleDelete(w.id)}>Usuń</button>
                      </div>

                      {/* 2. Szczegóły biegu */}
                      <button
                        style={{
                          width: '70%',
                          background: '#0f172a',
                          color: '#38bdf8',
                          padding: '0.45em 0.9em',
                          borderRadius: 6,
                          fontSize: '0.9em',
                          border: '1px solid #334155',
                          cursor: 'pointer',
                          textAlign: 'center',
                          marginBottom: '0.5em',
                        }}
                        type="button"
                        onClick={() => {
                          window.location.hash = `#analysis?id=${w.id}`;
                        }}
                      >
                        Szczegóły biegu
                      </button>

                      {/* 3. HR button */}
                      <label
                        style={{
                          padding: '0.35em 0.9em',
                          fontSize: '0.85em',
                          background: '#dc2626',
                          color: '#fff',
                          borderRadius: 4,
                          cursor: 'pointer',
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                          width: '70%',
                          marginBottom: '0.35em',
                        }}
                      >
                        {uploadingHrId === w.id ? 'HR...' : w.hr_stats ? 'Zmień HR' : 'Dołącz HR'}
                        <input
                          type="file"
                          accept=".json,application/json"
                          style={{ display: 'none' }}
                          onChange={(e) => handleHrUpload(e, w.id)}
                        />
                      </label>

                      {/* 4. HR INFO – krótszy tekst, stała szerokość */}
                      <div
                        style={{
                          fontSize: '0.8em',
                          maxWidth: '230px',
                          textAlign: 'center',
                          lineHeight: 1.3,
                        }}
                      >
                        {w.hr_stats ? (
                          <>
                            <div style={{ color: '#16a34a' }}>
                              Plik HR dołączony – {w.hr_stats.count} próbek
                            </div>
                            <div
                              style={{
                                fontSize: '0.75em',
                                color: '#374151',
                                marginTop: '0.1em',
                              }}
                            >
                              Śr {w.hr_stats.avg} / min {w.hr_stats.min} / max {w.hr_stats.max}
                            </div>
                          </>
                        ) : (
                          <div style={{ color: '#6b7280' }}>
                            Brak pliku HR – dołącz plik .json z tętnem.
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* LISTA STRAVA */}
          <div>
            <h3>Lista treningów Strava</h3>
            {stravaWorkouts.length === 0 ? (
              <p style={{ fontSize: '0.9em', color: '#555' }}>
                Brak treningów Strava. Po dodaniu obsługi plików .fit pojawią się tutaj.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {stravaWorkouts.map((w) => (
                  <li
                    key={w.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.5em 0',
                      borderBottom: '1px solid #eee',
                    }}
                  >
                    <div>
                      <div>
                        <strong>
                          Bieg{' '}
                          {(w.performed_at || w.created_at)
                            ? new Date(w.performed_at || w.created_at).toLocaleDateString('pl-PL')
                            : ''}
                        </strong>
                      </div>
                      {w.distance_m && (
                        <div style={{ color: '#555', marginTop: '0.1em' }}>
                          {(w.distance_m / 1000).toFixed(1)} km
                        </div>
                      )}
                      {(w.gpx_file || w.manual) && (
                        <div
                          style={{
                            fontSize: '0.8em',
                            marginTop: '0.1em',
                            maxWidth: '180px',   // <–– kluczowe: węższy blok, ładniejsze łamanie
                            lineHeight: 1.25,
                          }}
                        >
                          {w.gpx_file && (
                            <div style={{ color: '#16a34a' }}>
                              GPX dołączony – można wygenerować widok trasy
                            </div>
                          )}
                          {w.manual && (
                            <div style={{ color: '#6b7280' }}>
                              (ręcznie dodany)
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        flex: '0 0 auto',
                        minWidth: 240,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                      }}
                    >
                      {/* 1. GPX + Usuń */}
                      <div style={{ display: 'flex', gap: '0.5em', marginBottom: '0.5em' }}>
                        <label
                          style={{
                            padding: '0.4em 0.8em',
                            fontSize: '0.85em',
                            whiteSpace: 'nowrap',
                            background: '#0ea5e9',
                            color: '#fff',
                            borderRadius: 4,
                            cursor: 'pointer',
                          }}
                        >
                          {uploadingGpxId === w.id
                            ? 'Wgrywanie...'
                            : w.gpx_file
                            ? 'Zmień plik GPX'
                            : 'Dołącz plik GPX'}
                          <input
                            type="file"
                            accept=".gpx,application/gpx+xml,application/xml,text/xml"
                            style={{ display: 'none' }}
                            onChange={(e) => handleGpxUpload(e, w.id)}
                          />
                        </label>

                        <button onClick={() => handleDelete(w.id)}>Usuń</button>
                      </div>

                      {/* 2. Szczegóły biegu */}
                      <button
                        style={{
                          width: '70%',
                          background: '#0f172a',
                          color: '#38bdf8',
                          padding: '0.45em 0.9em',
                          borderRadius: 6,
                          fontSize: '0.9em',
                          border: '1px solid #334155',
                          cursor: 'pointer',
                          textAlign: 'center',
                          marginBottom: '0.5em',
                        }}
                        type="button"
                        onClick={() => {
                          window.location.hash = `#analysis?id=${w.id}`;
                        }}
                      >
                        Szczegóły biegu
                      </button>

                      {/* 3. HR button */}
                      <label
                        style={{
                          padding: '0.35em 0.9em',
                          fontSize: '0.85em',
                          background: '#dc2626',
                          color: '#fff',
                          borderRadius: 4,
                          cursor: 'pointer',
                          textAlign: 'center',
                          whiteSpace: 'nowrap',
                          width: '70%',
                          marginBottom: '0.35em',
                        }}
                      >
                        {uploadingHrId === w.id ? 'HR...' : w.hr_stats ? 'Zmień HR' : 'Dołącz HR'}
                        <input
                          type="file"
                          accept=".json,application/json"
                          style={{ display: 'none' }}
                          onChange={(e) => handleHrUpload(e, w.id)}
                        />
                      </label>

                      {/* 4. HR INFO – stała szerokość, jak w Adidas */}
                      <div
                        style={{
                          fontSize: '0.8em',
                          maxWidth: '230px',
                          textAlign: 'center',
                          lineHeight: 1.3,
                        }}
                      >
                        {w.hr_stats ? (
                          <>
                            <div style={{ color: '#16a34a' }}>
                              Plik HR dołączony – {w.hr_stats.count} próbek
                            </div>
                            <div
                              style={{
                                fontSize: '0.75em',
                                color: '#374151',
                                marginTop: '0.1em',
                              }}
                            >
                              Śr {w.hr_stats.avg} / min {w.hr_stats.min} / max {w.hr_stats.max}
                            </div>
                          </>
                        ) : (
                          <div style={{ color: '#6b7280' }}>
                            Brak pliku HR – dołącz plik .json z tętnem.
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default Workouts;
