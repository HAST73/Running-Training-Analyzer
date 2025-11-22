import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import './styles/common.css';
import './styles/auth.css';
import './styles/profile.css';
import './styles/home.css';
import './styles/workouts.css';
import './styles/social.css';
import './styles/plans.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
