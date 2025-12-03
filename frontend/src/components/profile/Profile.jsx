import React, { useEffect, useState } from 'react';

function Profile({ session, onUpdated }) {
  const [username, setUsername] = useState(session.username || '');
  const [heightCm, setHeightCm] = useState(session.height_cm || '');
  const [weightKg, setWeightKg] = useState(session.weight_kg || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [stravaStatus, setStravaStatus] = useState(session.strava_linked ? 'linked' : 'not-linked');
  const [stravaMsg, setStravaMsg] = useState('');

  useEffect(() => {
    setUsername(session.username || '');
    setHeightCm(session.height_cm || '');
    setWeightKg(session.weight_kg || '');
  }, [session.username, session.height_cm, session.weight_kg]);

  useEffect(() => {
    const linkedFromSession = Boolean(
      session.strava_linked ||
      session.strava_athlete_id ||
      session.strava_access_token ||
      session.strava_refresh_token
    );
    setStravaStatus(linkedFromSession ? 'linked' : 'not-linked');
  }, [session.strava_linked]);

  // Sync Strava link state from backend (e.g., tokens exist in DB)
  useEffect(() => {
    const fetchStravaStatus = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/strava/status/', { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (res.ok && (data.linked === true || data.has_tokens === true)) {
          setStravaStatus('linked');
        }
        // Fallback: try profile endpoint for token fields
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
    try {
      const payload = {};
      if (username !== (session.username || '')) payload.username = username;
      if (heightCm !== '') payload.height_cm = heightCm;
      if (weightKg !== '') payload.weight_kg = weightKg;
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
        onUpdated && onUpdated();
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
      <h2>Profil</h2>
      <form onSubmit={save} className="profile-form">
        <div className="form-row">
          <label>Nazwa użytkownika
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="np. biegacz_krk"
            />
          </label>
          {session.needs_username && (
            <p style={{ marginTop: 6, fontSize: '0.9em', color: '#7c3aed' }}>
              Ustaw własną nazwę użytkownika (konto połączone przez Strava).
            </p>
          )}
        </div>
        <div className="form-row">
          <label>Wzrost
            <input
              type="number"
              min="0"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="np. 180"
            />
          </label>
        </div>
        <div className="form-row">
          <label>Waga
            <input
              type="number"
              min="0"
              step="0.1"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="np. 72.5"
            />
          </label>
        </div>
        {error && <p className="form-error">{error}</p>}
        {saved && <p className="form-success">Zapisano!</p>}
        <div className="form-actions">
          <button disabled={saving} type="submit" className="btn-primary">{saving ? 'Zapis...' : 'Zapisz'}</button>
        </div>
      </form>

      {/* Ręczne powiązanie konta Strava */}
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