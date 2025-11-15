import React, { useEffect, useState } from 'react';

function Workouts() {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchWorkouts = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/workouts/', {
        credentials: 'include',
      });
      const data = await res.json();
      setWorkouts(data.workouts || []);
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

  const handleFileChange = async (event) => {
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
    } catch (e) {
      console.error(e);
      setError('Nie udało się zaimportować pliku. Upewnij się, że to poprawny JSON.');
    } finally {
      // reset input, żeby można było wgrać ten sam plik ponownie
      event.target.value = '';
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
    } catch (e) {
      console.error(e);
      setError('Nie udało się usunąć treningu.');
    }
  };

  return (
    <section>
      <h2>Moje treningi</h2>

      <div style={{ marginBottom: '1em' }}>
        <label
          htmlFor="workout-upload"
          style={{
            display: 'inline-block',
            background: '#2563eb',
            color: '#fff',
            padding: '0.6em 1.2em',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Importuj trening (.json)
        </label>
        <input
          id="workout-upload"
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {loading ? (
        <p>Ładowanie treningów...</p>
      ) : workouts.length === 0 ? (
        <p>Brak zapisanych treningów. Zaimportuj plik .json, aby dodać pierwszy.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {workouts.map((w) => (
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
              </div>
              <button onClick={() => handleDelete(w.id)}>Usuń</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default Workouts;
