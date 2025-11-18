from django.db import models
from django.contrib.auth.models import User


class Workout(models.Model):
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="workouts")
	external_id = models.CharField(max_length=128, blank=True, null=True)
	source = models.CharField(max_length=64, default="json")
	performed_at = models.DateTimeField(blank=True, null=True)
	manual = models.BooleanField(default=False)
	title = models.CharField(max_length=255)
	distance_m = models.FloatField(blank=True, null=True)
	duration_ms = models.BigIntegerField(blank=True, null=True)
	# Legacy FileField (no longer used for new uploads). Kept for backward compatibility.
	gpx_file = models.FileField(upload_to="gpx/", blank=True, null=True)
	# New inline storage in DB (preferred)
	gpx_name = models.CharField(max_length=255, blank=True, null=True)
	gpx_mime = models.CharField(max_length=120, blank=True, null=True)
	gpx_size = models.IntegerField(blank=True, null=True)
	gpx_data = models.BinaryField(blank=True, null=True, editable=False)
	raw_data = models.JSONField()
	created_at = models.DateTimeField(auto_now_add=True)

	def __str__(self) -> str:
		return f"{self.title} ({self.user.username})"
