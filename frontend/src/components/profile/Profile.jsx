import React, { useEffect, useState } from 'react';

function Profile({ session, onUpdated }) {
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Strava link state
  const [stravaStatus, setStravaStatus] = useState(session && session.strava_linked ? 'linked' : 'not-linked');
  const [stravaMsg, setStravaMsg] = useState('');
  
  // Pobieramy dane z sesji przy starcie
  useEffect(() => {
    if (session) {
        setUsername(session.username || '');
        setFirstName(session.first_name || '');
        setLastName(session.last_name || '');
        setHeightCm(session.height_cm || '');
        setWeightKg(session.weight_kg || '');
    }
  }, [session]);

  // Keep some primitives in sync explicitly
  useEffect(() => {
    if (!session) return;
    setUsername(session.username || '');
    setHeightCm(session.height_cm || '');
    setWeightKg(session.weight_kg || '');
  }, [session?.username, session?.height_cm, session?.weight_kg]);

  // Derive Strava linked state from session fields
  useEffect(() => {
    if (!session) return;
    const linkedFromSession = Boolean(
      session.strava_linked ||
      session.strava_athlete_id ||
      session.strava_access_token ||
      session.strava_refresh_token
    );
    setStravaStatus(linkedFromSession ? 'linked' : 'not-linked');
  }, [session?.strava_linked]);

  // Sync Strava link state from backend (tokens present in DB)
  useEffect(() => {
    const fetchStravaStatus = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/strava/status/', { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (res.ok && (data.linked === true || data.has_tokens === true)) {
          setStravaStatus('linked');
        }
        // Fallback to profile endpoint if status not conclusive
        if (!res.ok || !(data.linked === true || data.has_tokens === true)) {
          try {
            const r2 = await fetch('http://127.0.0.1:8000/api/profile/', { credentials: 'include' });
            const d2 = await r2.json().catch(() => ({}));
            if (r2.ok && (d2.strava_access_token || d2.strava_athlete_id || d2.strava_refresh_token)) {
              setStravaStatus('linked');
            }
          } catch {}
        }
      } catch {}
    };
    fetchStravaStatus();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setSaved(false);
    setSaving(true);
    
    // Walidacja front-end
    const nameRegex = /^[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+([ -][A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+)*$/;
    if (firstName && !nameRegex.test(firstName.trim())) {
        setError('Imię musi zaczynać się z dużej litery.');
        setSaving(false);
        return;
    }
    if (lastName && !nameRegex.test(lastName.trim())) {
        setError('Nazwisko musi zaczynać się z dużej litery.');
        setSaving(false);
        return;
    }

    try {
      const payload = {
        username,
        first_name: firstName,
        last_name: lastName,
        height_cm: heightCm,
        weight_kg: weightKg
      };
      
      const res = await fetch('http://127.0.0.1:8000/api/profile/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Błąd zapisu');
      } else {
        setSaved(true);
        onUpdated && onUpdated(); // Odświeża sesję w App.js
      }
    } catch (err) {
      setError('Błąd sieci');
    } finally {
      setSaving(false);
    }
  };

  const startStravaLink = async () => {
    setStravaMsg('');
    try {
      const res = await fetch('http://127.0.0.1:8000/api/strava/connect/', {
        method: 'GET',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.auth_url) {
        throw new Error(data.error || 'Nie udało się rozpocząć łączenia ze Strava.');
      }
      window.location.href = data.auth_url;
    } catch (e) {
      setStravaMsg(e.message || 'Błąd połączenia ze Strava.');
    }
  };

  const unlinkStrava = async () => {
    setStravaMsg('');
    try {
      const res = await fetch('http://127.0.0.1:8000/api/strava/unlink/', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Nie udało się odłączyć Strava.');
      }
      setStravaStatus('not-linked');
      setStravaMsg('Konto Strava odłączone.');
      onUpdated && onUpdated();
    } catch (e) {
      setStravaMsg(e.message || 'Błąd odłączania Strava.');
    }
  };

  return (
    <div className="profile-page">
      <h2>Profil Użytkownika</h2>
      <form onSubmit={save} className="profile-form">
        <div className="form-row">
            <label>Nazwa użytkownika
                <input type="text" value={username} onChange={e => setUsername(e.target.value)} />
            </label>
        </div>
        
        <div className="form-row">
            <label>Imię
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Np. Jan" />
            </label>
        </div>
        
        <div className="form-row">
            <label>Nazwisko
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Np. Kowalski" />
            </label>
        </div>

        <div className="form-row">
            <label>Wzrost (cm)
                <input type="number" value={heightCm} onChange={e => setHeightCm(e.target.value)} />
            </label>
        </div>

        <div className="form-row">
            <label>Waga (kg)
                <input type="number" step="0.1" value={weightKg} onChange={e => setWeightKg(e.target.value)} />
            </label>
        </div>

        {error && <p className="form-error" style={{color:'red'}}>{error}</p>}
        {saved && <p className="form-success" style={{color:'green'}}>Zapisano zmiany!</p>}
        
        <button disabled={saving} type="submit" className="btn-primary">
            {saving ? 'Zapisywanie...' : 'Zapisz zmiany'}
        </button>
      </form>

      {/* Powiązanie konta Strava */}
      <div className="auth-card" style={{ marginTop: '1.2rem' }}>
        <h3>Powiązanie konta Strava</h3>
        <p style={{ color: '#475569', fontSize: '0.9rem' }}>
          Połącz konto Strava z tym profilem, aby automatycznie importować treningi w zakładce "Moje treningi".
        </p>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginTop: '0.6rem' }}>
          {stravaStatus === 'linked' ? (
            <>
              <span style={{ color: '#16a34a', fontWeight: 600 }}>Strava: połączono</span>
              <button type="button" className="btn-primary" onClick={unlinkStrava} style={{ background:'#ef4444' }}>Odłącz</button>
            </>
          ) : (
            <>
              <span style={{ color: '#6b7280' }}>Strava: niepołączono</span>
              <button type="button" className="btn-strava" onClick={startStravaLink}>Połącz ze Strava</button>
            </>
          )}
        </div>
        {stravaMsg && (
          <p style={{ marginTop: '0.5rem', color: stravaMsg.includes('odłączone') ? '#16a34a' : '#dc2626' }}>{stravaMsg}</p>
        )}
      </div>
    </div>
  );
}

export default Profile;