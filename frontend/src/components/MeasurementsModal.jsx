import React, { useState } from 'react';

function MeasurementsModal({ session, onDone }) {
  const [heightCm, setHeightCm] = useState(session.height_cm || '');
  const [weightKg, setWeightKg] = useState(session.weight_kg || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!session.needs_measurements) return null;

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {};
      if (heightCm !== '') payload.height_cm = heightCm;
      if (weightKg !== '') payload.weight_kg = weightKg;
      const res = await fetch('http://127.0.0.1:8000/api/profile/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Błąd zapisu');
      } else {
        onDone && onDone();
      }
    } catch (err) {
      setError('Błąd sieci');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h3>Uzupełnij dane</h3>
        <p>Aby dokładniej analizować kalorie i tempo, uzupełnij wzrost i wagę.</p>
        <form onSubmit={save} className="modal-form">
          <label>
            Wzrost (cm)
            <input
              type="number"
              min="0"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              placeholder="np. 180"
              required
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
              required
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button disabled={saving} type="submit" className="btn-primary">{saving ? 'Zapis...' : 'Zapisz'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MeasurementsModal;