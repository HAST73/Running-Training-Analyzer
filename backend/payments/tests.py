from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from unittest.mock import patch, MagicMock

from payments.models import Payment


class PaymentsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="payuser", email="payer@example.com", password="password")
        self.client.force_login(self.user)

    @patch("payments.views.stripe.checkout.Session.create")
    @patch("payments.views.stripe.Price.list")
    def test_create_checkout_session_creates_payment_and_returns_session(self, mock_price_list, mock_session_create):
        # Mock Stripe price lookup and session creation
        mock_price_list.return_value = MagicMock(data=[MagicMock(id="price_123")])
        mock_session_create.return_value = MagicMock(id="sess_123", url="https://checkout.test/session/sess_123")

        import payments.views as pv
        with patch.object(pv.stripe, "api_key", "sk_test"):
            resp = self.client.post("/api/payments/create-checkout-session/", data=b"{}", content_type="application/json")

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("session_id", data)
        self.assertEqual(data.get("session_id"), "sess_123")
        self.assertIn("url", data)

        payment = Payment.objects.filter(user=self.user).order_by("-created_at").first()
        self.assertIsNotNone(payment)
        self.assertEqual(payment.stripe_session_id, "sess_123")
        self.assertEqual(payment.metadata.get("price_id"), "price_123")

    @patch("payments.views.stripe.checkout.Session.retrieve")
    def test_confirm_session_marks_payment_paid(self, mock_session_retrieve):
        # Create a payment record that matches the (to-be) stripe session id
        payment = Payment.objects.create(user=self.user, product_id="price_123", status="created", stripe_session_id="sess_confirm")

        # Mock Stripe session retrieval to indicate the payment was completed
        mock_session_retrieve.return_value = {"payment_status": "paid"}

        import payments.views as pv
        with patch.object(pv.stripe, "api_key", "sk_test"):
            resp = self.client.get("/api/payments/confirm/?session_id=sess_confirm")

        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data.get("status"), "paid")
        self.assertEqual(data.get("payment_status"), "paid")

        payment.refresh_from_db()
        self.assertEqual(payment.status, "paid")
        self.assertIsNotNone(payment.completed_at)
        self.assertTrue(isinstance(payment.completed_at, timezone.datetime))
