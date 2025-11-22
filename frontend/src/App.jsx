import React, { useEffect, useState } from 'react';
import Home from './components/home/Home';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Workouts from './components/workouts/Workouts';
import WorkoutAnalysis from './components/workouts/WorkoutAnalysis';
import Social from './components/social/Social';
import Events from './components/home/Events';
import TrainingPlans from './components/workouts/TrainingPlans';
import Profile from './components/profile/Profile';
import Notifications from './components/common/Notifications';

function App() {
  // Minimalny hash-router – ignorujemy część po '?' (parametry)
  const normalizeHash = () => {
    const raw = window.location.hash || '#home';
    const base = raw.split('?')[0];
    return base.toLowerCase();
  };
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

  // Potwierdzanie Stripe sesji globalnie – niezależnie od tego na której stronie wylądowaliśmy
  const confirmStripeIfPresent = async () => {
    const raw = window.location.hash || '';
    if (!raw.includes('success=1') || !raw.includes('session_id=')) return;
    const paramsPart = raw.split('?')[1] || '';
    const sp = new URLSearchParams(paramsPart);
    const sessionId = sp.get('session_id');
    if (!sessionId) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/payments/confirm/?session_id=${encodeURIComponent(sessionId)}`, { credentials: 'include' });
      const data = await res.json();
      if (data.status === 'paid') {
        await fetchSession();
        // Przekierowanie na stronę planów po udanym potwierdzeniu
        window.location.hash = '#plans';
      }
    } catch (e) {
      // Ignorujemy błąd – użytkownik może spróbować ponownie ręcznie
    }
  };

  useEffect(() => {
    const onHashChange = () => {
      setRoute(normalizeHash());
      confirmStripeIfPresent();
    };
    if (!window.location.hash) {
      window.location.hash = '#home';
    }
    window.addEventListener('hashchange', onHashChange);
    fetchSession().then(() => confirmStripeIfPresent());
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Po Strava OAuth wymuś jednorazowe ustawienie nazwy użytkownika
  // Usunięto wymuszanie zmiany nazwy – użytkownik może edytować ją opcjonalnie na profilu

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
        {authed && (
          <div className="app-header-actions">
            <Notifications />
          </div>
        )}
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
              {session.pro_unlocked ? (
                <a href="#plans" className={isActive('#plans') ? 'active' : ''}>Plany treningowe</a>
              ) : (
                <a href="#plans" className={isActive('#plans') ? 'active locked' : 'locked'} title="Dostęp PRO – odblokuj płatnością">🔒 Plany treningowe</a>
              )}
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
        {authed && route === '#plans' && <TrainingPlans session={session} refreshSession={fetchSession} />}
        {authed && route === '#profile' && <Profile session={session} onUpdated={fetchSession} />}
        {authed && route.startsWith('#analysis') && <WorkoutAnalysis />}
        {authed && (route === '#home' || route === '') && <Home />}
      </div>
      {/* Measurements modal removed: anthropometrics only editable on Profile page */}
    </div>
  );
}

export default App;
