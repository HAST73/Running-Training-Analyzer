import React, { useEffect, useState } from 'react';

function Workouts() {
  const [workouts, setWorkouts] = useState([]);
  const [adidasWorkouts, setAdidasWorkouts] = useState([]);
  const [stravaWorkouts, setStravaWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sourceInfo, setSourceInfo] = useState('');

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

  useEffect(() => {
    fetchWorkouts();
  }, []);

  const handleAdidasFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      const res = await fetch('http://127.0.0.1:8000/api/workouts/upload/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(parsed),
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
      // reset input, żeby można było wgrać ten sam plik ponownie
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
          gridTemplateColumns: '1.1fr 1.1fr',
          gap: '3rem',
          margin: '0 auto 1.5em auto',
          maxWidth: '900px',
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

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {sourceInfo && !error && <p style={{ color: 'green' }}>{sourceInfo}</p>}

      {loading ? (
        <p style={{ textAlign: 'center' }}>Ładowanie treningów...</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '3rem',
            marginTop: '2em',
            margin: '0 auto',
            maxWidth: '900px',
          }}
        >
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
                      <strong>{w.title}</strong>
                      {w.distance_m && (
                        <span style={{ marginLeft: '0.5em', color: '#555' }}>
                          {(w.distance_m / 1000).toFixed(1)} km
                        </span>
                      )}
                      {w.manual && (
                        <span style={{ marginLeft: '0.5em', fontSize: '0.8em', color: '#6b7280' }}>
                          (ręcznie dodany)
                        </span>
                      )}
                    </div>
                    <button onClick={() => handleDelete(w.id)}>Usuń</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

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
                      <strong>{w.title}</strong>
                      {w.distance_m && (
                        <span style={{ marginLeft: '0.5em', color: '#555' }}>
                          {(w.distance_m / 1000).toFixed(1)} km
                        </span>
                      )}
                      {w.manual && (
                        <span style={{ marginLeft: '0.5em', fontSize: '0.8em', color: '#6b7280' }}>
                          (ręcznie dodany)
                        </span>
                      )}
                    </div>
                    <button onClick={() => handleDelete(w.id)}>Usuń</button>
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
