from django.db import models

# Create your models here.
from django.contrib.auth.models import User
import json
from datetime import date

class UserPreference(models.Model):
    """Store user preferences for travel planning"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='preferences')
    departure=models.CharField(max_length=255, blank=True, null=True)
    destination = models.CharField(max_length=255, blank=True, null=True)
    budget = models.CharField(max_length=100, blank=True, null=True)
    start_date=models.DateField(default=date.today, null=False, blank=False)
    end_date=models.DateField(default=date.today, null=False, blank=False)
    travel_style = models.CharField(max_length=100, blank=True, null=True)
    activities = models.TextField(blank=True, null=True)
    transportation = models.CharField(max_length=100, blank=True, null=True)
    health_issues = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.username}'s preferences for {self.destination}"
    
    def get_activities_list(self):
    #Convert activities string to list if necessary
        if isinstance(self.activities, list):  
        # If already a list, return as it is (ensure no extra spaces)
            return [act.strip() for act in self.activities]  

        if isinstance(self.activities, str):  
        # If it's a string, split it into a list
            return [act.strip() for act in self.activities.split(',')]

        return []  # Return empty list if activities is None or unexpected type

    def get_health_issues_list(self):
        """Convert health issues string to list"""
        if isinstance(self.health_issues, list):  
        # If already a list, return as it is (ensure no extra spaces)
            return [issues.strip() for issues in self.health_issues]  

        if isinstance(self.health_issues, str):  
        # If it's a string, split it into a list
            return [issues.strip() for issues in self.health_issues.split(',')]
        
        return []
    
    def to_dict(self):
        """Convert model to dictionary for AI prompt creation"""
        return {
            'departure': self.departure,
            'destination': self.destination,
            'budget': self.budget,
            'start_date':self.start_date,
            'end_date':self.end_date,           
            'travel_style': self.travel_style,
            'activities': self.get_activities_list(),
            'transportation': self.transportation,
            'health_issues': self.get_health_issues_list(),
        }

class Itinerary(models.Model):
    """Store generated itineraries"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='itineraries')
    preference = models.ForeignKey(UserPreference, on_delete=models.CASCADE, related_name='itineraries')
    itinerary_data = models.JSONField() #to store structured JSON data in the database.
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Itinerary for {self.user.username} - {self.created_at}"
    
    def get_itinerary_json(self):
        """Return itinerary data as JSON string"""
        return json.dumps(self.itinerary_data)