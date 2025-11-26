from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt

from events_scraper import fetch_poland_events, fetch_world_events

@csrf_exempt
def list_events(request: HttpRequest) -> JsonResponse:
    """Return upcoming running events for Poland and World."""
    if request.method != "GET":
        return JsonResponse({"error": "Only GET allowed"}, status=405)

    poland = []
    world = []
    
    # Sprawdzamy, czy w URL podano konkretny limit (np. ?limit=10 dla testów)
    limit_param = request.GET.get("limit")
    custom_limit = None
    
    if limit_param:
        try:
            custom_limit = int(limit_param)
        except (TypeError, ValueError):
            pass

    try:
        if custom_limit:
            # Jeśli ktoś ręcznie wpisał limit w URL, używamy go dla obu list
            poland = fetch_poland_events(limit=custom_limit)
            world = fetch_world_events(limit=custom_limit)
        else:
            # Jeśli nie ma parametru w URL, używamy domyślnych wartości ze scrapera
            # (czyli 200 dla Polski i 60 dla Świata)
            poland = fetch_poland_events()
            world = fetch_world_events()
            
    except Exception as exc:  # pragma: no cover - defensive
        return JsonResponse({"error": f"Failed to fetch events: {exc}"}, status=502)

    return JsonResponse({"poland": poland, "world": world})