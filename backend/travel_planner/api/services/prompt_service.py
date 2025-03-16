from datetime import datetime
def create_prompt_from_preferences(preferences):
    # Extract preference values, providing defaults for missing fields
    departure = preferences.get('departure point', 'unspecified location')
    destination = preferences.get('destination', 'unspecified location')
    budget = preferences.get('budget', 'medium')
    start_date = preferences.get('start_date')
    end_date = preferences.get('end_date')
    travel_style = preferences.get('travel_style', 'balanced')
    activities = preferences.get('activities', [])
    transportation = preferences.get('transportation', 'public transport')
    health = preferences.get('health_issues', [])
    delta=end_date-start_date
    duration=delta.days+1
    # Format activities and health issues for the prompt
    activities_str = ', '.join(activities) if activities else 'various activities'
    health_str = ', '.join(health) if health else 'no specific health issues'
    
    prompt = f"""
    As a travel planning AI, create a detailed day-by-day travel itinerary based on the following user preferences:
    Departure point: {departure}
    Destination: {destination}
    Budget Level: {budget}
    Start Date: {start_date}
    End Date: {end_date}
    Duration: {duration} day
    Travelling With: {travel_style}
    Preferred Activities: {activities_str}
    Transportation Preference: {transportation}
    Health Issues: {health_str}
    
    Please structure your response as a valid JSON object with the following format:
    
    {{
      "destination": "Destination name",
      "duration": "Duration in days",
      "overview": "Brief overview of the itinerary",
      "budget_feasibility": "Brief description on budget feasibility "
      "daily_plan": [
        {{
          "day": 1,
          "title": "Day 1 title",
          "description": "Brief description of the day",
          "morning": {{
            "activity": "Morning activity",
            "description": "Description of activity",
            "location": "Location name"
          "breakfast":{{
            "restaurant": "Restaurant name, rate per meal"
          }},
          }},
          "afternoon": {{
            "activity": "Afternoon activity",
            "description": "Description of activity",
            "location": "Location name"
          "lunch":m{{
            "restaurant": "Restaurant name, rate per meal"
          }},
          }},
          "evening": {{
            "activity": "Evening activity",
            "description": "Description of activity",
            "location": "Location name"
          }},
          "dinner": {{
            "restaurant": "Restaurant name, rate per meal"
          }},
        }},
        // Additional days...
      ],
      "estimated_budget": {{
        "currency": "Rupees",
        "total": "Total estimated cost",
        "breakdown": {{
          "accommodation": "Accommodation cost",
          "food": "Food cost",
          "activities": "Activities cost",
          "transportation": "Transportation cost"
        }}
      }},
      "travel_tips": [
        "Tip 1",
        "Tip 2"
      ]
    }}
    If a field is not applicable, use null or skip it as appropriate.If the budget is insufficient, mention that.
    Ensure the response is valid JSON without any markdown formatting or extra text outside the JSON structure.
    """

    return prompt