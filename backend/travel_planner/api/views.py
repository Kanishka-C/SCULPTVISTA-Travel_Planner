from django.shortcuts import render

# Create your views here.
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.authentication import JWTAuthentication
from .models import UserPreference, Itinerary
from .serializers import UserPreferenceSerializer, ItinerarySerializer
from .services.gemini_service import GeminiService

class GenerateItineraryView(APIView):
    """API view for generating travel itineraries with Gemini"""
    authentication_classes=[JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        # Deserialize and validate user preferences
        serializer = UserPreferenceSerializer(data=request.data)
        
        if serializer.is_valid():
            # Save user preferences
            preference = serializer.save(user=request.user)
            
            try:
                # Initialize Gemini service
                gemini_service = GeminiService()
                
                # Generate itinerary using Gemini API
                itinerary_data = gemini_service.generate_itinerary(preference.to_dict())
                
                # Save the generated itinerary to database
                itinerary = Itinerary.objects.create(
                    user=request.user,
                    preference=preference,
                    itinerary_data=itinerary_data
                )
                
                # Return the itinerary data to frontend
                itinerary_serializer = ItinerarySerializer(itinerary)
                return Response(itinerary_serializer.data, status=status.HTTP_201_CREATED)
                
            except Exception as e:
                # Handle errors during itinerary generation
                return Response(
                    {"error": str(e)},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        else:
            # Return validation errors
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UserItinerariesView(APIView):
    """API view for retrieving user's saved itineraries"""
    authentication_classes=[JWTAuthentication]
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get all itineraries for the logged-in user"""
        itineraries = Itinerary.objects.filter(user=request.user).order_by('-created_at')
        serializer = ItinerarySerializer(itineraries, many=True)
        return Response(serializer.data)