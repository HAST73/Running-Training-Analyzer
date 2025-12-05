# Scenariusze przypadków użycia i diagram przypadków użycia

Poniżej zebrano szczegółowe scenariusze przypadków użycia dla aplikacji webowej do monitorowania i analizy treningów biegowych z funkcjami społecznościowymi. Na końcu znajduje się instrukcja, jak na ich podstawie przygotować diagram przypadków użycia.

## Role (aktorzy)
- Użytkownik (Runner): zalogowany użytkownik aplikacji.
- Gość (Guest): niezalogowany odwiedzający (rejestracja/logowanie).
- System Płatności (Stripe): zewnętrzny dostawca płatności.
- Strava: zewnętrzny serwis uprawnień (OAuth) i aktywności.
- Baza danych: trwałe przechowywanie danych (aktor pasywny w kontekście diagramu).

---

## Przypadki użycia — Auth i Profil

### UC1: Rejestracja użytkownika
- Aktorzy: Gość
- Cel: Założenie konta i uzupełnienie podstawowych danych (wzrost, waga, opcjonalnie imię/nazwisko).
- Wejście: `username`, `email`, `password`, `height_cm`, `weight_kg`, `first_name?`, `last_name?`.
- Warunki wstępne: Brak konta o podanym `username`/`email`.
- Scenariusz:
  1. Gość otwiera formularz rejestracji.
  2. Wprowadza dane, aplikacja sprawdza dostępność nazwy i email.
  3. Po walidacji tworzony jest użytkownik i profil.
  4. System zwraca sukces i umożliwia logowanie.
- Wyjątki: 409 (zajęty username/email), 400 (walidacja), słabe hasło.
- Rezultat: Konto utworzone, profil z antropometrią.

### UC2: Logowanie użytkownika
- Aktorzy: Gość
- Cel: Uzyskanie sesji.
- Wejście: `username`, `password`.
- Scenariusz: Gość podaje dane, system uwierzytelnia i zakłada sesję.
- Wyjątki: 401 błędne dane.
- Rezultat: Sesja aktywna; dostęp do zasobów [Auth].

### UC3: Podgląd i aktualizacja profilu
- Aktorzy: Użytkownik
- Cel: Utrzymanie poprawnych danych osobowych i antropometrycznych.
- Wejście: `username?`, `first_name?`, `last_name?`, `height_cm?`, `weight_kg?`.
- Scenariusz: Użytkownik otwiera ustawienia, edytuje dane, zapisuje; system waliduje i aktualizuje.
- Wyjątki: 409 (nazwa zajęta), 400 (walidacja nazw/wartości).
- Rezultat: Zaktualizowany profil, log aktywności.

### UC4: Połączenie konta Strava
- Aktorzy: Użytkownik, Strava
- Cel: Powiązanie konta w celu importu aktywności.
- Scenariusz: Użytkownik żąda `auth_url` → przekierowanie do Strava → callback z tokenem → zapis tokenów w profilu.
- Wyjątki: 500 (brak konfiguracji), 502 (błąd wymiany tokenów).
- Rezultat: Konto połączone, możliwy import Strava.

---

## Przypadki użycia — Treningi

### UC5: Dodanie treningu (upload)
- Aktorzy: Użytkownik
- Cel: Zapis aktywności z pliku lub JSON.
- Wejście: `multipart .json/.fit` lub `application/json` (Adidas/trackpoints).
- Scenariusz: Użytkownik przesyła plik/dane; system rozpoznaje format (Adidas/trackpoints/FIT), wylicza dystans/czas, tworzy rekord.
- Wyjątki: 400 (nieobsługiwany format), 405 (zła metoda).
- Rezultat: Nowy trening, wpis w dzienniku aktywności.

### UC6: Dołączenie pliku GPX
- Aktorzy: Użytkownik
- Cel: Uzupełnienie trasy w istniejącym treningu.
- Wejście: `multipart file` (GPX lub JSON z punktami → konwersja do GPX).
- Scenariusz: System zapisuje GPX inline, aktualizuje metadane.
- Wyjątki: 404 (brak treningu), 400 (brak pliku).
- Rezultat: Trening posiada GPX; GET zwraca plik do podglądu.

