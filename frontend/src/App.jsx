import React, { useEffect, useState } from 'react';
import Home from './components/Home';
import Login from './components/Login';
import Register from './components/Register';
import Workouts from './components/Workouts';
import Social from './components/Social';
import Events from './components/Events';

function App() {
  // Minimalny, prosty hash-router, żeby komponent się prze-renderował po zmianie #hash
  const normalizeHash = () => (window.location.hash || '#home').toLowerCase();
  const [route, setRoute] = useState(normalizeHash());

  useEffect(() => {
    const onHashChange = () => setRoute(normalizeHash());
    // Ustaw domyślny hash przy pierwszym uruchomieniu
    if (!window.location.hash) {
      window.location.hash = '#home';
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <div>
      <h1>Running Training Analyzer</h1>
      {/* Prosta nawigacja */}
      <nav>
        <a href="#home">Strona główna</a> |{' '}
        <a href="#login">Logowanie</a> |{' '}
        <a href="#register">Rejestracja</a> |{' '}
        <a href="#workouts">Treningi</a> |{' '}
        <a href="#social">Społeczność</a> |{' '}
        <a href="#events">Wydarzenia</a>
      </nav>
      {/* Prosty routing */}
      <div style={{marginTop: '2em'}}>
        {route === '#login' && <Login />}
        {route === '#register' && <Register />}
        {route === '#workouts' && <Workouts />}
        {route === '#social' && <Social />}
        {route === '#events' && <Events />}
        {(route === '' || route === '#home') && <Home />}
      </div>
    </div>
  );
}

export default App;
