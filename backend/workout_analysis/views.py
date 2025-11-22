from __future__ import annotations

from django.contrib.auth.decorators import login_required
from django.http import HttpRequest, JsonResponse

from workouts.models import Workout
from .utils import analyze_track, parse_gpx
import statistics
import json

def _safe_float(value):
    """Zwraca float albo None, jeżeli nie da się przekonwertować."""
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None

@login_required
def workout_analysis(request: HttpRequest, workout_id: int) -> JsonResponse:
    """Return detailed analysis for a workout.

    WAŻNE: analiza (dystans, tempo, przewyższenie, kadencja, wykres)
    jest liczona TYLKO z GPX, jeżeli GPX został dołączony.
    JSON z Adidasa / FIT ze Stravy służy tylko jako surowe raw_data.
    """
    try:
        w = Workout.objects.get(id=workout_id, user=request.user)
    except Workout.DoesNotExist:
        return JsonResponse({"error": "Workout not found"}, status=404)

    # 1) ZBIERAMY PUNKTY WYŁĄCZNIE Z GPX
    points = []
    # najpierw inline gpx_data (nowy sposób przechowywania)
    if w.gpx_data:
        points = parse_gpx(bytes(w.gpx_data))
    # fallback na stare FileField, jeśli jeszcze gdzieś jest używane
    elif w.gpx_file and getattr(w.gpx_file, "file", None):
        try:
            points = parse_gpx(w.gpx_file.read())
        except Exception:
            points = []

    # 2) ANALIZA – bazuje TYLKO na punktach z GPX
    analysis = analyze_track(points)

    # Uzupełnienie kalorii wagą użytkownika (jeśli dostępna) – prosta modyfikacja
    user_profile = getattr(request.user, "profile", None)
    user_weight = None
    user_height_cm = None
    if user_profile:
        user_weight = user_profile.weight_kg if user_profile.weight_kg else None
        user_height_cm = user_profile.height_cm if user_profile.height_cm else None
    if user_weight and isinstance(analysis.get("summary"), dict):
        dist_m = analysis["summary"].get("distance_m") or 0.0
        try:
            analysis["summary"]["calories_kcal"] = 1.036 * float(user_weight) * (float(dist_m) / 1000.0)
        except Exception:
            pass

    # 3) Dodatki z raw_data (Adidas / Strava) – wersja BEZPIECZNA
    def _safe_float(v):
        try:
            if v is None:
                return None
            return float(v)
        except (TypeError, ValueError):
            return None

    calories = None
    dehydration_volume = None
    base_duration_ms = None
    adidas_weather = None
    adidas_steps = None
    adidas_device = None

    raw = w.raw_data

    # nowy kod – obsługa zarówno JSONField (dict), jak i TextField (string)
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except Exception:
            raw = {}
    elif not isinstance(raw, dict) or raw is None:
        raw = {}


    # proste pola
    calories = raw.get("calories") or raw.get("total_calories")
    dehydration_volume = raw.get("dehydration_volume")
    base_duration_ms = raw.get("duration") or raw.get("duration_ms")

    # BEZPIECZNE czytanie features
    features = raw.get("features") or []
    if not isinstance(features, list):
        features = []

    for f in features:
        if not isinstance(f, dict):
            continue

        f_type = f.get("type")
        attrs = f.get("attributes") or {}
        if not isinstance(attrs, dict):
            attrs = {}

        # --- POGODA ---
        if f_type == "weather":
            conditions = attrs.get("conditions")
            temp = _safe_float(attrs.get("temperature") or attrs.get("temperature_c"))
            wind_speed = _safe_float(attrs.get("wind_speed") or attrs.get("wind_speed_ms"))
            wind_dir = _safe_float(attrs.get("wind_direction") or attrs.get("wind_direction_deg"))
            humidity = _safe_float(attrs.get("humidity") or attrs.get("humidity_percent"))

            # ustaw tylko jeśli coś realnego jest
            if any([conditions, temp, wind_speed, wind_dir, humidity]):
                adidas_weather = {
                    "conditions": conditions,
                    "temperature_c": temp,
                    "wind_speed_ms": wind_speed,
                    "wind_direction_deg": wind_dir,
                    "humidity_percent": humidity,
                }

        # --- KROKI ---
        elif f_type == "steps":
            total_steps = attrs.get("total_steps")
            avg_step_rate = _safe_float(attrs.get("average_step_rate"))
            max_step_rate = _safe_float(attrs.get("maximum_step_rate"))
            avg_step_length = _safe_float(attrs.get("average_step_length"))

            if any([total_steps, avg_step_rate, max_step_rate, avg_step_length]):
                adidas_steps = {
                    "total_steps": total_steps,
                    "average_step_rate_spm": avg_step_rate,
                    "max_step_rate_spm": max_step_rate,
                    "average_step_length_cm": avg_step_length,
                }

        # --- URZĄDZENIE ---
        elif f_type == "origin":
            dev = attrs.get("device") or {}
            if isinstance(dev, dict):
                name = dev.get("name")
                vendor = dev.get("vendor")
                os_version = dev.get("os_version")
                if any([name, vendor, os_version]):
                    adidas_device = {
                        "name": name,
                        "vendor": vendor,
                        "os_version": os_version,
                    }


    # 4) Odpowiedź – dystans/czas bierzemy z Workout (tak jak masz),
    #     ale przewyższenie WYŁĄCZNIE z analysis.summary.elev_gain_m
    resp = {
        "id": w.id,
        "title": w.title,
        "performed_at": (w.performed_at.isoformat() if w.performed_at else None),
        "distance_m": w.distance_m,
        "duration_ms": w.duration_ms,
        "has_track": bool(points),
        "analysis": analysis,
        "calories_kcal": calories or analysis.get("summary", {}).get("calories_kcal"),
        "user_anthropometrics": {
            "height_cm": user_height_cm,
            "weight_kg": float(user_weight) if user_weight is not None else None,
        },
        # nowe pole z rzeczami z Adidas JSON (opcjonalne)
        "adidas_meta": {
            "duration_ms": base_duration_ms,
            "dehydration_volume_ml": dehydration_volume,
            "weather": adidas_weather,
            "steps": adidas_steps,
            "device": adidas_device,
        },
    }

    # Heurystyczna "Analiza AI" – oparta na analysis (czyli GPX)
    summary = analysis.get("summary", {})
    splits = analysis.get("splits", [])

    avg_pace = summary.get("avg_pace_s_per_km")
    best_1k = analysis.get("best_segments", {}).get("best_1k_pace_s")
    elev = summary.get("elev_gain_m")
    cad = summary.get("avg_cadence_spm")

    def _pace_str(v: float | None) -> str:
        """Format seconds per km as M:SS min/km (e.g. 5:30 min/km)."""
        if v is None or not isinstance(v, (int, float)) or v <= 0:
            return "-"
        total = int(round(v))  # nearest second
        m = total // 60
        s = total % 60
        return f"{m}:{s:02d} min/km"

    def _safe_mean(values):
        vals = [float(x) for x in values if isinstance(x, (int, float))]
        return statistics.mean(vals) if vals else None

    # ---- Podsumowanie liczbowe ----
    lines: list[str] = []
    lines.append("Podsumowanie:")
    if avg_pace:
        lines.append(f"- Średnie tempo { _pace_str(avg_pace) }.")
    if best_1k:
        lines.append(f"- Najszybszy km w tempie { _pace_str(best_1k) }.")
    if elev is not None:
        if elev < 30:
            prof = "prawie płaska trasa"
        elif elev < 120:
            prof = "umiarkowanie pofałdowana trasa"
        else:
            prof = "mocno pofałdowana trasa"
        lines.append(f"- Łączne przewyższenie +{int(elev)} m ({prof}).")
    if cad:
        lines.append(f"- Średnia kadencja ~{int(cad)} spm.")

    # ---- Stabilność tempa ----
    all_paces = [s.get("pace_s") for s in splits if s.get("pace_s")]
    improve_tips: list[str] = []
    good_points: list[str] = []

    if len(all_paces) >= 3:
        mean_p = _safe_mean(all_paces)
        std_p = statistics.pstdev(all_paces) if mean_p else 0.0
        var_ratio = (std_p / mean_p) if mean_p else 0.0

        if var_ratio < 0.03:
            good_points.append("Tempo bardzo równe – świetna kontrola intensywności.")
        elif var_ratio < 0.06:
            good_points.append("Tempo w miarę równe, z niewielkimi wahaniami.")
        else:
            improve_tips.append(
                "Tempo mocno się wahało – spróbuj trzymać stały rytm, zwłaszcza na płaskich odcinkach."
            )

    # ---- Początek vs koniec biegu ----
    n = len(splits)
    if n >= 3:
        third = max(1, n // 3)
        begin = _safe_mean(s["pace_s"] for s in splits[:third])
        middle = _safe_mean(s["pace_s"] for s in splits[third : 2 * third])
        end = _safe_mean(s["pace_s"] for s in splits[2 * third :])

        if begin and end:
            delta = end - begin  # dodatnie = wolniejsza końcówka
            diff = abs(delta)

            if diff <= 5:
                good_points.append(
                    "Początek i koniec biegu były w bardzo podobnym tempie – bieg równy."
                )
            elif delta > 5:
                improve_tips.append(
                    f"Końcówka była wolniejsza o ok. {int(delta)} s/km. "
                    "Spróbuj zaczynać odrobinę spokojniej, żeby utrzymać tempo do końca."
                )
            else:  # delta < -5 (negative split)
                good_points.append(
                    f"Druga część biegu była szybsza o ok. {int(-delta)} s/km – bardzo dobra dystrybucja sił (negative split)."
                )

        # dodatkowo lekki komentarz o środku biegu
        if middle and begin and end:
            if middle > max(begin, end) + 5:
                improve_tips.append(
                    "Środkowa część biegu była wyraźnie wolniejsza – uważaj, żeby nie wybijać się z rytmu np. na nawrotkach lub podbiegach."
                )

    # ---- Składamy końcowy tekst ----
    if good_points:
        lines.append("")
        lines.append("Co poszło dobrze:")
        for g in good_points:
            lines.append(f"- {g}")

    if improve_tips:
        lines.append("")
        lines.append("Na co zwrócić uwagę:")
        for tip in improve_tips:
            lines.append(f"- {tip}")

    # ---- Wskazówki na podstawie wzrostu / wagi ----
    if user_height_cm or user_weight:
        lines.append("")
        lines.append("Wskazówki antropometryczne:")
        # BMI – orientacyjne (jeśli oba parametry są dostępne)
        if user_height_cm and user_weight:
            try:
                h_m = float(user_height_cm) / 100.0
                bmi = float(user_weight) / (h_m ** 2) if h_m > 0 else None
            except Exception:
                bmi = None
            if bmi:
                if bmi < 18.5:
                    lines.append("- BMI sugeruje niedowagę – zadbaj o odpowiednie odżywienie i regenerację.")
                elif bmi < 25:
                    lines.append("- BMI w normie – dobra baza do progresu szybkości i wytrzymałości.")
                elif bmi < 30:
                    lines.append("- BMI powyżej normy – delikatna redukcja masy może poprawić ekonomię biegu.")
                else:
                    lines.append("- Wysokie BMI – rozważ konsultację z trenerem / dietetykiem dla optymalizacji obciążeń.")

        # Szacowana długość kroku vs oczekiwana (jeśli mamy tempo i kadencję)
        avg_pace_val = avg_pace if isinstance(avg_pace, (int, float)) else None
        cad_val = cad if isinstance(cad, (int, float)) else None
        if user_height_cm and avg_pace_val and cad_val and avg_pace_val > 0 and cad_val > 0 and summary.get("distance_m") and summary.get("duration_s"):
            speed_m_s = (summary["distance_m"] / summary["duration_s"]) if summary.get("duration_s") else None
            if speed_m_s and speed_m_s > 0:
                steps_per_s = cad_val / 60.0
                stride_len_m = speed_m_s / steps_per_s if steps_per_s > 0 else None
                # Oczekiwany zakres (orientacyjnie 0.38–0.46 * wzrost) dla biegu ciągłego
                expected_min = (float(user_height_cm) / 100.0) * 0.38
                expected_max = (float(user_height_cm) / 100.0) * 0.46
                if stride_len_m:
                    lines.append(f"- Szacowana długość kroku ~{stride_len_m:.2f} m (typowy zakres {expected_min:.2f}–{expected_max:.2f} m).")
                    if stride_len_m < expected_min * 0.95:
                        lines.append("  Kroki krótsze niż typowe – możesz popracować nad mocą wybicia / mobilnością bioder.")
                    elif stride_len_m > expected_max * 1.05:
                        lines.append("  Kroki dłuższe niż typowe – zwróć uwagę czy nie powoduje to nadmiernego lądowania przed środkiem ciężkości.")

        # Kadencja – orientacyjne widełki 165–185 spm dla większości biegaczy
        if cad_val:
            if cad_val < 160:
                lines.append("- Kadencja poniżej 160 spm – podniesienie o kilka kroków/min może poprawić ekonomię.")
            elif cad_val > 190:
                lines.append("- Bardzo wysoka kadencja (>190 spm) – upewnij się, że nie skracasz nadmiernie kroku.")

    resp["ai_note"] = "\n".join(lines)

    resp["ai_note"] = "\n".join(lines)

    # Zwracamy pełną odpowiedź JSON z analizą
    return JsonResponse(resp)

