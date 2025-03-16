from django.urls import path
from .views import GenerateItineraryView, UserItinerariesView

urlpatterns = [
    path('generate-itinerary/', GenerateItineraryView.as_view(), name='generate-itinerary'),
    path('itineraries/', UserItinerariesView.as_view(), name='user-itineraries'),
]