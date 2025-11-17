from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt

from events_scraper import fetch_poland_events, fetch_world_events


@csrf_exempt
def list_events(request: HttpRequest) -> JsonResponse:
	"""Return upcoming running events for Poland and World.

	Currently Poland events are scraped from maratonypolskie.pl, and
	"world" is left empty (placeholder for future external API).
	"""
	if request.method != "GET":
		return JsonResponse({"error": "Only GET allowed"}, status=405)

	poland = []
	world = []
	limit_param = request.GET.get("limit")
	try:
		limit = int(limit_param) if limit_param is not None else 100
	except (TypeError, ValueError):
		limit = 100

	try:
		poland = fetch_poland_events(limit=limit)
		world = fetch_world_events(limit=limit)
	except Exception as exc:  # pragma: no cover - defensive
		return JsonResponse({"error": f"Failed to fetch events: {exc}"}, status=502)

	return JsonResponse({"poland": poland, "world": world})
