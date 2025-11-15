import json

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt

from .models import Workout


@login_required
def list_workouts(request: HttpRequest) -> JsonResponse:
  workouts = (
	  Workout.objects.filter(user=request.user)
	  .order_by("-created_at")
	  .values("id", "title", "distance_m", "duration_ms", "created_at")
  )
  return JsonResponse({"workouts": list(workouts)})


@csrf_exempt
@login_required
def upload_workout(request: HttpRequest) -> JsonResponse:
  if request.method != "POST":
	  return JsonResponse({"error": "Only POST allowed"}, status=405)

  try:
	  body = request.body.decode("utf-8")
	  data = json.loads(body)
  except Exception:
	  return JsonResponse({"error": "Invalid JSON body"}, status=400)

  # próbujemy wyciągnąć sensowne pola z przykładowej struktury
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
	  source="json",
	  title=title,
	  distance_m=distance_m,
	  duration_ms=duration_ms,
	  raw_data=data,
  )

  return JsonResponse({"id": workout.id, "title": workout.title}, status=201)


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
