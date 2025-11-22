"""
URL configuration for running_analyzer project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from users import views as user_views
from social import views as social_views
from django.conf import settings
from django.conf.urls.static import static
from workouts import views as workout_views
from events import views as events_views
from workout_analysis import views as analysis_views
from users import views as user_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/session/', user_views.session, name='session'),
    path('api/register/', user_views.register, name='register'),
    path('api/login/', user_views.login, name='login'),
    path('api/logout/', user_views.logout, name='logout'),
    path('api/activity/recent/', user_views.recent_activity, name='recent_activity'),
    path('api/activity/clear_all/', user_views.clear_activity, name='clear_activity'),
    path('api/activity/<int:activity_id>/', user_views.delete_activity, name='delete_activity'),
    path('oauth/strava/login/', user_views.strava_login, name='strava_login'),
    path('oauth/strava/callback/', user_views.strava_callback, name='strava_callback'),
    path('api/workouts/', workout_views.list_workouts, name='workouts_list'),
    path('api/workouts/last/', workout_views.last_workout, name='workouts_last'),
    path('api/workouts/weekly_summary/', workout_views.weekly_summary, name='workouts_weekly_summary'),
    path('api/workouts/upload/', workout_views.upload_workout, name='workouts_upload'),
    path('api/workouts/<int:workout_id>/', workout_views.delete_workout, name='workouts_delete'),
    path('api/workouts/<int:workout_id>/gpx/', workout_views.upload_gpx, name='workouts_upload_gpx'),
    path('api/workouts/import_strava/', workout_views.import_strava_workouts, name='workouts_import_strava'),
    path('api/events/', events_views.list_events, name='events_list'),
    path('api/workouts/<int:workout_id>/analysis/', analysis_views.workout_analysis, name='workout_analysis'),
    path('api/profile/', user_views.profile, name='profile'),
    path('api/payments/', include('payments.urls')),
    # Social / community endpoints
    path('api/social/posts/', social_views.list_or_create_posts, name='social_posts'),
    path('api/social/posts/<int:post_id>/likes/', social_views.toggle_like, name='social_post_like'),
    path('api/social/posts/<int:post_id>/comments/', social_views.comments, name='social_post_comments'),
    path('api/social/search_users/', social_views.search_users, name='social_search_users'),
    path('api/social/friend_requests/', social_views.friend_requests, name='social_friend_requests'),
    path('api/social/friend_requests/<int:fr_id>/respond/', social_views.respond_friend_request, name='social_friend_request_respond'),
]
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
