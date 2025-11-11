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

from .models import UserProfile, ActivityLog


def session(request):
	if request.user.is_authenticated:
		return JsonResponse({"authenticated": True, "username": request.user.username})
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

	user = User.objects.create_user(username=username, email=email, password=password)
	UserProfile.objects.create(user=user)
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
