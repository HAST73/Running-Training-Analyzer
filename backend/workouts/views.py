import json
import math
from io import BytesIO

from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt

from fitparse import FitFile
from users.models import UserProfile

from .models import Workout


@login_required
def list_workouts(request: HttpRequest) -> JsonResponse:
    workouts = (
        Workout.objects.filter(user=request.user)
        .order_by("-created_at")
        .values(
            "id",
            "title",
            "distance_m",
            "duration_ms",
            "created_at",
            "performed_at",
            "source",
            "manual",
            "gpx_file",
        )
    )
    return JsonResponse({"workouts": list(workouts)})


@login_required
def last_workout(request: HttpRequest) -> JsonResponse:
    """Return workout closest to today (by performed_at or created_at).

    If there are no workouts, returns {"workout": null}.
    """
    from django.utils import timezone

    today = timezone.now()
    qs = Workout.objects.filter(user=request.user)
    if not qs.exists():
        return JsonResponse({"workout": None})

    # Prefer performed_at; fall back to created_at when performed_at is null
    closest = min(
        qs,
        key=lambda w: abs(((w.performed_at or w.created_at) or today) - today),
    )

    workout_data = {
        "id": closest.id,
        "title": closest.title,
        "distance_m": closest.distance_m,
        "duration_ms": closest.duration_ms,
        "performed_at": closest.performed_at,
        "created_at": closest.created_at,
        "source": closest.source,
        "manual": closest.manual,
    }

    # Optional extra stats from raw_data if available
    raw = closest.raw_data or {}
    calories = None
    elevation_gain = None
    if isinstance(raw, dict):
        calories = raw.get("calories") or raw.get("total_calories")
        elevation_gain = raw.get("elevation_gain") or raw.get("total_elevation_gain")

    workout_data["calories"] = calories
    workout_data["elevation_gain"] = elevation_gain

    return JsonResponse({"workout": workout_data})


@login_required
def weekly_summary(request: HttpRequest) -> JsonResponse:
    """Return summary of runs for a given period.

    Query param "period" can be:
      - "7d"   (default) – ostatnie 7 dni, bucket = dzień
      - "30d"            – ostatnie 30 dni, bucket = tydzień
      - "year"           – ostatnie 12 miesięcy, bucket = miesiąc
    """
    from django.utils import timezone
    from datetime import timedelta, date

    period = request.GET.get("period", "7d")
    end = timezone.now().date()

    # Ustalamy zakres dat i typ bucketu
    if period == "30d":
        days = 30
        bucket = "week"
    elif period == "year":
        days = 365
        bucket = "month"
    else:
        days = 7
        bucket = "day"

    start = end - timedelta(days=days - 1)

    # Treningi użytkownika w tym zakresie – bierzemy performed_at, a jak go nie ma, created_at
    qs = Workout.objects.filter(user=request.user).filter(
        Q(performed_at__date__gte=start, performed_at__date__lte=end)
        | Q(
            performed_at__isnull=True,
            created_at__date__gte=start,
            created_at__date__lte=end,
        )
    )

    # --------- BUCKET: MIESIĄCE (ostatnie 12 miesięcy) ---------
    if bucket == "month":
        from collections import OrderedDict

        # Budujemy 12 miesięcy wstecz od końca (end)
        y, m = end.year, end.month
        buckets = OrderedDict()
        for _ in range(12):
            key = f"{y:04d}-{m:02d}"  # np. "2025-11"
            buckets[key] = 0.0
            m -= 1
            if m == 0:
                m = 12
                y -= 1

        # Sumujemy dystans do odpowiednich miesięcy
        for w in qs:
            dt = w.performed_at or w.created_at
            if dt and w.distance_m:
                key = dt.strftime("%Y-%m")
                if key in buckets:
                    buckets[key] += float(w.distance_m)

        items = [{"label": key, "distance_m": dist} for key, dist in buckets.items()]
        total_distance = sum(buckets.values())

    # --------- BUCKET: TYGODNIE (ostatnie 30 dni) ---------
    elif bucket == "week":
        from datetime import timedelta as td

        def week_start(d: date) -> date:
            # poniedziałek tygodnia d
            return d - td(days=d.weekday())

        buckets: dict[date, float] = {}

        # inicjalizujemy tygodnie w zakresie
        for i in range(30):
            day = start + td(days=i)
            ws = week_start(day)
            if start <= ws <= end:
                buckets.setdefault(ws, 0.0)

        for w in qs:
            dt = w.performed_at or w.created_at
            if dt and w.distance_m:
                day = dt.date()
                if start <= day <= end:
                    ws = week_start(day)
                    if ws in buckets:
                        buckets[ws] += float(w.distance_m)

        items = [
            {"label": d.isoformat(), "distance_m": buckets[d]}
            for d in sorted(buckets.keys())
        ]
        total_distance = sum(buckets.values())

    # --------- BUCKET: DNI (ostatnie 7 dni) ---------
    else:
        from datetime import timedelta as td

        dist_by_day = {start + td(days=i): 0.0 for i in range(7)}
        for w in qs:
            dt = w.performed_at or w.created_at
            if dt and w.distance_m:
                day = dt.date()
                if day in dist_by_day:
                    dist_by_day[day] += float(w.distance_m)

        items = [
            {"label": d.isoformat(), "distance_m": dist_by_day[d]}
            for d in sorted(dist_by_day.keys())
        ]
        total_distance = sum(dist_by_day.values())

    return JsonResponse({"items": items, "total_distance_m": total_distance})


