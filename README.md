# SCULPTVISTA-AI Powered Personalized Travel Planner 🌍✈️
## 🚀 Project Overview
SCULPTIVISTA is a personalized travel planner that leverages AI to create customized travel itineraries. With features like health-focused recommendations, budget planning, and destination suggestions based on user interests, it aims to provide a seamless travel experience.

## 🎯 Features
- 🧭 Personalized travel recommendations based on user preferences.
- 💡 Integration of AI (via Gemini) for smart itinerary planning.
- 🏞️ Tourist destination suggestions based on interests and travel history.
- 💰 Budget prediction and cost breakdown for trips.
- 🚗 Distance and travel time calculations for better planning.
- 🛌 Hotel and restaurant suggestions with visualization in Google Maps
- 📄 Download generated itineraries in a PDF format for offline access.
## 🛠 Tech Stack
### Frontend
- HTML
- CSS
- React.js library
- Vite (build tool and development server)
### Backend
- Python Django REST Framework
- Gemini API
- Google Maps API
### Database
- SQLite
## Setup Instructions
### 1.Clone the repository
```bash
git clone https://github.com/Kanishka-C/SCULPTVISTA-Travel_Planner.git
cd SCULPTVISTA-Travel_Planner
```
### 2. Backend Setup
- Open command prompt and navigate to ```/backend``` directory:
```bash
cd backend/travelplanner
```
- Set up a virtual environment
```bash
python -m venv venv
```
- Activate the virtual environment:
  - Windows:
    ```bash
    venv\Scripts\activate
    ```
  - macOS/Linux: 
    ```bash
    source venv/bin/activate
    ```
- Install the required dependencies:
```bash
pip install -r requirements.txt  
```
- Run the Django server:
```bash
python manage.py runserver  
```
### 3.Frontend Setup
- Navigate to the ```/Frontend``` directory and install dependencies:
```bash
cd Frontend  
npm install  
```
- Start the development server:
```bash
npm run dev  
```
### 4. Run the application
Open your browser and go to: 
 http://localhost:5173

 ## Acknowledgements
 - Thanks to [Gemini API](https://ai.google.dev/) and [Google Maps API](https://mapsplatform.google.com/) for powering the AI features
