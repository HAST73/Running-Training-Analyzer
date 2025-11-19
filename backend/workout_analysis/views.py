from __future__ import annotations

from django.contrib.auth.decorators import login_required
from django.http import HttpRequest, JsonResponse

from workouts.models import Workout
from .utils import analyze_track, parse_gpx


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

    # 3) KALORIE – możemy wziąć z raw_data, ale wysokości już NIE
    calories = None
    try:
        raw = w.raw_data or {}
        if isinstance(raw, dict):
            calories = raw.get("calories") or raw.get("total_calories")
    except Exception:
        calories = None

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
