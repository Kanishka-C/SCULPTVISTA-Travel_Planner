# services/gemini_service.py
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
            response = self.model.generate_content(prompt)
            raw_itinerary = response.text.strip()
            logger.debug(f"Unstructured Prompt: {prompt}\nRaw Response: '{raw_itinerary}'")
            if not raw_itinerary:
                raise ValueError("Empty response from Gemini API")
            return raw_itinerary
        except Exception as e:
            logger.error(f"Error generating raw itinerary: {str(e)}")
            raise Exception(f"Failed to generate raw itinerary: {str(e)}")

    def structure_itinerary(self, raw_itinerary):
        """Restructure the raw itinerary into JSON."""
        try:
            prompt = get_structured_itinerary_prompt(raw_itinerary)
            response = self.model.generate_content(prompt)
            response_text = response.text.strip()
            logger.debug(f"Structured Prompt: {prompt}\nRaw Response: '{response_text}'")

            if not response_text:
                raise ValueError("Empty response from Gemini API")

            try:
                itinerary_data = json.loads(response_text)
                return itinerary_data
            except json.JSONDecodeError:
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    json_str = json_match.group(0)
                    logger.debug(f"Extracted JSON: '{json_str}'")
                    itinerary_data = json.loads(json_str)
                    return itinerary_data
                else:
                    logger.error(f"Failed to parse JSON: '{response_text}'")
                    raise ValueError("Invalid JSON response from Gemini API")

        except Exception as e:
            logger.error(f"Error structuring itinerary: {str(e)}")
            raise Exception(f"Failed to structure itinerary: {str(e)}")

    def generate_itinerary(self, preferences):
        """
        Generate and structure the itinerary in two steps.
        """
        raw_itinerary = self.generate_raw_itinerary(preferences)
        structured_itinerary = self.structure_itinerary(raw_itinerary)
        return structured_itinerary

