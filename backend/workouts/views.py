import json
from io import BytesIO

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt

from fitparse import FitFile

from .models import Workout


@login_required
def list_workouts(request: HttpRequest) -> JsonResponse:
	workouts = (
		Workout.objects.filter(user=request.user)
		.order_by("-created_at")
		.values("id", "title", "distance_m", "duration_ms", "created_at", "source", "manual")
	)
	return JsonResponse({"workouts": list(workouts)})


@csrf_exempt
@login_required
def import_strava_workouts(request: HttpRequest) -> JsonResponse:
	"""Placeholder endpoint for importing all Strava workouts via API.

	For now, this only simulates an import by creating a sample Strava workout
	so that the frontend flow can be wired and tested.
	"""
	if request.method != "POST":
		return JsonResponse({"error": "Only POST allowed"}, status=405)

	# TODO: In the future, use user's Strava tokens to call Strava API
	# and import all run activities.
	title = "Strava przykładowy trening (API)"
	distance_m = 5000.0
	duration_ms = 25 * 60 * 1000  # 25 min

	workout = Workout.objects.create(
		user=request.user,
		external_id=None,
		source="strava",
		manual=False,
		title=title,
		distance_m=distance_m,
		duration_ms=duration_ms,
		raw_data={"source": "strava_api_dummy"},
	)

	return JsonResponse({"imported": 1, "created_id": workout.id}, status=201)


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
	features = data.get("features") or []
	for f in features:
		if f.get("type") == "track_metrics":
			attrs = f.get("attributes") or {}
			distance_m = attrs.get("distance")
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
	raw_summary = {
		"source": "strava_fit",
		"file_name": original_name,
		"distance_m": total_distance_m,
		"duration_ms": total_timer_time,
	}

	workout = Workout.objects.create(
		user=request.user,
		external_id=None,
		source="strava",
		manual=True,
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
