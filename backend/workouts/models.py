from django.db import models
from django.contrib.auth.models import User


class Workout(models.Model):
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="workouts")
	external_id = models.CharField(max_length=128, blank=True, null=True)
	source = models.CharField(max_length=64, default="json")
	manual = models.BooleanField(default=False)
	title = models.CharField(max_length=255)
	distance_m = models.FloatField(blank=True, null=True)
	duration_ms = models.BigIntegerField(blank=True, null=True)
	raw_data = models.JSONField()
	created_at = models.DateTimeField(auto_now_add=True)

	def __str__(self) -> str:
		return f"{self.title} ({self.user.username})"
