# API Endpoints (Backend Django)

Poniższa dokumentacja opisuje publiczne endpointy backendu: metoda, ścieżka, opis, przykładowe odpowiedzi, wymagania autoryzacji oraz miejsce użycia w frontendzie (komponenty React).

Legenda autoryzacji: [Public] bez logowania, [Auth] wymaga zalogowanego użytkownika.

---

## Auth & Session

- GET `/api/session/` [Public]
  - Opis: Zwraca status sesji i podstawowe dane zalogowanego użytkownika.
  - Response 200: `{ authenticated: true|false, username?, first_name?, last_name?, email?, height_cm?, weight_kg?, needs_measurements, pro_unlocked, needs_username, strava_linked }`
  - Użycie: `App.jsx` (inicjalizacja), `Profile.jsx`.

- POST `/api/register/` [Public]
  - Body (JSON): `{ username, email, password, height_cm, weight_kg, first_name?, last_name? }`
  - Response 200: `{ status: "ok", username }`
  - Błędy: 400 invalid data, 409 duplicates.
  - Użycie: `Register.jsx`.

- POST `/api/login/` [Public]
  - Body (JSON): `{ username, password }`
  - Response 200: `{ status: "ok", username }`; 401 invalid credentials.
  - Użycie: `Login.jsx`.

- POST `/api/logout/` [Public]
  - Opis: Zamyka sesję, jeśli istnieje.
  - Response 200: `{ status: "ok" }`
  - Użycie: przycisk wylogowania w nawigacji.

- GET `/api/check_username/?username=...` [Public]
  - Response 200: `{ available: true|false|null }`
  - Użycie: `Register.jsx`.

- GET `/api/check_email/?email=...` [Public]
  - Response 200: `{ available: true|false|null }`
  - Użycie: `Register.jsx`.

## Profil użytkownika

- GET `/api/profile/` [Auth]
  - Opis: Zwraca dane profilu zalogowanego użytkownika.
  - Response 200: `{ username, first_name, last_name, height_cm, weight_kg, strava_athlete_id, strava_access_token }`
  - Użycie: `Profile.jsx`.

- POST `/api/profile/` [Auth]
  - Body (JSON): dowolne z `{ username?, first_name?, last_name?, height_cm?, weight_kg? }`
  - Response 200: `{ status: "ok", ...fields_changed }`; 400 walidacja; 409 konflikt nazwy.
  - Użycie: `Profile.jsx`.

## Dziennik aktywności (ActivityLog)

- GET `/api/activity/recent/?limit=20` [Auth]
  - Response 200: `{ items: [ {id, action, metadata, created_at}, ... ] }`

- DELETE `/api/activity/{activity_id}/` [Auth]
  - Response 200: `{ ok: true }`

- POST lub DELETE `/api/activity/clear_all/` [Auth]
  - Response 200: `{ ok: true }`

## Integracja Strava

- GET `/api/strava/status/` [Public]
  - Response 200: `{ linked: true|false }`
  - Użycie: `Profile.jsx`.

- GET `/api/strava/connect/` [Public]
  - Response 200: `{ auth_url }` – URL do autoryzacji Strava dla przycisku w UI.
  - Użycie: `Profile.jsx`.

- POST `/api/strava/unlink/` [Auth]
  - Response 200: `{ status: "ok" }` – usuwa tokeny ze `UserProfile`.
  - Użycie: `Profile.jsx`.

- GET `/oauth/strava/login/` [Public]
  - Redirect do Strava OAuth.

- GET `/oauth/strava/callback/` [Public]
  - Opis: Callback z wymianą kodu na tokeny; zapis w profilu; logowanie użytkownika; redirect do frontendu.

## Treningi (Workouts)

- GET `/api/workouts/` [Auth]
  - Response 200: `{ workouts: [ { id, title, distance_m, duration_ms, created_at, performed_at, source, manual, gpx_file, hr_stats? }, ... ] }`
  - Użycie: `Workouts.jsx`.

- GET `/api/workouts/last/` [Auth]
  - Response 200: `{ workout: { id, title, distance_m, duration_ms, performed_at, created_at, source, manual, calories?, elevation_gain? } | null }`
  - Użycie: dashboard/kafelki.

- GET `/api/workouts/weekly_summary/?period=7d|30d|year` [Auth]
  - Response 200: `{ items: [ { label, distance_m } ], total_distance_m }`
  - Użycie: wykres podsumowania.

- POST `/api/workouts/upload/` [Auth]
  - Content-Type: `application/json` (Adidas JSON lub trackpoints) lub `multipart/form-data` z plikiem `.json` (Adidas/trackpoints) lub `.fit` (Strava).
  - Response 201: `{ id, title, source }`; 400 dla nieobsługiwanych formatów.
  - Użycie: upload w `Workouts.jsx`.

- DELETE `/api/workouts/{id}/` [Auth]
  - Response 200: `{ ok: true }`
  - Użycie: usuwanie w `Workouts.jsx`.

- POST `/api/workouts/{id}/gpx/` [Auth]
  - multipart/file `file`: GPX lub JSON z punktami; zapis inline w DB. Zwraca `{ ok: true, gpx_file: true }`.
  - GET zwraca treść GPX (Content-Disposition inline) lub 404, jeśli brak.
  - Użycie: przypięcie GPX po utworzeniu treningu.

