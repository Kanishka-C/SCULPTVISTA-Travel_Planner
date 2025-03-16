from django.urls import path
from .views import GenerateItineraryView, UserItinerariesView

urlpatterns = [
    path('generate-itinerary/', GenerateItineraryView.as_view(), name='generate_itinerary'),
    path('user-itineraries/', UserItinerariesView.as_view(), name='user_itineraries'),
]