@csrf_exempt
@login_required
def upload_gpx(request: HttpRequest, workout_id: int) -> JsonResponse:
    """Attach a GPX file to an existing workout.

    Front-end sends multipart/form-data with field "file".
    """
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)

    file = request.FILES.get("file")
    if not file:
        return JsonResponse({"error": "No GPX file provided"}, status=400)

    try:
        workout = Workout.objects.get(id=workout_id, user=request.user)
    except Workout.DoesNotExist:
        return JsonResponse({"error": "Workout not found"}, status=404)

    workout.gpx_file = file
    workout.save(update_fields=["gpx_file"])

    return JsonResponse(
        {"ok": True, "gpx_file": workout.gpx_file.url if workout.gpx_file else None}
    )


@csrf_exempt
@login_required
def import_strava_workouts(request: HttpRequest) -> JsonResponse:
    """Import all Strava run activities for the current user using Strava API.

    Requires that the user has linked their Strava account (tokens stored in UserProfile).
    """
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)

    try:
        profile = request.user.profile
    except UserProfile.DoesNotExist:
        return JsonResponse(
            {
                "error": "Brak powiązanego profilu Strava. Połącz konto w ustawieniach."
            },
            status=400,
        )

    from django.utils import timezone
    import os
    import requests

    client_id = os.environ.get("STRAVA_CLIENT_ID")
    client_secret = os.environ.get("STRAVA_CLIENT_SECRET")
    if not client_id or not client_secret:
        return JsonResponse(
            {"error": "Brak konfiguracji STRAVA_CLIENT_ID/SECRET"}, status=500
        )

    # Odśwież token, jeśli wygasł lub za chwilę wygaśnie
    now = timezone.now()
    if not profile.strava_access_token:
        return JsonResponse(
            {"error": "Konto Strava nie jest połączone."}, status=400
        )
    if profile.strava_token_expires_at and profile.strava_token_expires_at <= now:
        refresh_resp = requests.post(
            "https://www.strava.com/oauth/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "grant_type": "refresh_token",
                "refresh_token": profile.strava_refresh_token,
            },
        )
        if refresh_resp.status_code != 200:
            return JsonResponse(
                {
                    "error": "Nie udało się odświeżyć tokenu Strava.",
                    "details": refresh_resp.text,
                },
                status=502,
            )
        refresh_data = refresh_resp.json()
        profile.strava_access_token = refresh_data.get(
            "access_token", profile.strava_access_token
        )
        profile.strava_refresh_token = refresh_data.get(
            "refresh_token", profile.strava_refresh_token
        )
        from datetime import datetime, timezone as dt_timezone

        expires_at = refresh_data.get("expires_at")
        if isinstance(expires_at, (int, float)):
            profile.strava_token_expires_at = datetime.fromtimestamp(
                int(expires_at), tz=dt_timezone.utc
            )
        profile.save()

    access_token = profile.strava_access_token

    headers = {"Authorization": f"Bearer {access_token}"}
    page = 1
    per_page = 50
    imported = 0

    from datetime import datetime as dt

    while True:
        resp = requests.get(
            "https://www.strava.com/api/v3/athlete/activities",
            params={"page": page, "per_page": per_page},
            headers=headers,
        )
        if resp.status_code != 200:
            return JsonResponse(
                {
                    "error": "Błąd podczas pobierania aktywności ze Stravy.",
                    "details": resp.text,
                },
                status=502,
            )
        activities = resp.json()
        if not activities:
            break

        for act in activities:
            # Interesują nas tylko biegi
            if act.get("type") != "Run":
                continue

            strava_id = act.get("id")
            if not strava_id:
                continue

            # Unikamy duplikatów
            if Workout.objects.filter(
                user=request.user, external_id=str(strava_id), source="strava"
            ).exists():
                continue

            distance_m = act.get("distance")  # w metrach
            duration_ms = None
            moving_time = act.get("moving_time")  # sekundy
            if moving_time is not None:
                duration_ms = int(moving_time) * 1000

            performed_at = None
            title = act.get("name") or "Strava bieg"
            start_date_str = act.get("start_date")
            if start_date_str:
                try:
                    start_dt = dt.fromisoformat(start_date_str.replace("Z", "+00:00"))
                    performed_at = start_dt
                    title = f"Strava bieg {start_dt.date()}"
                except Exception:
                    performed_at = None

            Workout.objects.create(
                user=request.user,
                external_id=str(strava_id),
                source="strava",
                manual=False,
                title=title,
                performed_at=performed_at,
                distance_m=distance_m,
                duration_ms=duration_ms,
                raw_data=act,
            )
            imported += 1

        if len(activities) < per_page:
            break
        page += 1

    return JsonResponse({"imported": imported}, status=201)


