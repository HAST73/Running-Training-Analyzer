import React from 'react';

function Notifications({ notifications }) {
  if (!notifications?.length) return null;
  return (
    <div className="notifications-panel">
      <h3>Powiadomienia</h3>
      <ul>
        {notifications.map((n, idx) => (
          <li key={idx} className={`notif-item notif-${n.type || 'info'}`}>
            {n.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Notifications;