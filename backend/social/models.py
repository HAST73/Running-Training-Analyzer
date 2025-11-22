from django.db import models
from django.contrib.auth.models import User
from workouts.models import Workout


class Post(models.Model):
	user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="posts")
	workout = models.ForeignKey(Workout, on_delete=models.SET_NULL, null=True, blank=True, related_name="shared_posts")
	text = models.TextField(blank=True)
	image = models.ImageField(upload_to="post_images/", null=True, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)
	# privacy placeholder – for now all public
	privacy = models.CharField(max_length=16, default="public")

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
		# Add symmetrical friendship via User.profile many-to-many (if implemented later)
		# For now we just rely on accepted requests to determine friends.

	def reject(self):
		from django.utils import timezone
		self.status = "rejected"
		self.responded_at = timezone.now()
		self.save(update_fields=["status", "responded_at"]) 
