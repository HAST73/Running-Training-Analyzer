from django.db import models
from django.contrib.auth.models import User
from workouts.models import Workout


class Post(models.Model):
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="posts")
	workout = models.ForeignKey(Workout, on_delete=models.SET_NULL, null=True, blank=True, related_name="shared_posts")
	text = models.TextField(blank=True)
	image = models.ImageField(upload_to="post_images/", null=True, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	# privacy: 'public' or 'friends'. Kept for future extensions.
	privacy = models.CharField(max_length=16, default="public")
	# global visibility flag (True -> appears in global feed). If False only in friends feed.
	is_global = models.BooleanField(default=True)

	class Meta:
		ordering = ["-created_at"]

	def __str__(self):
		return f"Post(id={self.id}, user={self.user.username})"


class PostLike(models.Model):
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="post_likes")
	post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="likes")
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		unique_together = ("user", "post")

	def __str__(self):
		return f"PostLike(user={self.user.username}, post={self.post_id})"


class PostComment(models.Model):
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="post_comments")
	post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="comments")
	text = models.TextField()
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		ordering = ["created_at"]

	def __str__(self):
		return f"PostComment(id={self.id}, post={self.post_id}, user={self.user.username})"


class PostReaction(models.Model):
	REACTION_CHOICES = [
		("like", "Like"),
		("love", "Love"),
		("fire", "Fire"),
		("party", "Party"),
	]
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="post_reactions")
	post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="reactions")
	reaction_type = models.CharField(max_length=16, choices=REACTION_CHOICES)
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		unique_together = ("user", "post", "reaction_type")
		indexes = [models.Index(fields=["post", "reaction_type"])]

	def __str__(self):
		return f"PostReaction(type={self.reaction_type}, post={self.post_id}, user={self.user.username})"


class FriendRequest(models.Model):
	from_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sent_friend_requests")
	to_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="received_friend_requests")
	status = models.CharField(max_length=16, default="pending")  # pending / accepted / rejected
	created_at = models.DateTimeField(auto_now_add=True)
	responded_at = models.DateTimeField(null=True, blank=True)

	class Meta:
		unique_together = ("from_user", "to_user")
		ordering = ["-created_at"]

	def __str__(self):
		return f"FriendRequest({self.from_user.username}->{self.to_user.username}, {self.status})"

	def accept(self):
		from django.utils import timezone
		self.status = "accepted"
		self.responded_at = timezone.now()
		self.save(update_fields=["status", "responded_at"])
		# Create Friendship (symmetrical) if not exists
		u1, u2 = sorted([self.from_user_id, self.to_user_id])
		Friendship.objects.get_or_create(user1_id=u1, user2_id=u2)

	def reject(self):
		from django.utils import timezone
		self.status = "rejected"
		self.responded_at = timezone.now()
		self.save(update_fields=["status", "responded_at"]) 


class Friendship(models.Model):
	user1 = models.ForeignKey(User, on_delete=models.CASCADE, related_name="friendships_initiated")
	user2 = models.ForeignKey(User, on_delete=models.CASCADE, related_name="friendships_received")
	created_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		unique_together = ("user1", "user2")
		indexes = [models.Index(fields=["user1", "user2"])]

	def __str__(self):
		return f"Friendship({self.user1.username},{self.user2.username})"

	@staticmethod
	def friend_ids_for(user: User):
		# Return set of friend user IDs for given user (using normalized ordering user1<user2)
		from django.db.models import Q
		ids = set()
		for fr in Friendship.objects.filter(Q(user1=user) | Q(user2=user)).select_related("user1", "user2"):
			ids.add(fr.user1_id if fr.user1_id != user.id else fr.user2_id)
			ids.add(fr.user2_id if fr.user2_id != user.id else fr.user1_id)
		ids.discard(user.id)
		return ids
