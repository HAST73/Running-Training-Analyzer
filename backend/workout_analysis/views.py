import statistics
import json
import math
from bisect import bisect_left
from django.contrib.auth.decorators import login_required
from django.http import HttpRequest, JsonResponse
from workouts.models import Workout
from .utils import analyze_track, parse_gpx

def _safe_float(value):
    """Zwraca float albo None, jeżeli nie da się przekonwertować."""
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None

def _extract_time_series_from_json(raw_data):
    """
    Parsuje płaską listę zdarzeń (jak w Twoim pliku .json) do posortowanej listy krotek.
    Zwraca: [(time_seconds, heart_rate), ...]
    """
    data_list = []
    
    # 1. Jeśli raw_data to bezpośrednio lista (Twój przypadek)
    if isinstance(raw_data, list):
        data_list = raw_data
    # 2. Jeśli to słownik z kluczem 'hr_samples' (przypadek attach_hr)
    elif isinstance(raw_data, dict):
        if "hr_samples" in raw_data:
            # hr_samples ma zazwyczaj format {t: ms, hr: val}
            return sorted(
                [(x["t"] / 1000.0, float(x["hr"])) for x in raw_data["hr_samples"] if x.get("hr")],
                key=lambda x: x[0]
            )
        # Fallback: szukanie features (Adidas standard) - pomijamy dla uproszczenia, bo Twój plik to lista
        
    hr_points = []
    for item in data_list:
        if not isinstance(item, dict):
            continue
        
        # Pobierz czas (w ms)
        ts_ms = item.get("start_time") or item.get("timestamp")
        hr = item.get("heart_rate") or item.get("hr")
        
        if ts_ms is not None and hr is not None:
            try:
                # Konwersja ms -> sekundy
                t_sec = float(ts_ms) / 1000.0
                hr_val = float(hr)
                if hr_val > 0:
                    hr_points.append((t_sec, hr_val))
            except (ValueError, TypeError):
                continue

    # Sortowanie po czasie jest kluczowe dla interpolacji
    hr_points.sort(key=lambda x: x[0])
    return hr_points

def _interpolate_hr(target_ts, hr_series):
    """Znajduje tętno dla danego znacznika czasu (najbliższy sąsiad)."""
    if not hr_series:
        return None
    
    # hr_series to lista [(ts, hr), ...]
    keys = [x[0] for x in hr_series]
    idx = bisect_left(keys, target_ts)
    
    # Sprawdź granice
    if idx == 0:
        return hr_series[0][1]
    if idx >= len(hr_series):
        return hr_series[-1][1]
    
    # Wybierz bliższy punkt (interpolacja nearest-neighbor)
    before = hr_series[idx - 1]
    after = hr_series[idx]
    
    if abs(target_ts - before[0]) < abs(target_ts - after[0]):
        return before[1]
    else:
        return after[1]

