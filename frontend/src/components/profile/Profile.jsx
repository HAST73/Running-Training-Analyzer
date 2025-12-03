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
    </div>
  );
}

export default Profile;