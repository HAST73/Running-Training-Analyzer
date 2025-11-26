import requests
from bs4 import BeautifulSoup
from datetime import datetime, date
from urllib.parse import urljoin
import re
import warnings

# Wyłączenie ostrzeżeń SSL
from requests.packages.urllib3.exceptions import InsecureRequestWarning
requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

# --- DANE ZASTĘPCZE (MOCK) ---
MOCK_POLAND = [{"name": "Brak danych", "date": "2024-01-01", "place": "Sprawdź konsolę", "url": "#"}]
MOCK_WORLD = [{"name": "Brak danych", "date": "2024-01-01", "place": "Sprawdź konsolę", "url": "#"}]

MONTHS_PL = {
    1: "styczen", 2: "luty", 3: "marzec", 4: "kwiecien",
    5: "maj", 6: "czerwiec", 7: "lipiec", 8: "sierpien",
    9: "wrzesien", 10: "pazdziernik", 11: "listopad", 12: "grudzien",
}

def _clean_text(text: str) -> str:
    if not text:
        return ""
    garbage = ["Kliknij tutaj", "ZAKRES WYSZUKIWANIA", "->", "Dzień:", "Dzien:", "\xa0", "&nbsp;"]
    cleaned = text
    for g in garbage:
        cleaned = cleaned.replace(g, "")
    return " ".join(cleaned.split())

def _parse_date(date_str: str):
    if not date_str:
        return None
    clean = re.sub(r'\(.*?\)', '', date_str).strip()
    formats = ["%d.%m.%Y", "%Y.%m.%d", "%d-%m-%Y", "%d.%m.%y"]
    for fmt in formats:
        try:
            return datetime.strptime(clean, fmt).date()
        except ValueError:
            continue
    return None

def _fetch_html(params):
    url = "https://www.maratonypolskie.pl/mp_index.php"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded"
    }
    try:
        resp = requests.post(url, data=params, headers=headers, timeout=8, verify=False)
        resp.encoding = "iso-8859-2"
        return resp.text if resp.status_code == 200 else None
    except Exception as e:
        print(f"DEBUG: Wyjątek sieciowy: {e}")
        return None

def _parse_events_from_html(html_content, base_url="https://www.maratonypolskie.pl/"):
    if not html_content:
        return []
    soup = BeautifulSoup(html_content, "html.parser")
    events = []
    rows = soup.find_all("tr")
    
    for row in rows:
        row_text = row.get_text()
        
        # Filtrowanie nagłówków reklamowych
        if "ZOBACZ OFERT" in row_text.upper() or "WYDARZENIA PROMOWANE" in row_text.upper():
            continue
            
        cols = row.find_all("td")
        if len(cols) < 3:
            continue
            
        # 1. Szukamy DATY
        event_date = None
        date_col_idx = -1
        
        for idx in range(0, min(3, len(cols))):
            txt = cols[idx].get_text(strip=True)
            if re.search(r'\d+\.\d+', txt):
                parsed = _parse_date(txt)
                if parsed:
                    event_date = parsed
                    date_col_idx = idx
                    break
        
        if not event_date:
            continue

        # 2. Szukamy MIEJSCA i NAZWY
        place = ""
        name = ""
        url = ""
        
        found_texts = []
        for idx in range(date_col_idx + 1, len(cols)):
            cell = cols[idx]
            txt = _clean_text(cell.get_text(" ", strip=True))
            if len(txt) > 1:
                link = cell.find("a")
                found_texts.append({
                    "text": txt,
                    "has_link": bool(link),
                    "href": link["href"] if link and link.has_attr("href") else ""
                })

        # Zazwyczaj pierwszy element to Miejsce, drugi to Nazwa
        if len(found_texts) >= 1:
            place = found_texts[0]["text"]
            if len(found_texts) >= 2:
                name = found_texts[1]["text"]
                if found_texts[1]["href"]:
                     url = urljoin(base_url, found_texts[1]["href"]) if not found_texts[1]["href"].startswith("http") else found_texts[1]["href"]

        if name and place:
            events.append({
                "name": name,
                "date": event_date,
                "place": place,
                "url": url,
            })
            
    return events

def _fetch_events_generic(mapa_nazwa: str, limit: int) -> list[dict]:
    print(f"\n[SCRAPER] Pobieranie: {mapa_nazwa}")
    today = datetime.now().date()
    current_year = today.year
    
    # Pobieramy bieżący rok i 2 kolejne
    years = [current_year, current_year + 1, current_year + 2]
    all_events = []

    for year in years:
        start_month = today.month if year == current_year else 1
        
        for m in range(start_month, 13):
            # Zwiększyłem limit bufora, żeby nie przerywało za wcześnie
            if len(all_events) >= limit + 200: 
                break
                
            print(f"DEBUG: Pobieram {year}-{m}...")
            params = {
                "dzienp1": "1", "dzienk1": "31",
                "czasm1": MONTHS_PL[m], "czasr1": str(year),
                "mapa_nazwa": mapa_nazwa,
                "mapa_tryb2": "Tekstowo",
                "grp": "13", "wielkosc": "2", "dzial": "3", "action": "1"
            }
            html = _fetch_html(params)
            
            if html:
                found = _parse_events_from_html(html)
                
                # --- KLUCZOWA POPRAWKA: ŚCISŁA KONTROLA DATY ---
                # Odrzucamy "promowane" biegi, które strona wkleja z inną datą niż ta, o którą pytamy.
                valid_for_month = []
                for ev in found:
                    if ev['date'].year == year and ev['date'].month == m:
                        valid_for_month.append(ev)
                    # else:
                        # print(f"DEBUG: Odrzucono promowany/błędny: {ev['name']} ({ev['date']}) podczas pytania o {year}-{m}")
                
                all_events.extend(valid_for_month)

        if len(all_events) >= limit + 200:
            break

    unique = []
    seen = set()
    all_events.sort(key=lambda x: x["date"])
    
    for e in all_events:
        if e["date"] < today: continue
        k = (e["name"], e["date"])
        if k not in seen:
            seen.add(k)
            e["date"] = e["date"].isoformat()
            unique.append(e)
            
    print(f"[SCRAPER] Wynik {mapa_nazwa}: {len(unique)} unikalnych przyszłych.")
    return unique

def fetch_poland_events(limit: int = 100) -> list[dict]:
    raw = _fetch_events_generic("Polska", limit)
    clean = []
    for ev in raw:
        # Usuwamy te, które mają kod kraju (np. GER) - zabezpieczenie
        if re.search(r'\([A-Z]{2,3}\)', ev["place"]):
            continue
        clean.append(ev)
    return clean[:limit]

def fetch_world_events(limit: int = 100) -> list[dict]:
    # Pobieramy więcej, bo dużo odpadnie przy filtracji
    raw = _fetch_events_generic("Swiat", limit + 200)
    clean = []
    
    for ev in raw:
        place = ev["place"]
        # Filtr Świata: Musi mieć kod kraju w nawiasie np. (GER)
        has_country_code = bool(re.search(r'\([A-Z]{2,3}\)', place))
        
        if has_country_code:
            clean.append(ev)
            
    if not clean:
        return MOCK_WORLD
    return clean[:limit]