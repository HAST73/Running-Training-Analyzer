from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
import json
import io
from datetime import datetime, timedelta, timezone as dt_tz

from . import views as workout_views
from .models import Workout


class WorkoutImportTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user('tester', password='GoodP@ss1', email='t@t.pl')
        self.client.force_login(self.user)

    def post_json(self, url, payload):
        return self.client.post(url, json.dumps(payload), content_type='application/json')

    def test_import_adidas_json_body(self):
        # minimal Adidas-like payload containing 'features'
        payload = {
            "id": "ad123",
            "features": [
                {"type": "initial_values", "attributes": {"start_time": int((timezone.now().timestamp()) * 1000)}},
                {"type": "track_metrics", "attributes": {"distance": 5000}}
            ]
        }
        res = self.post_json('/api/workouts/upload/', payload)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data.get('source'), 'adidas')
        w = Workout.objects.get(id=data.get('id'))
        self.assertEqual(w.source, 'adidas')

    def test_import_adidas_json_file_multipart(self):
        payload = {
            "id": "ad_file",
            "features": [
                {"type": "initial_values", "attributes": {"start_time": int((timezone.now().timestamp()) * 1000)}},
                {"type": "track_metrics", "attributes": {"distance": 3000}}
            ]
        }
        content = json.dumps(payload).encode('utf-8')
        f = SimpleUploadedFile('activity.json', content, content_type='application/json')
        res = self.client.post('/api/workouts/upload/', {'file': f}, format='multipart')
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data.get('source'), 'adidas')

    def test_import_fit_file_creates_strava_workout(self):
        # Monkeypatch FitFile to a fake that returns session messages
        class FakeRecord:
            def __init__(self, items):
                self._items = items
            def __iter__(self):
                for k,v in self._items.items():
                    class D: pass
                    d = D(); d.name = k; d.value = v
                    yield d

        class FakeFit:
            def __init__(self, fp):
                pass
            def get_messages(self, name):
                if name == 'session':
                    # produce one session record
                    yield FakeRecord({'total_distance': 10000.0, 'total_timer_time': 3600.0, 'start_time': int(datetime.now().timestamp())})
                return []

        # Patch
        workout_views.FitFile = FakeFit

        fake_content = b'FAKEFITDATA'
        f = SimpleUploadedFile('run.fit', fake_content, content_type='application/octet-stream')
        res = self.client.post('/api/workouts/upload/', {'file': f}, format='multipart')
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data.get('source'), 'strava')

    def test_attach_gpx_to_workout_and_attach_hr_alignment(self):
        # Create a workout first (adidas source)
        w = Workout.objects.create(user=self.user, title='w1', source='adidas', manual=True, raw_data={})

        # Build small GPX with 3 points spaced 1s apart
        now = datetime.now(dt_tz.utc)
        t0 = now
        t1 = now + timedelta(seconds=1)
        t2 = now + timedelta(seconds=2)
        gpx = f'''<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><trkseg>
    <trkpt lat="50.0" lon="20.0"><time>{t0.isoformat()}</time></trkpt>
    <trkpt lat="50.0001" lon="20.0001"><time>{t1.isoformat()}</time></trkpt>
    <trkpt lat="50.0002" lon="20.0002"><time>{t2.isoformat()}</time></trkpt>
  </trkseg></trk>
</gpx>'''.encode('utf-8')

        gf = SimpleUploadedFile('route.gpx', gpx, content_type='application/gpx+xml')
        res = self.client.post(f'/api/workouts/{w.id}/gpx/', {'file': gf}, format='multipart')
        self.assertEqual(res.status_code, 200)
        w.refresh_from_db()
        self.assertTrue(w.gpx_data is not None)

        # Prepare HR samples matching t1 (in ms)
        samples = [
            {"start_time": int(t1.timestamp() * 1000), "heart_rate": 150},
            {"start_time": int(t2.timestamp() * 1000), "heart_rate": 152},
        ]
        hf = SimpleUploadedFile('hr.json', json.dumps(samples).encode('utf-8'), content_type='application/json')
        res2 = self.client.post(f'/api/workouts/{w.id}/attach_hr/', {'file': hf}, format='multipart')
        self.assertEqual(res2.status_code, 200)
        data = res2.json()
        self.assertIn('hr_stats', data)
        # Alignment should be present
        self.assertIn('hr_alignment', data)

    def test_attach_hr_without_samples_returns_error(self):
        w = Workout.objects.create(user=self.user, title='w2', source='adidas', manual=True, raw_data={})
        hf = SimpleUploadedFile('hr.json', b'[]', content_type='application/json')
        res = self.client.post(f'/api/workouts/{w.id}/attach_hr/', {'file': hf}, format='multipart')
        self.assertEqual(res.status_code, 400)

    def test_delete_workout(self):
        w = Workout.objects.create(user=self.user, title='to_delete', source='adidas', manual=True, raw_data={})
        res = self.client.delete(f'/api/workouts/{w.id}/')
        self.assertEqual(res.status_code, 200)
        # Ensure it's gone
        with self.assertRaises(Workout.DoesNotExist):
            Workout.objects.get(id=w.id)
