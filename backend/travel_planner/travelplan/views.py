from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import UserPreference, Itinerary
from .serializers import UserPreferenceSerializer, ItinerarySerializer
from .services.gemini_service import GeminiService

class GenerateItineraryView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = UserPreferenceSerializer(data=request.data)
        if serializer.is_valid():
            preference = serializer.save(user=request.user)
            try:
                gemini_service = GeminiService()
                itinerary_data = gemini_service.generate_itinerary(preference.to_dict())
                itinerary = Itinerary.objects.create(
                    user=request.user,
                    preference=preference,
                    itinerary_data=itinerary_data
                )
                return Response(ItinerarySerializer(itinerary).data, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UserItinerariesView(APIView):
    """API view for retrieving user's saved itineraries"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get all itineraries for the logged-in user"""
        itineraries = Itinerary.objects.filter(user=request.user).order_by('-created_at')
        serializer = ItinerarySerializer(itineraries, many=True)
        return Response(serializer.data)