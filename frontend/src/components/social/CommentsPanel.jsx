import React, { useEffect, useState } from 'react';
import { getCSRFToken } from '../../utils/csrf';

export default function CommentsPanel({ postId, onClose, onCommentAdded }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/social/posts/${postId}/comments/`, { credentials: 'include' });
      const data = await res.json();
      setComments(Array.isArray(data.comments) ? data.comments : []);
    } catch (e) { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchComments(); }, [postId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/social/posts/${postId}/comments/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCSRFToken() },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      if (data.comment) {
        setComments((prev) => [...prev, data.comment]);
        setText('');
        if (onCommentAdded) onCommentAdded(postId);
      }
    } catch (e) { /* ignore */ }
  };

  return (
    <div className="comments-panel">
      <div className="comments-head">
        <strong>Komentarze</strong>
        <button onClick={onClose}>✕</button>
      </div>
      {loading && <div className="comments-loading">Ładowanie…</div>}
      {!loading && comments.length === 0 && <div className="comments-empty">Brak komentarzy</div>}
      <div className="comments-list">
        {comments.map(c => (
          <div key={c.id} className="comment-item">
            <strong>{c.user}</strong>: {c.text}
            <span className="comment-date">{new Date(c.created_at).toLocaleString()}</span>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="comment-form">
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Dodaj komentarz" />
        <button type="submit">Wyślij</button>
      </form>
    </div>
  );
}
