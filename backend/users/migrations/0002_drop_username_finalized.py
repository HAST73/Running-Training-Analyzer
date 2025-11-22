from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.RunSQL(
            sql="ALTER TABLE users_userprofile DROP COLUMN IF EXISTS username_finalized;",
            reverse_sql="ALTER TABLE users_userprofile ADD COLUMN username_finalized boolean DEFAULT TRUE;",
        )
    ]
