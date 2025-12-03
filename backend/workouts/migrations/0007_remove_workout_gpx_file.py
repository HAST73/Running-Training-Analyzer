from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [
        ("workouts", "0006_ensure_gpx_columns"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="workout",
            name="gpx_file",
        ),
    ]
