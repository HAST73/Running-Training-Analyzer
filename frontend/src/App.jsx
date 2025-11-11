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
  const [session, setSession] = useState({ loading: true, authenticated: false });

  const fetchSession = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/session/', { credentials: 'include' });
      const data = await res.json();
      setSession({ loading: false, ...data });
    } catch (e) {
      setSession({ loading: false, authenticated: false });
    }
  };

  useEffect(() => {
    const onHashChange = () => setRoute(normalizeHash());
    // Ustaw domyślny hash przy pierwszym uruchomieniu
    if (!window.location.hash) {
      window.location.hash = '#home';
    }
    window.addEventListener('hashchange', onHashChange);
    fetchSession();
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleLogout = async () => {
    await fetch('http://127.0.0.1:8000/api/logout/', { method: 'POST', credentials: 'include' });
    setSession({ loading: false, authenticated: false });
    window.location.hash = '#login';
  };

  const afterAuth = () => {
    fetchSession();
    window.location.hash = '#home';
  };

  const authed = session.authenticated;

  return (
    <div>
      <h1>Running Training Analyzer</h1>
      <nav>
        <a href="#home">Strona główna</a> |{' '}
        {!authed && <><a href="#login">Logowanie</a> |{' '}<a href="#register">Rejestracja</a> |{' '}</>}
        {authed && <><a href="#workouts">Treningi</a> |{' '}<a href="#social">Społeczność</a> |{' '}<a href="#events">Wydarzenia</a> |{' '}<button onClick={handleLogout}>Wyloguj</button></>}
      </nav>
      {/* Prosty routing */}
      <div style={{marginTop: '2em'}}>
        {!authed && (route === '#register') && <Register afterAuth={afterAuth} />}
        {!authed && (route === '#login' || route === '#home') && <Login afterAuth={afterAuth} />}
        {authed && route === '#workouts' && <Workouts />}
        {authed && route === '#social' && <Social />}
        {authed && route === '#events' && <Events />}
        {authed && (route === '#home' || route === '') && <Home />}
      </div>
    </div>
  );
}

export default App;
