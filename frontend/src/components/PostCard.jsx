import React, { useState } from 'react';

export default function PostCard({ post, onLike, onShowComments }) {
  const [pending, setPending] = useState(false);

  const handleLike = async () => {
    if (pending) return;
    setPending(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/social/posts/${post.id}/likes/`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      if (data && typeof data.liked === 'boolean') {
        onLike(post.id, data.liked, data.likes_count);
      }
    } catch (e) { /* ignore */ }
    setPending(false);
  };

  return (
    <div className="post-card">
      <div className="post-head">
        <strong>{post.user}</strong>
        <span className="post-date">{new Date(post.created_at).toLocaleString()}</span>
      </div>
      {post.workout_id && (
        <div className="post-workout-ref">Powiązany trening #{post.workout_id}</div>
      )}
      {post.text && <div className="post-text">{post.text}</div>}
      {post.image_url && (
        <div className="post-image-wrapper">
          <img src={post.image_url} alt="post" className="post-image" />
        </div>
      )}
      <div className="post-actions">
        <button onClick={handleLike} disabled={pending} className={post.liked ? 'liked' : ''}>
          {post.liked ? '♥' : '♡'} {post.likes_count}
        </button>
        <button onClick={() => onShowComments(post.id)}>Komentarze ({post.comments_count})</button>
      </div>
    </div>
  );
}