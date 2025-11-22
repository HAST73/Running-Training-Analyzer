import React, { useEffect, useState } from 'react';

function Profile({ session, refreshSession }) {
  const [profileError, setProfileError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [heightCm, setHeightCm] = useState(session?.height_cm || '');
  const [weightKg, setWeightKg] = useState(session?.weight_kg || '');
  const [birthYear, setBirthYear] = useState(session?.birth_year || '');

  useEffect(() => {
    setHeightCm(session?.height_cm || '');
    setWeightKg(session?.weight_kg || '');
    setBirthYear(session?.birth_year || '');
  }, [session]);

  const onSave = async (e) => {
    e.preventDefault();
    setProfileError('');
    setSuccessMessage('');
    try {
      const payload = {};
      if (heightCm.trim() !== '') payload.height_cm = heightCm.trim();
      if (weightKg.trim() !== '') payload.weight_kg = weightKg.trim();
      if (birthYear.trim() !== '') payload.birth_year = birthYear.trim();

      const res = await fetch('http://127.0.0.1:8000/api/update_profile/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileError(data.error || 'Błąd aktualizacji profilu.');
        return;
      }
      setSuccessMessage('Profil zaktualizowany pomyślnie.');
      refreshSession && refreshSession();
    } catch (e) {
      setProfileError('Błąd połączenia z serwerem');
    }
  };

  return (
    <div className="profile-page">
      <h2>Profil użytkownika</h2>
      <form onSubmit={onSave} className="profile-form">
        <label>
          Wzrost (cm)
          <input
            type="number"
            min="0"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            placeholder="np. 180"
          />
        </label>
        <label>
          Waga (kg)
          <input
            type="number"
            min="0"
            step="0.1"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            placeholder="np. 72.5"
          />
        </label>
        <label>
          Rok urodzenia
          <input
            type="number"
            min="1900"
            max={new Date().getFullYear()}
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            placeholder="np. 1990"
          />
        </label>
        {profileError && <p className="form-error">{profileError}</p>}
        {successMessage && <p className="form-success">{successMessage}</p>}
        <button type="submit" className="btn-primary">Zapisz</button>
      </form>
      <div className="profile-meta">
        <p><strong>Użytkownik:</strong> {session?.username}</p>
        <p><strong>Email:</strong> {session?.email}</p>
        {session?.pro_unlocked && <p className="pro-badge">PRO aktywny</p>}
      </div>
    </div>
  );
}

export default Profile;