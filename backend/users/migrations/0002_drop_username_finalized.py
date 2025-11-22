from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0001_initial'),
    ]

    # No-op placeholder to resolve previous branch; DROP COLUMN removed for SQLite compatibility.
    operations = []