@login_required
def workout_analysis(request: HttpRequest, workout_id: int) -> JsonResponse:
    try:
        w = Workout.objects.get(id=workout_id, user=request.user)
    except Workout.DoesNotExist:
        return JsonResponse({"error": "Workout not found"}, status=404)

    # 1) ZBIERAMY PUNKTY Z GPX (Geometria trasy)
    points = []
    if w.gpx_data:
        points = parse_gpx(bytes(w.gpx_data))

    # 2) ANALIZA PODSTAWOWA (z GPX)
    analysis = analyze_track(points)

    # 3) WZBOGACENIE O DANE Z JSON (TĘTNO)
    # Jeśli raw_data jest stringiem JSON, parsujemy go
    raw = w.raw_data
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except Exception:
            raw = []
    
    # Wyciągamy serię czasową tętna z pliku JSON
    hr_series = _extract_time_series_from_json(raw)

    summary = analysis.get("summary", {})
    # Ensure these are always defined (used later even without HR data)
    track = analysis.get("track", [])
    chart = analysis.get("chart", {})
    splits = analysis.get("splits", [])
    
    # JEŚLI MAMY DANE HR Z PLIKU JSON:
    if hr_series:
        # A. Statystyki ogólne (jeśli GPX ich nie dostarczył)
        hrs = [x[1] for x in hr_series]
        if not summary.get("avg_hr_bpm") and hrs:
            summary["avg_hr_bpm"] = sum(hrs) / len(hrs)
        if not summary.get("max_hr_bpm") and hrs:
            summary["max_hr_bpm"] = max(hrs)
        if "min_hr_bpm" not in summary and hrs: # Dodatkowe pole
            summary["min_hr_bpm"] = min(hrs)

        # B. Synchronizacja z wykresem i splitami (Data Fusion)
        # Jeśli mamy trasę (GPX) z czasami, możemy "dokleić" tętno do punktów trasy
        
        # B.1 Uzupełnij 'track' o HR (jeśli brakuje)
        # To pozwoli na poprawne mapowanie, jeśli frontend tego używa
        has_track_timestamps = track and track[0].get("ts") is not None
        
        if has_track_timestamps:
            # Uzupełnij tablicę wykresu (chart)
            # chart['km'] to oś X (dystans). Musimy wiedzieć, jaki czas odpowiada danemu dystansowi.
            # analyze_track nie zwraca czasu dla punktów wykresu wprost, ale możemy to przybliżyć
            # iterując po 'track' i próbkując co ~100m.
            
            # Zróbmy regenerację tablicy 'hr' do wykresu
            new_chart_hr = []
            current_dist = 0.0
            next_sample_dist = 0.0
            
            # Jeśli chart['km'] istnieje, spróbujmy dopasować HR
            if chart.get("km"):
                # Ponieważ analyze_track już zbudował chart['km'], musimy zrobić trudniejszą interpolację
                # albo (prościej) nadpisać logikę zbierania danych do wykresu,
                # iterując po 'track' jeszcze raz.
                
                chart_hr_values = []
                sample_indices = [] # indeksy w 'track', które trafiły do wykresu
                
                accum_dist = 0.0
                accum_since_last = 0.0
                
                # Symulacja logiki z analyze_track żeby zgrać się z chart['km']
                # (zakładamy, że analyze_track próbkuje co ok 100m)
                for pt in track:
                    segment = pt.get("seg_m") or 0.0
                    ts = pt.get("ts")
                    
                    accum_dist += segment
                    accum_since_last += segment
                    
                    if accum_since_last >= 100.0:
                        accum_since_last = 0.0
                        # Mamy punkt wykresu. Znajdź tętno dla czasu 'ts'
                        val = None
                        if ts:
                            val = _interpolate_hr(float(ts), hr_series)
                        chart_hr_values.append(val)
                
                # Nadpisz/Dodaj do wykresu
                # Uwaga: długość musi się zgadzać. Jeśli symulacja wyjdzie inna o 1 element,
                # przytnij lub dopełnij.
                target_len = len(chart["km"])
                current_len = len(chart_hr_values)
                
                if current_len > target_len:
                    chart_hr_values = chart_hr_values[:target_len]
                elif current_len < target_len:
                    chart_hr_values.extend([None] * (target_len - current_len))
                
                analysis["chart"]["hr"] = chart_hr_values

            # B.2 Uzupełnij splity o średnie tętno
            # Splity mają pole 'km' (1, 2, 3...).
            # Musimy obliczyć średnie HR dla każdego kilometra.
            # Użyjmy punktów 'track' jako odniesienia czasu i dystansu.
            km_idx = 1
            curr_km_hr_sum = 0.0
            curr_km_hr_count = 0
            curr_km_dist = 0.0
            
            # Mapa splitów do szybkiego dostępu
            split_map = {s["km"]: s for s in splits}
            
            for pt in track:
                dist = pt.get("seg_m") or 0.0
                ts = pt.get("ts")
                curr_km_dist += dist
                
                if ts:
                    hr_val = _interpolate_hr(float(ts), hr_series)
                    if hr_val:
                        curr_km_hr_sum += hr_val
                        curr_km_hr_count += 1
                
                if curr_km_dist >= 1000.0:
                    if km_idx in split_map:
                        avg = (curr_km_hr_sum / curr_km_hr_count) if curr_km_hr_count > 0 else None
                        # Nadpisz tylko jeśli split nie ma HR z GPX
                        if split_map[km_idx].get("hr_bpm") is None:
                            split_map[km_idx]["hr_bpm"] = avg
                    
                    km_idx += 1
                    curr_km_dist -= 1000.0
                    curr_km_hr_sum = 0.0
                    curr_km_hr_count = 0

    # Reszta kodu (kalorie, antropometria, meta) bez zmian...
    user_profile = getattr(request.user, "profile", None)
    user_weight = user_profile.weight_kg if user_profile and user_profile.weight_kg else None
    user_height_cm = user_profile.height_cm if user_profile and user_profile.height_cm else None

    if user_weight and summary.get("distance_m"):
         dist_km = summary["distance_m"] / 1000.0
         # Proste szacowanie jeśli nie ma kalorii
         if not summary.get("calories_kcal"):
             summary["calories_kcal"] = 1.036 * float(user_weight) * dist_km

    # Ekstrakcja metadanych Adidas (pogoda, kroki, urządzenie, utrata płynów)
    adidas_meta = {}
    if isinstance(raw, dict):
        features = raw.get("features")
        if isinstance(features, list):
            for f in features:
                if not isinstance(f, dict):
                    continue
                ftype = f.get("type")
                attrs = f.get("attributes") or {}
                # Pogoda
                if ftype == "weather":
                    # Support multiple naming variants
                    temp = attrs.get("temperature_c")
                    if temp is None:
                        temp = attrs.get("temperature")
                    hum = attrs.get("humidity_percent")
                    if hum is None:
                        hum = attrs.get("humidity")
                    wsp = attrs.get("wind_speed_ms")
                    if wsp is None:
                        wsp = attrs.get("wind_speed")
                    weather = {
                        "conditions": attrs.get("conditions"),
                        "temperature_c": _safe_float(temp),
                        "humidity_percent": _safe_float(hum),
                        "wind_speed_ms": _safe_float(wsp),
                        "wind_direction_deg": _safe_float(attrs.get("wind_direction")),
                    }
                    adidas_meta["weather"] = weather
                # Kroki / kadencja
                elif ftype in ("steps", "step_metrics", "running_metrics"):
                    # Fallback naming variants
                    avg_rate = attrs.get("average_step_rate_spm")
                    if avg_rate is None:
                        avg_rate = attrs.get("average_step_rate")
                    max_rate = attrs.get("max_step_rate_spm")
                    if max_rate is None:
                        max_rate = attrs.get("maximum_step_rate")
                    avg_len = attrs.get("average_step_length_cm")
                    if avg_len is None:
                        avg_len = attrs.get("average_step_length")
                    steps = {
                        "total_steps": attrs.get("total_steps"),
                        "average_step_rate_spm": _safe_float(avg_rate),
                        "max_step_rate_spm": _safe_float(max_rate),
                        "average_step_length_cm": _safe_float(avg_len),
                    }
                    adidas_meta["steps"] = steps
                # Utrata płynów
                elif ftype in ("hydration", "dehydration") or any(
                    k for k in attrs.keys() if "dehydration" in k or "hydration" in k
                ):
                    vol = attrs.get("dehydration_volume_ml") or attrs.get("hydration_volume_ml") or attrs.get("dehydration_volume")
                    if vol is not None:
                        try:
                            adidas_meta["dehydration_volume_ml"] = float(vol)
                        except Exception:
                            pass
                # Origin feature holds device info
                if ftype == "origin" and isinstance(attrs.get("device"), dict):
                    dev_attrs = attrs.get("device") or {}
                    dev = {
                        "name": dev_attrs.get("name"),
                        "vendor": dev_attrs.get("vendor"),
                        "os_version": dev_attrs.get("os_version"),
                    }
                    adidas_meta["device"] = dev
                # Informacje o urządzeniu
                elif ftype in ("device", "device_info"):
                    dev = {
                        "name": attrs.get("name"),
                        "vendor": attrs.get("vendor"),
                        "os_version": attrs.get("os_version"),
                    }
                    adidas_meta["device"] = dev
                # Czas trwania wg Adidas (czasami w initial_values, ale również tu)
                if "duration_ms" in attrs and adidas_meta.get("duration_ms") is None:
                    try:
                        adidas_meta["duration_ms"] = int(attrs.get("duration_ms"))
                    except Exception:
                        pass
        # Dodatkowo: initial_values może trzymać start_time/duration
        if not adidas_meta.get("duration_ms"):
            if isinstance(features, list):
                for f in features:
                    if isinstance(f, dict) and f.get("type") == "initial_values":
                        attrs = f.get("attributes") or {}
                        dur = attrs.get("duration") or attrs.get("duration_ms")
                        if dur is not None:
                            try:
                                adidas_meta["duration_ms"] = int(dur)
                            except Exception:
                                pass
                        break

    # Budowanie odpowiedzi JSON
    # Add top-level dehydration if not captured
    if isinstance(raw, dict) and adidas_meta.get("dehydration_volume_ml") is None:
        top_dehydration = raw.get("dehydration_volume") or raw.get("dehydration_volume_ml")
        if top_dehydration is not None:
            try:
                adidas_meta["dehydration_volume_ml"] = float(top_dehydration)
            except Exception:
                pass
    resp = {
        "id": w.id,
        "title": w.title,
        "performed_at": (w.performed_at.isoformat() if w.performed_at else None),
        "distance_m": w.distance_m,
        "duration_ms": w.duration_ms,
        "has_track": bool(points),
        "analysis": analysis,
        "calories_kcal": summary.get("calories_kcal"),
        "user_anthropometrics": {
            "height_cm": user_height_cm,
            "weight_kg": float(user_weight) if user_weight else None,
        },
        "adidas_meta": adidas_meta,
        "hr_stats": (raw.get("hr_stats") if isinstance(raw, dict) else None),
        "hr_alignment": (raw.get("hr_alignment") if isinstance(raw, dict) else None),
    }

    # --- Generowanie notatki AI (uproszczone pod nową logikę) ---
    avg_pace = summary.get("avg_pace_s_per_km")
    avg_hr = summary.get("avg_hr_bpm")
    max_hr = summary.get("max_hr_bpm")
    
    def _pace_str(v):
        if not v: return "-"
        m, s = divmod(int(v), 60)
        return f"{m}:{s:02d} min/km"

    lines = ["Podsumowanie:"]
    # Summary metrics
    if avg_pace:
        lines.append(f"- Średnie tempo {_pace_str(avg_pace)}.")
    best_1k = None
    for s in splits:
        if s.get("km") == 1 and s.get("pace_s"):
            best_1k = s.get("pace_s")
            break
    if best_1k:
        lines.append(f"- Najszybszy 1 km w tempie {_pace_str(best_1k)}.")
    elev_gain = summary.get("elev_gain_m") or summary.get("elevation_gain_m")
    if elev_gain:
        lines.append(f"- Łączne przewyższenie +{int(elev_gain)} m.")
    if avg_hr:
        lines.append(f"- Średnie tętno {int(avg_hr)} bpm.")
    if max_hr:
        lines.append(f"- Tętno maksymalne {int(max_hr)} bpm.")

    # Split pacing & HR analysis — build structured suggestions (good / suspicious / improve)
    good_bullets = []
    suspect_bullets = []
    improve_bullets = []

    # Analyze splits pacing
    split_paces = [s.get("pace_s") for s in splits if s.get("pace_s")]
    split_kms = [s.get("km") for s in splits if s.get("pace_s")]
    split_hrs = [s.get("hr_bpm") for s in splits if s.get("hr_bpm") is not None]

    # precompute median pace for heuristics (safe fallback)
    pace_median = None
    if split_paces:
        try:
            pace_median = statistics.median(split_paces)
        except Exception:
            pace_median = None

    if len(split_paces) >= 3:
        # compare early/mid/late
        n = len(split_paces)
        third = max(1, n // 3)
        p_begin = split_paces[:third]
        p_mid = split_paces[third:2*third]
        p_end = split_paces[2*third:]
        mean_begin = sum(p_begin)/len(p_begin) if p_begin else None
        mean_end = sum(p_end)/len(p_end) if p_end else None
        if mean_begin and mean_end:
            diff = mean_end - mean_begin
            if diff < -10:
                good_bullets.append("Świetny negative split – końcówka szybsza niż początek.")
            elif diff > 10:
                improve_bullets.append("Końcówka wyraźnie wolniejsza niż na początku – spróbuj zaczynać nieco wolniej.")
            else:
                good_bullets.append("Tempo było bardzo równe między początkiem a końcem biegu.")

    # Detect single very slow or very fast km (pauses or GPS issues)
    if split_paces:
        med = statistics.median(split_paces)
        for s in splits:
            ps = s.get("pace_s")
            if not ps:
                continue
            if ps > med * 1.6 or ps - med > 60:
                suspect_bullets.append(
                    f"Nietypowo wolny {s.get('km')} km ({_pace_str(ps)}) – możliwa przerwa lub błąd GPS."
                )
            elif ps < med * 0.6 or med - ps > 45:
                # unusually fast kilometer (maybe downhill or GPS spike)
                suspect_bullets.append(
                    f"Bardzo szybki {s.get('km')} km ({_pace_str(ps)}) – sprawdź, czy to nie krótki zjazd lub błąd pomiaru."
                )

# HR-based observations
    if split_hrs and avg_hr:
        try:
            first_hr = next((s.get('hr_bpm') for s in splits if s.get('hr_bpm') is not None), None)
            last_hr = next((s.get('hr_bpm') for s in reversed(splits) if s.get('hr_bpm') is not None), None)
            
            if first_hr and last_hr and (last_hr - first_hr) >= 8:
                # ZMIANA TREŚCI PONIŻEJ:
                improve_bullets.append('Wystąpił wyraźny dryf tętna (wzrost w czasie). Sugeruje to narastające zmęczenie mięśniowe – pracuj nad wytrzymałością tlenową.')
                
        except Exception:
            pass

    # HR vs pace mismatches: wysoki HR przy wolnym tempie -> możliwy wysiłek na podbiegach lub przeszarżowanie
    if split_paces and split_hrs and avg_hr is not None:
        for s in splits:
            ps = s.get('pace_s')
            hrv = s.get('hr_bpm')
            if ps and hrv:
                # compare against median pace or summary avg pace
                ref_pace = summary.get('avg_pace_s_per_km') if summary.get('avg_pace_s_per_km') is not None else (pace_median or 0)
                if hrv > (avg_hr + 12) and ps > (ref_pace + 15):
                    suspect_bullets.append(f"W km {s.get('km')} tętno ({int(hrv)} bpm) wyższe niż średnie przy wolniejszym tempie — możliwe podbiegi lub przeszarżowanie.")

    # Chart-level sudden spikes (tempo) — wykryj duże skoki w wykresie tempa
    chart_pace = chart.get('pace_s') or []
    if chart_pace and len(chart_pace) >= 3:
        for i in range(1, len(chart_pace)):
            a = chart_pace[i-1]
            b = chart_pace[i]
            if a is None or b is None: continue
            if abs(b - a) > 30:
                suspect_bullets.append('Wykres pokazuje gwałtowny skok tempa — możliwy pomiarowy spike lub krótka przerwa.')
                break

    # Cadence hints (from adidas_meta or summary)
    cadence = summary.get('avg_cadence_spm') or (adidas_meta.get('steps') and adidas_meta['steps'].get('average_step_rate_spm'))
    if cadence:
        try:
            c = float(cadence)
            if c < 150:
                improve_bullets.append('Średnia kadencja jest niska — praca nad kadencją (drille) może poprawić ekonomię biegu.')
            elif c > 190:
                improve_bullets.append('Bardzo wysoka kadencja — upewnij się, że technika i długość kroku są odpowiednie.')
            else:
                good_bullets.append('Kadencja w zdrowym zakresie — dobra technika kroku.')
        except Exception:
            pass

    # Compose sections into lines (preserve existing order semantics)
    if good_bullets:
        lines.append("\nCo poszło dobrze:")
        for b in good_bullets:
            lines.append(f"- {b}")
    if suspect_bullets:
        lines.append("\nPodejrzane:")
        for b in suspect_bullets:
            lines.append(f"- {b}")
    if improve_bullets:
        lines.append("\nNa co zwrócić uwagę:")
        for b in improve_bullets:
            lines.append(f"- {b}")

    # Weather / hydration hints (deduplicated hydration advice)
    weather = adidas_meta.get("weather") or {}
    temp_c = weather.get("temperature_c")
    humidity = weather.get("humidity_percent")
    dehydration_ml = adidas_meta.get("dehydration_volume_ml")
    improve_section_added = any(l.strip().startswith('Na co zwrócić uwagę:') for l in lines)
# Sprawdzamy czy w ogóle mamy dane
    if temp_c is not None or dehydration_ml is not None or humidity is not None:
        if not improve_section_added:
            lines.append("\nNa co zwrócić uwagę:")
            improve_section_added = True

        # Sprawdzamy czy w ogóle mamy dane
    if temp_c is not None or dehydration_ml is not None or humidity is not None:
        if not improve_section_added:
            lines.append("\nNa co zwrócić uwagę:")
            improve_section_added = True

        # --- 1. TEMPERATURA (Kontekst: Taktyka i zarządzanie siłami) ---
        if temp_c is not None:
            if temp_c < 5:
                lines.append("- Niska temperatura zwiększa ryzyko kontuzji – pamiętaj o dynamicznej rozgrzewce w cieple przed wyjściem.")
            elif 5 <= temp_c < 15:
                lines.append("- Warunki termiczne były idealne (5-15°C) – to optymalne okno do budowania wydolności i szybkości.")
            elif 15 <= temp_c < 24:
                lines.append("- Przy tej temperaturze organizm zużywa więcej energii na chłodzenie, co może naturalnie podbić tętno o kilka uderzeń.")
            elif temp_c >= 24:
                lines.append("- Upał to duże obciążenie dla serca. W takich warunkach kluczowe jest chłodzenie ciała, a nie walka o tempo za wszelką cenę.")

        # --- 2. WILGOTNOŚĆ (Kontekst: Wydolność i odczucia) ---
        if humidity is not None:
            if humidity < 40:
                lines.append("- Suche powietrze może podrażniać drogi oddechowe. Jeśli czujesz drapanie w gardle, zadbaj o nawilżenie śluzówki po biegu.")
            elif 40 <= humidity <= 60:
                pass # Komfortowa norma, nie zaśmiecamy raportu
            elif humidity > 75:
                lines.append("- Wysoka wilgotność utrudnia parowanie potu. Odczuwalne zmęczenie mogło być wyższe niż wskazywałoby na to samo tempo.")

        # --- 3. UTRATA PŁYNÓW (Kontekst: Regeneracja) ---
        if dehydration_ml is not None:
            # Zaokrąglamy do całości dla czytelności
            loss = int(dehydration_ml)
            if 500 < loss <= 1000:
                lines.append(f"- Straciłeś ok. {loss}ml płynów. Wypij dodatkową szklankę wody lub izotoniku, by przyspieszyć regenerację.")
            elif loss > 1000:
                lines.append(f"- Znaczna utrata płynów ({loss}ml). Sama woda to za mało – koniecznie uzupełnij elektrolity, by uniknąć bólu głowy i skurczów.")

    # Anthropometric suggestions (BMI) — detailed info and weight range
    weight = user_weight
    height_cm = user_height_cm
    if weight and height_cm:
        try:
            h_m = float(height_cm) / 100.0
            bmi = float(weight) / (h_m * h_m)
        except Exception:
            bmi = None
        if bmi:
            bmi_val = round(bmi, 2)
            # ideal weight range for BMI 18.5 .. 24.99
            min_w = 18.5 * (h_m * h_m)
            max_w = 24.99 * (h_m * h_m)
            min_w_r = round(min_w, 2)
            max_w_r = round(max_w, 2)
            lines.append(f"\nWynik BMI: {bmi_val}")
            lines.append(f"Prawidłowa waga dla wzrostu {int(round(height_cm))} cm wynosi między {min_w_r} a {max_w_r} kg.")

            # informacja o odległości od granic
            w = float(weight)
            if bmi < 18.5:
                need = round(min_w - w, 1)
                if need <= 0:
                    need = 0.0
                lines.append(f"Brakuje około {need} kg do dolnej granicy normy (BMI 18.5).")
            elif bmi > 24.99:
                over = round(w - max_w, 1)
                if over <= 0:
                    over = 0.0
                lines.append(f"Masz około {over} kg powyżej górnej granicy normy (BMI 24.99).")
            else:
                to_upper = round(max_w - w, 1)
                to_lower = round(w - min_w, 1)
                lines.append(f"Jesteś w normie BMI. Do górnej granicy brakuje Ci około {to_upper} kg, do dolnej jest {to_lower} kg.")
            # krótka rekomendacja (bardziej opisowa, bez etykiety "Rekomendacja:")
            if bmi < 18.5:
                lines.append("- Warto zadbać o nadwyżkę kaloryczną i trening siłowy, by wzmocnić organizm przed cięższym wysiłkiem.")
            elif bmi < 25:
                lines.append("- Masz optymalne warunki fizyczne – to świetny moment, by bezpiecznie pracować nad szybkością i siłą biegową.")
            elif bmi < 30:
                lines.append("- Skup się na długim, spokojnym wysiłku tlenowym – to najskuteczniejsza i najbezpieczniejsza droga do budowania formy.")
            else:
                lines.append("- Dla zdrowia stawów kluczowa jest teraz regularność w bardzo spokojnym tempie (np. marszobiegi), bez presji na prędkość.")

    resp["ai_note"] = "\n".join(lines)

    return JsonResponse(resp)