@csrf_exempt
@login_required
def upload_workout(request: HttpRequest) -> JsonResponse:
    """
    Upload workout from Adidas JSON or Strava FIT.

    Front-end może:
    - wysłać JSON w body (Content-Type: application/json)  -> Adidas
    - wysłać multipart/form-data z plikiem .json           -> Adidas
    - wysłać multipart/form-data z plikiem .fit            -> Strava
    """
    if request.method != "POST":
        return JsonResponse({"error": "Only POST allowed"}, status=405)

    content_type = request.content_type or ""

    # 1) Czysty JSON w body (Adidas)
    if content_type.startswith("application/json"):
        try:
            body = request.body.decode("utf-8")
            data = json.loads(body)
        except Exception:
            return JsonResponse({"error": "Invalid JSON body"}, status=400)

        # Rozpoznaj typ ładunku: Adidas activity z features vs lista punktów GPS
        if _is_trackpoints_payload(data):
            return _handle_trackpoints_json(request, data)
        return _handle_adidas_json(request, data)

    # 2) multipart/form-data – plik (Adidas JSON albo Strava FIT)
    if content_type.startswith("multipart/form-data"):
        file = request.FILES.get("file")
        if not file:
            return JsonResponse({"error": "No file provided"}, status=400)

        # wczytujemy zawartość tylko raz
        content = file.read()

        # Proste logowanie diagnostyczne formatu (tylko na czas debugowania)
        try:
            raw_debug = content.decode("utf-8", errors="ignore")
            # ucinamy, żeby nie spamować logów
            snippet = raw_debug[:500]
            print("[UPLOAD_WORKOUT] Raw file snippet:", snippet)
        except Exception:
            pass

        # --- spróbuj jako Adidas JSON / lista punktów ---
        try:
            raw = content.decode("utf-8")
            data = json.loads(raw)
            if _is_trackpoints_payload(data):
                return _handle_trackpoints_json(request, data)
            return _handle_adidas_json(request, data)
        except Exception:
            pass  # nie wygląda jak poprawny JSON Adidasa

        # --- spróbuj jako FIT (Strava) ---
        try:
            fit = FitFile(BytesIO(content))
            return _handle_strava_fit(request, fit, original_name=file.name)
        except Exception as exc:
            return JsonResponse(
                {
                    "error": "Unsupported or invalid file (expected Adidas JSON or Strava FIT)",
                    "details": str(exc),
                },
                status=400,
            )

    # 3) fallback – jeśli body wygląda jak JSON, potraktuj jak Adidas
    try:
        body = request.body.decode("utf-8")
        data = json.loads(body)
        return _handle_adidas_json(request, data)
    except Exception:
        return JsonResponse({"error": "Unsupported content type"}, status=400)


# ---------- ADIDAS JSON PARSER (POPRAWIONY) ----------


