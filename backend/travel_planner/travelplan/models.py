from django.db import models
from django.contrib.auth.models import User
import json
from datetime import date

class UserPreference(models.Model):
    """Store user preferences for travel planning"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='preferences')
    departure = models.CharField(max_length=255, blank=True, null=True)
    destination = models.CharField(max_length=255, blank=True, null=True)
    budget = models.CharField(max_length=100, blank=True, null=True)
    start_date = models.DateField(default=date.today, null=False, blank=False)
    end_date = models.DateField(default=date.today, null=False, blank=False)
    travel_style = models.CharField(max_length=100, blank=True, null=True)
    activities = models.TextField(blank=True, null=True)
    transportation = models.CharField(max_length=100, blank=True, null=True)
    health_issues = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.username}'s preferences for {self.destination or 'unknown'}"
    
    def get_activities_list(self):
        """Convert activities string to list"""
        if isinstance(self.activities, list):
            return [act.strip() for act in self.activities]
        if isinstance(self.activities, str):
            return [act.strip() for act in self.activities.split(',') if act.strip()]
        return []
    
    def get_health_issues_list(self):
        """Convert health issues string to list"""
        if isinstance(self.health_issues, list):
            return [issue.strip() for issue in self.health_issues]
        if isinstance(self.health_issues, str):
            return [issue.strip() for issue in self.health_issues.split(',') if issue.strip()]
        return []
    
    def to_dict(self):
        """Convert model to dictionary for AI prompt creation"""
        return {
            'departure': self.departure or "",
            'destination': self.destination or "",
            'budget': self.budget or "unspecified",
            'start_date': str(self.start_date),
            'end_date': str(self.end_date),
            'travel_style': self.travel_style or "unspecified",
            'activities': self.get_activities_list(),
            'transportation': self.transportation or "unspecified",
            'health_issues': self.get_health_issues_list(),
        }

class Itinerary(models.Model):
    """Store generated itineraries"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='itineraries')
    preference = models.ForeignKey(UserPreference, on_delete=models.CASCADE, related_name='itineraries')
    itinerary_data = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Itinerary for {self.user.username} - {self.created_at}"
    
    def get_itinerary_json(self):
        """Return itinerary data as JSON string"""
        return json.dumps(self.itinerary_data)

