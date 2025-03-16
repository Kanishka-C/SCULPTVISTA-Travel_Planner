import json
import google.generativeai as genai
from django.conf import settings
from .prompt_service import (
    get_transportation_prompt, get_hotels_restaurants_prompt,
    get_itinerary_prompt, get_budget_prompt
)
import logging
import re

logger = logging.getLogger(__name__)

class GeminiService:
    def __init__(self):
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.model = genai.GenerativeModel('gemini-2.0-flash')

    def generate_component(self, prompt):
        try:
            response = self.model.generate_content(prompt)
            response_text = response.text.strip()
            logger.debug(f"Prompt: {prompt}\nRaw Response: '{response_text}'")
            if not response_text:
                raise ValueError("Empty response from Gemini API")

            try:
                return json.loads(response_text)
            except json.JSONDecodeError:
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    json_str = json_match.group(0)
                    logger.debug(f"Extracted JSON: '{json_str}'")
                    return json.loads(json_str)
                logger.warning(f"Non-JSON response: '{response_text}'. Using fallback.")
                return {"error": "Invalid response format", "raw_response": response_text}

        except Exception as e:
            logger.error(f"Error generating component: {str(e)}")
            raise Exception(f"Failed to generate component: {str(e)}")

    def generate_itinerary(self, preferences):
        try:
            # Step 1: Transportation
            transport_prompt = get_transportation_prompt(preferences)
            transportation_data = self.generate_component(transport_prompt)
            if "error" in transportation_data:
                return transportation_data

            # Step 2: Hotels/Restaurants
            hotels_restaurants_prompt = get_hotels_restaurants_prompt(preferences)
            hotels_restaurants_data = self.generate_component(hotels_restaurants_prompt)
            if "error" in hotels_restaurants_data:
                return hotels_restaurants_data

            # Step 3: Itinerary
            itinerary_prompt = get_itinerary_prompt(preferences, transportation_data, hotels_restaurants_data)
            itinerary_data = self.generate_component(itinerary_prompt)
            if "error" in itinerary_data:
                return itinerary_data

            # Step 4: Budget
            budget_prompt = get_budget_prompt(preferences, transportation_data, hotels_restaurants_data, itinerary_data)
            budget_data = self.generate_component(budget_prompt)
            if "error" in budget_data:
                return budget_data

            # Combine results
            final_itinerary = {
                "itinerary": itinerary_data,
                "transportation": transportation_data,
                "accommodation": hotels_restaurants_data.get("hotel", {}),
                "restaurants": hotels_restaurants_data.get("restaurants", []),
                "budget": budget_data
            }

            # Enforce budget
            budget_value = float(preferences.get('budget', '6000 Rupees').split()[0]) if preferences.get('budget', '6000 Rupees').split() else 6000
            total_budget = final_itinerary['budget'].get('total', 0)
            if total_budget > budget_value:
                logger.warning(f"Budget exceeded: {total_budget} > {budget_value}. Capping.")
                final_itinerary['budget']['total'] = budget_value
                # Adjust activities if possible
                final_itinerary['budget']['breakdown']['activities'] = max(
                    0, budget_value - (
                        final_itinerary['budget']['breakdown'].get('transport', 0) +
                        final_itinerary['budget']['breakdown'].get('hotel', 0) +
                        final_itinerary['budget']['breakdown'].get('food', 0)
                    )
                )
                final_itinerary['warnings'] = ["Budget capped at 6000 INR; reduced activity costs."]

            return final_itinerary

        except Exception as e:
            logger.error(f"Error generating itinerary: {str(e)}")
            raise Exception(f"Failed to generate itinerary: {str(e)}")
