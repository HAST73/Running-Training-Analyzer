import React, { useState, useEffect } from 'react';

function Register({ afterAuth }) {
  // Pola formularza
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  
  // Obsługa błędów
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  
  // Statusy dostępności (unikalności)
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  const [emailAvailable, setEmailAvailable] = useState(null);
  const [checkingEmail, setCheckingEmail] = useState(false);

  // --- 1. Sprawdzanie dostępności NAZWY UŻYTKOWNIKA (Debounce) ---
  useEffect(() => {
    const timer = setTimeout(() => {
      checkUsernameAvailability(username);
    }, 500);
    return () => clearTimeout(timer);
  }, [username]);

  async function checkUsernameAvailability(name) {
    if (!name || name.trim().length < 3) {
      setUsernameAvailable(null);
      return;
    }
    setCheckingUsername(true);
    setFieldErrors(prev => { const newErrors = {...prev}; delete newErrors.username; return newErrors; });

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/check_username/?username=${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.available === 'boolean') {
          setUsernameAvailable(data.available);
          if (!data.available) {
             setFieldErrors(prev => ({ ...prev, username: 'Nazwa użytkownika jest już zajęta' }));
          }
        } else {
          setUsernameAvailable(null);
        }
      } else {
        setUsernameAvailable(null);
      }
    } catch (e) {
      setUsernameAvailable(null);
    }
    setCheckingUsername(false);
  }

  // --- 2. Sprawdzanie dostępności EMAILA (Debounce) ---
  useEffect(() => {
    const timer = setTimeout(() => {
      checkEmailAvailability(email);
    }, 500);
    return () => clearTimeout(timer);
  }, [email]);

  async function checkEmailAvailability(mail) {
    if (!mail || !/\S+@\S+\.\S+/.test(mail)) {
      setEmailAvailable(null);
      return;
    }
    setCheckingEmail(true);
    setFieldErrors(prev => { const newErrors = {...prev}; delete newErrors.email; return newErrors; });

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/check_email/?email=${encodeURIComponent(mail)}`);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.available === 'boolean') {
          setEmailAvailable(data.available);
          if (!data.available) {
             setFieldErrors(prev => ({ ...prev, email: 'Ten adres email jest już zajęty' }));
          }
        } else {
          setEmailAvailable(null);
        }
      } else {
        setEmailAvailable(null);
      }
    } catch (e) {
      setEmailAvailable(null);
    }
    setCheckingEmail(false);
  }

  // --- 3. Walidacje lokalne ---
  const validateEmailFormat = (email) => /\S+@\S+\.\S+/.test(email);
  
  const validatePassword = (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    return password.length >= minLength && hasUpperCase && hasSpecialChar;
  };

  const blockInvalidNumberChars = (e) => {
    if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault();
  };

  // --- 4. Wysyłanie formularza ---
  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const errors = {};
    // Blokada jeśli API już powiedziało, że zajęte
    if (usernameAvailable === false) errors.username = 'Nazwa użytkownika jest zajęta.';
    if (emailAvailable === false) errors.email = 'Ten email jest już używany.';
    
    // Walidacja formatu
    if (!validateEmailFormat(email)) errors.email = 'Podaj poprawny adres email.';
    if (!validatePassword(password)) errors.password = 'Hasło: min. 8 znaków, duża litera i znak specjalny.';

    // ZMIANA: Walidacja wzrostu i wagi (pola wymagane)
    if (!heightCm || parseInt(heightCm) <= 0) errors.height_cm = 'Wzrost jest wymagany (min. 1 cm).';
    if (!weightKg || parseFloat(weightKg) <= 0) errors.weight_kg = 'Waga jest wymagana.';

    if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
    }

    try {
      // ZMIANA: wysyłamy height_cm i weight_kg bez warunków
      const payload = { 
        username, 
        email, 
        password,
        height_cm: heightCm,
        weight_kg: weightKg
      };

      const res = await fetch('http://127.0.0.1:8000/api/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        let serverError = data.error || 'Błąd rejestracji';
        if (serverError.toLowerCase().includes('username taken') || serverError.toLowerCase().includes('already exists')) {
            serverError = 'Ta nazwa użytkownika jest już zajęta.';
        } 
        else if (serverError.toLowerCase().includes('email') && serverError.toLowerCase().includes('taken')) {
            serverError = 'Ten adres email jest już powiązany z innym kontem.';
        }
        setError(serverError);
        return;
      }

      // Logowanie po udanej rejestracji
      const loginRes = await fetch('http://127.0.0.1:8000/api/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      if (loginRes.ok) afterAuth && afterAuth();
      else setError('Konto utworzone, ale automatyczne logowanie nie powiodło się.');
      
    } catch (e) {
      setError('Błąd połączenia z serwerem');
    }
  };

  // Style pomocnicze dla inputów (bez zmian)
  const inputWrapperStyle = { position: 'relative', width: '100%' };
  const inputStyle = (isAvailable) => ({
      width: '100%',
      boxSizing: 'border-box',
      paddingRight: '90px', 
      borderColor: isAvailable === false ? 'red' : (isAvailable === true ? 'green' : '')
  });
  const loadingTextStyle = {
      position: 'absolute',
      right: '10px',
      top: '50%',
      transform: 'translateY(-50%)',
      fontSize: '0.75em',
      color: '#666',
      pointerEvents: 'none'
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Rejestracja</h2>
        <form onSubmit={onSubmit} className="auth-form">
          
          {/* --- USERNAME --- */}
          <label style={{ width: '100%' }}>
            Nazwa użytkownika
            <div style={inputWrapperStyle}>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  type="text"
                  name="username"
                  required
                  style={inputStyle(usernameAvailable)}
                />
                {checkingUsername && <span style={loadingTextStyle}>Sprawdzanie...</span>}
            </div>
            {fieldErrors.username && <span className="field-error" style={{color: 'red', fontSize: '0.8em'}}>{fieldErrors.username}</span>}
          </label>

          {/* --- EMAIL --- */}
          <label style={{ width: '100%' }}>
            Email
            <div style={inputWrapperStyle}>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  name="email"
                  required
                  style={inputStyle(emailAvailable)}
                />
                {checkingEmail && <span style={loadingTextStyle}>Sprawdzanie...</span>}
            </div>
            {fieldErrors.email && <span className="field-error" style={{color: 'red', fontSize: '0.8em'}}>{fieldErrors.email}</span>}
          </label>

          {/* --- PASSWORD --- */}
          <label>
            Hasło
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              name="password"
              required
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
            <small style={{ color: '#777', fontSize: '0.75em', display: 'block', marginTop: '4px' }}>
                Min. 8 znaków, 1 duża litera, 1 znak specjalny.
            </small>
            {fieldErrors.password && <div className="field-error" style={{color: 'red', fontSize: '0.8em'}}>{fieldErrors.password}</div>}
          </label>

          {/* --- WZROST (wymagane) --- */}
          <label>
            Wzrost (cm)
            <input
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              onKeyDown={blockInvalidNumberChars}
              type="number"
              min="1"
              name="height_cm"
              required
              placeholder="np. 180"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
            {fieldErrors.height_cm && <div className="field-error" style={{color: 'red', fontSize: '0.8em'}}>{fieldErrors.height_cm}</div>}
          </label>

          {/* --- WAGA (wymagane) --- */}
          <label>
            Waga (kg)
            <input
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              onKeyDown={blockInvalidNumberChars}
              type="number"
              min="1"
              step="0.1"
              name="weight_kg"
              required
              placeholder="np. 72.5"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
             {fieldErrors.weight_kg && <div className="field-error" style={{color: 'red', fontSize: '0.8em'}}>{fieldErrors.weight_kg}</div>}
          </label>

          {/* GŁÓWNY BŁĄD FORMULARZA */}
          {error && <p className="auth-error" style={{color: 'red', textAlign: 'center'}}>{error}</p>}
          
          <button 
            type="submit" 
            className="btn-primary" 
            disabled={checkingUsername || checkingEmail || usernameAvailable === false || emailAvailable === false}
          >
            Zarejestruj się
          </button>
        </form>
        <a href="#login" className="btn-link">
          Zaloguj się
        </a>
      </div>
    </div>
  );
}

export default Register;