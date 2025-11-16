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
from django.urls import path
from users import views as user_views
from workouts import views as workout_views
from events import views as events_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/session/', user_views.session, name='session'),
    path('api/register/', user_views.register, name='register'),
    path('api/login/', user_views.login, name='login'),
    path('api/logout/', user_views.logout, name='logout'),
    path('oauth/strava/login/', user_views.strava_login, name='strava_login'),
    path('oauth/strava/callback/', user_views.strava_callback, name='strava_callback'),
    path('api/workouts/', workout_views.list_workouts, name='workouts_list'),
    path('api/workouts/upload/', workout_views.upload_workout, name='workouts_upload'),
    path('api/workouts/<int:workout_id>/', workout_views.delete_workout, name='workouts_delete'),
    path('api/workouts/<int:workout_id>/gpx/', workout_views.upload_gpx, name='workouts_upload_gpx'),
    path('api/workouts/import_strava/', workout_views.import_strava_workouts, name='workouts_import_strava'),
    path('api/events/', events_views.list_events, name='events_list'),
]
