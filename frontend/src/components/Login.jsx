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
        const data = await res.json();
        setError(data.error || 'Błąd logowania');
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
    <div>
      <h2>Logowanie</h2>
      <form onSubmit={onSubmit}>
        <label>Nazwa użytkownika:
          <input value={username} onChange={(e) => setUsername(e.target.value)} type="text" name="username" required />
        </label>
        <label>Hasło:
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" name="password" required />
        </label>
        <button type="submit">Zaloguj się</button>
      </form>
      <div style={{ marginTop: '1em' }}>
        <button onClick={loginWithStrava}>Zaloguj przez Strava</button>
      </div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <p>Nie masz konta? <a href="#register">Zarejestruj się</a></p>
    </div>
  );
}

export default Login;