def _find_adidas_activity(payload):
    """
    Szuka w dowolnej strukturze (dict / list) pierwszego obiektu,
    który ma klucz "features" – to zazwyczaj pojedynczy trening.
    """
    if isinstance(payload, dict):
        if "features" in payload:
            return payload
        for value in payload.values():
            found = _find_adidas_activity(value)
            if found is not None:
                return found
    elif isinstance(payload, list):
        for item in payload:
            found = _find_adidas_activity(item)
            if found is not None:
                return found
    return None



def _is_trackpoints_payload(data) -> bool:
    """Heurystycznie sprawdza, czy to lista punktów GPS (lat/lon/timestamp).

    Akceptujemy listę słowników zawierających przynajmniej 'latitude' i 'longitude'
    lub 'timestamp'.
    """
    if isinstance(data, list) and data:
        first = data[0]
        if isinstance(first, dict):
            keys = set(first.keys())
            has_coords = {"latitude", "longitude"}.issubset(keys)
            has_time = "timestamp" in keys
            return has_coords or has_time
    return False


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.asin(min(1.0, math.sqrt(a)))
    return R * c


def _handle_trackpoints_json(request: HttpRequest, points) -> JsonResponse:
    """Tworzy Workout na podstawie listy punktów GPS (Adidas – surowe trackpoints).

    Oczekuje listy słowników z polami: latitude, longitude, timestamp (ms).
    Dystans liczony z par kolejnych punktów (haversine), czas z zakresu timestampów.
    """
    if not isinstance(points, list) or len(points) < 2:
        return JsonResponse({"error": "Za mało punktów śladu GPS"}, status=400)

    # Filtrujemy punkty z wymaganymi polami i sortujemy po czasie, jeśli dostępny
    cleaned = []
    for p in points:
        if not isinstance(p, dict):
            continue
        lat = p.get("latitude")
        lon = p.get("longitude")
        ts = p.get("timestamp")
        if lat is None or lon is None:
            continue
        cleaned.append({"lat": float(lat), "lon": float(lon), "ts": ts})

    if len(cleaned) < 2:
        return JsonResponse({"error": "Brak wystarczających danych GPS"}, status=400)

    cleaned.sort(key=lambda x: (x["ts"] is None, x["ts"]))  # None na końcu

    total_m = 0.0
    prev = cleaned[0]
    for cur in cleaned[1:]:
        total_m += _haversine_m(prev["lat"], prev["lon"], cur["lat"], cur["lon"])
        prev = cur

    # Czas trwania – jeśli mamy znaczniki czasu (ms od epoki)
    start_ts = next((c["ts"] for c in cleaned if isinstance(c["ts"], (int, float))), None)
    end_ts = next((c["ts"] for c in reversed(cleaned) if isinstance(c["ts"], (int, float))), None)
    duration_ms = None
    performed_at = None
    if isinstance(start_ts, (int, float)) and isinstance(end_ts, (int, float)) and end_ts >= start_ts:
        duration_ms = int(end_ts - start_ts)
        from datetime import datetime, timezone as dt_timezone
        performed_at = datetime.fromtimestamp(start_ts / 1000.0, tz=dt_timezone.utc)

    title = "Trening"
    if total_m:
        title = f"Trening {total_m/1000.0:.1f} km"

    workout = Workout.objects.create(
        user=request.user,
        external_id=None,
        source="adidas",
        manual=True,
        performed_at=performed_at,
        title=title,
        distance_m=float(total_m) or None,
        duration_ms=duration_ms,
        raw_data={
            "source": "adidas_trackpoints",
            "points_count": len(cleaned),
        },
    )

    return JsonResponse(
        {"id": workout.id, "title": workout.title, "source": workout.source},
        status=201,
    )


