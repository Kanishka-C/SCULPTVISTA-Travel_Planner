import json
import google.generativeai as genai
from django.conf import settings
from .prompt_service import create_prompt_from_preferences

class GeminiService:
    """Service for interacting with the Gemini API"""
    
    def __init__(self):
        """Initialize the Gemini API client"""
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.model = genai.GenerativeModel('gemini-2.0-flash')
    
    def generate_itinerary(self, user_preferences):
        # Create a prompt for Gemini
        prompt = create_prompt_from_preferences(user_preferences)
        
        try:
            # Make request to Gemini API
            response = self.model.generate_content(prompt)
            
            # Extract text response from Gemini
            response_text = response.text
            
            # Sometimes Gemini returns code blocks, we need to extract the JSON
            json_str = self._extract_json_from_response(response_text)
            
            # Parse the JSON string to a Python dictionary
            itinerary_data = json.loads(json_str)
            
            return itinerary_data
            
        except Exception as e:
            print(f"Error generating itinerary: {str(e)}")
            raise Exception(f"Failed to generate itinerary: {str(e)}")
    
    def _extract_json_from_response(self, response_text):
        # Check if response is wrapped in markdown code block
        if "```json" in response_text and "```" in response_text:
            # Extract content between ```json and ``` markers
            start_index = response_text.find("```json") + 7
            end_index = response_text.rfind("```")
            json_str = response_text[start_index:end_index].strip()
        # Check if response is wrapped in just code block
        elif "```" in response_text:
            start_index = response_text.find("```") + 3
            end_index = response_text.rfind("```")
            json_str = response_text[start_index:end_index].strip()
        else:
            # Assume the entire response is JSON
            json_str = response_text.strip()
        
        return json_str