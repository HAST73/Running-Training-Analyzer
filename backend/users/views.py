from django.http import JsonResponse, HttpResponseRedirect
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.conf import settings
from django.urls import reverse
from datetime import datetime, timezone as dt_timezone, timedelta
from django.db import IntegrityError
import json
import os
import requests
from payments.models import Payment

from .models import UserProfile, ActivityLog


def session(request):
    if request.user.is_authenticated:
        profile = getattr(request.user, "profile", None)
        needs_measurements = False
        height_cm = None
        weight_kg = None
        strava_linked = False # Domyślnie false

        if profile:
            height_cm = profile.height_cm
            weight_kg = profile.weight_kg
            needs_measurements = (profile.height_cm is None or profile.weight_kg is None)
            # Sprawdź czy są tokeny
            if profile.strava_access_token:
                strava_linked = True

        pro_unlocked = Payment.objects.filter(user=request.user, status="paid").exists()
        needs_username = False
        
        return JsonResponse({
            "authenticated": True,
            "username": request.user.username,
            "height_cm": height_cm,
            "weight_kg": float(weight_kg) if weight_kg is not None else None,
            "needs_measurements": needs_measurements,
            "pro_unlocked": pro_unlocked,
            "needs_username": needs_username,
            "strava_linked": strava_linked, # <-- DODANO TO
        })
    return JsonResponse({"authenticated": False})

def strava_status(request):
    """Zwraca status połączenia ze Stravą dla Reacta."""
    if not request.user.is_authenticated:
        return JsonResponse({"linked": False})
    
    profile = getattr(request.user, "profile", None)
    is_linked = False
    if profile and profile.strava_access_token:
        is_linked = True
        
    return JsonResponse({"linked": is_linked})

def strava_connect_json(request):
    """Zwraca URL autoryzacji w JSON (dla przycisku w React)."""
    if not STRAVA_CLIENT_ID:
        return JsonResponse({"error": "STRAVA_CLIENT_ID not set"}, status=500)
    
    redirect_uri = request.build_absolute_uri(STRAVA_REDIRECT_PATH)
    scope = "read,activity:read"
    auth_url = (
        f"https://www.strava.com/oauth/authorize?client_id={STRAVA_CLIENT_ID}&response_type=code&redirect_uri={redirect_uri}&approval_prompt=auto&scope={scope}"
    )
    return JsonResponse({"auth_url": auth_url})

@csrf_exempt
def strava_unlink(request):
    """Usuwa tokeny Stravy z profilu."""
    if not request.user.is_authenticated:
        return JsonResponse({"error": "Auth required"}, status=401)
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    
    profile = getattr(request.user, "profile", None)
    if profile:
        # Czyścimy tokeny
        profile.strava_access_token = None
        profile.strava_refresh_token = None
        profile.strava_token_expires_at = None
        # Opcjonalnie: czyścimy ID, jeśli chcemy całkowitego resetu, 
        # ale zazwyczaj ID zostawia się, by uniknąć duplikatów w przyszłości.
        # Jeśli chcesz pełnego rozłączenia:
        # profile.strava_athlete_id = None 
        profile.save()
        
    return JsonResponse({"status": "ok"})


