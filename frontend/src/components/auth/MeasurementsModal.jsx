import React, { useState } from 'react';

function MeasurementsModal({ onClose, onSave }) {
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    setError('');
    if (heightCm.trim() === '' && weightKg.trim() === '') {
      setError('Wprowadź co najmniej jeden parametr.');
      return;
    }
    onSave({
      height_cm: heightCm.trim() !== '' ? heightCm.trim() : undefined,
      weight_kg: weightKg.trim() !== '' ? weightKg.trim() : undefined,
    });
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3>Aktualizuj parametry</h3>
        <form onSubmit={submit} className="modal-form">
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
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="submit" className="btn-primary">Zapisz</button>
            <button type="button" className="btn-secondary" onClick={onClose}>Anuluj</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MeasurementsModal;