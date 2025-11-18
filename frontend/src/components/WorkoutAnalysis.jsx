import React, { useEffect, useMemo, useState } from 'react';

function getHashParams() {
  const hash = window.location.hash || '';
  const qIndex = hash.indexOf('?');
  if (qIndex === -1) return {};
  const query = new URLSearchParams(hash.slice(qIndex + 1));
  const out = {};
  for (const [k, v] of query.entries()) out[k] = v;
  return out;
}

export default function WorkoutAnalysis() {
  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const params = useMemo(() => getHashParams(), [window.location.hash]);
  const workoutId = params.id ? Number(params.id) : null;

  useEffect(() => {
    setLoading(true);
    setError('');
    setWorkout(null);
    if (!workoutId) {
      setError('Brak identyfikatora treningu w adresie.');
      setLoading(false);
      return;
    }

    // Tymczasowo pobieramy listę i filtrujemy po id; w przyszłości endpoint /api/workouts/<id>/details/
    const fetchOne = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/workouts/', { credentials: 'include' });
        if (!res.ok) throw new Error('Błąd pobierania listy treningów');
        const data = await res.json();
        const found = (data.workouts || []).find(w => w.id === workoutId) || null;
        setWorkout(found);
      } catch (e) {
        console.error(e);
        setError('Nie udało się pobrać danych treningu.');
      } finally {
        setLoading(false);
      }
    };

    fetchOne();
  }, [workoutId]);

  const handleBack = () => {
    window.location.hash = '#workouts';
  };

  return (
    <section>
      <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>Szczegółowa analiza biegu</h2>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
        <button onClick={handleBack}>Powrót do listy treningów</button>
      </div>

      {loading && <p style={{ textAlign: 'center' }}>Ładowanie...</p>}
      {error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}

      {!loading && !error && !workout && (
        <p style={{ textAlign: 'center' }}>Nie znaleziono treningu o ID: {workoutId}</p>
      )}

      {!loading && !error && workout && (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ marginBottom: '1rem' }}>
            <strong>Trening:</strong> {workout.title || `#${workout.id}`}<br />
            <strong>Data:</strong> {workout.performed_at ? new Date(workout.performed_at).toLocaleString('pl-PL') : (workout.created_at ? new Date(workout.created_at).toLocaleString('pl-PL') : '-') }<br />
            {workout.distance_m ? (
              <>
                <strong>Dystans:</strong> {(workout.distance_m / 1000).toFixed(2)} km
              </>
            ) : null}
          </div>

          <div style={{ padding: '1rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <p>Tu pojawi się szczegółowa analiza (tempo na odcinkach, wykresy, mapa itd.).</p>
            <p>Id treningu: <code>{workoutId}</code></p>
          </div>
        </div>
      )}
    </section>
  );
}
