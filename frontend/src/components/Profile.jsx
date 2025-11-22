import React, { useEffect, useState } from 'react';

function Profile({ session, onUpdated }) {
  const [username, setUsername] = useState(session.username || '');
  const [heightCm, setHeightCm] = useState(session.height_cm || '');
  const [weightKg, setWeightKg] = useState(session.weight_kg || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setUsername(session.username || '');
    setHeightCm(session.height_cm || '');
    setWeightKg(session.weight_kg || '');
  }, [session.username, session.height_cm, session.weight_kg]);

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
    </div>
  );
}

export default Profile;