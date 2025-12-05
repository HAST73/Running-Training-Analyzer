# Interfejs użytkownika (Frontend React)

Poniższy opis szczegółowo przedstawia strukturę, widoki i interakcje interfejsu użytkownika aplikacji. Dokument mapuje komponenty na funkcje biznesowe i endpointy backendu.

## Stos i struktura
- Technologia: React (SPA) z `jsx`, style w `index.css` i stylach per komponent.
- Struktura katalogów: `frontend/src/` z podkatalogiem `components/` (widoki) oraz głównymi plikami `App.jsx`, `index.js`, `index.css`.
- Statyczne zasoby: `frontend/public/` (np. obrazy, materiały).

## Nawigacja i routing
- `App.jsx`: zarządza routingiem i wyświetla główne sekcje aplikacji: `Home`, `Workouts`, `WorkoutAnalysis`, `Social`, `Events`, `Login`, `Register`, `Profile`.
- Paski nawigacyjne i nagłówki: zapewniają dostęp do logowania/wylogowania, profilu, treningów i sekcji społeczności.

## Widoki i komponenty

### 1. Home.jsx
- Funkcja: strona główna / dashboard.
- Elementy: skróty do ostatniego treningu (`/api/workouts/last`), powiadomienia, odnośniki do sekcji.

### 2. Workouts.jsx
- Funkcja: lista treningów, upload, usuwanie, dołączanie GPX/HR.
- Interakcje:
  - GET `/api/workouts/` — pobranie listy.
  - POST `/api/workouts/upload/` — przesłanie treningu (Adidas JSON/trackpoints/FIT).
  - DELETE `/api/workouts/{id}/` — usunięcie treningu.
  - POST/GET `/api/workouts/{id}/gpx/` — dołączenie/odczyt GPX.
  - POST `/api/workouts/{id}/attach_hr/` — dołączenie próbek tętna.
- UI:
  - Tabela/kafelki z polami: tytuł, dystans, czas, data.
  - Formy uploadu: `multipart/form-data` (plik) lub `application/json` (wklejka).
  - Komunikaty błędów dla formatów nieobsługiwanych.

### 3. WorkoutAnalysis.jsx
- Funkcja: szczegóły i analiza treningu.
- Interakcje: GET `/api/workouts/{id}/analysis/`.
- UI:
  - Podsumowanie: średnie tempo, przewyższenie, HR (średnie/maks), kalorie.
  - Splity 1 km: tempo, HR, przewyższenia.
  - Wykresy: oś km z tempem i wysokością, opcjonalnie HR.
  - Notatka „AI”: sekcje „Co poszło dobrze”, „Podejrzane”, „Na co zwrócić uwagę”, BMI.

### 4. Social.jsx
- Funkcja: feed społeczności — globalny i znajomych.
- Interakcje:
  - GET `/api/social/posts/?scope=global|friends`.
  - POST `/api/social/posts/` — publikacja (tekst/obraz/powiązanie z treningiem, prywatność).
  - POST `/api/social/posts/{post_id}/reactions/` — reakcje `love|fire|party`.
  - GET/POST `/api/social/posts/{post_id}/comments/` — komentarze.
  - DELETE/POST `/api/social/posts/{post_id}/delete/` — usunięcie własnego posta.
  - GET `/api/social/search_users/?q=...` — wyszukiwanie użytkowników.
  - GET `/api/social/friend_requests/`, POST `/api/social/friend_requests/` — zarządzanie zaproszeniami.
  - POST `/api/social/friend_requests/{fr_id}/respond/` — akceptacja/odrzucenie.
  - GET `/api/social/friends/` — lista znajomych.
- UI:
  - Karta posta: autor, treść, obraz, powiązany trening, reakcje, liczba komentarzy.
  - Przełączanie scope: „Global” vs „Znajomi”.
  - Formularz publikacji: pole tekstowe, wybór treningu, upload obrazu, przełącznik prywatności.

### 5. Events.jsx
- Funkcja: lista nadchodzących biegów (Polska/Świat).
- Interakcje: GET `/api/events/?limit=...`.
- UI: dwie listy wydarzeń, możliwość ograniczenia liczby poprzez parametr `limit`.

### 6. Login.jsx
- Funkcja: logowanie.
- Interakcje: POST `/api/login/`.
- UI: formularz z polami `username`, `password`, informacja o błędach (401).

### 7. Register.jsx
- Funkcja: rejestracja konta.
- Interakcje:
  - GET `/api/check_username/`, GET `/api/check_email/` — dostępność.
  - POST `/api/register/` — utworzenie konta.
- UI:
  - Formularz: `username`, `email`, `password`, `height_cm`, `weight_kg`, `first_name`, `last_name`.
  - Walidacja hasła: live-check (min 8 znaków, wielka litera, znak specjalny); obramowanie pola na czerwono/zielono.
  - Błędy dostępności: czerwone komunikaty dla zajętego `username/email`.

### 8. Profile.jsx
- Funkcja: ustawienia konta i integracje.
- Interakcje:
  - GET/POST `/api/profile/` — odczyt i zapis danych.
  - GET `/api/strava/status/` — status połączenia.
  - GET `/api/strava/connect/` — URL autoryzacji.
  - POST `/api/strava/unlink/` — rozłączenie.
  - GET `/oauth/strava/login/` / `/oauth/strava/callback/` — przepływ OAuth.
- UI:
  - Pola edycji: `username`, `first_name`, `last_name`, `height_cm`, `weight_kg`.
  - Sekcja Strava: przycisk „Połącz/Usuń połączenie”, wskaźnik stanu.
  - Informacje Pro: status odblokowania (na bazie płatności).

## Wspólne elementy UI
- Powiadomienia: dropdown z wysokim `z-index` ponad nagłówkiem.
- Obsługa błędów: spójne komunikaty, kolory (np. czerwony dla błędów), statusy HTTP mapowane na alerty.
- Dostępność: formularze z etykietami i opisami, focus states.

## Styl i UX
- Kolory i typografia: proste, czytelne; priorytet na treść.
- Responsywność: układ siatki/kafelków w listach treningów i feedzie.
- Wytyczne walidacji: natychmiastowe informacje zwrotne w formularzach.

## Mapowanie na endpointy
- Zobacz `docs/api-endpoints.md` — każdy komponent powiązany z odpowiednimi REST API.

## Propozycje diagramu UI
- Diagram komponentów: bloki `Login`, `Register`, `Profile`, `Workouts`, `WorkoutAnalysis`, `Social`, `Events`, `Header/Nav` — strzałki do backendowych endpointów.
- Diagram przepływu dla uploadu: `Workouts.jsx (Upload)` → `/api/workouts/upload` → sukces → `Workouts.jsx (Lista)` → wybór → `WorkoutAnalysis.jsx`.
- Diagram przepływu dla społeczności: `Social.jsx (Publikacja)` → `/api/social/posts` → feed; `Reakcje`/`Komentarze` przepływy.

## Uwagi implementacyjne
- Zarządzanie stanem: lokalny stan per komponent + prosty fetch; można rozważyć `React Query` dla cache.
- Obsługa plików: `multipart/form-data` dla uploadów (obrazy, GPX, FIT), z diagnostyką typu.
- Bezpieczeństwo: brak przechowywania haseł w UI; sesja zarządzana przez backend (cookies).
