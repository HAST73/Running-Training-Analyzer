import React, { useEffect, useState } from 'react';
import PostCard from './PostCard';
import CommentsPanel from './CommentsPanel';

function Social() {
  const [scope, setScope] = useState('global');
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [workouts, setWorkouts] = useState([]);
  const [workoutId, setWorkoutId] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [commentsFor, setCommentsFor] = useState(null);
  const [userQuery, setUserQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [friendRequests, setFriendRequests] = useState({ incoming: [], outgoing: [] });
  const [frLoading, setFrLoading] = useState(false);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/social/posts/?scope=${scope}`,
        { credentials: 'include' }
      );
      const data = await res.json();
      setPosts(Array.isArray(data.posts) ? data.posts : []);
    } catch (e) { /* ignore */ }
    setLoading(false);
  };

  const fetchWorkouts = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/workouts/', { credentials: 'include' });
      const data = await res.json();
      setWorkouts(Array.isArray(data.workouts) ? data.workouts : []);
    } catch (e) { /* ignore */ }
  };

  const fetchFriendRequests = async () => {
    setFrLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/social/friend_requests/', { credentials: 'include' });
      const data = await res.json();
      setFriendRequests({
        incoming: Array.isArray(data.incoming) ? data.incoming : [],
        outgoing: Array.isArray(data.outgoing) ? data.outgoing : []
      });
    } catch (e) { /* ignore */ }
    setFrLoading(false);
  };

  useEffect(() => { fetchPosts(); }, [scope]);
  useEffect(() => { fetchWorkouts(); fetchFriendRequests(); }, []);

  const submitPost = async (e) => {
    e.preventDefault();
    const hasText = text.trim().length > 0;
    const hasWorkout = workoutId !== '';
    const hasImage = !!imageFile;
    if (!hasText && !hasWorkout && !hasImage) return;

    try {
      const form = new FormData();
      if (hasText) form.append('text', text);
      if (hasWorkout) form.append('workout_id', workoutId);
      if (hasImage) form.append('image', imageFile);

      const res = await fetch('http://127.0.0.1:8000/api/social/posts/', {
        method: 'POST',
        credentials: 'include',
        body: form
      });
      const data = await res.json();
      if (data.post) {
        setPosts((prev) => [data.post, ...prev]);
        setText('');
        setWorkoutId('');
        setImageFile(null);
      }
    } catch (e) { /* ignore */ }
  };

  const onLike = (id, liked, likesCount) => {
    setPosts((prev) =>
      prev.map(p => p.id === id ? { ...p, liked, likes_count: likesCount } : p)
    );
  };

  const searchUsers = async () => {
    const q = userQuery.trim();
    if (!q) { setSearchResults([]); return; }
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/social/search_users/?q=${encodeURIComponent(q)}`,
        { credentials: 'include' }
      );
      const data = await res.json();
      setSearchResults(Array.isArray(data.results) ? data.results : []);
    } catch (e) { /* ignore */ }
  };

  const sendFriendRequest = async (username) => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/social/friend_requests/', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      await res.json();
      fetchFriendRequests();
    } catch (e) { /* ignore */ }
  };

  const respondFriendRequest = async (id, action) => {
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/social/friend_requests/${id}/respond/`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action })
        }
      );
      await res.json();
      fetchFriendRequests();
      if (scope === 'friends') fetchPosts();
    } catch (e) { /* ignore */ }
  };

  return (
    <section className="social-page">
      <div className="social-header">
        <h2>Społeczność</h2>
        <p>Udostępniaj treningi, obserwuj znajomych i motywuj się nawzajem.</p>
      </div>

      {/* Taby: Globalne / Znajomi */}
      <div className="social-tabs">
        <button
          className={`social-tab ${scope === 'global' ? 'active' : ''}`}
          onClick={() => setScope('global')}
        >
          Globalne
        </button>
        <button
          className={`social-tab ${scope === 'friends' ? 'active' : ''}`}
          onClick={() => setScope('friends')}
        >
          Znajomi
        </button>
      </div>

      <div className="social-layout">
        {/* LEWA KOLUMNA – posty */}
        <div className="social-left">
          {/* Tworzenie posta */}
          <div className="card social-create-card">
            <h3>Dodaj post</h3>
            <form onSubmit={submitPost} className="post-form">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Napisz coś o swoim treningu, progresie albo motywacji..."
              />
              <div className="post-form-row">
                <select
                  value={workoutId}
                  onChange={e => setWorkoutId(e.target.value)}
                >
                  <option value="">Powiąż trening (opcjonalnie)</option>
                  {workouts.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.title || `Trening #${w.id}`}
                    </option>
                  ))}
                </select>
                <label className="file-input-label">
                  <span>Dodaj zdjęcie</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => setImageFile(e.target.files[0])}
                  />
                </label>
              </div>
              <div className="post-form-actions">
                <button type="submit" className="btn-primary">
                  Dodaj post
                </button>
              </div>
            </form>
          </div>

          {/* Feed */}
          <div className="card social-feed-card">
            <h3>{scope === 'global' ? 'Globalny feed' : 'Posty znajomych'}</h3>
            {loading && <div className="feed-info">Ładowanie postów…</div>}
            {!loading && posts.length === 0 && (
              <div className="feed-info">
                Brak postów. Dodaj coś jako pierwszy 🙂
              </div>
            )}
            {!loading && posts.map(p => (
              <PostCard
                key={p.id}
                post={p}
                onLike={onLike}
                onShowComments={setCommentsFor}
              />
            ))}
          </div>
        </div>

        {/* PRAWA KOLUMNA – znajomi / zaproszenia */}
        <aside className="social-right">
          <div className="card social-search-card">
            <h3>Znajdź użytkownika</h3>
            <div className="search-row">
              <input
                value={userQuery}
                onChange={e => setUserQuery(e.target.value)}
                placeholder="Nazwa użytkownika"
              />
              <button onClick={searchUsers} className="btn-secondary">
                Szukaj
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map(u => (
                  <div key={u.id} className="search-user">
                    <span>{u.username}</span>
                    <button
                      className="btn-mini"
                      onClick={() => sendFriendRequest(u.username)}
                    >
                      Zaproś
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card social-requests-card">
            <h3>Oczekujące zaproszenia</h3>
            {frLoading && <div>Ładowanie…</div>}
            {!frLoading &&
              friendRequests.incoming.length === 0 &&
              friendRequests.outgoing.length === 0 && (
                <div className="muted">Brak zaproszeń</div>
              )}

            {friendRequests.incoming.length > 0 && (
              <>
                <h4>Do Ciebie</h4>
                {friendRequests.incoming.map(fr => (
                  <div key={fr.id} className="fr-item">
                    <span className="fr-name">{fr.from}</span>
                    <div className="fr-actions">
                      <button
                        className="btn-mini btn-primary"
                        onClick={() => respondFriendRequest(fr.id, 'accept')}
                      >
                        Akceptuj
                      </button>
                      <button
                        className="btn-mini btn-ghost"
                        onClick={() => respondFriendRequest(fr.id, 'reject')}
                      >
                        Odrzuć
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {friendRequests.outgoing.length > 0 && (
              <>
                <h4>Wysłane</h4>
                {friendRequests.outgoing.map(fr => (
                  <div key={fr.id} className="fr-item outgoing">
                    <span className="fr-name">Do: {fr.to}</span>
                    <span className="fr-status">Wysłane</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </aside>
      </div>

      {commentsFor && (
        <CommentsPanel
          postId={commentsFor}
          onClose={() => setCommentsFor(null)}
        />
      )}
    </section>
  );
}

export default Social;