### UC7: Dołączenie tętna (HR)
- Aktorzy: Użytkownik
- Cel: Wzbogacenie treningu o próbki HR.
- Wejście: `application/json` lub `multipart file JSON` o rozmaitej strukturze.
- Scenariusz: System normalizuje próbki `t, hr`, liczy statystyki (min/max/avg), opcjonalnie dopasowuje do punktów GPX.
- Wyjątki: 400 (brak próbek lub błędne wartości).
- Rezultat: `raw_data.hr_samples`, `hr_stats`, opcjonalnie `hr_alignment`.

### UC8: Import aktywności ze Strava
- Aktorzy: Użytkownik, Strava
- Cel: Pobranie biegów ze Strava API.
- Scenariusz: System odświeża token (jeśli trzeba), iteruje po aktywnościach typu „Run”, tworzy rekordy bez duplikatów.
- Wyjątki: 502 (błąd API Strava), 500 (brak konfiguracji), 400 (konto niepołączone).
- Rezultat: Zaimportowane treningi, wpisy w dzienniku.

### UC9: Usunięcie treningu
- Aktorzy: Użytkownik
- Cel: Usunięcie własnego treningu.
- Scenariusz: System weryfikuje własność, usuwa rekord, zapisuje log.
- Wyjątki: 404 (brak), 405 (metoda).
- Rezultat: Trening usunięty.

### UC10: Analiza treningu
- Aktorzy: Użytkownik
- Cel: Otrzymanie metryk, wykresów i notatki AI.
- Scenariusz: System parsuje GPX, analizuje tempo/splity/kadencję/przewyższenia, scala HR z JSON i generuje AI note (co dobre/podejrzane/rekomendacje, BMI).
- Wyjątki: 404 (brak treningu), brak GPX/HR skutkuje ograniczoną analizą.
- Rezultat: JSON z `analysis`, `adidas_meta`, `hr_stats`, `ai_note`.

---

## Przypadki użycia — Społeczność

### UC11: Publikacja posta
- Aktorzy: Użytkownik
- Cel: Udostępnienie treści (tekst/obraz/powiązanie z treningiem).
- Wejście: `text?`, `workout_id?`, `image?`, `is_global?`.
- Scenariusz: System waliduje co najmniej jeden element treści; zapisuje post z prywatnością `public|friends`.
- Wyjątki: 400 (brak treści).
- Rezultat: Post opublikowany.

### UC12: Przegląd feedu
- Aktorzy: Użytkownik
- Cel: Oglądanie postów globalnych lub znajomych.
- Scenariusz: Dla `scope=global` zwracane są tylko globalne posty; dla `scope=friends` — posty znajomych (is_global=false) + własne.
- Wyjątki: brak znajomych → fallback do zaakceptowanych `FriendRequest`.
- Rezultat: Lista postów z reakcjami i komentarzami.

### UC13: Reakcje na post
- Aktorzy: Użytkownik
- Cel: Dodanie/zdjęcie reakcji z typów `love|fire|party`.
- Scenariusz: `toggle_reaction` wstawia lub usuwa rekord; zwraca `active`, liczniki.
- Wyjątki: 400 (nieprawidłowy typ), 404 (brak posta).
- Rezultat: Zaktualizowane liczniki reakcji.

### UC14: Komentowanie postów
- Aktorzy: Użytkownik
- Cel: Dodanie komentarza i pobranie listy komentarzy.
- Scenariusz: GET zwraca listę; POST dodaje komentarz.
- Wyjątki: 400 (pusty komentarz), 404 (brak posta).
- Rezultat: Komentarz zapisany.

### UC15: Relacje znajomości
- Aktorzy: Użytkownik
- Cel: Wysyłanie/odpowiadanie na prośby o znajomość, lista znajomych.
- Scenariusz: POST wysyła zaproszenie; respond `accept|reject`; lista znajomych pobiera pary z `social_friendship` (z fallbackiem).
- Wyjątki: 409 (duplikat zaproszenia), 404 (zaproszenie nie znalezione).
- Rezultat: Utworzone znajomości; feed znajomych działa.

