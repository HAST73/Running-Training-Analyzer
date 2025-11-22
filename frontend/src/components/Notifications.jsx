import React, { useEffect, useState, useRef } from 'react';

function formatItem(item) {
  const a = item.action;
  const m = item.metadata || {};
  const ts = new Date(item.created_at);
  const time = ts.toLocaleString();
  switch (a) {
    case 'profile_update':
      return `Zaktualizowano profil (${Object.keys(m).join(', ') || 'zmiany'}) — ${time}`;
    case 'strava_link':
      return `Połączono konto Strava — ${time}`;
    case 'workout_uploaded_adidas': {
      const dist = m.distance_m ? `${(m.distance_m/1000).toFixed(1)} km` : 'trening';
      return `Dodano nowy trening (Adidas) ${dist} — ${time}`;
    }
    case 'workout_uploaded_trackpoints': {
      const dist = m.distance_m ? `${(m.distance_m/1000).toFixed(1)} km` : 'trening';
      return `Dodano nowy trening (punkty GPS) ${dist} — ${time}`;
    }
    case 'workout_uploaded_fit': {
      const dist = m.distance_m ? `${(m.distance_m/1000).toFixed(1)} km` : 'trening';
      return `Dodano nowy trening (FIT) ${dist} — ${time}`;
    }
    case 'workout_gpx_attached': {
      const name = m.gpx_name ? `(${m.gpx_name})` : '';
      return `Dołączono / zaktualizowano plik GPX ${name} — ${time}`;
    }
    case 'workout_imported_strava': {
      const dist = m.distance_m ? `${(m.distance_m/1000).toFixed(1)} km` : 'trening';
      return `Zaimportowano nowy trening ze Stravy ${dist} — ${time}`;
    }
    case 'workout_deleted':
      return `Usunięto trening "${m.title || ''}" — ${time}`;
    case 'login':
      return `Zalogowano — ${time}`;
    case 'logout':
      return `Wylogowano — ${time}`;
    case 'register':
      return `Rejestracja zakończona — ${time}`;
    default:
      return `${a} — ${time}`;
  }
}

export default function Notifications() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const dropdownRef = useRef(null);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/activity/recent/?limit=20', { credentials: 'include' });
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  // Fetch fresh items immediately whenever dropdown is opened
  useEffect(() => {
    if (open) {
      fetchItems();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(fetchItems, 60000);
    return () => clearInterval(id);
  }, [open]);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const count = items.length;
  const badgeText = count > 9 ? '9+' : String(count || '');

  const clearOne = async (id) => {
    try {
      await fetch(`http://127.0.0.1:8000/api/activity/${id}/`, { method: 'DELETE', credentials: 'include' });
      setItems((prev) => prev.filter((it) => it.id !== id));
    } catch (e) {}
  };

  const clearAll = async () => {
    try {
      await fetch('http://127.0.0.1:8000/api/activity/clear_all/', { method: 'POST', credentials: 'include' });
      setItems([]);
    } catch (e) {}
  };

  return (
    <div className="notif-wrapper" ref={dropdownRef} style={{ position: 'relative' }}>
      <button className="notif-bell" onClick={() => setOpen(!open)} title="Powiadomienia" aria-label="Powiadomienia">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 22c1.104 0 2-.896 2-2h-4c0 1.104.896 2 2 2zm6-6V11c0-3.309-2.133-6.127-5-6.873V3a1 1 0 10-2 0v1.127C8.133 4.873 6 7.691 6 11v5l-2 2v1h16v-1l-2-2z" fill="currentColor"/>
        </svg>
        {count > 0 && (
          <span className="notif-badge">{badgeText}</span>
        )}
      </button>
      {open && (
        <div className="notif-dropdown">
          <div className="notif-head">
            <span>Powiadomienia</span>
            <div className="notif-actions">
              <button className="notif-action" onClick={fetchItems} title="Odśwież" aria-label="Odśwież">⟳</button>
              <button className="notif-action" onClick={clearAll} title="Wyczyść wszystkie" aria-label="Wyczyść wszystkie">🗑️</button>
            </div>
          </div>
          <div className="notif-list">
            {loading && <div className="notif-empty">Ładowanie…</div>}
            {!loading && items.length === 0 && (
              <div className="notif-empty">Brak nowych aktywności</div>
            )}
            {!loading && items.map((it) => (
              <div key={it.id} className="notif-item">
                <div className="notif-item-text">{formatItem(it)}</div>
                <button className="notif-item-clear" onClick={() => clearOne(it.id)} title="Usuń" aria-label="Usuń">✕</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
