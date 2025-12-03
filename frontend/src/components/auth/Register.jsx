import React, { useState, useEffect } from 'react';

function Register({ afterAuth }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pwTouched, setPwTouched] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState(null);
  const [checkingEmail, setCheckingEmail] = useState(false);

  // Sprawdzanie dostępności nazwy
  useEffect(() => {
    const timer = setTimeout(() => checkUsernameAvailability(username), 500);
    return () => clearTimeout(timer);
  }, [username]);

  async function checkUsernameAvailability(name) {
    if (!name || name.trim().length < 3) {
      setUsernameAvailable(null);
      return;
    }
    setCheckingUsername(true);
    setFieldErrors(prev => { const n = {...prev}; delete n.username; return n; });
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/check_username/?username=${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = await res.json();
        setUsernameAvailable(data.available);
        if (data.available === false) {
           setFieldErrors(prev => ({ ...prev, username: 'Nazwa zajęta' }));
        }
      }
    } catch (e) { setUsernameAvailable(null); }
    setCheckingUsername(false);
  }

  // Sprawdzanie dostępności email
  useEffect(() => {
    const timer = setTimeout(() => checkEmailAvailability(email), 500);
    return () => clearTimeout(timer);
  }, [email]);

  async function checkEmailAvailability(mail) {
    if (!mail || !/\S+@\S+\.\S+/.test(mail)) {
      setEmailAvailable(null);
      return;
    }
    setCheckingEmail(true);
    setFieldErrors(prev => { const n = {...prev}; delete n.email; return n; });
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/check_email/?email=${encodeURIComponent(mail)}`);
      if (res.ok) {
        const data = await res.json();
        setEmailAvailable(data.available);
        if (data.available === false) {
           setFieldErrors(prev => ({ ...prev, email: 'Email zajęty' }));
        }
      }
    } catch (e) { setEmailAvailable(null); }
    setCheckingEmail(false);
  }

  const validateName = (name) => {
    if (!name) return true; 
    // Wielka litera na początku, obsługa polskich znaków
    const re = /^[A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+([ -][A-ZĄĆĘŁŃÓŚŹŻ][a-ząćęłńóśźż]+)*$/;
    return re.test(name.trim());
  };

  const passwordChecks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  const passwordStrong = Object.values(passwordChecks).every(Boolean);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    const errors = {};

    if (usernameAvailable === false) errors.username = 'Nazwa zajęta.';
    if (emailAvailable === false) errors.email = 'Email zajęty.';
    
    if (firstName && !validateName(firstName)) errors.first_name = 'Imię musi zaczynać się wielką literą.';
    if (lastName && !validateName(lastName)) errors.last_name = 'Nazwisko musi zaczynać się wielką literą.';
    if (!heightCm || heightCm <= 0) errors.height_cm = 'Wymagane.';
    if (!weightKg || weightKg <= 0) errors.weight_kg = 'Wymagane.';
    if (!passwordStrong) errors.password = 'Hasło niespełnia wymagań.';

    if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
    }

    try {
      const res = await fetch('http://127.0.0.1:8000/api/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            username, email, password, 
            height_cm: heightCm, weight_kg: weightKg,
            first_name: firstName, last_name: lastName
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Błąd rejestracji');
        return;
      }
      
      // Auto login
      await fetch('http://127.0.0.1:8000/api/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      afterAuth && afterAuth();
    } catch (e) {
      setError('Błąd sieci');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Rejestracja</h2>
        <form onSubmit={onSubmit} className="auth-form">
            <label>Imię (opcjonalne)
                <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Np. Jan" />
                {fieldErrors.first_name && <span className="error">{fieldErrors.first_name}</span>}
            </label>
            <label>Nazwisko (opcjonalne)
                <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Np. Kowalski" />
                {fieldErrors.last_name && <span className="error">{fieldErrors.last_name}</span>}
            </label>
            
            <label>Nazwa użytkownika
                <input value={username} onChange={e => setUsername(e.target.value)} required 
                       style={{ borderColor: usernameAvailable === false ? 'red' : '' }}/>
                {checkingUsername && <small>Spr...</small>}
                {fieldErrors.username && <span className="error" style={{color:'red'}}>{fieldErrors.username}</span>}
            </label>
            
            <label>Email
                <input value={email} type="email" onChange={e => setEmail(e.target.value)} required
                       style={{ borderColor: emailAvailable === false ? 'red' : '' }}/>
                {checkingEmail && <small>Spr...</small>}
                {fieldErrors.email && <span className="error" style={{color:'red'}}>{fieldErrors.email}</span>}
            </label>
            
            <label>Hasło
                <input 
                  value={password} 
                  type="password" 
                  onChange={e => setPassword(e.target.value)} 
                  onBlur={() => setPwTouched(true)}
                  required 
                  style={{ borderColor: pwTouched && !passwordStrong ? 'red' : (passwordStrong && password ? 'green' : '') }}
                />
                <div style={{ fontSize:'0.85em', marginTop: '4px' }}>
                  <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
                    <span style={{ color: passwordChecks.length ? '#16a34a' : '#dc2626' }}>• min. 8 znaków</span>
                    <span style={{ color: passwordChecks.upper ? '#16a34a' : '#dc2626' }}>• co najmniej jedna duża litera</span>
                    <span style={{ color: passwordChecks.lower ? '#16a34a' : '#dc2626' }}>• co najmniej jedna mała litera</span>
                    <span style={{ color: passwordChecks.digit ? '#16a34a' : '#dc2626' }}>• co najmniej jedna cyfra</span>
                    <span style={{ color: passwordChecks.special ? '#16a34a' : '#dc2626' }}>• co najmniej jeden znak specjalny (!@#$…)</span>
                  </div>
                </div>
                {fieldErrors.password && <span className="error">{fieldErrors.password}</span>}
            </label>
            
            <label>Wzrost (cm)
                <input value={heightCm} type="number" onChange={e => setHeightCm(e.target.value)} required />
                {fieldErrors.height_cm && <span className="error">{fieldErrors.height_cm}</span>}
            </label>
            
            <label>Waga (kg)
                <input value={weightKg} type="number" step="0.1" onChange={e => setWeightKg(e.target.value)} required />
                {fieldErrors.weight_kg && <span className="error">{fieldErrors.weight_kg}</span>}
            </label>

            {error && <p style={{color:'red'}}>{error}</p>}
            <button type="submit" className="btn-primary">Zarejestruj</button>
        </form>
      </div>
    </div>
  );
}

export default Register;