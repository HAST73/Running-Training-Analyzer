import React, { useState } from 'react';
import { getCSRFToken } from '../../utils/csrf';

const REACTION_EMOJI = {
  love: '❤️',
  fire: '🔥',
  party: '🎉',
};

export default function PostCard({
  post,
  currentUser,
  onLike,
  onReaction,
  onDelete,
  onShowComments,
}) {
  const [pending, setPending] = useState(false);
  const [reactionPending, setReactionPending] = useState(null);

  const isOwner = currentUser && currentUser === post.user;
  const cardClass = `post-card ${isOwner ? 'own-post' : ''}`;

  const toggleReaction = async (rtype) => {
    if (reactionPending) return;
    setReactionPending(rtype);
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/social/posts/${post.id}/reactions/`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken(),
          },
          body: JSON.stringify({ type: rtype }),
        },
      );
      const data = await res.json();
      if (data.reaction_counts) {
        onReaction(post.id, data.reaction_counts, data.user_reactions || []);
      }
    } catch (e) {
      /* ignore */
    }
    setReactionPending(null);
  };

  const deletePost = async () => {
    if (!isOwner || pending) return;
    setPending(true);
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/social/posts/${post.id}/delete/`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'X-CSRFToken': getCSRFToken() },
        },
      );
      const data = await res.json();
      if (data.deleted) onDelete(post.id);
    } catch (e) {
      /* ignore */
    }
    setPending(false);
  };

  return (
    <div className={cardClass}>
      <div className="post-head">
        <div className="post-head-left">
          <strong className="post-author">{post.user}</strong>
          {isOwner && (
            <span className="post-badge">
              <span className="post-badge-dot" />
                - Twój post
            </span>
          )}
        </div>
        <span className="post-date">
          {new Date(post.created_at).toLocaleString()}
        </span>
      </div>

      {post.workout_id && (
        <div className="post-workout-ref">
          {post.workout_title
            ? <>Powiązany trening: {post.workout_title}</>
            : <>Powiązany trening #{post.workout_id}</>}
        </div>
      )}

      {post.text && <div className="post-text">{post.text}</div>}

      {post.image_url && (
        <div className="post-image-wrapper">
          <img src={post.image_url} alt="post" className="post-image" />
        </div>
      )}

      <div className="post-actions">
        {Object.keys(REACTION_EMOJI).map((r) => (
          <button
            key={r}
            onClick={() => toggleReaction(r)}
            disabled={reactionPending === r}
            className={
              post.user_reactions && post.user_reactions.includes(r)
                ? 'reacted'
                : ''
            }
          >
            {REACTION_EMOJI[r]} {post.reaction_counts ? post.reaction_counts[r] : 0}
          </button>
        ))}
        <button onClick={() => onShowComments(post.id)}>
          Komentarze ({post.comments_count})
        </button>
        {isOwner && (
          <button
            onClick={deletePost}
            disabled={pending}
            className="delete-btn"
          >
            Usuń
          </button>
        )}
      </div>
    </div>
  );
}
