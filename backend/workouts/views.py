import json
from io import BytesIO

from django.contrib.auth.decorators import login_required
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
		.values("id", "title", "distance_m", "duration_ms", "created_at", "performed_at", "source", "manual")
	)
	return JsonResponse({"workouts": list(workouts)})


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
		return JsonResponse({"error": "Brak powiązanego profilu Strava. Połącz konto w ustawieniach."}, status=400)

	from django.utils import timezone
	import os
	import requests

	client_id = os.environ.get("STRAVA_CLIENT_ID")
	client_secret = os.environ.get("STRAVA_CLIENT_SECRET")
	if not client_id or not client_secret:
		return JsonResponse({"error": "Brak konfiguracji STRAVA_CLIENT_ID/SECRET"}, status=500)

	# Odśwież token, jeśli wygasł lub za chwilę wygaśnie
	now = timezone.now()
	if not profile.strava_access_token:
		return JsonResponse({"error": "Konto Strava nie jest połączone."}, status=400)
	if profile.strava_token_expires_at and profile.strava_token_expires_at <= now:
		refresh_resp = requests.post("https://www.strava.com/oauth/token", data={
			"client_id": client_id,
			"client_secret": client_secret,
			"grant_type": "refresh_token",
			"refresh_token": profile.strava_refresh_token,
		})
		if refresh_resp.status_code != 200:
			return JsonResponse({"error": "Nie udało się odświeżyć tokenu Strava.", "details": refresh_resp.text}, status=502)
		refresh_data = refresh_resp.json()
		profile.strava_access_token = refresh_data.get("access_token", profile.strava_access_token)
		profile.strava_refresh_token = refresh_data.get("refresh_token", profile.strava_refresh_token)
		from datetime import datetime, timezone as dt_timezone
		expires_at = refresh_data.get("expires_at")
		if isinstance(expires_at, (int, float)):
			profile.strava_token_expires_at = datetime.fromtimestamp(int(expires_at), tz=dt_timezone.utc)
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
			return JsonResponse({"error": "Błąd podczas pobierania aktywności ze Stravy.", "details": resp.text}, status=502)
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
			if Workout.objects.filter(user=request.user, external_id=str(strava_id), source="strava").exists():
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
	"""Upload workout from Adidas JSON or Strava FIT.

	Front-end should either:
	- send JSON body (Adidas export) with Content-Type application/json
	- send multipart/form-data with a .fit file (Strava)
	"""
	if request.method != "POST":
		return JsonResponse({"error": "Only POST allowed"}, status=405)

	content_type = request.content_type or ""
	if content_type.startswith("application/json"):
		# Adidas JSON
		try:
			body = request.body.decode("utf-8")
			data = json.loads(body)
		except Exception:
			return JsonResponse({"error": "Invalid JSON body"}, status=400)

		return _handle_adidas_json(request, data)

	elif content_type.startswith("multipart/form-data"):
		# Expecting a FIT file under "file" field
		fit_file = request.FILES.get("file")
		if not fit_file:
			return JsonResponse({"error": "No FIT file provided"}, status=400)

		try:
			fit_bytes = fit_file.read()
			fit = FitFile(BytesIO(fit_bytes))
			return _handle_strava_fit(request, fit, original_name=fit_file.name)
		except Exception as exc:  # pragma: no cover - defensive
			return JsonResponse({"error": f"Invalid FIT file: {exc}"}, status=400)

	else:
		return JsonResponse({"error": "Unsupported content type"}, status=400)


def _handle_adidas_json(request: HttpRequest, data: dict) -> JsonResponse:
	external_id = data.get("id")
	duration_ms = data.get("duration") or data.get("duration_ms")

	distance_m = None
	performed_at = None
	features = data.get("features") or []
	for f in features:
		if f.get("type") == "track_metrics":
			attrs = f.get("attributes") or {}
			distance_m = attrs.get("distance")
			break
	for f in features:
		if f.get("type") == "initial_values":
			attrs = f.get("attributes") or {}
			start_ms = attrs.get("start_time")
			if start_ms is not None:
				from datetime import datetime, timezone as dt_timezone
				performed_at = datetime.fromtimestamp(start_ms / 1000.0, tz=dt_timezone.utc)
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
		raw_data=data,
	)

	return JsonResponse({"id": workout.id, "title": workout.title, "source": workout.source}, status=201)


def _handle_strava_fit(request: HttpRequest, fit: FitFile, original_name: str | None = None) -> JsonResponse:
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

	return JsonResponse({"id": workout.id, "title": workout.title, "source": workout.source}, status=201)


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
