from django.db import migrations


def _get_existing_columns(schema_editor, table_name: str) -> set[str]:
    connection = schema_editor.connection
    with connection.cursor() as cursor:
        if connection.vendor == "sqlite":
            cursor.execute(f"PRAGMA table_info({table_name})")
            return {row[1] for row in cursor.fetchall()}

        description = connection.introspection.get_table_description(cursor, table_name)
        return {col.name for col in description}


def drop_gpx_file_column(apps, schema_editor):
    Workout = apps.get_model("workouts", "Workout")
    table_name = Workout._meta.db_table
    if "gpx_file" not in _get_existing_columns(schema_editor, table_name):
        return

    field = Workout._meta.get_field("gpx_file")
    schema_editor.remove_field(Workout, field)


def add_gpx_file_column(apps, schema_editor):
    Workout = apps.get_model("workouts", "Workout")
    table_name = Workout._meta.db_table
    if "gpx_file" in _get_existing_columns(schema_editor, table_name):
        return

    field = Workout._meta.get_field("gpx_file")
    schema_editor.add_field(Workout, field)

class Migration(migrations.Migration):
    dependencies = [
        ("workouts", "0006_ensure_gpx_columns"),
    ]

    operations = [
        migrations.RunPython(
            code=drop_gpx_file_column,
            reverse_code=add_gpx_file_column,
        ),
    ]
