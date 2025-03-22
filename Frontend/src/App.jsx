import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home/Home';
import Login from './pages/Login/Login';
import SignUp from './pages/SignUp/SignUp';
import Chatbot from './pages/Chatbot/Chatbot';
import Itinerary from './pages/Itinerary/Itinerary';
import PastItineraries from './pages/PastItineraries/PastItineraries';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/chatbot" element={<Chatbot />} />
        <Route path="/itinerary/:id?" element={<Itinerary />} />
        <Route path="/past-itineraries" element={<PastItineraries />} />
      </Routes>
    </Router>
  );
}

export default App;