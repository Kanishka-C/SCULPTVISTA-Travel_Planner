from rest_framework import serializers
from .models import UserPreference, Itinerary

class UserPreferenceSerializer(serializers.ModelSerializer):
    """Serializer for user travel preferences"""
    activities = serializers.ListField(required=False, allow_empty=True, default=[])
    health_issues = serializers.ListField(required=False, allow_empty=True, default=[])
    
    class Meta:
        model = UserPreference
        fields = [
            'id', 'departure', 'destination', 'budget', 'start_date', 'end_date',
            'travel_style', 'activities', 'transportation', 'health_issues',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def to_representation(self, instance):
        """Custom representation with lists for activities and health issues"""
        rep = super().to_representation(instance)
        rep['activities'] = instance.get_activities_list()
        rep['health_issues'] = instance.get_health_issues_list()
        return rep

class ItinerarySerializer(serializers.ModelSerializer):
    """Serializer for travel itineraries"""
    class Meta:
        model = Itinerary
        fields = ['id', 'user', 'preference', 'itinerary_data', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']
