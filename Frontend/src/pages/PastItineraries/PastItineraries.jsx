import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './PastItineraries.css';

const PastItineraries = () => {
  const [itineraries, setItineraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchItineraries = async () => {
      try {
        const response = await fetch('http://127.0.0.1:8000/api/itinerary/', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setItineraries(data);
        } else {
          throw new Error('Failed to fetch itineraries');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchItineraries();
  }, []);

  const handleViewItinerary = (itinerary) => {
    navigate('/itinerary', { state: { itinerary } });
  };

  if (loading) {
    return (
      <div className="past-itineraries-container">
        <p className="past-itineraries-text">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="past-itineraries-container">
        <h2 className="past-itineraries-header">Error</h2>
        <p className="past-itineraries-text">{error}</p>
        <div className="past-itineraries-button-container">
          <button className="past-itineraries-button" onClick={() => navigate('/chatbot')}>
            Back to Chatbot
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="past-itineraries-container">
      <h1 className="past-itineraries-header">Past Itineraries</h1>
      {itineraries.length === 0 ? (
        <p className="past-itineraries-text">No past itineraries found. Create a new one!</p>
      ) : (
        <div className="itinerary-list">
          {itineraries.map((itinerary) => (
            <div key={itinerary.id} className="itinerary-card">
              <h3>{itinerary.itinerary_data.destination}</h3>
              <p className="past-itineraries-text">
                <strong>Duration:</strong> {itinerary.itinerary_data.duration}
              </p>
              <p className="past-itineraries-text">
                <strong>Created:</strong> {new Date(itinerary.created_at).toLocaleDateString()}
              </p>
              <button
                className="past-itineraries-button"
                onClick={() => handleViewItinerary(itinerary)}
              >
                View Details
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="past-itineraries-button-container">
        <button className="past-itineraries-button" onClick={() => navigate('/chatbot')}>
          Back to Chatbot
        </button>
      </div>
    </div>
  );
};

export default PastItineraries;