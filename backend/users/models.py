from django.db import models
from django.contrib.auth.models import User


class UserProfile(models.Model):
	user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
	# Pola związane ze Stravą (opcjonalne)
	# Unikalny identyfikator atlety Strava – po oczyszczeniu duplikatów ustawiamy unique=True
	strava_athlete_id = models.CharField(max_length=64, blank=True, null=True, unique=True)
	strava_access_token = models.CharField(max_length=255, blank=True, null=True)
	strava_refresh_token = models.CharField(max_length=255, blank=True, null=True)
	strava_token_expires_at = models.DateTimeField(blank=True, null=True)
	# Antropometria (opcjonalna, do dokładniejszych obliczeń kalorii i personalizacji)
	height_cm = models.PositiveSmallIntegerField(blank=True, null=True)
	weight_kg = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
	# Czy użytkownik ustalił już swoją docelową nazwę (po technicznym strava_XXXX)
	username_finalized = models.BooleanField(default=False)

	def __str__(self) -> str:
		return f"Profile({self.user.username})"


class ActivityLog(models.Model):
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="activity_logs")
	action = models.CharField(max_length=128)
	metadata = models.JSONField(blank=True, null=True)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["-created_at"]

	def __str__(self) -> str:
		return f"ActivityLog(user={self.user.username}, action={self.action}, ts={self.created_at})"
