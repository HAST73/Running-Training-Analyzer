from django.db import models
from django.contrib.auth.models import User

class Payment(models.Model):
    STATUS_CHOICES = [
        ("created", "Created"),
        ("paid", "Paid"),
        ("failed", "Failed"),
        ("expired", "Expired"),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="payments")
    product_id = models.CharField(max_length=64)  # Stripe Product or Price ID
    stripe_session_id = models.CharField(max_length=128, blank=True, null=True)
    stripe_payment_intent = models.CharField(max_length=128, blank=True, null=True)
    amount_cents = models.IntegerField(blank=True, null=True)
    currency = models.CharField(max_length=10, default="pln")
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="created")
    metadata = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "product_id", "status"]),
        ]

    def __str__(self) -> str:
        return f"Payment(user={self.user_id}, product={self.product_id}, status={self.status})"
