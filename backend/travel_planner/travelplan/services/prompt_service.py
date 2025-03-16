import json
import logging

logger = logging.getLogger(__name__)

def get_transportation_prompt(preferences):
    # Use correct keys from frontend (departure, not departure_location)
    departure = preferences.get('departure', 'unspecified departure')
    destination = preferences.get('destination', 'unspecified destination')
    transportation = preferences.get('transportation', 'car')

    # Remove hardcoded distance/duration/cost; let AI estimate or use a lookup if available
    prompt = f"""
    You are a travel planner. Create a transportation plan for a trip from {departure} to {destination} using {transportation}.
    Provide the response as a valid JSON object only, with no additional text outside the JSON. Include:
    - Mode: {transportation}
    - Distance: Estimated distance in km (realistic for the route)
    - Duration: Estimated travel time (realistic for {transportation})
    - Cost: Estimated cost in INR (realistic for {transportation}, round trip)

    Example format:
    {{"mode": "{transportation}", "distance": "estimated km", "duration": "estimated time", "cost": "estimated INR"}}
    """
    return prompt

def get_hotels_restaurants_prompt(preferences):
    destination = preferences.get('destination', 'unspecified destination')
    budget = preferences.get('budget', '6000 Rupees')
    budget_value = float(budget.split()[0]) if budget.split() and budget.split()[0].isdigit() else 6000
    # Calculate nights from dates
    try:
        start_date = preferences.get('start_date', '2025-06-01')
        end_date = preferences.get('end_date', '2025-06-03')
        from datetime import datetime
        nights = (datetime.strptime(end_date, '%Y-%m-%d') - datetime.strptime(start_date, '%Y-%m-%d')).days
    except (ValueError, TypeError):
        nights = 2  # Default to 2 nights if dates are invalid

    prompt = f"""
    You are a travel planner. Suggest a hotel and restaurants in {destination} for a {nights}-night stay within a {budget_value} INR budget.
    Provide the response as a valid JSON object only, with no additional text outside the JSON. Include:
    - Hotel: Affordable option in {destination} (realistic name and cost per night)
    - Restaurants: 3 affordable options in {destination} (realistic names, 200-300 INR per meal)
    - Total hotel cost must fit within budget, reserving reasonable amounts for transport and activities/food.

    Example format:
    {{
      "hotel": {{"name": "Hotel Name", "cost_per_night": "X INR", "total_cost": "Y INR"}},
      "restaurants": [
        {{"name": "Restaurant 1", "cost": "Z INR"}},
        {{"name": "Restaurant 2", "cost": "W INR"}},
        {{"name": "Restaurant 3", "cost": "V INR"}}
      ]
    }}
    """
    return prompt

def get_itinerary_prompt(preferences, transportation_data, hotels_restaurants_data):
    departure = preferences.get('departure', 'unspecified departure')
    destination = preferences.get('destination', 'unspecified destination')
    start_date = preferences.get('start_date', '2025-06-01')
    end_date = preferences.get('end_date', '2025-06-03')
    travel_style = preferences.get('travel_style', 'Solo')
    activities = preferences.get('activities', [])
    activities_str = ', '.join(activities) if activities else 'general sightseeing'

    # Calculate trip days
    try:
        from datetime import datetime
        days = (datetime.strptime(end_date, '%Y-%m-%d') - datetime.strptime(start_date, '%Y-%m-%d')).days + 1
    except (ValueError, TypeError):
        days = 3  # Default to 3 days

    prompt = f"""
    You are a travel planner. Create a {days}-day itinerary for a {travel_style} trip from {departure} to {destination}.
    Provide the response as a valid JSON object only, with no additional text outside the JSON. Use:
    - Start date: {start_date}
    - End date: {end_date}
    - Transportation: {json.dumps(transportation_data)}
    - Hotels/Restaurants: {json.dumps(hotels_restaurants_data)}
    - Preferred activities: {activities_str}
    - Day 1: Travel to {destination}
    - Middle days: Sightseeing/activities in {destination} (include realistic attractions and costs)
    - Last day: Return to {departure}
    - Schedule meals using provided restaurants (lunch around 13:00)

    Example format:
    {{
      "days": [
        {{"day": "Day 1", "plan": [{{"time": "08:00-12:00", "activity": "Travel to {destination}", "cost": "X INR"}}, {{"time": "13:00-14:00", "activity": "Lunch at Restaurant 1", "cost": "Y INR"}}]}},
        {{"day": "Day 2", "plan": [{{"time": "09:00-11:00", "activity": "Sightseeing", "cost": "Z INR"}}]}},
        {{"day": "Day {days}", "plan": [{{"time": "12:00-16:00", "activity": "Return to {departure}", "cost": "0 INR"}}]}}
      ]
    }}
    """
    return prompt

def get_budget_prompt(preferences, transportation_data, hotels_restaurants_data, itinerary_data):
    budget = preferences.get('budget', '6000 Rupees')
    budget_value = float(budget.split()[0]) if budget.split() and budget.split()[0].isdigit() else 6000

    prompt = f"""
    You are a travel planner. Calculate the budget for a trip based on:
    - Transportation: {json.dumps(transportation_data)}
    - Hotels/Restaurants: {json.dumps(hotels_restaurants_data)}
    - Itinerary: {json.dumps(itinerary_data)}
    Provide the response as a valid JSON object only, with no additional text outside the JSON. 
    - Total cost must not exceed {budget_value} INR.
    - Extract numeric INR values (e.g., "2000 INR" = 2000) from data.
    - Breakdown: transport, hotel, food, activities.

    Example format:
    {{"total": 5630, "breakdown": {{"transport": 2000, "hotel": 3000, "food": 550, "activities": 80}}}}
    """
    return prompt

