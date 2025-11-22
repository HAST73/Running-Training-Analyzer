from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from users.models import UserProfile
from workouts.models import Workout
from users.models import ActivityLog
from django.db import transaction

class Command(BaseCommand):
    help = "Merge and remove duplicate UserProfile rows sharing the same strava_athlete_id; keep the one with most workouts/tokens."

    def handle(self, *args, **options):
        duplicates = (
            UserProfile.objects.exclude(strava_athlete_id__isnull=True)
            .exclude(strava_athlete_id="")
            .values_list("strava_athlete_id", flat=True)
            .distinct()
        )
        total_removed = 0
        for athlete_id in duplicates:
            profiles = list(UserProfile.objects.filter(strava_athlete_id=athlete_id))
            if len(profiles) <= 1:
                continue
            # Choose keeper: most workouts; if tie, has access token; else lowest id
            def profile_score(p):
                workout_count = Workout.objects.filter(user=p.user).count()
                token_score = 1 if p.strava_access_token else 0
                return (workout_count, token_score, -p.id)
            keeper = max(profiles, key=profile_score)
            others = [p for p in profiles if p != keeper]
            self.stdout.write(self.style.WARNING(f"Merging {len(others)} duplicates into profile id={keeper.id} for athlete {athlete_id}"))
            with transaction.atomic():
                # Move activity logs
                for p in others:
                    ActivityLog.objects.filter(user=p.user).update(user=keeper.user)
                    # Delete the user (cascade removes profile)
                    p.user.delete()
                    total_removed += 1
                # Consolidate tokens (latest non-null wins)
                for field in ["strava_access_token", "strava_refresh_token", "strava_token_expires_at"]:
                    for p in profiles:
                        val = getattr(p, field)
                        if val:
                            setattr(keeper, field, val)
                keeper.save()
        self.stdout.write(self.style.SUCCESS(f"Prune complete. Removed {total_removed} duplicate profiles."))
        self.stdout.write("Run: python manage.py makemigrations users && python manage.py migrate to apply unique constraint if pending.")
