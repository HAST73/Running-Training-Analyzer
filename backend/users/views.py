from django.http import JsonResponse, HttpResponseRedirect
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.conf import settings
from django.urls import reverse
from datetime import datetime, timezone as dt_timezone, timedelta
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
		if profile:
			height_cm = profile.height_cm
			weight_kg = profile.weight_kg
			needs_measurements = (profile.height_cm is None or profile.weight_kg is None)
		pro_unlocked = Payment.objects.filter(user=request.user, status="paid").exists()
		return JsonResponse({
			"authenticated": True,
			"username": request.user.username,
			"height_cm": height_cm,
			"weight_kg": float(weight_kg) if weight_kg is not None else None,
			"needs_measurements": needs_measurements,
			"pro_unlocked": pro_unlocked,
		})
	return JsonResponse({"authenticated": False})


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
	if not all([username, email, password]):
		return JsonResponse({"error": "username, email, password required"}, status=400)
	if User.objects.filter(username=username).exists():
		return JsonResponse({"error": "Username taken"}, status=409)

	height_cm = data.get("height_cm")
	weight_kg = data.get("weight_kg")
	user = User.objects.create_user(username=username, email=email, password=password)
	profile = UserProfile.objects.create(user=user)
	# Optional anthropometrics
	try:
		if height_cm is not None and str(height_cm).strip() != "":
			profile.height_cm = int(height_cm)
		if weight_kg is not None and str(weight_kg).strip() != "":
			profile.weight_kg = float(weight_kg)
		profile.save()
	except (ValueError, TypeError):
		pass
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

	if not request.user.is_authenticated:
		# Auto-create a local user if not logged in (simplified)
		username = f"strava_{athlete.get('id')}"
		user, _created = User.objects.get_or_create(username=username, defaults={"email": athlete.get("email", "")})
		if _created:
			UserProfile.objects.create(user=user, strava_athlete_id=str(athlete.get("id")))
		auth_login(request, user)
	profile = request.user.profile
	profile.strava_athlete_id = str(athlete.get("id"))
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
			"height_cm": profile.height_cm,
			"weight_kg": float(profile.weight_kg) if profile.weight_kg is not None else None,
		})
	if request.method != "POST":
		return JsonResponse({"error": "Method not allowed"}, status=405)
	try:
		data = json.loads(request.body.decode())
	except json.JSONDecodeError:
		return JsonResponse({"error": "Invalid JSON"}, status=400)
	height_cm = data.get("height_cm")
	weight_kg = data.get("weight_kg")
	changed = {}
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