def _handle_adidas_json(request: HttpRequest, data) -> JsonResponse:
    """
    Tworzy Workout z Adidas Running JSON.

    Obsługuje zarówno pojedynczy obiekt, jak i listę obiektów
    (np. eksport kilku treningów). Bierzemy pierwszy obiekt z
    polem "features".
    """
    # Jeśli dostaliśmy listę, spróbujmy znaleźć w niej pierwszy obiekt z features
    if isinstance(data, list):
        candidate = _find_adidas_activity(data)
        if candidate is None:
            return JsonResponse(
                {"error": "Nie znaleziono danych treningu (brak pola 'features')."},
                status=400,
            )
        activity = candidate
    elif isinstance(data, dict):
        # Pojedynczy obiekt – jeśli ma features, użyj go wprost,
        # jeśli nie, spróbuj poszukać głębiej
        if "features" in data:
            activity = data
        else:
            candidate = _find_adidas_activity(data)
            if candidate is None:
                return JsonResponse(
                    {"error": "Nie znaleziono danych treningu (brak pola 'features')."},
                    status=400,
                )
            activity = candidate
    else:
        return JsonResponse(
            {"error": "Nieprawidłowy format danych Adidas (oczekiwano JSONa)."},
            status=400,
        )

    external_id = activity.get("id")
    duration_ms = activity.get("duration") or activity.get("duration_ms")

    distance_m = None
    performed_at = None
    features = activity.get("features") or []

    # dystans
    for f in features:
        if f.get("type") == "track_metrics":
            attrs = f.get("attributes") or {}
            distance_m = attrs.get("distance")
            break

    # data rozpoczęcia
    for f in features:
        if f.get("type") == "initial_values":
            attrs = f.get("attributes") or {}
            start_ms = attrs.get("start_time")
            if start_ms is not None:
                from datetime import datetime, timezone as dt_timezone
                performed_at = datetime.fromtimestamp(
                    start_ms / 1000.0, tz=dt_timezone.utc
                )
            break

    title = "Trening"
    if distance_m:
        km = distance_m / 1000.0
        title = f"Trening {km:.1f} km"

    workout = Workout.objects.create(
        user=request.user,
        external_id=external_id,
        source="adidas",
        manual=True,
        performed_at=performed_at,
        title=title,
        distance_m=distance_m,
        duration_ms=duration_ms,
        raw_data=activity,
    )

    return JsonResponse(
        {"id": workout.id, "title": workout.title, "source": workout.source},
        status=201,
    )



# ---------- STRAVA FIT PARSER (bez zmian merytorycznych) ----------


def _handle_strava_fit(
    request: HttpRequest, fit: FitFile, original_name: str | None = None
) -> JsonResponse:
    """Parse a Strava FIT file and create a Workout.

    We extract basic summary: total distance, total duration and a simple title.
    """
    total_distance_m = 0.0
    total_timer_time = 0.0
    start_time = None

    for record in fit.get_messages("session"):
        data = {d.name: d.value for d in record}
        if "total_distance" in data and data["total_distance"] is not None:
            total_distance_m = float(data["total_distance"])
        if "total_timer_time" in data and data["total_timer_time"] is not None:
            total_timer_time = float(data["total_timer_time"]) * 1000.0  # s -> ms
        if not start_time and "start_time" in data:
            start_time = data["start_time"]

    # Fallback: try activity messages if session is missing
    if total_distance_m == 0.0:
        for record in fit.get_messages("activity"):
            data = {d.name: d.value for d in record}
            if "total_timer_time" in data and data["total_timer_time"] is not None:
                total_timer_time = float(data["total_timer_time"]) * 1000.0

    title = "Trening Strava"
    if total_distance_m:
        km = total_distance_m / 1000.0
        title = f"Strava {km:.1f} km"
    elif original_name:
        title = f"Strava: {original_name}"

    # FIT object is not JSON serializable; we store only a minimal summary as raw_data
    from datetime import datetime as dt, timezone as dt_timezone

    performed_at = None
    if start_time:
        if isinstance(start_time, (int, float)):
            performed_at = dt.fromtimestamp(start_time, tz=dt_timezone.utc)
        else:
            try:
                performed_at = start_time.astimezone(dt_timezone.utc)
            except Exception:
                performed_at = None

    raw_summary = {
        "source": "strava_fit",
        "file_name": original_name,
        "distance_m": total_distance_m,
        "duration_ms": total_timer_time,
        "start_time": performed_at.isoformat() if performed_at else None,
    }

    workout = Workout.objects.create(
        user=request.user,
        external_id=None,
        source="strava",
        manual=True,
        performed_at=performed_at,
        title=title,
        distance_m=total_distance_m or None,
        duration_ms=total_timer_time or None,
        raw_data=raw_summary,
    )

    return JsonResponse(
        {"id": workout.id, "title": workout.title, "source": workout.source},
        status=201,
    )


@csrf_exempt
@login_required
def delete_workout(request: HttpRequest, workout_id: int) -> JsonResponse:
    if request.method != "DELETE":
        return JsonResponse({"error": "Only DELETE allowed"}, status=405)

    try:
        workout = Workout.objects.get(id=workout_id, user=request.user)
    except Workout.DoesNotExist:
        return JsonResponse({"error": "Workout not found"}, status=404)

    workout.delete()
    return JsonResponse({"ok": True})
