from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("workouts", "0004_workout_gpx_file"),
    ]

    operations = [
        migrations.AddField(
            model_name="workout",
            name="gpx_name",
            field=models.CharField(max_length=255, blank=True, null=True),
        ),
        migrations.AddField(
            model_name="workout",
            name="gpx_mime",
            field=models.CharField(max_length=120, blank=True, null=True),
        ),
        migrations.AddField(
            model_name="workout",
            name="gpx_size",
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="workout",
            name="gpx_data",
            field=models.BinaryField(blank=True, null=True, editable=False),
        ),
    ]