- POST `/api/workouts/{id}/attach_hr/` [Auth]
  - Body: `application/json` lub `multipart/form-data` z plikiem JSON; rozpoznaje różne struktury; zapisuje `raw_data.hr_samples` i `hr_stats`.
  - Response 200: `{ ok: true, hr_stats, hr_alignment? }`
  - Użycie: dołączanie tętna z zewnętrznego eksportu.

- POST `/api/workouts/import_strava/` [Auth]
  - Opis: Import biegów z API Strava (wymaga połączenia konta).
  - Response 201: `{ imported: <int> }`

## Analiza treningu

- GET `/api/workouts/{id}/analysis/` [Auth]
  - Opis: Parsuje GPX, skleja HR z JSON, liczy metryki, wykresy i notatkę AI.
  - Response 200: `{ id, title, performed_at, distance_m, duration_ms, has_track, analysis, calories_kcal?, user_anthropometrics, adidas_meta, hr_stats?, hr_alignment?, ai_note }`
  - Użycie: `WorkoutAnalysis.jsx`.

## Wydarzenia (Events)

- GET `/api/events/?limit=...` [Public]
  - Response 200: `{ poland: [...], world: [...] }`
  - Użycie: `Events.jsx`.

## Społeczność (Social)

- GET `/api/social/posts/?scope=global|friends` [Auth]
  - Response 200: `{ posts: [ { id, user, user_id, workout_id, text, image_url, created_at, is_global, reaction_counts, user_reactions, comments_count } ], scope }`
  - Użycie: `Social.jsx` (feed globalny i znajomych).

- POST `/api/social/posts/` [Auth]
  - Body: `application/json` lub `multipart/form-data` z `text?`, `workout_id?`, `image?`, `is_global?`.
  - Response 201: `{ post: {...} }`; 400 gdy brak treści, treningu i obrazka jednocześnie.

- POST `/api/social/posts/{post_id}/reactions/` [Auth]
  - Body (JSON): `{ type: "love"|"fire"|"party" }` – przełącza reakcję.
  - Response 200: `{ type, active: true|false, reaction_counts, user_reactions }`.

- GET `/api/social/posts/{post_id}/comments/` [Auth]
  - Response 200: `{ comments: [ { id, user, user_id, text, created_at }, ... ] }`.

- POST `/api/social/posts/{post_id}/comments/` [Auth]
  - Body (JSON): `{ text }` – dodaje komentarz.
  - Response 201: `{ comment: { id, user, user_id, text, created_at } }`.

- DELETE lub POST `/api/social/posts/{post_id}/delete/` [Auth]
  - Opis: Usuwa własny post.
  - Response 200: `{ deleted: true, id }`.

- GET `/api/social/search_users/?q=...` [Auth]
  - Response 200: `{ results: [ { id, username }, ... ] }`.

### Znajomości

- GET `/api/social/friend_requests/` [Auth]
  - Response 200: `{ incoming: [ { id, from, status, created_at } ], outgoing: [ { id, to, status, created_at } ] }`.

- POST `/api/social/friend_requests/` [Auth]
  - Body (JSON): `{ username }` – wysyła zaproszenie.
  - Response 201: `{ id, to, status }` lub 409 jeśli już wysłane.

- POST `/api/social/friend_requests/{fr_id}/respond/` [Auth]
  - Body (JSON): `{ action: "accept"|"reject" }`.
  - Response 200: `{ id, status }`; dla `accept` także `{ friend, friend_id }`.

- GET `/api/social/friends/` [Auth]
  - Response 200: `{ friends: [ { id, username } ], count }`.

## Płatności (Stripe)

- POST `/api/payments/create-checkout-session/` [Auth]
  - Body (JSON opcjonalnie): `{ product_id? }` (domyślnie prekonfigurowany produkt/cena STRIPE).
  - Response 200: `{ url, session_id }` — link do Checkout.

- GET `/api/payments/confirm/?session_id=...` [Auth]
  - Opis: Potwierdzenie statusu płatności bez webhooków.
  - Response 200: `{ status: "created|paid|failed", payment_status: "paid|..." }`.

---

## Zabezpieczenia i dobre praktyki
- Autoryzacja: większość endpointów oznaczona [Auth] używa `@login_required`. Publiczne: rejestracja, logowanie, sprawdzanie dostępności, status Strava, lista wydarzeń, callbacki OAuth.
- Własność zasobów: treningi/GPX/HR i usuwanie postów filtrują po `user=request.user`.
- Walidacje: format email, siła hasła, poprawność nazw, zakresy liczb; obsługa błędów statusami 400/401/404/405/409/410/502.
- Idempotencja i unikalność: reakcje `get_or_create`/unikalne `(post_id,user_id,type)`; znajomości w parze kanonicznej; import Strava z unikaniem duplikatów.

## Mapowanie na frontend
- `Register.jsx`, `Login.jsx`, `Profile.jsx`: Auth/Session/Profile/Strava.
- `Workouts.jsx`: listowanie, upload, delete, GPX/HR attach, import Strava, weekly summary.
- `WorkoutAnalysis.jsx`: `/analysis`.
- `Social.jsx`: posts, reactions, comments, search users, friends endpoints.
- `Events.jsx`: `/api/events`.
- Płatności (ekran planów): `/api/payments/*` do odblokowania funkcji Pro.
