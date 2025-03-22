# views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import UserPreference, Itinerary
from .serializers import UserPreferenceSerializer, ItinerarySerializer
from .services.gemini_service import GeminiService
import googlemaps
from googlemaps.exceptions import ApiError, TransportError
from django.conf import settings

# Initialize Google Maps client
gmaps = googlemaps.Client(key=settings.GOOGLE_MAPS_API_KEY)

def fetch_place_id(name, context_location, existing_place_id=None):
    """Convert a name and context location to a Google Maps Place ID with lat/lng."""
    if not name or name.lower() in ["none", "relax", "drive", "journey"]:
        return {'placeId': 'ID not available', 'lat': None, 'lng': None, 'address': 'Not applicable'}

    try:
        geocode = gmaps.geocode(context_location)
        if not geocode:
            print(f"Failed to geocode context location: {context_location}")
            return {'placeId': 'ID not available', 'lat': None, 'lng': None, 'address': 'Context not geocoded'}
        coords = (geocode[0]['geometry']['location']['lat'], geocode[0]['geometry']['location']['lng'])

        if existing_place_id and existing_place_id != "ID not available":
            try:
                place_details = gmaps.place(place_id=existing_place_id, fields=['place_id', 'geometry', 'formatted_address'])
                geometry = place_details['result']['geometry']['location']
                return {
                    'placeId': existing_place_id,
                    'lat': geometry['lat'],
                    'lng': geometry['lng'],
                    'address': place_details['result'].get('formatted_address', 'Address not available')
                }
            except ApiError:
                print(f"Existing Place ID {existing_place_id} for {name} is invalid, searching anew")

        query = f"{name}, {context_location}"
        place_search = gmaps.find_place(
            input=query,
            input_type="textquery",
            location_bias=f"circle:15000@{coords[0]},{coords[1]}"
        )
        if place_search['candidates']:
            place_id = place_search['candidates'][0]['place_id']
            place_details = gmaps.place(place_id=place_id, fields=['place_id', 'geometry', 'formatted_address'])
            geometry = place_details['result']['geometry']['location']
            return {
                'placeId': place_id,
                'lat': geometry['lat'],
                'lng': geometry['lng'],
                'address': place_details['result'].get('formatted_address', 'Address not available')
            }

        places = gmaps.places_nearby(location=coords, radius=15000, keyword=name)
        if places['results']:
            place = places['results'][0]
            return {
                'placeId': place['place_id'],
                'lat': place['geometry']['location']['lat'],
                'lng': place['geometry']['location']['lng'],
                'address': place.get('vicinity', 'Address not available')
            }
        return {'placeId': 'ID not available', 'lat': None, 'lng': None, 'address': 'Not found'}
    except ApiError as e:
        print(f"API Error for {name} in {context_location}: {e}")
        return {'placeId': f'Error: {str(e)}', 'lat': None, 'lng': None, 'address': 'Error'}
    except TransportError as e:
        print(f"Network Error for {name} in {context_location}: {e}")
        return {'placeId': f'Error: {str(e)}', 'lat': None, 'lng': None, 'address': 'Error'}
    except Exception as e:
        print(f"Unexpected Error for {name} in {context_location}: {e}")
        return {'placeId': f'Error: {str(e)}', 'lat': None, 'lng': None, 'address': 'Error'}

def extract_hotels_and_restaurants(itinerary_data):
    """Extract hotel and restaurant names with context and existing Place IDs."""
    hotels = []
    restaurants = []

    destination = itinerary_data.get('destination', itinerary_data.get('startPoint', 'Unknown Location'))
    start_point = itinerary_data.get('startPoint', '').lower()

    for hotel in itinerary_data.get('hotelRecommendations', []):
        for option in hotel.get('options', []):
            if option.lower() != "none":
                place_id = hotel.get('placeId', 'ID not available')
                hotels.append({'name': option, 'placeId': place_id, 'context': destination})

    for day in itinerary_data.get('itinerary', []):
        for schedule in day.get('schedule', []):
            activity = schedule.get('activity', '').lower()
            if any(keyword in activity for keyword in ['lunch at', 'dinner at', 'breakfast at']):
                name = activity.split('at')[-1].strip()
                place_id = schedule.get('placeId', 'ID not available')
                context = destination
                if 'coimbatore' in activity or 'coimbatore bypass' in activity:
                    context = 'Coimbatore, Tamil Nadu, India'
                elif 'palakkad' in activity or start_point in activity:
                    context = 'Palakkad, Kerala, India'
                if ' or ' in name:
                    names = [n.strip() for n in name.split(' or ')]
                    restaurants.extend({'name': n, 'placeId': place_id, 'context': context} for n in names)
                else:
                    restaurants.append({'name': name, 'placeId': place_id, 'context': context})

    return hotels, restaurants

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
                # Process the itinerary_data to include lat/lng immediately after generation
                hotels, restaurants = extract_hotels_and_restaurants(itinerary_data)
                hotel_locations = [fetch_place_id(h['name'], h['context'], h['placeId']) for h in hotels]
                restaurant_locations = [fetch_place_id(r['name'], r['context'], r['placeId']) for r in restaurants]
                response_data = {
                    'id': itinerary.id,
                    'user': itinerary.user.id,
                    'preference': itinerary.preference.id,
                    'itinerary_data': itinerary_data,
                    'hotels': hotel_locations,
                    'restaurants': restaurant_locations,
                    'created_at': itinerary.created_at.isoformat()
                }
                return Response(response_data, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UserItinerariesView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        itinerary_id = request.query_params.get('id', None)
        latest = request.query_params.get('latest', 'false').lower() == 'true'
        detail = request.query_params.get('detail', 'false').lower() == 'true'

        itineraries = Itinerary.objects.filter(user=request.user).order_by('-created_at')

        if not itineraries.exists():
            return Response({'error': 'No itineraries found'}, status=status.HTTP_404_NOT_FOUND)

        if itinerary_id:
            try:
                itinerary = itineraries.get(id=itinerary_id)
                if detail:
                    hotels, restaurants = extract_hotels_and_restaurants(itinerary.itinerary_data)
                    hotel_locations = [fetch_place_id(h['name'], h['context'], h['placeId']) for h in hotels]
                    restaurant_locations = [fetch_place_id(r['name'], r['context'], r['placeId']) for r in restaurants]
                    response_data = {
                        'itinerary': itinerary.itinerary_data,
                        'hotels': hotel_locations,
                        'restaurants': restaurant_locations
                    }
                else:
                    response_data = ItinerarySerializer(itinerary).data
                return Response(response_data)
            except Itinerary.DoesNotExist:
                return Response({'error': 'Itinerary not found'}, status=status.HTTP_404_NOT_FOUND)
        elif latest and detail:
            itinerary = itineraries.first()
            hotels, restaurants = extract_hotels_and_restaurants(itinerary.itinerary_data)
            hotel_locations = [fetch_place_id(h['name'], h['context'], h['placeId']) for h in hotels]
            restaurant_locations = [fetch_place_id(r['name'], r['context'], r['placeId']) for r in restaurants]
            response_data = {
                'itinerary': itinerary.itinerary_data,
                'hotels': hotel_locations,
                'restaurants': restaurant_locations
            }
            return Response(response_data)
        else:
            serializer = ItinerarySerializer(itineraries, many=True)
            return Response(serializer.data)

