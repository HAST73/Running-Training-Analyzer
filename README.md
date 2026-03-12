# Project overview (EN)

## What this app is

Running Training Analyzer is a web application for importing, storing, and analyzing running workouts. It provides a Django backend API and a React single-page frontend. Optional integrations include Strava OAuth (connect/sync account) and Stripe (payments/plans).

## Main page (screenshot)

![Main page](https://raw.githubusercontent.com/HAST73/Running-Training-Analyzer/main/mainpage.png)

## High-level architecture

- **Frontend (React)**: user interface, calls backend endpoints via HTTP.
- **Backend (Django)**: API endpoints, auth/session handling, data processing, and persistence.
- **Database**:
	- PostgreSQL is the primary (recommended) database.
	- SQLite is supported for quick local development.

## Repository structure (detailed)

- `backend/`
	- `manage.py` – Django entry point
	- `requirements.txt` – Python dependencies
	- `pytest.ini` – pytest configuration
	- `running_analyzer/` – project config (settings/urls/wsgi/asgi)
	- `users/` – registration/login + user profile + Strava OAuth endpoints
	- `workouts/` – workouts storage and import endpoints
	- `workout_analysis/` – analysis utilities/endpoints
	- `events/` + `events_scraper.py` – events feature and scraping logic
	- `payments/` – Stripe checkout/payment flow
	- `social/` – social feed models/endpoints
	- `sample_workouts/` – example workout files used for local testing

- `frontend/`
	- `package.json` – JS dependencies and scripts
	- `public/` – CRA public assets
	- `src/`
		- `App.jsx` – main app component
		- `components/` – UI components
		- `styles/` – styling
		- `utils/` – helper functions

## Core user flows

- **Auth**: register/login, sessions/cookies.
- **Workouts**: upload/import workout data → store → display → analyze.
- **Workout analysis**: compute summary stats and derived metrics based on stored data.
- **Events**: show upcoming running events (data sourced from a public listing via a scraper; if you publish this repository, ensure you comply with the source’s ToS and provide attribution if required).
- **Strava (optional)**: connect account via OAuth and use credentials provided via environment variables.
- **Payments (optional)**: create a Stripe Checkout session and confirm payments.

## Technologies

- Backend: Python, Django
- Frontend: React, JavaScript (Create React App)
- Database: SQLite / PostgreSQL
- Maps/UI (frontend): Leaflet / react-leaflet (if enabled by the UI)
- Testing:
	- Backend: pytest
	- Frontend: Cypress (E2E)

### Concrete versions (as defined in this repository)

Backend (`backend/requirements.txt`):

- Django 5.2.7
- psycopg[binary] 3.2.12
- django-cors-headers 4.x
- requests 2.x
- fitparse 1.x
- stripe 10.x
- Pillow 10.x

Frontend (`frontend/package.json`):

- React 18.2
- react-scripts 5.0.1
- Leaflet 1.9.4
- react-leaflet 4.2.1
- Cypress 15.x (dev dependency)

## Requirements

- Python 3.x
- Node.js + npm
- (Optional) PostgreSQL for Postgres-based setup

Recommended for a smooth local dev experience:

- PostgreSQL installed and running locally if you set `USE_POSTGRES=1`
- Otherwise use SQLite (default)

## Quick start (local)

Backend:

```powershell
cd backend
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000
```

Frontend:

```powershell
cd frontend
npm install
npm start
```

Ports (defaults):

- Frontend: http://127.0.0.1:3000/
- Backend: http://127.0.0.1:8000/

