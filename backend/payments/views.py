import json, os, stripe
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse, HttpRequest, HttpResponse
from django.contrib.auth.decorators import login_required
from django.conf import settings
from django.utils import timezone
from .models import Payment

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or getattr(settings, "STRIPE_SECRET_KEY", None)

PRODUCT_ID_PLANS = os.environ.get("STRIPE_PLANS_PRODUCT_ID", "prod_TSp2YZ7iQygNLn")  # fallback to provided ID

@login_required
@csrf_exempt
def create_checkout_session(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    if not stripe.api_key:
        return JsonResponse({"error": "Stripe secret key not configured"}, status=500)

    # Optionally allow overriding product/price via body for future expansion
    try:
        body = json.loads(request.body.decode() or "{}")
    except Exception:
        body = {}
    product_id = body.get("product_id") or PRODUCT_ID_PLANS
    # In real usage you'd fetch Price ID; here we create a lookup by product → price
    # Simplify: treat product_id as a Price ID if it starts with 'price_'

    # Create Payment record
    payment = Payment.objects.create(
        user=request.user,
        product_id=product_id,
        status="created",
    )

    # You should create a Price in Stripe dashboard; if you only have product_id we need price lookup.
    # For demo: we attempt to list prices for product to pick first recurring/one-time price.
    price_id = None
    try:
        if product_id.startswith("price_"):
            price_id = product_id
        else:
            prices = stripe.Price.list(product=product_id, active=True, limit=1)
            if prices.data:
                price_id = prices.data[0].id
    except Exception:
        pass
    if not price_id:
        return JsonResponse({"error": "Nie znaleziono aktywnej ceny dla produktu Stripe."}, status=400)

    try:
        checkout_session = stripe.checkout.Session.create(
            mode="payment",  # adjust to 'subscription' if price is recurring
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            customer_email=request.user.email or None,
            success_url=f"{os.environ.get('FRONTEND_REDIRECT_URL','http://127.0.0.1:3000/#plans')}?success=1&session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{os.environ.get('FRONTEND_REDIRECT_URL','http://127.0.0.1:3000/#plans')}?canceled=1",
            metadata={"user_id": str(request.user.id), "payment_id": str(payment.id)},
        )
    except Exception as exc:
        payment.status = "failed"
        payment.metadata = {"error": str(exc)}
        payment.save(update_fields=["status", "metadata"])
        return JsonResponse({"error": "Stripe session create failed", "details": str(exc)}, status=502)

    payment.stripe_session_id = checkout_session.id
    payment.metadata = {"price_id": price_id}
    payment.save(update_fields=["stripe_session_id", "metadata"])

    return JsonResponse({"url": checkout_session.url, "session_id": checkout_session.id})

@login_required
def confirm_session(request: HttpRequest) -> JsonResponse:
    """Manual confirmation of a Stripe Checkout Session (no webhook)."""
    session_id = request.GET.get("session_id")
    if not session_id:
        return JsonResponse({"error": "session_id required"}, status=400)
    if not stripe.api_key:
        return JsonResponse({"error": "Stripe secret key not configured"}, status=500)
    try:
        checkout_session = stripe.checkout.Session.retrieve(session_id)
    except Exception as exc:
        return JsonResponse({"error": "Failed to retrieve session", "details": str(exc)}, status=400)
    payment_status = checkout_session.get("payment_status")  # 'paid' when completed (for mode=payment)
    # locate payment record
    try:
        payment = Payment.objects.get(stripe_session_id=session_id, user=request.user)
    except Payment.DoesNotExist:
        return JsonResponse({"error": "Payment record not found"}, status=404)
    if payment_status == "paid" and payment.status != "paid":
        payment.status = "paid"
        payment.completed_at = timezone.now()
        payment.save(update_fields=["status", "completed_at"])
    return JsonResponse({"status": payment.status, "payment_status": payment_status})
