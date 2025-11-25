import json
from django.test import TestCase
from django.contrib.auth.models import User

from social.models import FriendRequest, Friendship, Post, PostReaction, PostComment


class SocialAppTests(TestCase):
    def setUp(self):
        self.alice = User.objects.create_user(username="alice", email="alice@example.com", password="pw")
        self.bob = User.objects.create_user(username="bob", email="bob@example.com", password="pw")

    def test_send_friend_request_and_accept(self):
        # Alice sends request to Bob
        self.client.force_login(self.alice)
        resp = self.client.post(
            "/api/social/friend_requests/",
            data=json.dumps({"username": "bob"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertIn("id", data)
        fr_id = data["id"]

        fr = FriendRequest.objects.get(id=fr_id)
        self.assertEqual(fr.from_user, self.alice)
        self.assertEqual(fr.to_user, self.bob)
        self.assertEqual(fr.status, "pending")

        # Bob accepts the request
        self.client.force_login(self.bob)
        resp2 = self.client.post(
            f"/api/social/friend_requests/{fr_id}/respond/",
            data=json.dumps({"action": "accept"}),
            content_type="application/json",
        )
        self.assertEqual(resp2.status_code, 200)
        fr.refresh_from_db()
        self.assertEqual(fr.status, "accepted")

        # Friendship row should exist (normalized ordering)
        u1, u2 = sorted([self.alice.id, self.bob.id])
        friends = Friendship.objects.filter(user1_id=u1, user2_id=u2)
        self.assertTrue(friends.exists())

        # Both users should see each other in friends list endpoint
        self.client.force_login(self.alice)
        resp3 = self.client.get("/api/social/friends/")
        self.assertEqual(resp3.status_code, 200)
        pals = [p["username"] for p in resp3.json().get("friends", [])]
        self.assertIn("bob", pals)

    def test_global_and_friends_feed_react_and_comment(self):
        # Create a friendship directly so feeds will include friends posts
        u1, u2 = sorted([self.alice.id, self.bob.id])
        Friendship.objects.create(user1_id=u1, user2_id=u2)

        # Alice creates a global post
        self.client.force_login(self.alice)
        resp_g = self.client.post(
            "/api/social/posts/",
            data=json.dumps({"text": "Hello global", "is_global": True}),
            content_type="application/json",
        )
        self.assertEqual(resp_g.status_code, 201)
        pg = resp_g.json()["post"]
        self.assertTrue(pg["is_global"])

        # Global feed contains it
        resp_list = self.client.get("/api/social/posts/?scope=global")
        self.assertEqual(resp_list.status_code, 200)
        ids = [p["id"] for p in resp_list.json().get("posts", [])]
        self.assertIn(pg["id"], ids)

        # Bob creates a friends-only post
        self.client.force_login(self.bob)
        resp_f = self.client.post(
            "/api/social/posts/",
            data=json.dumps({"text": "Only friends", "is_global": False}),
            content_type="application/json",
        )
        self.assertEqual(resp_f.status_code, 201)
        pf = resp_f.json()["post"]

        # Alice should see Bob's friends-only post in friends feed
        self.client.force_login(self.alice)
        resp_friends = self.client.get("/api/social/posts/?scope=friends")
        self.assertEqual(resp_friends.status_code, 200)
        friend_ids = [p["id"] for p in resp_friends.json().get("posts", [])]
        self.assertIn(pf["id"], friend_ids)

        # Alice reacts to Bob's post
        resp_react = self.client.post(
            f"/api/social/posts/{pf['id']}/reactions/",
            data=json.dumps({"type": "love"}),
            content_type="application/json",
        )
        self.assertEqual(resp_react.status_code, 200)
        rdata = resp_react.json()
        self.assertEqual(rdata["type"], "love")
        self.assertTrue(rdata["active"])
        self.assertEqual(rdata["reaction_counts"]["love"], 1)

        # Alice comments on Bob's post
        resp_comment = self.client.post(
            f"/api/social/posts/{pf['id']}/comments/",
            data=json.dumps({"text": "Nice run!"}),
            content_type="application/json",
        )
        self.assertEqual(resp_comment.status_code, 201)
        cdata = resp_comment.json().get("comment")
        self.assertIsNotNone(cdata)
        self.assertEqual(cdata["text"], "Nice run!")

        # Retrieve comments list
        resp_comments = self.client.get(f"/api/social/posts/{pf['id']}/comments/")
        self.assertEqual(resp_comments.status_code, 200)
        texts = [c["text"] for c in resp_comments.json().get("comments", [])]
        self.assertIn("Nice run!", texts)
