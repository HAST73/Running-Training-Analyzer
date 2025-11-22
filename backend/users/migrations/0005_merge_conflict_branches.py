from django.db import migrations


class Migration(migrations.Migration):
    # Merge branches: one ending at 0002_drop_username_finalized and the other at 0004_alter_userprofile_strava_athlete_id
    dependencies = [
        ('users', '0002_drop_username_finalized'),
        ('users', '0004_alter_userprofile_strava_athlete_id'),
    ]

    operations = []
