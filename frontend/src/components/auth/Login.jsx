import React, { useState } from 'react';

function Login({ afterAuth }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('http://127.0.0.1:8000/api/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        let serverMsg = data.error || '';
        serverMsg = (serverMsg || '').toString();
        // Translate common English backend messages to Polish for UX clarity
        let friendly = 'Błąd logowania';
        const lower = serverMsg.toLowerCase();
        if (lower.includes('invalid credentials') || lower.includes('invalid')) {
          friendly = 'Nieprawidłowa nazwa użytkownika lub hasło';
        } else if (lower.includes('post required') || lower.includes('post required')) {
          friendly = 'Żądanie powinno być wysłane metodą POST';
        } else if (lower.includes('missing') || lower.includes('required')) {
          friendly = 'Brakuje wymaganych danych logowania';
        } else if (serverMsg) {
          // fallback: show server message but in Polish context
          friendly = serverMsg;
        }
        setError(friendly);
        return;
      }
      afterAuth && afterAuth();
    } catch (e) {
      setError('Błąd połączenia z serwerem');
    }
  };

  const loginWithStrava = () => {
    window.location.href = 'http://127.0.0.1:8000/oauth/strava/login/';
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h2>Logowanie</h2>
        <form onSubmit={onSubmit} className="auth-form">
          <label>
            Nazwa użytkownika
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              type="text"
              name="username"
              required
            />
          </label>
          <label>
            Hasło
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              name="password"
              required
            />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="btn-primary">
            Zaloguj się
          </button>
        </form>
        <button onClick={loginWithStrava} className="btn-strava">
          Zaloguj przez Strava
        </button>
        <a href="#register" className="btn-link">
          Zarejestruj się
        </a>
      </div>
    </div>
  );
}

export default Login;
