import React from 'react';

function Register() {
  return (
    <form>
      <h2>Rejestracja</h2>
      <label>Nazwa użytkownika:
        <input type="text" name="username" required />
      </label>
      <label>Email:
        <input type="email" name="email" required />
      </label>
      <label>Hasło:
        <input type="password" name="password" required />
      </label>
      <button type="submit">Zarejestruj się</button>
    </form>
  );
}

export default Register;
