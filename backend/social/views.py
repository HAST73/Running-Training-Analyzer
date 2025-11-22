import json
from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Count
from workouts.models import Workout
from .models import Post, PostLike, PostComment, FriendRequest


def _serialize_post(p: Post, user) -> dict:
	return {
		"id": p.id,
		"user": p.user.username,
		"user_id": p.user.id,
		"workout_id": p.workout_id,
		"text": p.text,
		"image_url": p.image.url if p.image else None,
		"created_at": p.created_at.isoformat(),
		"likes_count": p.likes.count(),
		"comments_count": p.comments.count(),
		"liked": p.likes.filter(user=user).exists() if user.is_authenticated else False,
	}


@login_required
def list_or_create_posts(request: HttpRequest) -> JsonResponse:
	if request.method == "GET":
		scope = request.GET.get("scope", "global")
		qs = Post.objects.all()
		if scope == "friends":
			# friends = accepted friend requests where current user is involved
			friend_ids = set()
			for fr in FriendRequest.objects.filter(status="accepted").filter(from_user=request.user) | FriendRequest.objects.filter(status="accepted").filter(to_user=request.user):
				friend_ids.add(fr.from_user_id)
				friend_ids.add(fr.to_user_id)
			friend_ids.discard(request.user.id)
			qs = qs.filter(user_id__in=list(friend_ids))
		limit = 50
		posts = [
			_serialize_post(p, request.user) for p in qs.select_related("user", "workout")[:limit]
		]
		return JsonResponse({"posts": posts})

	if request.method == "POST":
		content_type = request.content_type or ""
		text = ""
		workout = None
		image = None
		if content_type.startswith("multipart/form-data"):
			text = (request.POST.get("text") or "").strip()
			wid = request.POST.get("workout_id")
			if wid:
				try:
					workout = Workout.objects.get(id=int(wid), user=request.user)
				except (Workout.DoesNotExist, ValueError):
					workout = None
			image = request.FILES.get("image")
		else:
			try:
				data = json.loads(request.body.decode())
			except Exception:
				data = {}
			text = (data.get("text") or "").strip()
			wid = data.get("workout_id")
			if wid:
				try:
					workout = Workout.objects.get(id=int(wid), user=request.user)
				except (Workout.DoesNotExist, ValueError):
					workout = None
		if not text and not workout and not image:
			return JsonResponse({"error": "Post musi mieć tekst, obraz lub powiązany trening."}, status=400)
		post = Post.objects.create(user=request.user, workout=workout, text=text, image=image)
		return JsonResponse({"post": _serialize_post(post, request.user)}, status=201)

	return JsonResponse({"error": "Method not allowed"}, status=405)


@login_required
def toggle_like(request: HttpRequest, post_id: int) -> JsonResponse:
	if request.method != "POST":
		return JsonResponse({"error": "Only POST allowed"}, status=405)
	try:
		post = Post.objects.get(id=post_id)
	except Post.DoesNotExist:
		return JsonResponse({"error": "Post not found"}, status=404)
	like = PostLike.objects.filter(post=post, user=request.user).first()
	if like:
		like.delete()
		liked = False
	else:
		PostLike.objects.create(post=post, user=request.user)
		liked = True
	return JsonResponse({"liked": liked, "likes_count": post.likes.count()})


@login_required
def comments(request: HttpRequest, post_id: int) -> JsonResponse:
	try:
		post = Post.objects.get(id=post_id)
	except Post.DoesNotExist:
		return JsonResponse({"error": "Post not found"}, status=404)

	if request.method == "GET":
		items = [
			{
				"id": c.id,
				"user": c.user.username,
				"user_id": c.user.id,
				"text": c.text,
				"created_at": c.created_at.isoformat(),
			}
			for c in post.comments.select_related("user")
		]
		return JsonResponse({"comments": items})

	if request.method == "POST":
		try:
			data = json.loads(request.body.decode())
		except Exception:
			data = {}
		text = (data.get("text") or "").strip()
		if not text:
			return JsonResponse({"error": "Komentarz nie może być pusty."}, status=400)
		c = PostComment.objects.create(post=post, user=request.user, text=text)
		return JsonResponse({"comment": {
			"id": c.id, "user": c.user.username, "user_id": c.user.id, "text": c.text, "created_at": c.created_at.isoformat()
		}}, status=201)

	return JsonResponse({"error": "Method not allowed"}, status=405)


@login_required
def search_users(request: HttpRequest) -> JsonResponse:
	q = (request.GET.get("q") or "").strip()
	if not q:
		return JsonResponse({"results": []})
	users = User.objects.filter(username__icontains=q).exclude(id=request.user.id)[:10]
	results = [{"id": u.id, "username": u.username} for u in users]
	return JsonResponse({"results": results})


@login_required
def friend_requests(request: HttpRequest) -> JsonResponse:
	if request.method == "GET":
		incoming = [
			{"id": fr.id, "from": fr.from_user.username, "status": fr.status, "created_at": fr.created_at.isoformat()}
			for fr in FriendRequest.objects.filter(to_user=request.user, status="pending")
		]
		outgoing = [
			{"id": fr.id, "to": fr.to_user.username, "status": fr.status, "created_at": fr.created_at.isoformat()}
			for fr in FriendRequest.objects.filter(from_user=request.user, status="pending")
		]
		return JsonResponse({"incoming": incoming, "outgoing": outgoing})

	if request.method == "POST":
		try:
			data = json.loads(request.body.decode())
		except Exception:
			data = {}
		target_username = (data.get("username") or "").strip()
		if not target_username:
			return JsonResponse({"error": "Brak nazwy użytkownika"}, status=400)
		if target_username == request.user.username:
			return JsonResponse({"error": "Nie możesz wysłać zaproszenia do siebie"}, status=400)
		try:
			target = User.objects.get(username=target_username)
		except User.DoesNotExist:
			return JsonResponse({"error": "Użytkownik nie istnieje"}, status=404)
		fr, created = FriendRequest.objects.get_or_create(from_user=request.user, to_user=target, defaults={"status": "pending"})
		if not created and fr.status == "pending":
			return JsonResponse({"error": "Zaproszenie już wysłane"}, status=409)
		if not created and fr.status in ("accepted", "rejected"):
			# allow re-send after rejection? For now return status
			return JsonResponse({"error": f"Zaproszenie ma status {fr.status}"}, status=409)
		return JsonResponse({"id": fr.id, "to": target.username, "status": fr.status}, status=201)

	return JsonResponse({"error": "Method not allowed"}, status=405)


@login_required
def respond_friend_request(request: HttpRequest, fr_id: int) -> JsonResponse:
	if request.method != "POST":
		return JsonResponse({"error": "Only POST allowed"}, status=405)
	try:
		fr = FriendRequest.objects.get(id=fr_id, to_user=request.user)
	except FriendRequest.DoesNotExist:
		return JsonResponse({"error": "Zaproszenie nie znalezione"}, status=404)
	try:
		data = json.loads(request.body.decode())
	except Exception:
		data = {}
	action = (data.get("action") or "").strip().lower()
	if fr.status != "pending":
		return JsonResponse({"error": "Zaproszenie już obsłużone"}, status=400)
	if action == "accept":
		fr.accept()
	elif action == "reject":
		fr.reject()
	else:
		return JsonResponse({"error": "Nieprawidłowa akcja (accept/reject)"}, status=400)
	return JsonResponse({"id": fr.id, "status": fr.status})
