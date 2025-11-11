import React, { useState } from 'react';

function Register({ afterAuth }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch('http://127.0.0.1:8000/api/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Błąd rejestracji');
        return;
      }
      // Po rejestracji automatycznie zaloguj
      const loginRes = await fetch('http://127.0.0.1:8000/api/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });
      if (loginRes.ok) {
        afterAuth && afterAuth();
      } else {
        setError('Konto utworzone, ale automatyczne logowanie się nie powiodło. Spróbuj zalogować ręcznie.');
      }
    } catch (e) {
      setError('Błąd połączenia z serwerem');
    }
  };

  return (
    <div>
      <h2>Rejestracja</h2>
      <form onSubmit={onSubmit}>
        <label>Nazwa użytkownika:
          <input value={username} onChange={(e) => setUsername(e.target.value)} type="text" name="username" required />
        </label>
        <label>Email:
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" name="email" required />
        </label>
        <label>Hasło:
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" name="password" required />
        </label>
        <button type="submit">Zarejestruj się</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <p>Masz już konto? <a href="#login">Zaloguj się</a></p>
    </div>
  );
}

export default Register;
