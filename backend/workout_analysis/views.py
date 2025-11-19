from __future__ import annotations

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
    if not isinstance(raw, dict):
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
        # nowe pole z rzeczami z Adidas JSON (opcjonalne)
        "adidas_meta": {
            "duration_ms": base_duration_ms,
            "dehydration_volume_ml": dehydration_volume,
            "weather": adidas_weather,
            "steps": adidas_steps,
            "device": adidas_device,
        },
    }

    # Heurystyczna "Analiza AI" – też oparta na analysis (czyli na GPX)
    summary = analysis.get("summary", {})
    avg_pace = summary.get("avg_pace_s_per_km")
    if avg_pace:
        avg_str = f"~{int(avg_pace):d}s/km"
    else:
        avg_str = "-"

    best_1k = analysis.get("best_segments", {}).get("best_1k_pace_s")
    notes = [f"Średnie tempo {avg_str}."]
    if best_1k:
        notes.append(f"Najszybszy km w tempie ~{int(best_1k)}s/km.")
    elev = summary.get("elev_gain_m")
    if elev:
        notes.append(f"Przewyższenie +{int(elev)} m.")
    cad = summary.get("avg_cadence_spm")
    if cad:
        notes.append(f"Śr. kadencja ~{int(cad)} spm.")
    resp["ai_note"] = " ".join(notes)

    # (opcjonalnie) meta info – do debugowania w UI
    track = analysis.get("track", [])
    resp["meta"] = {
        "track_points": len(track),
        "has_elev_samples": any(p.get("ele") is not None for p in track),
        "elevation_source": "gpx" if points else "none",
    }

    return JsonResponse(resp)
