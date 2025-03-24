import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, Marker, MarkerClusterer } from '@react-google-maps/api';
import api from '../../api';
import './PastItineraries.css';

const PastItineraries = () => {
  const [itineraries, setItineraries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mapsLoaded, setMapsLoaded] = useState(false); // Custom state to track script availability
  const navigate = useNavigate();

  const mapContainerStyle = { width: '100%', height: '200px' };

  const isValidLatLng = (lat, lng) => {
    return typeof lat === 'number' && !isNaN(lat) && typeof lng === 'number' && !isNaN(lng);
  };

  // Check if Google Maps script is loaded
  useEffect(() => {
    const checkMapsLoaded = () => {
      if (window.google && window.google.maps) {
        setMapsLoaded(true);
      } else {
        // Poll until loaded (or timeout)
        const interval = setInterval(() => {
          if (window.google && window.google.maps) {
            setMapsLoaded(true);
            clearInterval(interval);
          }
        }, 100);
        setTimeout(() => clearInterval(interval), 5000); // Give up after 5s
      }
    };
    checkMapsLoaded();
  }, []);

  useEffect(() => {
    const fetchItineraries = async () => {
      try {
        const response = await api.get('/api/itinerary/user-itineraries/');
        console.log("Fetched itineraries:", JSON.stringify(response.data, null, 2));
        if (mapsLoaded) {
          const itinerariesWithLocations = await Promise.all(
            response.data.map(async (itinerary) => {
              const locations = await loadMapLocations(itinerary);
              const mapCenter = await getMapCenter(itinerary, locations);
              return { ...itinerary, locations, mapCenter };
            })
          );
          setItineraries(itinerariesWithLocations);
        } else {
          setItineraries(response.data); // Fallback without maps
        }
      } catch (err) {
        console.error("Error fetching itineraries:", err);
        if (err.response?.status === 401) {
          setError("Please log in to view your past itineraries.");
          navigate('/login');
        } else {
          setError(err.response?.data?.detail || err.message || "Failed to fetch itineraries.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchItineraries();
  }, [mapsLoaded]); // Depend on mapsLoaded instead of isLoaded
  const getMapCenter = async (itinerary, locations) => {
    const destination = itinerary.itinerary_data.tripName?.match(/to\s(.+?)(\s|$)/)?.[1] || "Unknown";
    const hotelCoords = itinerary.hotels?.[0];
    const restaurantCoords = itinerary.restaurants?.[0];
    if (hotelCoords && isValidLatLng(hotelCoords.lat, hotelCoords.lng)) {
      console.log("Map center set to hotel coordinates:", { lat: hotelCoords.lat, lng: hotelCoords.lng });
      return { lat: hotelCoords.lat, lng: hotelCoords.lng };
    } else if (restaurantCoords && isValidLatLng(restaurantCoords.lat, restaurantCoords.lng)) {
      console.log("Map center set to restaurant coordinates:", { lat: restaurantCoords.lat, lng: restaurantCoords.lng });
      return { lat: restaurantCoords.lat, lng: restaurantCoords.lng };
    } else if (locations.length > 0) {
      const firstValidLocation = locations[0];
      console.log("Map center set to first valid activity location:", {
        lat: firstValidLocation.lat,
        lng: firstValidLocation.lng,
      });
      return { lat: firstValidLocation.lat, lng: firstValidLocation.lng };
    } else {
      const startPoint = itinerary.itinerary_data.startPoint;
      const endPoint = itinerary.itinerary_data.endPoint;
      const fallbackPoint = startPoint || endPoint;
      if (fallbackPoint && mapsLoaded) {
        return new Promise((resolve) => {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ address: fallbackPoint }, (results, status) => {
            if (status === "OK" && results[0]) {
              const lat = results[0].geometry.location.lat();
              const lng = results[0].geometry.location.lng();
              if (isValidLatLng(lat, lng)) {
                console.log(`Map center set to ${fallbackPoint}:`, { lat, lng });
                resolve({ lat, lng });
              } else {
                resolve(null);
              }
            } else {
              console.warn(`Geocoding failed for "${fallbackPoint}": ${status}`);
              resolve(null);
            }
          });
        });
      }
      return null;
    }
  };

  const loadMapLocations = async (itinerary) => {
    if (!itinerary.itinerary_data.itinerary?.length || !mapsLoaded) {
      console.log("No itinerary schedule to process for locations or Google Maps not loaded");
      return [];
    }

    const geocoder = new window.google.maps.Geocoder();
    const destination = itinerary.itinerary_data.tripName?.match(/to\s(.+?)(\s|$)/)?.[1] || "Unknown";
    const allLocations = itinerary.itinerary_data.itinerary.flatMap(day =>
      day.schedule
        .filter(item => item.activity)
        .map(item => {
          const match = item.activity.match(/(?:Visit|at|to)\s+(?:the\s+)?(?:magnificent\s+)?(.+?)(?:,|$)/i);
          const placeName = match ? match[1].trim() : item.activity.split(" ").slice(-2).join(" ");
          return { name: placeName, fullName: item.activity };
        })
    );

    console.log("Locations to geocode (parsed from activities):", JSON.stringify(allLocations, null, 2));

    const coords = await Promise.all(
      allLocations.map(loc =>
        new Promise((resolve) => {
          const fullLocation = `${loc.name}, ${destination}`;
          geocoder.geocode({ address: fullLocation }, (results, status) => {
            console.log(`Geocoding "${fullLocation}" - Status: ${status}, Results:`, results);
            if (status === "OK" && results[0]) {
              const lat = results[0].geometry.location.lat();
              const lng = results[0].geometry.location.lng();
              if (isValidLatLng(lat, lng)) {
                resolve({ name: loc.name, lat, lng, type: "activity" });
              } else {
                console.warn(`Invalid lat/lng for "${fullLocation}"`);
                resolve(null);
              }
            } else {
              console.warn(`Geocoding failed for "${fullLocation}": ${status}`);
              resolve(null);
            }
          });
        })
      )
    );

    const validLocations = coords.filter(loc => loc !== null);
    console.log("Valid map locations:", JSON.stringify(validLocations, null, 2));
    return validLocations;
  };

  if (loading) {
    return (
      <div className="past-itineraries-container">
        <p className="past-itineraries-text">Loading past itineraries...</p>
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
          {error.includes("log in") && (
            <button className="past-itineraries-button" onClick={() => navigate('/login')}>
              Go to Login
            </button>
          )}
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
              <h3>
                {itinerary.itinerary_data?.destination || itinerary.itinerary_data?.tripName || "Unnamed Trip"}
              </h3>
              <p className="past-itineraries-text">
                <strong>Duration:</strong> {itinerary.itinerary_data?.duration || "N/A"}
              </p>
              <p className="past-itineraries-text">
                <strong>Created:</strong> {new Date(itinerary.created_at).toLocaleDateString()}
              </p>
              {!mapsLoaded ? (
                <p>Loading map (ensure Google Maps script is loaded)...</p>
              ) : !itinerary.mapCenter || !isValidLatLng(itinerary.mapCenter.lat, itinerary.mapCenter.lng) ? (
                <p>No valid coordinates available for map</p>
              ) : (
                <GoogleMap mapContainerStyle={mapContainerStyle} center={itinerary.mapCenter} zoom={8}>
                  <MarkerClusterer averageCenter enableRetinaIcons gridSize={60}>
                    {(clusterer) =>
                      itinerary.locations.map((location, index) =>
                        isValidLatLng(location.lat, location.lng) ? (
                          <Marker
                            key={index}
                            position={{ lat: location.lat, lng: location.lng }}
                            clusterer={clusterer}
                            label={{
                              text: location.name,
                              color: "black",
                              fontSize: "10px",
                              fontWeight: "bold",
                            }}
                            icon={{
                              url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
                            }}
                          />
                        ) : null
                      )
                    }
                  </MarkerClusterer>
                </GoogleMap>
              )}
              <button
                className="past-itineraries-button"
                onClick={() => navigate('/itinerary', { state: { itinerary } })}
              >
                View Details
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="past-itineraries-button-container">
        <button className="past-itineraries-button" onClick={() => navigate('/chatbot')}>
          Create New Itinerary
        </button>
      </div>
    </div>
  );
};

export default PastItineraries;
