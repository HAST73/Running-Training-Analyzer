import React, { useEffect, useState } from 'react';
import Home from './components/Home';
import Login from './components/Login';
import Register from './components/Register';
import Workouts from './components/Workouts';
import WorkoutAnalysis from './components/WorkoutAnalysis';
import Social from './components/Social';
import Events from './components/Events';
import Profile from './components/Profile';

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
    // Po powrocie z OAuth Strava dopiszemy znacznik w hash (?from=strava)
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

  const isActive = (hash) => route === hash;

  return (
    <div>
      <h1 className="app-logo">
        <img src="/materials/logo.png" alt="Running Training Analyzer" />
      </h1>
      <nav>
        <div className="nav-left">
          <a href="#home" className={isActive('#home') ? 'active' : ''}>Strona główna</a>
          {!authed && (
            <>
              <a href="#login" className={isActive('#login') ? 'active' : ''}>Logowanie</a>
              <a href="#register" className={isActive('#register') ? 'active' : ''}>Rejestracja</a>
            </>
          )}
          {authed && (
            <>
              <a href="#workouts" className={isActive('#workouts') ? 'active' : ''}>Treningi</a>
              <a href="#social" className={isActive('#social') ? 'active' : ''}>Społeczność</a>
              <a href="#events" className={isActive('#events') ? 'active' : ''}>Wydarzenia</a>
            </>
          )}
        </div>

        {authed && (
          <div className="nav-right">
            <a href="#profile" className={isActive('#profile') ? 'active' : ''}>Profil</a>
            <button onClick={handleLogout}>Wyloguj</button>
          </div>
        )}
      </nav>
      {/* Prosty routing */}
      <div style={{marginTop: '2em'}}>
        {!authed && (route === '#register') && <Register afterAuth={afterAuth} />}
        {!authed && (route === '#login' || route === '#home') && <Login afterAuth={afterAuth} />}
        {authed && route === '#workouts' && <Workouts />}
        {authed && route === '#social' && <Social />}
        {authed && route === '#events' && <Events />}
        {authed && route === '#profile' && <Profile session={session} onUpdated={fetchSession} />}
        {authed && route.startsWith('#analysis') && <WorkoutAnalysis />}
        {authed && (route === '#home' || route === '') && <Home />}
      </div>
      {/* Measurements modal removed: anthropometrics only editable on Profile page */}
    </div>
  );
}

export default App;
