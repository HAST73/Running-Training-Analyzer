from django.test import TestCase, Client
from django.contrib.auth.models import User
import json


class UsersAuthTests(TestCase):
	def setUp(self):
		self.client = Client()

	def post_json(self, url, payload):
		return self.client.post(url, json.dumps(payload), content_type='application/json')

	def test_register_success(self):
		res = self.post_json('/api/register/', {'username': 'testuser', 'email': 't@t.pl', 'password': 'GoodP@ss1'})
		self.assertEqual(res.status_code, 200)
		self.assertTrue(User.objects.filter(username='testuser').exists())

	def test_register_duplicate_username(self):
		User.objects.create_user('exists', password='Xx!234567', email='a@a.pl')
		res = self.post_json('/api/register/', {'username': 'exists', 'email': 'other@t.pl', 'password': 'GoodP@ss1'})
		self.assertEqual(res.status_code, 409)

	def test_register_duplicate_email(self):
		User.objects.create_user('user1', password='Xx!234567', email='dup@example.com')
		res = self.post_json('/api/register/', {'username': 'newuser', 'email': 'dup@example.com', 'password': 'GoodP@ss1'})
		self.assertEqual(res.status_code, 409)

	def test_register_invalid_email(self):
		res = self.post_json('/api/register/', {'username': 'u2', 'email': 'not-an-email', 'password': 'GoodP@ss1'})
		self.assertEqual(res.status_code, 400)

	def test_register_weak_password(self):
		res = self.post_json('/api/register/', {'username': 'u3', 'email': 'ok@ex.pl', 'password': 'weakpass'})
		self.assertEqual(res.status_code, 400)

	def test_login_success_and_failure(self):
		User.objects.create_user('loginuser', password='GoodP@ss1', email='l@l.pl')
		# correct
		res = self.post_json('/api/login/', {'username': 'loginuser', 'password': 'GoodP@ss1'})
		self.assertEqual(res.status_code, 200)
		# incorrect
		res2 = self.post_json('/api/login/', {'username': 'loginuser', 'password': 'bad'})
		self.assertEqual(res2.status_code, 401)

	def test_check_username_and_email_endpoints(self):
		User.objects.create_user('u_exists', password='P@ssword1', email='uex@ex.pl')
		r1 = self.client.get('/api/check_username/?username=u_exists')
		self.assertEqual(r1.status_code, 200)
		self.assertEqual(r1.json().get('available'), False)
		r2 = self.client.get('/api/check_username/?username=newname')
		self.assertEqual(r2.json().get('available'), True)

		r3 = self.client.get('/api/check_email/?email=uex@ex.pl')
		self.assertEqual(r3.status_code, 200)
		self.assertEqual(r3.json().get('available'), False)
		r4 = self.client.get('/api/check_email/?email=new@ex.pl')
		self.assertEqual(r4.json().get('available'), True)

