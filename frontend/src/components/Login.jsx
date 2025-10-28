import React from 'react';

function Login() {
  return (
    <form>
      <h2>Logowanie</h2>
      <label>Nazwa użytkownika:
        <input type="text" name="username" required />
      </label>
      <label>Hasło:
        <input type="password" name="password" required />
      </label>
      <button type="submit">Zaloguj się</button>
    </form>
  );
}

export default Login;
