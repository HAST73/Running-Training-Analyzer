from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [
        ("workouts", "0006_ensure_gpx_columns"),
    ]

    operations = [
        migrations.RunSQL(
            sql="ALTER TABLE workouts_workout DROP COLUMN IF EXISTS gpx_file",
            reverse_sql="ALTER TABLE workouts_workout ADD COLUMN gpx_file boolean",
        ),
    ]
