from django.db import migrations


def ensure_gpx_columns(apps, schema_editor):
    connection = schema_editor.connection
    vendor = connection.vendor
    table = 'workouts_workout'

    def get_columns_sqlite(cur):
        cur.execute(f"PRAGMA table_info({table})")
        return {row[1] for row in cur.fetchall()}

    def get_columns_postgres(cur):
        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = %s
            """,
            [table],
        )
        return {row[0] for row in cur.fetchall()}

    with connection.cursor() as cur:
        if vendor == 'sqlite':
            existing = get_columns_sqlite(cur)
        elif vendor == 'postgresql':
            existing = get_columns_postgres(cur)
        else:
            # Fallback: try sqlite pragma first
            try:
                existing = get_columns_sqlite(cur)
            except Exception:
                existing = set()

        statements = []
        if 'gpx_name' not in existing:
            statements.append("ALTER TABLE workouts_workout ADD COLUMN gpx_name varchar(255)")
        if 'gpx_mime' not in existing:
            statements.append("ALTER TABLE workouts_workout ADD COLUMN gpx_mime varchar(120)")
        if 'gpx_size' not in existing:
            statements.append("ALTER TABLE workouts_workout ADD COLUMN gpx_size integer")
        if 'gpx_data' not in existing:
            # Ensure presence if previous migration was faked on a fresh DB
            statements.append("ALTER TABLE workouts_workout ADD COLUMN gpx_data blob")

        for stmt in statements:
            cur.execute(stmt)


class Migration(migrations.Migration):

    dependencies = [
        ("workouts", "0005_workout_gpx_inline"),
    ]

    operations = [
        migrations.RunPython(ensure_gpx_columns, reverse_code=migrations.RunPython.noop),
    ]