@csrf_exempt
def register(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    try:
        data = json.loads(request.body.decode())
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    username = data.get("username")
    email = data.get("email")
    password = data.get("password")
    height_cm = data.get("height_cm")
    weight_kg = data.get("weight_kg")

    # ZMIANA: Dodano height_cm i weight_kg do wymaganych pól
    if not all([username, email, password, height_cm, weight_kg]):
        return JsonResponse({"error": "Wszystkie pola (nazwa, email, hasło, wzrost, waga) są wymagane"}, status=400)

    # Walidacja liczbowa wzrostu i wagi
    try:
        h_val = int(height_cm)
        w_val = float(weight_kg)
        if h_val <= 0 or w_val <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return JsonResponse({"error": "Wzrost i waga muszą być prawidłowymi liczbami dodatnimi"}, status=400)

    # Basic validations
    import re
    # Username uniqueness
    if User.objects.filter(username=username).exists():
        return JsonResponse({"error": "Username taken"}, status=409)
    # Email format
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        return JsonResponse({"error": "Invalid email format"}, status=400)
    # Email uniqueness
    if User.objects.filter(email__iexact=email).exists():
        return JsonResponse({"error": "Email taken"}, status=409)
    # Password strength: min 8, at least one uppercase and one special char
    if len(password) < 8 or not re.search(r"[A-Z]", password) or not re.search(r"[^A-Za-z0-9]", password):
        return JsonResponse({"error": "Weak password"}, status=400)

    # Tworzenie użytkownika
    user = User.objects.create_user(username=username, email=email, password=password)
    
    # ZMIANA: Tworzenie profilu od razu z wymaganymi danymi
    UserProfile.objects.create(
        user=user,
        height_cm=h_val,
        weight_kg=w_val
    )

    ActivityLog.objects.create(user=user, action="register", metadata={"email": email})
    return JsonResponse({"status": "ok", "username": username})


@csrf_exempt
def login(request):
	if request.method != "POST":
		return JsonResponse({"error": "POST required"}, status=405)
	try:
		data = json.loads(request.body.decode())
	except json.JSONDecodeError:
		return JsonResponse({"error": "Invalid JSON"}, status=400)
	username = data.get("username")
	password = data.get("password")
	user = authenticate(request, username=username, password=password)
	if user is None:
		return JsonResponse({"error": "Invalid credentials"}, status=401)
	auth_login(request, user)
	ActivityLog.objects.create(user=user, action="login")
	return JsonResponse({"status": "ok", "username": user.username})


@csrf_exempt
def logout(request):
	if request.user.is_authenticated:
		ActivityLog.objects.create(user=request.user, action="logout")
		auth_logout(request)
	return JsonResponse({"status": "ok"})


# ---- Strava OAuth (simplified) ----
STRAVA_CLIENT_ID = os.environ.get("STRAVA_CLIENT_ID", "")
STRAVA_CLIENT_SECRET = os.environ.get("STRAVA_CLIENT_SECRET", "")
STRAVA_REDIRECT_PATH = "/oauth/strava/callback/"
# Where to send user after successful OAuth; default to CRA dev server (use 127.0.0.1 to match cookie host)
FRONTEND_REDIRECT_URL = os.environ.get("FRONTEND_REDIRECT_URL", "http://127.0.0.1:3000/#home")


def strava_login(request):
	if not STRAVA_CLIENT_ID:
		return JsonResponse({"error": "STRAVA_CLIENT_ID not set"}, status=500)
	redirect_uri = request.build_absolute_uri(STRAVA_REDIRECT_PATH)
	scope = "read,activity:read"
	auth_url = (
		f"https://www.strava.com/oauth/authorize?client_id={STRAVA_CLIENT_ID}&response_type=code&redirect_uri={redirect_uri}&approval_prompt=auto&scope={scope}"
	)
	return HttpResponseRedirect(auth_url)


def strava_callback(request):
	code = request.GET.get("code")
	if not code:
		return JsonResponse({"error": "Missing code"}, status=400)
	if not STRAVA_CLIENT_ID or not STRAVA_CLIENT_SECRET:
		return JsonResponse({"error": "Client credentials not set"}, status=500)

	token_resp = requests.post("https://www.strava.com/oauth/token", data={
		"client_id": STRAVA_CLIENT_ID,
		"client_secret": STRAVA_CLIENT_SECRET,
		"code": code,
		"grant_type": "authorization_code",
	})
	if token_resp.status_code != 200:
		return JsonResponse({"error": "Strava token exchange failed", "details": token_resp.text}, status=502)
	token_data = token_resp.json()

	athlete = token_data.get("athlete", {})
	access_token = token_data.get("access_token")
	refresh_token = token_data.get("refresh_token")
	expires_at = token_data.get("expires_at")
	expires_in = token_data.get("expires_in")

	athlete_id = str(athlete.get("id")) if athlete.get("id") is not None else None
	existing_profile = None
	if athlete_id:
		existing_profile = UserProfile.objects.filter(strava_athlete_id=athlete_id).select_related("user").first()

	import secrets
	profile = None
	if existing_profile:
		# Reużyj istniejącego profilu i zaloguj jego użytkownika
		auth_login(request, existing_profile.user)
		profile = existing_profile
	else:
		if request.user.is_authenticated:
			# Użyj obecnego użytkownika – przypnij athlete_id jeśli brak
			profile = getattr(request.user, "profile", None)
			if profile and athlete_id:
				profile.strava_athlete_id = athlete_id
			if not profile:
				try:
					profile = UserProfile.objects.create(user=request.user, strava_athlete_id=athlete_id)
				except IntegrityError:
					# Wyścig: ktoś już utworzył – pobierz i użyj
					profile = UserProfile.objects.filter(strava_athlete_id=athlete_id).first()
					if profile:
						auth_login(request, profile.user)
		else:
			# Brak zalogowanego i brak istniejącego profilu – tworzymy świeżego usera + profil
			base_username = f"strava_{athlete_id}" if athlete_id else "strava_user"
			username = base_username
			counter = 1
			while User.objects.filter(username=username).exists():
				counter += 1
				username = f"{base_username}_{counter}"
			password = secrets.token_urlsafe(12)
			user = User.objects.create_user(username=username, password=password, email=athlete.get("email", ""))
			try:
				profile = UserProfile.objects.create(user=user, strava_athlete_id=athlete_id)
			except IntegrityError:
				# Jeśli constraint zadziałał, pobierz istniejący i zaloguj jego właściciela
				profile = UserProfile.objects.filter(strava_athlete_id=athlete_id).first()
				if profile:
					user = profile.user
			auth_login(request, user)

	# Aktualizacja tokenów na wybranym profilu
	if profile and athlete_id:
		profile.strava_athlete_id = athlete_id
	profile.strava_access_token = access_token
	profile.strava_refresh_token = refresh_token
	if isinstance(expires_at, (int, float)):
		profile.strava_token_expires_at = datetime.fromtimestamp(int(expires_at), tz=dt_timezone.utc)
	elif isinstance(expires_in, (int, float)):
		profile.strava_token_expires_at = timezone.now() + timedelta(seconds=int(expires_in))
	profile.save()
	ActivityLog.objects.create(user=request.user, action="strava_link", metadata={"athlete_id": athlete.get("id")})
	# Explicitly save session to ensure cookie set before redirect
	request.session.save()
	# Redirect back to frontend app (SPA)
	return HttpResponseRedirect(FRONTEND_REDIRECT_URL)


@csrf_exempt
def profile(request):
	"""GET returns current anthropometrics; POST updates them."""
	if not request.user.is_authenticated:
		return JsonResponse({"error": "auth required"}, status=401)
	profile = request.user.profile
	if request.method == "GET":
		return JsonResponse({
			"username": request.user.username,
			"height_cm": profile.height_cm,
			"weight_kg": float(profile.weight_kg) if profile.weight_kg is not None else None,
		})
	if request.method != "POST":
		return JsonResponse({"error": "Method not allowed"}, status=405)
	try:
		data = json.loads(request.body.decode())
	except json.JSONDecodeError:
		return JsonResponse({"error": "Invalid JSON"}, status=400)
	# Aktualizacja nazwy użytkownika (opcjonalna)
	new_username = (data.get("username") or "").strip()
	height_cm = data.get("height_cm")
	weight_kg = data.get("weight_kg")
	changed = {}
	# Najpierw nazwa użytkownika, aby zwrócić sensowny błąd zajętej nazwy
	if new_username:
		# Jeżeli to ta sama nazwa – ignoruj
		if new_username != request.user.username:
			# Prosta walidacja – tylko litery/cyfry/._-
			import re
			if not re.match(r"^[A-Za-z0-9._-]{3,32}$", new_username):
				return JsonResponse({"error": "Nieprawidłowa nazwa (3-32 znaki, litery/cyfry . _ -)"}, status=400)
			# Sprawdź unikalność
			if User.objects.filter(username=new_username).exclude(id=request.user.id).exists():
				return JsonResponse({"error": "Nazwa użytkownika zajęta"}, status=409)
			request.user.username = new_username
			request.user.save(update_fields=["username"])
			changed["username"] = new_username
	try:
		if height_cm is not None and str(height_cm).strip() != "":
			profile.height_cm = int(height_cm)
			changed["height_cm"] = profile.height_cm
		if weight_kg is not None and str(weight_kg).strip() != "":
			profile.weight_kg = float(weight_kg)
			changed["weight_kg"] = float(profile.weight_kg)
		profile.save()
	except (ValueError, TypeError):
		return JsonResponse({"error": "Invalid values"}, status=400)
	ActivityLog.objects.create(user=request.user, action="profile_update", metadata=changed)
	return JsonResponse({"status": "ok", **changed})


def check_username(request):
	"""Simple availability check used by frontend (GET). Returns {available: true/false/null}.
	If username is empty returns available=null."""
	if request.method != 'GET':
		return JsonResponse({"error": "GET required"}, status=405)
	username = (request.GET.get('username') or '').strip()
	if not username:
		return JsonResponse({"available": None})
	available = not User.objects.filter(username=username).exists()
	return JsonResponse({"available": available})


def check_email(request):
	"""Simple availability check for email (GET). Returns {available: true/false/null}."""
	if request.method != 'GET':
		return JsonResponse({"error": "GET required"}, status=405)
	email = (request.GET.get('email') or '').strip()
	if not email:
		return JsonResponse({"available": None})
	# case-insensitive check
	available = not User.objects.filter(email__iexact=email).exists()
	return JsonResponse({"available": available})


@csrf_exempt
def recent_activity(request):
	"""Return recent activity log items for the current user.

	Query params:
	  - `limit`: number of items to return (default 20, min 5, max 50)
	"""
	if not request.user.is_authenticated:
		return JsonResponse({"error": "auth required"}, status=401)
	if request.method != "GET":
		return JsonResponse({"error": "Method not allowed"}, status=405)

	try:
		limit = int(request.GET.get("limit", "20"))
	except ValueError:
		limit = 20
	limit = max(5, min(50, limit))

	logs = ActivityLog.objects.filter(user=request.user).order_by("-created_at")[:limit]
	items = [
		{
			"id": log.id,
			"action": log.action,
			"metadata": log.metadata or {},
			"created_at": log.created_at.isoformat(),
		}
		for log in logs
	]
	return JsonResponse({"items": items})


@csrf_exempt
def delete_activity(request, activity_id: int):
	"""Delete a single activity log entry of the current user."""
	if not request.user.is_authenticated:
		return JsonResponse({"error": "auth required"}, status=401)
	if request.method != "DELETE":
		return JsonResponse({"error": "Method not allowed"}, status=405)
	try:
		log = ActivityLog.objects.get(id=activity_id, user=request.user)
	except ActivityLog.DoesNotExist:
		return JsonResponse({"error": "not found"}, status=404)
	log.delete()
	return JsonResponse({"ok": True})


@csrf_exempt
def clear_activity(request):
	"""Clear all activity logs for the current user."""
	if not request.user.is_authenticated:
		return JsonResponse({"error": "auth required"}, status=401)
	if request.method not in ("POST", "DELETE"):
		return JsonResponse({"error": "Method not allowed"}, status=405)
	ActivityLog.objects.filter(user=request.user).delete()
	return JsonResponse({"ok": True})
