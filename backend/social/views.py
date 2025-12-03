import json
from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Count
from workouts.models import Workout
from .models import Post, PostComment, FriendRequest, Friendship, PostReaction


def _serialize_post(p: Post, user) -> dict:
    return {
        "id": p.id,
        "user": p.user.username,
        "user_id": p.user.id,
        "workout_id": p.workout_id,
        "text": p.text,
        "image_url": p.image.url if p.image else None,
        "created_at": p.created_at.isoformat(),
        # USUNIĘTO likes_count i liked, ponieważ model PostLike już nie istnieje
        "comments_count": p.comments.count(),
        "is_global": p.is_global,
        "reaction_counts": _reaction_counts(p),
        "user_reactions": _user_reactions(p, user),
    }


ALLOWED_REACTIONS = ["love", "fire", "party"]  # likes removed; use reactions


def _reaction_counts(p: Post) -> dict:
	counts = {}
	for rtype in ALLOWED_REACTIONS:
		counts[rtype] = p.reactions.filter(reaction_type=rtype).count()
	return counts


def _user_reactions(p: Post, user) -> list:
	if not user.is_authenticated:
		return []
	return list(p.reactions.filter(user=user).values_list("reaction_type", flat=True))


@login_required
def list_or_create_posts(request: HttpRequest) -> JsonResponse:
	if request.method == "GET":
		scope = request.GET.get("scope", "global").lower()
		limit = 50
		if scope == "friends":
			friend_ids = Friendship.friend_ids_for(request.user)
			if not friend_ids:
				legacy_qs = FriendRequest.objects.filter(status="accepted")
				legacy_ids = set()
				for fr in legacy_qs.filter(from_user=request.user):
					legacy_ids.add(fr.to_user_id)
				for fr in legacy_qs.filter(to_user=request.user):
					legacy_ids.add(fr.from_user_id)
				friend_ids = legacy_ids
			from django.db.models import Q
			# Friends feed shows ONLY friends-only posts (is_global False) from friends or self.
			qs = Post.objects.filter(is_global=False).filter(Q(user_id__in=friend_ids) | Q(user=request.user))
		else:
			# Global feed shows ONLY global posts.
			qs = Post.objects.filter(is_global=True)
		posts = [_serialize_post(p, request.user) for p in qs.select_related("user", "workout")[:limit]]
		return JsonResponse({"posts": posts, "scope": scope})

	if request.method == "POST":
		content_type = request.content_type or ""
		text = ""
		workout = None
		image = None
		is_global = True
		if content_type.startswith("multipart/form-data"):
			text = (request.POST.get("text") or "").strip()
			wid = request.POST.get("workout_id")
			if wid:
				try:
					workout = Workout.objects.get(id=int(wid), user=request.user)
				except (Workout.DoesNotExist, ValueError):
					workout = None
			image = request.FILES.get("image")
			is_global = (request.POST.get("is_global", "true").lower() != "false")
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
			is_global = bool(data.get("is_global", True))
		if not text and not workout and not image:
			return JsonResponse({"error": "Post musi mieć tekst, obraz lub powiązany trening."}, status=400)
		privacy = "public" if is_global else "friends"
		post = Post.objects.create(user=request.user, workout=workout, text=text, image=image, is_global=is_global, privacy=privacy)
		return JsonResponse({"post": _serialize_post(post, request.user)}, status=201)

	return JsonResponse({"error": "Method not allowed"}, status=405)


@login_required
def toggle_like(request: HttpRequest, post_id: int) -> JsonResponse:
	# Endpoint deprecated since likes feature was removed
	return JsonResponse({"error": "Likes disabled"}, status=410)


@login_required
def toggle_reaction(request: HttpRequest, post_id: int) -> JsonResponse:
	if request.method != "POST":
		return JsonResponse({"error": "Only POST allowed"}, status=405)
	try:
		post = Post.objects.get(id=post_id)
	except Post.DoesNotExist:
		return JsonResponse({"error": "Post not found"}, status=404)
	try:
		data = json.loads(request.body.decode())
	except Exception:
		data = {}
	reaction_type = (data.get("type") or "").lower()
	if reaction_type not in ALLOWED_REACTIONS:
		return JsonResponse({"error": "Nieprawidłowy typ reakcji"}, status=400)
	existing = PostReaction.objects.filter(post=post, user=request.user, reaction_type=reaction_type).first()
	if existing:
		existing.delete()
		active = False
	else:
		PostReaction.objects.create(post=post, user=request.user, reaction_type=reaction_type)
		active = True
	return JsonResponse({
		"type": reaction_type,
		"active": active,
		"reaction_counts": _reaction_counts(post),
		"user_reactions": _user_reactions(post, request.user)
	})


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
		# Provide friend info for optimistic UI update
		return JsonResponse({"id": fr.id, "status": fr.status, "friend": fr.from_user.username, "friend_id": fr.from_user.id})
	elif action == "reject":
		fr.reject()
	else:
		return JsonResponse({"error": "Nieprawidłowa akcja (accept/reject)"}, status=400)
	return JsonResponse({"id": fr.id, "status": fr.status})


@login_required
def friends_list(request: HttpRequest) -> JsonResponse:
	"""Return list of accepted friends for current user.

	Uses Friendship model (normalized pairs). Falls back to accepted FriendRequest if no Friendship rows yet.
	"""
	if request.method != "GET":
		return JsonResponse({"error": "Only GET allowed"}, status=405)
	friend_ids = Friendship.friend_ids_for(request.user)
	if not friend_ids:
		legacy = FriendRequest.objects.filter(status="accepted")
		for fr in legacy.filter(from_user=request.user):
			friend_ids.add(fr.to_user_id)
		for fr in legacy.filter(to_user=request.user):
			friend_ids.add(fr.from_user_id)
	users = User.objects.filter(id__in=friend_ids).order_by('username')
	data = [{"id": u.id, "username": u.username} for u in users]
	return JsonResponse({"friends": data, "count": len(data)})


@login_required
def delete_post(request: HttpRequest, post_id: int) -> JsonResponse:
	if request.method not in ("DELETE", "POST"):
		return JsonResponse({"error": "Only DELETE or POST allowed"}, status=405)
	try:
		post = Post.objects.get(id=post_id, user=request.user)
	except Post.DoesNotExist:
		return JsonResponse({"error": "Post nie znaleziony lub brak uprawnień"}, status=404)
	post.delete()
	return JsonResponse({"deleted": True, "id": post_id})
