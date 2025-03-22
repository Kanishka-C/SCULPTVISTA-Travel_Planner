# services/prompt_service.py
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

def get_unstructured_itinerary_prompt(preferences):
    departure = preferences.get('departure location', 'NSS College of Engineering, Palakkad')
    destination = preferences.get('destination', 'Ooty')
    budget = preferences.get('budget', '6000 Rupees')
    budget_value = budget.split()[0] if budget.split() else "6000"
    travel_style = preferences.get('travel_style', 'Solo')
    transportation = preferences.get('transportation', 'public transport')
    try:
        days = (datetime.strptime(preferences.get('end_date', '2025-06-01'), '%Y-%m-%d') - 
                datetime.strptime(preferences.get('start_date', '2025-06-01'), '%Y-%m-%d')).days + 1
        days = max(days, 1)
    except (ValueError, TypeError):
        days = 2

    prompt = f"""
    generate an itinerary for a {travel_style} {days}-day trip from {departure} to {destination}, 
    generate a detailed travel plan with mode of transportation as {transportation}, 
    activities, restaurant names (for breakfast, lunch, and dinner), 
    accommodation (with name of hotel), 
    also generate a realistic budget breaking down the cost within {budget_value} Rupees. 
    For each hotel, restaurant, and activity location, include its Google Maps Place ID (e.g., ChIJ...) 
    if available, or note 'ID not available' if not found.
    """
    return prompt

def get_structured_itinerary_prompt(raw_itinerary):
    prompt = f"""
    You are a travel planner. Take the following unstructured itinerary and convert it into a structured JSON object matching this exact format:
    
    {{
      "tripName": "<Travel Style> <Destination> Trip from <Departure>",
      "duration": "<Days> Day(s)",
      "groupSize": 1,
      "travelStyle": "<Travel Style>",
      "season": "Adaptable, avoid peak monsoon",
      "startPoint": "<Departure>",
      "endPoint": "<Departure>",
      "itinerary": [
        {{
          "day": 1,
          "title": "Journey to <Destination> and Initial Exploration",
          "schedule": [
            {{"time": "<Time Range>", "activity": "<Activity Description>", "costPerPerson": "<Cost>", "placeId": "<Google Maps Place ID>"}}
          ]
        }},
        // Additional days if applicable
      ],
      "hotelRecommendations": [
        {{"category": "Budget-Friendly", "options": ["<Hotel Name>"], "placeId": "<Google Maps Place ID>"}}
      ],
      "hotelCostEstimate": {{
        "costPerRoomPerNight": "<Cost Range>",
        "assumptions": "Budget-friendly option for 1 traveler",
        "costPerPerson": "<Cost Range>"
      }},
      "budgetCalculation": {{
        "transportation": {{"totalTransportation": "<Cost Range>"}},
        "accommodation": "<Cost Range>",
        "food": {{"totalFood": "<Cost Range>"}},
        "activitiesEntryFees": "<Cost Range>",
        "miscellaneous": "<Cost Range>",
        "totalEstimatedBudgetPerPerson": "<Total Cost Range>"
      }},
      "importantNotesAndTips": [
        "<Note 1>",
        "<Note 2>"
      ]
    }}

    Here’s the unstructured itinerary to convert:
    {raw_itinerary}

    Ensure:
    - Extract days, timings, activities, restaurant names, hotel name, and costs from the text.
    - Include Google Maps Place IDs (e.g., 'ChIJ...') for hotels, restaurants, and activity locations as 'placeId' fields.
    - If no Place ID is provided, use 'ID not available'.
    - Fill in the JSON structure accurately based on the provided data.
    - Use realistic cost ranges in INR (e.g., '₹200-₹300').
    - Provide the response as a valid JSON object only.
    """
    return prompt


