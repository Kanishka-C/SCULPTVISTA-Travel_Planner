import json
import google.generativeai as genai
from django.conf import settings
from .prompt_service import get_unstructured_itinerary_prompt, get_structured_itinerary_prompt
import logging
import re

logger = logging.getLogger(__name__)

class GeminiService:
    def __init__(self):
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.model = genai.GenerativeModel('gemini-2.0-flash')  # Adjust model name as needed

    def generate_raw_itinerary(self, preferences):
        """Generate the unstructured itinerary."""
        try:
            prompt = get_unstructured_itinerary_prompt(preferences)
            print(f"Unstructured prompt sent to Gemini: {prompt}")
            response = self.model.generate_content(prompt)
            raw_itinerary = response.text.strip()
            print(f"Raw itinerary from Gemini: {raw_itinerary}")
            logger.debug(f"Unstructured Prompt: {prompt}\nRaw Response: '{raw_itinerary}'")
            if not raw_itinerary:
                raise ValueError("Empty response from Gemini API")
            return raw_itinerary
        except Exception as e:
            logger.error(f"Error generating raw itinerary: {str(e)}")
            raise Exception(f"Failed to generate raw itinerary: {str(e)}")

    def structure_itinerary(self, raw_itinerary, preferences):
        """Restructure the raw itinerary into JSON, enforcing startPoint."""
        try:
            prompt = get_structured_itinerary_prompt(raw_itinerary)
            print(f"Structured prompt sent to Gemini: {prompt}")
            response = self.model.generate_content(prompt)
            response_text = response.text.strip()
            print(f"Structured response from Gemini: {response_text}")
            logger.debug(f"Structured Prompt: {prompt}\nRaw Response: '{response_text}'")

            if not response_text:
                raise ValueError("Empty response from Gemini API")

            try:
                itinerary_data = json.loads(response_text)
            except json.JSONDecodeError:
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    json_str = json_match.group(0)
                    logger.debug(f"Extracted JSON: '{json_str}'")
                    itinerary_data = json.loads(json_str)
                else:
                    logger.error(f"Failed to parse JSON: '{response_text}'")
                    raise ValueError("Invalid JSON response from Gemini API")

            # Forcefully set startPoint to user input
            original_start_point = itinerary_data.get('startPoint', 'Not set')
            itinerary_data['startPoint'] = preferences['startPoint']
            if original_start_point != preferences['startPoint']:
                print(f"Overrode startPoint from '{original_start_point}' to '{preferences['startPoint']}'")

            # Force first activity to start from user’s startPoint
            if itinerary_data.get('itinerary') and len(itinerary_data['itinerary']) > 0:
                first_day = itinerary_data['itinerary'][0]
                if first_day.get('schedule') and len(first_day['schedule']) > 0:
                    first_activity = first_day['schedule'][0]['activity']
                    if "NSS College" in first_activity or not first_activity.startswith(f"Depart from {preferences['startPoint']}"):
                        new_activity = f"Depart from {preferences['startPoint']} to {preferences['destination']}"
                        print(f"Overrode first activity from '{first_activity}' to '{new_activity}'")
                        first_day['schedule'][0]['activity'] = new_activity

            return itinerary_data

        except Exception as e:
            logger.error(f"Error structuring itinerary: {str(e)}")
            raise Exception(f"Failed to structure itinerary: {str(e)}")

    def generate_itinerary(self, preferences):
        """Generate and structure the itinerary in two steps."""
        raw_itinerary = self.generate_raw_itinerary(preferences)
        structured_itinerary = self.structure_itinerary(raw_itinerary, preferences)
        return structured_itinerary