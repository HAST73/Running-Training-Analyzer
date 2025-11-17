from datetime import datetime
from urllib.parse import urljoin
import re

import requests
from bs4 import BeautifulSoup


def _parse_date(date_str: str):
    """
    Parsuje datę z formatu:
      - '2.11.2025 (nd)'
      - '2026.1.6 (wt)'
    Zwraca obiekt datetime.date lub None.
    """
    if not date_str:
        return None

    clean = date_str.strip()

    # utnij wszystko po spacji lub nawiasie, np. '2.11.2025 (nd)' -> '2.11.2025'
    for sep in ("(", " "):
        if sep in clean:
            clean = clean.split(sep)[0]
            break

    for fmt in ("%d.%m.%Y", "%Y.%m.%d"):
        try:
            return datetime.strptime(clean, fmt).date()
        except ValueError:
            continue

    return None


MONTHS_PL = {
    1: "styczen",
    2: "luty",
    3: "marzec",
    4: "kwiecien",
    5: "maj",
    6: "czerwiec",
    7: "lipiec",
    8: "sierpien",
    9: "wrzesien",
    10: "pazdziernik",
    11: "listopad",
    12: "grudzien",
}

COUNTRIES = {
    "Włochy",
    "Hiszpania",
    "Ukraina",
    "Francja",
    "Niemcy",
    "Wielka",
    "Brytania",
    "Portugalia",
    "USA",
    "Cypr",
    "Czechy",
    "Szwajcaria",
    "Austria",
    "Grecja",
    "Wietnam",
    # dopiszesz sobie kolejne jak będziesz potrzebował
}


def _fetch_for_params(params: dict) -> str:
    """Wysyła pojedyncze zapytanie POST do maratonypolskie.pl z danymi formularza."""
    resp = requests.post(
        "https://www.maratonypolskie.pl/mp_index.php",
        data=params,
        timeout=10,
    )
    resp.raise_for_status()
    # Strona używa ISO-8859-2 (Central European), ustawiamy ręcznie, żeby uniknąć krzaków
    resp.encoding = "iso-8859-2"
    return resp.text


def _parse_events_from_html(html: str) -> list[dict]:
    """Parsuje biegi z dostarczonego HTML-a (pojedyncza odpowiedź)."""
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(" ", strip=True)

    # np. "23.11.2025" albo "2025.11.23"
    date_pattern = re.compile(r"(\d{1,4}\.\d{1,2}\.\d{4})")

    events: list[dict] = []

    for match in date_pattern.finditer(text):
        date_str = match.group(1)
        date_obj = _parse_date(date_str)
        if not date_obj:
            continue

        # bierzemy ~200 znaków po dacie jako "kontekst"
        end = min(len(text), match.end() + 200)
        after = text[match.end() : end]

        # utnij do kolejnej daty (żeby nie mieszać dwóch wydarzeń naraz)
        next_date = date_pattern.search(after)
        if next_date:
            after = after[: next_date.start()]

        parts = after.strip().split()
        if len(parts) < 2:
            continue

        # wywal nawiasy typu (ITA), (ESP) itp.
        parts = [p for p in parts if not (p.startswith("(") and p.endswith(")"))]
        if len(parts) < 2:
            continue

        # domyślnie miasto = pierwszy token
        city_tokens = [parts[0]]
        name_start_idx = 1

        # jeśli zaraz po mieście występuje nazwa kraju (np. "Włochy", "Hiszpania"),
        # to dorzuć ją do city, a name zaczynaj dopiero po niej
        if len(parts) >= 2 and parts[1] in COUNTRIES:
            city_tokens.append(parts[1])
            name_start_idx = 2

        city = " ".join(city_tokens).strip(",.")
        name = " ".join(parts[name_start_idx:]).strip()
        if not name:
            continue

        events.append(
            {
                "date": date_obj,
                "city": city,
                "name": name,
                "url": None,
                "source": "maratonypolskie.pl",
            }
        )

    return events


def fetch_poland_events(limit: int = 20) -> list[dict]:
    """Pobiera biegi w Polsce dla bieżącego roku i +1 (np. 2025 i 2026)."""

    today = datetime.now().date()
    current_year = today.year
    years = [current_year, current_year + 1]

    all_events: list[dict] = []

    for year in years:
        for month_num, month_name in MONTHS_PL.items():
            params = {
                "dzienp1": "1",
                "dzienk1": "31",
                "czasm1": month_name,
                "czasr1": str(year),
                "wojew": "Wszystkie",
                "mapa_nazwa": "Polska",
                "mapa_tryb2": "Tekstowo",
                "grp": "13",
                "wielkosc": "2",
                "dzial": "3",
                "action": "1",
            }

            try:
                html = _fetch_for_params(params)
                events = _parse_events_from_html(html)
                all_events.extend(events)
            except Exception:
                continue

    # filtrujemy tylko przyszłe wydarzenia (>= dziś),
    # bez dodatkowego sprawdzania "year in years", bo to potrafi wyzerować listę
    filtered = [e for e in all_events if e["date"] and e["date"] >= today]
    filtered.sort(key=lambda e: e["date"])  # sort po dacie

    # usunięcie duplikatów po (date, city, name)
    seen = set()
    unique: list[dict] = []
    for e in filtered:
        key = (e["date"], e["city"], e["name"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(e)

    result = unique
    if limit is not None:
        result = result[:limit]

    return [
        {
            **e,
            "date": e["date"].isoformat(),
        }
        for e in result
    ]


def fetch_world_events(limit: int = 200) -> list[dict]:
    """Pobiera biegi ze świata z maratonypolskie.pl."""

    today = datetime.now().date()
    current_year = today.year
    years = [current_year, current_year + 1]

    all_events: list[dict] = []

    for year in years:
        for month_num, month_name in MONTHS_PL.items():
            params = {
                "dzienp1": "1",
                "dzienk1": "31",
                "czasm1": month_name,
                "czasr1": str(year),
                "mapa_nazwa": "Swiat",
                "mapa_tryb2": "Tekstowo",
                "grp": "13",
                "wielkosc": "2",
                "dzial": "3",
                "action": "1",
            }

            try:
                html = _fetch_for_params(params)
                events = _parse_events_from_html(html)
                all_events.extend(events)
            except Exception:
                continue

    filtered = [e for e in all_events if e["date"] and e["date"] >= today]
    filtered.sort(key=lambda e: e["date"])

    seen = set()
    unique: list[dict] = []
    for e in filtered:
        key = (e["date"], e["city"], e["name"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(e)

    result = unique
    if limit is not None:
        result = result[:limit]

    return [
        {
            **e,
            "date": e["date"].isoformat(),
        }
        for e in result
    ]