### UC16: Usuwanie własnego posta
- Aktorzy: Użytkownik
- Cel: Skasowanie posta.
- Scenariusz: System weryfikuje własność; usuwa.
- Wyjątki: 404, 405.
- Rezultat: Post usunięty.

---

## Przypadki użycia — Płatności

### UC17: Utworzenie sesji płatności (Checkout)
- Aktorzy: Użytkownik, System Płatności
- Cel: Rozpoczęcie transakcji odblokowującej funkcje Pro.
- Wejście: `product_id?`.
- Scenariusz: System tworzy rekord `Payment`, prosi Stripe o `Session`, zwraca `url`.
- Wyjątki: 500 (brak klucza), 400 (brak ceny), 502 (błąd Stripe).
- Rezultat: Link do Checkout.

### UC18: Potwierdzenie płatności
- Aktorzy: Użytkownik, System Płatności
- Cel: Zmiana statusu płatności po udanym Checkout.
- Wejście: `session_id`.
- Scenariusz: System pyta Stripe o stan, aktualizuje `Payment.status` na `paid`.
- Rezultat: Funkcje Pro odblokowane (np. dodatkowe analizy).

---

## Jak przygotować diagram przypadków użycia

### Elementy diagramu (UML Use Case)
- Aktorzy: Gość, Użytkownik, Strava, System Płatności (Stripe).
- Przypadki użycia (owale): UC1–UC18 (lub zgrupowane logicznie: Auth/Profil, Treningi, Social, Płatności).
- Relacje:
  - Asocjacje aktor ↔ przypadek (linie).
  - «include» i «extend» (opcjonalnie):
    - «include» między `Analiza treningu` a `Parsowanie GPX` i `Fuzja HR JSON`.
    - «extend» między `Publikacja posta` a `Powiązanie z treningiem` (opcjonalnie).
  - Granice systemu: ramka z nazwą aplikacji; aktorzy na zewnątrz.

### Kroki wykonania
1. Zgrupuj przypadki użycia w cztery obszary: Auth/Profil, Treningi, Social, Płatności.
2. Umieść aktorów: Gość (Auth), Użytkownik (wszystkie), Strava (OAuth/Import), Stripe (Checkout/Confirm).
3. Narysuj owale przypadków (UC1–UC18) i połącz je liniami z odpowiednimi aktorami.
4. Dodaj relacje «include»/«extend» dla zależnych kroków (np. Analiza → Parsowanie/Fuzja HR).
5. Dodaj notatki, jeśli potrzeba (walidacje, własność zasobów, idempotencja reakcji).

### Przykładowy podział na diagramy
- Diagram 1: Auth/Profil (UC1–UC4).
- Diagram 2: Treningi i Analiza (UC5–UC10).
- Diagram 3: Social (UC11–UC16).
- Diagram 4: Płatności (UC17–UC18).

### Narzędzia
- Draw.io / diagrams.net: prosty edytor UML.
- PlantUML / Mermaid: tekstowe definicje (łatwo do wersjonowania).
- StarUML / Visual Paradigm: pełne narzędzia CASE.

---

## Mapowanie na endpointy (skrót)
- UC1/UC2/UC3/UC4: `/api/register`, `/api/login`, `/api/profile`, `/api/strava/*`, `/api/session`.
- UC5–UC9: `/api/workouts/*` (upload, gpx, attach_hr, delete, import_strava, list/last/weekly_summary).
- UC10: `/api/workouts/{id}/analysis`.
- UC11–UC16: `/api/social/*` (posts/reactions/comments/search_users/friend_requests/friends/delete).
- UC17–UC18: `/api/payments/*` (checkout-session, confirm).

> Na bazie powyższych scenariuszy możesz odwzorować pełny diagram przypadków użycia z czytelnymi powiązaniami i rozszerzeniami. Jeśli chcesz, mogę wygenerować wersję PlantUML/Mermaid gotową do wklejenia w dokumentację.
