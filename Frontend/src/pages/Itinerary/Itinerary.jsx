import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { jsPDF } from "jspdf";
import "./Itinerary.css";

const LIBRARIES = ["places", "geocoding"];

const Itinerary = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const backendItinerary = state?.itinerary;

  const [itinerary, setItinerary] = useState(backendItinerary || { itinerary_data: {} });
  const [locations, setLocations] = useState([]);
  const [mapCenter, setMapCenter] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  const googleMapsApiKey = "AIzaSyCPbEx2Cx-nxPvOEEYsMG3VsvAMkodoRI4"; // Replace with your actual key
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey,
    libraries: LIBRARIES,
  });

  const mapContainerStyle = { width: "100%", height: "400px" };

  const isValidLatLng = (lat, lng) => {
    return typeof lat === "number" && !isNaN(lat) && typeof lng === "number" && !isNaN(lng);
  };


  useEffect(() => {
    console.log("New backendItinerary received:", JSON.stringify(backendItinerary, null, 2));
    setItinerary(backendItinerary || { itinerary_data: {} });
    setLocations([]);
    setMapCenter(null);

    if (!isLoaded) {
      console.log("Google Maps API not loaded yet");
      return;
    }
    if (!backendItinerary?.itinerary_data) {
      console.log("No itinerary data available");
      return;
    }

    const destination = backendItinerary.itinerary_data.tripName?.match(/to\s(.+?)(\s|$)/)?.[1] || "Unknown";
    console.log("Extracted destination (or default):", destination);

    const hotelCoords = backendItinerary.hotels?.[0];
    const restaurantCoords = backendItinerary.restaurants?.[0];

    if (hotelCoords && isValidLatLng(hotelCoords.lat, hotelCoords.lng)) {
      setMapCenter({ lat: hotelCoords.lat, lng: hotelCoords.lng });
      console.log("Map center set to hotel coordinates:", { lat: hotelCoords.lat, lng: hotelCoords.lng });
      loadMapLocations(destination);
    } else if (restaurantCoords && isValidLatLng(restaurantCoords.lat, restaurantCoords.lng)) {
      setMapCenter({ lat: restaurantCoords.lat, lng: restaurantCoords.lng });
      console.log("Map center set to restaurant coordinates:", { lat: restaurantCoords.lat, lng: restaurantCoords.lng });
      loadMapLocations(destination);
    } else {
      console.log("No pre-geocoded coordinates found, falling back to activity or start/end points");
      loadMapLocations(destination);
    }
  }, [backendItinerary, isLoaded]);

  const loadMapLocations = (destination) => {
    if (!itinerary.itinerary_data.itinerary?.length) {
      console.log("No itinerary schedule to process for locations");
      return;
    }

    const geocoder = new window.google.maps.Geocoder();
    const allLocations = itinerary.itinerary_data.itinerary.flatMap(day =>
      day.schedule
        .filter(item => item.activity)
        .map(item => {
          const match = item.activity.match(/(?:Visit|at|to)\s+(.+?)(?:,|$)/i);
          const placeName = match ? match[1].trim() : item.activity.split(" ").slice(0, 3).join(" ");
          return { name: placeName, fullName: item.activity };
        })
    );

    console.log("Locations to geocode (parsed from activities):", JSON.stringify(allLocations, null, 2));

    Promise.all(
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
    ).then(coords => {
      const validLocations = coords.filter(loc => loc !== null);
      console.log("Valid map locations:", JSON.stringify(validLocations, null, 2));
      setLocations(validLocations);

      if (!mapCenter && validLocations.length > 0) {
        const firstValidLocation = validLocations[0];
        setMapCenter({ lat: firstValidLocation.lat, lng: firstValidLocation.lng });
        console.log("Map center set to first valid activity location:", {
          lat: firstValidLocation.lat,
          lng: firstValidLocation.lng,
        });
      } else if (!mapCenter) {
        const startPoint = itinerary.itinerary_data.startPoint;
        const endPoint = itinerary.itinerary_data.endPoint;
        const fallbackPoint = startPoint || endPoint;
        if (fallbackPoint) {
          geocoder.geocode({ address: fallbackPoint }, (results, status) => {
            console.log(`Geocoding fallback "${fallbackPoint}" - Status: ${status}, Results:`, results);
            if (status === "OK" && results[0]) {
              const lat = results[0].geometry.location.lat();
              const lng = results[0].geometry.location.lng();
              if (isValidLatLng(lat, lng)) {
                setMapCenter({ lat, lng });
                console.log(`Map center set to ${fallbackPoint}:`, { lat, lng });
              }
            } else {
              console.warn(`Geocoding failed for "${fallbackPoint}": ${status}`);
            }
          });
        } else {
          console.log("No valid coordinates found in data to set map center");
        }
      }
    });
  };

  const handleInputChange = (e, field, subField = null, dayIndex = null, scheduleIndex = null) => {
    const updatedItinerary = { ...itinerary };
    if (dayIndex !== null && scheduleIndex !== null) {
      updatedItinerary.itinerary_data.itinerary[dayIndex].schedule[scheduleIndex][field] = e.target.value;
    } else if (subField === "budgetCalculation.breakdown") {
      updatedItinerary.itinerary_data.budgetCalculation[field] = e.target.value;
    } else if (subField === "hotelCostEstimate") {
      updatedItinerary.itinerary_data.hotelCostEstimate[field] = e.target.value;
    } else if (subField) {
      updatedItinerary.itinerary_data[subField][field] = e.target.value;
    } else {
      updatedItinerary.itinerary_data[field] = e.target.value;
    }
    setItinerary(updatedItinerary);
  };

  const handleTravelTipChange = (e, index) => {
    const updatedItinerary = { ...itinerary };
    updatedItinerary.itinerary_data.importantNotesAndTips[index] = e.target.value;
    setItinerary(updatedItinerary);
  };

  const toggleEdit = () => {
    setIsEditing(!isEditing);
  };

  const saveChanges = () => {
    console.log("Updated Itinerary:", JSON.stringify(itinerary, null, 2));
    setIsEditing(false);
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    let yOffset = 10;
    const pageHeight = 297;
    const marginBottom = 20;
    const maxPageHeight = pageHeight - marginBottom;
    const lineHeight = 7;

    const addText = (text, x, y, fontSize, maxWidth = null) => {
      doc.setFontSize(fontSize);
      let lines = maxWidth ? doc.splitTextToSize(text, maxWidth) : [text];
      let textHeight = lines.length * lineHeight;

      if (y + textHeight > maxPageHeight) {
        doc.addPage();
        yOffset = 10;
      } else {
        yOffset = y;
      }

      if (maxWidth) {
        doc.text(lines, x, yOffset, { maxWidth });
      } else {
        doc.text(text, x, yOffset);
      }

      yOffset += textHeight;
      return yOffset;
    };

    yOffset = addText("Travel Itinerary", 10, yOffset, 20);
    yOffset += 5;

    yOffset = addText("Overview", 10, yOffset, 16);
    yOffset = addText(`Trip Name: ${itinerary.itinerary_data.tripName || "N/A"}`, 10, yOffset, 14);
    yOffset = addText(`Duration: ${itinerary.itinerary_data.duration || "N/A"}`, 10, yOffset, 14);
    yOffset = addText(`Start Point: ${itinerary.itinerary_data.startPoint || "N/A"}`, 10, yOffset, 14);
    yOffset = addText(`End Point: ${itinerary.itinerary_data.endPoint || "N/A"}`, 10, yOffset, 14);
    yOffset = addText(`Travel Style: ${itinerary.itinerary_data.travelStyle || "N/A"}`, 10, yOffset, 14);
    yOffset += 5;

    yOffset = addText("Daily Plan", 10, yOffset, 16);
    itinerary.itinerary_data.itinerary?.forEach(day => {
      yOffset = addText(`Day ${day.day}: ${day.title}`, 10, yOffset, 14);
      day.schedule.forEach(item => {
        yOffset = addText(`${item.time}: ${item.activity} (Cost: ${item.costPerPerson})`, 15, yOffset, 12, 170);
      });
      yOffset += 5;
    });

    yOffset = addText("Hotel Recommendations", 10, yOffset, 16);
    itinerary.itinerary_data.hotelRecommendations?.forEach(hotel => {
      yOffset = addText(`${hotel.category}: ${hotel.options.join(", ")}`, 15, yOffset, 12);
    });
    if (itinerary.itinerary_data.hotelCostEstimate) {
      yOffset = addText(`Hotel Cost Estimate:`, 15, yOffset, 12);
      yOffset = addText(`Cost per Room per Night: ${itinerary.itinerary_data.hotelCostEstimate.costPerRoomPerNight}`, 20, yOffset, 12);
      yOffset = addText(`Cost per Person: ${itinerary.itinerary_data.hotelCostEstimate.costPerPerson}`, 20, yOffset, 12);
      yOffset = addText(`Assumptions: ${itinerary.itinerary_data.hotelCostEstimate.assumptions}`, 20, yOffset, 12, 160);
    }
    yOffset += 5;

    yOffset = addText("Budget Breakdown", 10, yOffset, 16);
    if (itinerary.itinerary_data.budgetCalculation) {
      yOffset = addText(`Total: ${itinerary.itinerary_data.budgetCalculation.totalEstimatedBudgetPerPerson}`, 15, yOffset, 12);
      yOffset = addText(`Transportation: ${itinerary.itinerary_data.budgetCalculation.transportation.totalTransportation}`, 15, yOffset, 12);
      yOffset = addText(`Accommodation: ${itinerary.itinerary_data.budgetCalculation.accommodation}`, 15, yOffset, 12);
      yOffset = addText(`Food: ${itinerary.itinerary_data.budgetCalculation.food.totalFood}`, 15, yOffset, 12);
      yOffset = addText(`Activities: ${itinerary.itinerary_data.budgetCalculation.activitiesEntryFees}`, 15, yOffset, 12);
      yOffset = addText(`Miscellaneous: ${itinerary.itinerary_data.budgetCalculation.miscellaneous}`, 15, yOffset, 12);
    }
    yOffset += 5;

    yOffset = addText("Important Notes and Tips", 10, yOffset, 16);
    itinerary.itinerary_data.importantNotesAndTips?.forEach((tip, index) => {
      yOffset = addText(`${index + 1}. ${tip}`, 15, yOffset, 12, 170);
    });

    doc.save(`Itinerary_${itinerary.itinerary_data.tripName || "Trip"}.pdf`);
  };

  if (!backendItinerary) {
    return (
      <div className="itinerary-container">
        <h2 className="itinerary-header">No Itinerary Available</h2>
        <p>Please create an itinerary using the chatbot.</p>
        <button className="itinerary-button" onClick={() => navigate("/chatbot")}>
          Go to Chatbot
        </button>
      </div>
    );
  }

  return (
    <div className="itinerary-container">
      <h2 className="itinerary-header">Your Personalized Travel Itinerary</h2>

      <div className="itinerary-section">
        <h3 className="itinerary-subheader">Overview</h3>
        <p className="itinerary-text">
          <strong>Trip Name:</strong>{" "}
          {isEditing ? (
            <input
              type="text"
              value={itinerary.itinerary_data.tripName || ""}
              onChange={(e) => handleInputChange(e, "tripName")}
            />
          ) : (
            itinerary.itinerary_data.tripName || "N/A"
          )}
        </p>
        <p className="itinerary-text">
          <strong>Duration:</strong>{" "}
          {isEditing ? (
            <input
              type="text"
              value={itinerary.itinerary_data.duration || ""}
              onChange={(e) => handleInputChange(e, "duration")}
            />
          ) : (
            itinerary.itinerary_data.duration || "N/A"
          )}
        </p>
        <p className="itinerary-text">
          <strong>Start Point:</strong>{" "}
          {isEditing ? (
            <input
              type="text"
              value={itinerary.itinerary_data.startPoint || ""}
              onChange={(e) => handleInputChange(e, "startPoint")}
            />
          ) : (
            itinerary.itinerary_data.startPoint || "N/A"
          )}
        </p>
        <p className="itinerary-text">
          <strong>End Point:</strong>{" "}
          {isEditing ? (
            <input
              type="text"
              value={itinerary.itinerary_data.endPoint || ""}
              onChange={(e) => handleInputChange(e, "endPoint")}
            />
          ) : (
            itinerary.itinerary_data.endPoint || "N/A"
          )}
        </p>
        <p className="itinerary-text">
          <strong>Travel Style:</strong>{" "}
          {isEditing ? (
            <input
              type="text"
              value={itinerary.itinerary_data.travelStyle || ""}
              onChange={(e) => handleInputChange(e, "travelStyle")}
            />
          ) : (
            itinerary.itinerary_data.travelStyle || "N/A"
          )}
        </p>
        <p className="itinerary-text">
          <strong>Season:</strong>{" "}
          {isEditing ? (
            <input
              type="text"
              value={itinerary.itinerary_data.season || ""}
              onChange={(e) => handleInputChange(e, "season")}
            />
          ) : (
            itinerary.itinerary_data.season || "N/A"
          )}
        </p>
      </div>

      <div className="itinerary-section">
        <h3 className="itinerary-subheader">Daily Plan</h3>
        {itinerary.itinerary_data.itinerary?.length > 0 ? (
          <ul className="itinerary-list">
            {itinerary.itinerary_data.itinerary.map((day, dayIndex) => (
              <li key={dayIndex} className="itinerary-list-item">
                <h4>
                  Day {day.day}:{" "}
                  {isEditing ? (
                    <input
                      type="text"
                      value={day.title}
                      onChange={(e) => {
                        const updated = { ...itinerary };
                        updated.itinerary_data.itinerary[dayIndex].title = e.target.value;
                        setItinerary(updated);
                      }}
                    />
                  ) : (
                    day.title
                  )}
                </h4>
                {day.schedule.map((item, scheduleIndex) => (
                  <p key={scheduleIndex} className="itinerary-text">
                    {isEditing ? (
                      <>
                        <input
                          type="text"
                          value={item.time}
                          onChange={(e) => handleInputChange(e, "time", null, dayIndex, scheduleIndex)}
                        />
                        :{" "}
                        <input
                          type="text"
                          value={item.activity}
                          onChange={(e) => handleInputChange(e, "activity", null, dayIndex, scheduleIndex)}
                        />{" "}
                        (Cost:{" "}
                        <input
                          type="text"
                          value={item.costPerPerson}
                          onChange={(e) => handleInputChange(e, "costPerPerson", null, dayIndex, scheduleIndex)}
                        />
                        )
                      </>
                    ) : (
                      `${item.time}: ${item.activity} (Cost: ${item.costPerPerson})`
                    )}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        ) : (
          <p className="itinerary-text">No daily itinerary available.</p>
        )}
      </div>

      <div className="itinerary-section">
        <h3 className="itinerary-subheader">Hotel Recommendations</h3>
        {itinerary.itinerary_data.hotelRecommendations?.length > 0 ? (
          <ul className="itinerary-list">
            {itinerary.itinerary_data.hotelRecommendations.map((hotel, index) => (
              <li key={index} className="itinerary-list-item">
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={hotel.category}
                      onChange={(e) => {
                        const updated = { ...itinerary };
                        updated.itinerary_data.hotelRecommendations[index].category = e.target.value;
                        setItinerary(updated);
                      }}
                    />
                    :{" "}
                    <input
                      type="text"
                      value={hotel.options.join(", ")}
                      onChange={(e) => {
                        const updated = { ...itinerary };
                        updated.itinerary_data.hotelRecommendations[index].options = e.target.value.split(", ");
                        setItinerary(updated);
                      }}
                    />
                  </>
                ) : (
                  `${hotel.category}: ${hotel.options.join(", ")}`
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="itinerary-text">No hotel recommendations available.</p>
        )}
        {itinerary.itinerary_data.hotelCostEstimate && (
          <div>
            <p className="itinerary-text"><strong>Hotel Cost Estimate:</strong></p>
            <p className="itinerary-text">
              Cost per Room per Night:{" "}
              {isEditing ? (
                <input
                  type="text"
                  value={itinerary.itinerary_data.hotelCostEstimate.costPerRoomPerNight}
                  onChange={(e) => handleInputChange(e, "costPerRoomPerNight", "hotelCostEstimate")}
                />
              ) : (
                itinerary.itinerary_data.hotelCostEstimate.costPerRoomPerNight
              )}
            </p>
            <p className="itinerary-text">
              Cost per Person:{" "}
              {isEditing ? (
                <input
                  type="text"
                  value={itinerary.itinerary_data.hotelCostEstimate.costPerPerson}
                  onChange={(e) => handleInputChange(e, "costPerPerson", "hotelCostEstimate")}
                />
              ) : (
                itinerary.itinerary_data.hotelCostEstimate.costPerPerson
              )}
            </p>
            <p className="itinerary-text">
              Assumptions:{" "}
              {isEditing ? (
                <textarea
                  value={itinerary.itinerary_data.hotelCostEstimate.assumptions}
                  onChange={(e) => handleInputChange(e, "assumptions", "hotelCostEstimate")}
                />
              ) : (
                itinerary.itinerary_data.hotelCostEstimate.assumptions
              )}
            </p>
          </div>
        )}
      </div>

      <div className="itinerary-section">
        <h3 className="itinerary-subheader">Budget Breakdown</h3>
        {itinerary.itinerary_data.budgetCalculation ? (
          <div>
            <p className="itinerary-text">
              <strong>Total Estimated Budget:</strong>{" "}
              {isEditing ? (
                <input
                  type="text"
                  value={itinerary.itinerary_data.budgetCalculation.totalEstimatedBudgetPerPerson}
                  onChange={(e) => handleInputChange(e, "totalEstimatedBudgetPerPerson", "budgetCalculation")}
                />
              ) : (
                itinerary.itinerary_data.budgetCalculation.totalEstimatedBudgetPerPerson
              )}
            </p>
            <p className="itinerary-text">
              Transportation:{" "}
              {isEditing ? (
                <input
                  type="text"
                  value={itinerary.itinerary_data.budgetCalculation.transportation.totalTransportation}
                  onChange={(e) => handleInputChange(e, "totalTransportation", "budgetCalculation.transportation")}
                />
              ) : (
                itinerary.itinerary_data.budgetCalculation.transportation.totalTransportation
              )}
            </p>
            <p className="itinerary-text">
              Accommodation:{" "}
              {isEditing ? (
                <input
                  type="text"
                  value={itinerary.itinerary_data.budgetCalculation.accommodation}
                  onChange={(e) => handleInputChange(e, "accommodation", "budgetCalculation")}
                />
              ) : (
                itinerary.itinerary_data.budgetCalculation.accommodation
              )}
            </p>
            <p className="itinerary-text">
              Food:{" "}
              {isEditing ? (
                <input
                  type="text"
                  value={itinerary.itinerary_data.budgetCalculation.food.totalFood}
                  onChange={(e) => handleInputChange(e, "totalFood", "budgetCalculation.food")}
                />
              ) : (
                itinerary.itinerary_data.budgetCalculation.food.totalFood
              )}
            </p>
            <p className="itinerary-text">
              Activities Entry Fees:{" "}
              {isEditing ? (
                <input
                  type="text"
                  value={itinerary.itinerary_data.budgetCalculation.activitiesEntryFees}
                  onChange={(e) => handleInputChange(e, "activitiesEntryFees", "budgetCalculation")}
                />
              ) : (
                itinerary.itinerary_data.budgetCalculation.activitiesEntryFees
              )}
            </p>
            <p className="itinerary-text">
              Miscellaneous:{" "}
              {isEditing ? (
                <input
                  type="text"
                  value={itinerary.itinerary_data.budgetCalculation.miscellaneous}
                  onChange={(e) => handleInputChange(e, "miscellaneous", "budgetCalculation")}
                />
              ) : (
                itinerary.itinerary_data.budgetCalculation.miscellaneous
              )}
            </p>
          </div>
        ) : (
          <p className="itinerary-text">No budget breakdown available.</p>
        )}
      </div>

      <div className="itinerary-section">
        <h3 className="itinerary-subheader">Important Notes and Tips</h3>
        {itinerary.itinerary_data.importantNotesAndTips?.length > 0 ? (
          <ul className="itinerary-list">
            {itinerary.itinerary_data.importantNotesAndTips.map((tip, index) => (
              <li key={index} className="itinerary-list-item">
                {isEditing ? (
                  <input
                    type="text"
                    value={tip}
                    onChange={(e) => handleTravelTipChange(e, index)}
                  />
                ) : (
                  tip
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="itinerary-text">No notes or tips available.</p>
        )}
      </div>

      <div className="itinerary-section">
        <h3 className="itinerary-subheader">Map of Locations</h3>
        {loadError ? (
          <p>Error loading map: {loadError.message}</p>
        ) : !isLoaded ? (
          <p>Loading map...</p>
        ) : !mapCenter || !isValidLatLng(mapCenter.lat, mapCenter.lng) ? (
          <p>Waiting for valid destination coordinates...</p>
        ) : (
          <GoogleMap mapContainerStyle={mapContainerStyle} center={mapCenter} zoom={12}>
            {locations.map((location, index) => (
              isValidLatLng(location.lat, location.lng) ? (
                <Marker
                  key={index}
                  position={{ lat: location.lat, lng: location.lng }}
                  label={{
                    text: location.name.split(",")[0],
                    color: "black",
                    fontSize: "14px",
                    fontWeight: "bold",
                  }}
                  icon={{
                    url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
                  }}
                />
              ) : null
            ))}
          </GoogleMap>
        )}
      </div>

      <div className="itinerary-button-container">
        {isEditing ? (
          <button className="itinerary-button" onClick={saveChanges}>
            Save Changes
          </button>
        ) : (
          <button className="itinerary-button" onClick={toggleEdit}>
            Edit Itinerary
          </button>
        )}
        <button className="itinerary-button" onClick={downloadPDF}>
          Download as PDF
        </button>
        <button className="itinerary-button" onClick={() => navigate("/chatbot")}>
          Create Another Itinerary
        </button>
        <button className="itinerary-button" onClick={() => navigate("/past-itineraries")}>
          View Past Itineraries
        </button>
      </div>
    </div>
  );
};

export default Itinerary;









































//-----nearly working----------------



// import React, { useState, useEffect } from "react";
// import { useLocation, useNavigate } from "react-router-dom";
// import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
// import { jsPDF } from "jspdf";
// import "./Itinerary.css";

// const LIBRARIES = ["places", "geocoding"];

// const Itinerary = () => {
//   const navigate = useNavigate();
//   const { state } = useLocation();
//   const backendItinerary = state?.itinerary;

//   const [itinerary, setItinerary] = useState(backendItinerary || { itinerary_data: {} });
//   const [locations, setLocations] = useState([]);
//   const [mapCenter, setMapCenter] = useState(null);
//   const [isEditing, setIsEditing] = useState(false);

//   const googleMapsApiKey = "AIzaSyCPbEx2Cx-nxPvOEEYsMG3VsvAMkodoRI4"; // Replace with your actual key
//   const { isLoaded, loadError } = useJsApiLoader({
//     googleMapsApiKey,
//     libraries: LIBRARIES,
//   });

//   const mapContainerStyle = { width: "100%", height: "400px" };

//   const isValidLatLng = (lat, lng) => {
//     return typeof lat === "number" && !isNaN(lat) && typeof lng === "number" && !isNaN(lng);
//   };

//   useEffect(() => {
//     console.log("New backendItinerary received:", JSON.stringify(backendItinerary, null, 2));
//     setItinerary(backendItinerary || { itinerary_data: {} });
//     setLocations([]);
//     setMapCenter(null);

//     if (!isLoaded || !backendItinerary?.itinerary_data) {
//       console.log("API not loaded or no itinerary data");
//       return;
//     }

//     const destination = backendItinerary.itinerary_data.tripName?.match(/to\s(.+?)(\s|$)/)?.[1];
//     console.log("Extracted destination:", destination);

//     if (destination) {
//       const geocoder = new window.google.maps.Geocoder();
//       geocoder.geocode({ address: destination }, (results, status) => {
//         if (status === "OK" && results[0]) {
//           const lat = results[0].geometry.location.lat();
//           const lng = results[0].geometry.location.lng();
//           if (isValidLatLng(lat, lng)) {
//             setMapCenter({ lat, lng });
//             console.log(`Map center set to ${destination}:`, { lat, lng });
//             loadMapLocations(destination);
//           } else {
//             console.error("Invalid coordinates from geocoder:", { lat, lng });
//           }
//         } else {
//           console.error(`Geocoding failed for ${destination}: ${status}`);
//           // Fallback to first hotel/restaurant latlng if available
//           const fallbackLatLng =
//             backendItinerary.hotels?.[0] || backendItinerary.restaurants?.[0];
//           if (fallbackLatLng && isValidLatLng(fallbackLatLng.lat, fallbackLatLng.lng)) {
//             setMapCenter({ lat: fallbackLatLng.lat, lng: fallbackLatLng.lng });
//             console.log("Using fallback center:", fallbackLatLng);
//             loadMapLocations(destination);
//           }
//         }
//       });
//     } else {
//       console.log("No destination extracted, trying fallback...");
//       const fallbackLatLng = backendItinerary.hotels?.[0] || backendItinerary.restaurants?.[0];
//       if (fallbackLatLng && isValidLatLng(fallbackLatLng.lat, fallbackLatLng.lng)) {
//         setMapCenter({ lat: fallbackLatLng.lat, lng: fallbackLatLng.lng });
//         console.log("Fallback center set:", fallbackLatLng);
//         loadMapLocations("Ooty"); // Default to Ooty if no destination
//       }
//     }
//   }, [backendItinerary, isLoaded]);

//   const loadMapLocations = (destination) => {
//     if (!itinerary.itinerary_data.itinerary?.length) {
//       console.log("No itinerary schedule to process for locations");
//       return;
//     }

//     const geocoder = new window.google.maps.Geocoder();
//     const allLocations = itinerary.itinerary_data.itinerary.flatMap(day =>
//       day.schedule
//         .filter(item => item.placeId && item.placeId !== "ID not available")
//         .map(item => ({
//           name: item.activity,
//           placeId: item.placeId,
//         }))
//     );

//     console.log("Locations with placeIds:", JSON.stringify(allLocations, null, 2));

//     Promise.all(
//       allLocations.map(loc =>
//         new Promise((resolve) => {
//           geocoder.geocode({ placeId: loc.placeId }, (results, status) => {
//             if (status === "OK" && results[0]) {
//               const lat = results[0].geometry.location.lat();
//               const lng = results[0].geometry.location.lng();
//               if (isValidLatLng(lat, lng)) {
//                 resolve({ name: loc.name, lat, lng, type: "activity" });
//               } else {
//                 console.warn(`Invalid lat/lng for placeId ${loc.placeId}`);
//                 resolve(null);
//               }
//             } else {
//               console.warn(`Geocoding failed for placeId ${loc.placeId}: ${status}`);
//               resolve(null);
//             }
//           });
//         })
//       )
//     ).then(coords => {
//       const validLocations = coords.filter(loc => loc !== null);
//       console.log("Valid map locations:", JSON.stringify(validLocations, null, 2));
//       setLocations(validLocations);
//     });
//   };

//   const handleInputChange = (e, field, subField = null, dayIndex = null, scheduleIndex = null) => {
//     const updatedItinerary = { ...itinerary };
//     if (dayIndex !== null && scheduleIndex !== null) {
//       updatedItinerary.itinerary_data.itinerary[dayIndex].schedule[scheduleIndex][field] = e.target.value;
//     } else if (subField === "budgetCalculation.breakdown") {
//       updatedItinerary.itinerary_data.budgetCalculation[field] = e.target.value;
//     } else if (subField === "hotelCostEstimate") {
//       updatedItinerary.itinerary_data.hotelCostEstimate[field] = e.target.value;
//     } else if (subField) {
//       updatedItinerary.itinerary_data[subField][field] = e.target.value;
//     } else {
//       updatedItinerary.itinerary_data[field] = e.target.value;
//     }
//     setItinerary(updatedItinerary);
//   };

//   const handleTravelTipChange = (e, index) => {
//     const updatedItinerary = { ...itinerary };
//     updatedItinerary.itinerary_data.importantNotesAndTips[index] = e.target.value;
//     setItinerary(updatedItinerary);
//   };

//   const toggleEdit = () => {
//     setIsEditing(!isEditing);
//   };

//   const saveChanges = () => {
//     console.log("Updated Itinerary:", JSON.stringify(itinerary, null, 2));
//     setIsEditing(false);
//   };

//   const downloadPDF = () => {
//     const doc = new jsPDF();
//     let yOffset = 10;
//     const pageHeight = 297;
//     const marginBottom = 20;
//     const maxPageHeight = pageHeight - marginBottom;
//     const lineHeight = 7;

//     const addText = (text, x, y, fontSize, maxWidth = null) => {
//       doc.setFontSize(fontSize);
//       let lines = maxWidth ? doc.splitTextToSize(text, maxWidth) : [text];
//       let textHeight = lines.length * lineHeight;

//       if (y + textHeight > maxPageHeight) {
//         doc.addPage();
//         yOffset = 10;
//       } else {
//         yOffset = y;
//       }

//       if (maxWidth) {
//         doc.text(lines, x, yOffset, { maxWidth });
//       } else {
//         doc.text(text, x, yOffset);
//       }

//       yOffset += textHeight;
//       return yOffset;
//     };

//     yOffset = addText("Travel Itinerary", 10, yOffset, 20);
//     yOffset += 5;

//     yOffset = addText("Overview", 10, yOffset, 16);
//     yOffset = addText(`Trip Name: ${itinerary.itinerary_data.tripName || "N/A"}`, 10, yOffset, 14);
//     yOffset = addText(`Duration: ${itinerary.itinerary_data.duration || "N/A"}`, 10, yOffset, 14);
//     yOffset = addText(`Start Point: ${itinerary.itinerary_data.startPoint || "N/A"}`, 10, yOffset, 14);
//     yOffset = addText(`End Point: ${itinerary.itinerary_data.endPoint || "N/A"}`, 10, yOffset, 14);
//     yOffset = addText(`Travel Style: ${itinerary.itinerary_data.travelStyle || "N/A"}`, 10, yOffset, 14);
//     yOffset += 5;

//     yOffset = addText("Daily Plan", 10, yOffset, 16);
//     itinerary.itinerary_data.itinerary?.forEach(day => {
//       yOffset = addText(`Day ${day.day}: ${day.title}`, 10, yOffset, 14);
//       day.schedule.forEach(item => {
//         yOffset = addText(`${item.time}: ${item.activity} (Cost: ${item.costPerPerson})`, 15, yOffset, 12, 170);
//       });
//       yOffset += 5;
//     });

//     yOffset = addText("Hotel Recommendations", 10, yOffset, 16);
//     itinerary.itinerary_data.hotelRecommendations?.forEach(hotel => {
//       yOffset = addText(`${hotel.category}: ${hotel.options.join(", ")}`, 15, yOffset, 12);
//     });
//     if (itinerary.itinerary_data.hotelCostEstimate) {
//       yOffset = addText(`Hotel Cost Estimate:`, 15, yOffset, 12);
//       yOffset = addText(`Cost per Room per Night: ${itinerary.itinerary_data.hotelCostEstimate.costPerRoomPerNight}`, 20, yOffset, 12);
//       yOffset = addText(`Cost per Person: ${itinerary.itinerary_data.hotelCostEstimate.costPerPerson}`, 20, yOffset, 12);
//       yOffset = addText(`Assumptions: ${itinerary.itinerary_data.hotelCostEstimate.assumptions}`, 20, yOffset, 12, 160);
//     }
//     yOffset += 5;

//     yOffset = addText("Budget Breakdown", 10, yOffset, 16);
//     if (itinerary.itinerary_data.budgetCalculation) {
//       yOffset = addText(`Total: ${itinerary.itinerary_data.budgetCalculation.totalEstimatedBudgetPerPerson}`, 15, yOffset, 12);
//       yOffset = addText(`Transportation: ${itinerary.itinerary_data.budgetCalculation.transportation.totalTransportation}`, 15, yOffset, 12);
//       yOffset = addText(`Accommodation: ${itinerary.itinerary_data.budgetCalculation.accommodation}`, 15, yOffset, 12);
//       yOffset = addText(`Food: ${itinerary.itinerary_data.budgetCalculation.food.totalFood}`, 15, yOffset, 12);
//       yOffset = addText(`Activities: ${itinerary.itinerary_data.budgetCalculation.activitiesEntryFees}`, 15, yOffset, 12);
//       yOffset = addText(`Miscellaneous: ${itinerary.itinerary_data.budgetCalculation.miscellaneous}`, 15, yOffset, 12);
//     }
//     yOffset += 5;

//     yOffset = addText("Important Notes and Tips", 10, yOffset, 16);
//     itinerary.itinerary_data.importantNotesAndTips?.forEach((tip, index) => {
//       yOffset = addText(`${index + 1}. ${tip}`, 15, yOffset, 12, 170);
//     });

//     doc.save(`Itinerary_${itinerary.itinerary_data.tripName || "Trip"}.pdf`);
//   };

//   if (!backendItinerary) {
//     return (
//       <div className="itinerary-container">
//         <h2 className="itinerary-header">No Itinerary Available</h2>
//         <p>Please create an itinerary using the chatbot.</p>
//         <button className="itinerary-button" onClick={() => navigate("/chatbot")}>
//           Go to Chatbot
//         </button>
//       </div>
//     );
//   }

//   return (
//     <div className="itinerary-container">
//       <h2 className="itinerary-header">Your Personalized Travel Itinerary</h2>

//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Overview</h3>
//         <p className="itinerary-text">
//           <strong>Trip Name:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.tripName || ""}
//               onChange={(e) => handleInputChange(e, "tripName")}
//             />
//           ) : (
//             itinerary.itinerary_data.tripName || "N/A"
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>Duration:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.duration || ""}
//               onChange={(e) => handleInputChange(e, "duration")}
//             />
//           ) : (
//             itinerary.itinerary_data.duration || "N/A"
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>Start Point:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.startPoint || ""}
//               onChange={(e) => handleInputChange(e, "startPoint")}
//             />
//           ) : (
//             itinerary.itinerary_data.startPoint || "N/A"
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>End Point:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.endPoint || ""}
//               onChange={(e) => handleInputChange(e, "endPoint")}
//             />
//           ) : (
//             itinerary.itinerary_data.endPoint || "N/A"
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>Travel Style:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.travelStyle || ""}
//               onChange={(e) => handleInputChange(e, "travelStyle")}
//             />
//           ) : (
//             itinerary.itinerary_data.travelStyle || "N/A"
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>Season:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.season || ""}
//               onChange={(e) => handleInputChange(e, "season")}
//             />
//           ) : (
//             itinerary.itinerary_data.season || "N/A"
//           )}
//         </p>
//       </div>

//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Daily Plan</h3>
//         {itinerary.itinerary_data.itinerary?.length > 0 ? (
//           <ul className="itinerary-list">
//             {itinerary.itinerary_data.itinerary.map((day, dayIndex) => (
//               <li key={dayIndex} className="itinerary-list-item">
//                 <h4>
//                   Day {day.day}:{" "}
//                   {isEditing ? (
//                     <input
//                       type="text"
//                       value={day.title}
//                       onChange={(e) => {
//                         const updated = { ...itinerary };
//                         updated.itinerary_data.itinerary[dayIndex].title = e.target.value;
//                         setItinerary(updated);
//                       }}
//                     />
//                   ) : (
//                     day.title
//                   )}
//                 </h4>
//                 {day.schedule.map((item, scheduleIndex) => (
//                   <p key={scheduleIndex} className="itinerary-text">
//                     {isEditing ? (
//                       <>
//                         <input
//                           type="text"
//                           value={item.time}
//                           onChange={(e) => handleInputChange(e, "time", null, dayIndex, scheduleIndex)}
//                         />
//                         :{" "}
//                         <input
//                           type="text"
//                           value={item.activity}
//                           onChange={(e) => handleInputChange(e, "activity", null, dayIndex, scheduleIndex)}
//                         />{" "}
//                         (Cost:{" "}
//                         <input
//                           type="text"
//                           value={item.costPerPerson}
//                           onChange={(e) => handleInputChange(e, "costPerPerson", null, dayIndex, scheduleIndex)}
//                         />
//                         )
//                       </>
//                     ) : (
//                       `${item.time}: ${item.activity} (Cost: ${item.costPerPerson})`
//                     )}
//                   </p>
//                 ))}
//               </li>
//             ))}
//           </ul>
//         ) : (
//           <p className="itinerary-text">No daily itinerary available.</p>
//         )}
//       </div>

//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Hotel Recommendations</h3>
//         {itinerary.itinerary_data.hotelRecommendations?.length > 0 ? (
//           <ul className="itinerary-list">
//             {itinerary.itinerary_data.hotelRecommendations.map((hotel, index) => (
//               <li key={index} className="itinerary-list-item">
//                 {isEditing ? (
//                   <>
//                     <input
//                       type="text"
//                       value={hotel.category}
//                       onChange={(e) => {
//                         const updated = { ...itinerary };
//                         updated.itinerary_data.hotelRecommendations[index].category = e.target.value;
//                         setItinerary(updated);
//                       }}
//                     />
//                     :{" "}
//                     <input
//                       type="text"
//                       value={hotel.options.join(", ")}
//                       onChange={(e) => {
//                         const updated = { ...itinerary };
//                         updated.itinerary_data.hotelRecommendations[index].options = e.target.value.split(", ");
//                         setItinerary(updated);
//                       }}
//                     />
//                   </>
//                 ) : (
//                   `${hotel.category}: ${hotel.options.join(", ")}`
//                 )}
//               </li>
//             ))}
//           </ul>
//         ) : (
//           <p className="itinerary-text">No hotel recommendations available.</p>
//         )}
//         {itinerary.itinerary_data.hotelCostEstimate && (
//           <div>
//             <p className="itinerary-text"><strong>Hotel Cost Estimate:</strong></p>
//             <p className="itinerary-text">
//               Cost per Room per Night:{" "}
//               {isEditing ? (
//                 <input
//                   type="text"
//                   value={itinerary.itinerary_data.hotelCostEstimate.costPerRoomPerNight}
//                   onChange={(e) => handleInputChange(e, "costPerRoomPerNight", "hotelCostEstimate")}
//                 />
//               ) : (
//                 itinerary.itinerary_data.hotelCostEstimate.costPerRoomPerNight
//               )}
//             </p>
//             <p className="itinerary-text">
//               Cost per Person:{" "}
//               {isEditing ? (
//                 <input
//                   type="text"
//                   value={itinerary.itinerary_data.hotelCostEstimate.costPerPerson}
//                   onChange={(e) => handleInputChange(e, "costPerPerson", "hotelCostEstimate")}
//                 />
//               ) : (
//                 itinerary.itinerary_data.hotelCostEstimate.costPerPerson
//               )}
//             </p>
//             <p className="itinerary-text">
//               Assumptions:{" "}
//               {isEditing ? (
//                 <textarea
//                   value={itinerary.itinerary_data.hotelCostEstimate.assumptions}
//                   onChange={(e) => handleInputChange(e, "assumptions", "hotelCostEstimate")}
//                 />
//               ) : (
//                 itinerary.itinerary_data.hotelCostEstimate.assumptions
//               )}
//             </p>
//           </div>
//         )}
//       </div>

//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Budget Breakdown</h3>
//         {itinerary.itinerary_data.budgetCalculation ? (
//           <div>
//             <p className="itinerary-text">
//               <strong>Total Estimated Budget:</strong>{" "}
//               {isEditing ? (
//                 <input
//                   type="text"
//                   value={itinerary.itinerary_data.budgetCalculation.totalEstimatedBudgetPerPerson}
//                   onChange={(e) => handleInputChange(e, "totalEstimatedBudgetPerPerson", "budgetCalculation")}
//                 />
//               ) : (
//                 itinerary.itinerary_data.budgetCalculation.totalEstimatedBudgetPerPerson
//               )}
//             </p>
//             <p className="itinerary-text">
//               Transportation:{" "}
//               {isEditing ? (
//                 <input
//                   type="text"
//                   value={itinerary.itinerary_data.budgetCalculation.transportation.totalTransportation}
//                   onChange={(e) => handleInputChange(e, "totalTransportation", "budgetCalculation.transportation")}
//                 />
//               ) : (
//                 itinerary.itinerary_data.budgetCalculation.transportation.totalTransportation
//               )}
//             </p>
//             <p className="itinerary-text">
//               Accommodation:{" "}
//               {isEditing ? (
//                 <input
//                   type="text"
//                   value={itinerary.itinerary_data.budgetCalculation.accommodation}
//                   onChange={(e) => handleInputChange(e, "accommodation", "budgetCalculation")}
//                 />
//               ) : (
//                 itinerary.itinerary_data.budgetCalculation.accommodation
//               )}
//             </p>
//             <p className="itinerary-text">
//               Food:{" "}
//               {isEditing ? (
//                 <input
//                   type="text"
//                   value={itinerary.itinerary_data.budgetCalculation.food.totalFood}
//                   onChange={(e) => handleInputChange(e, "totalFood", "budgetCalculation.food")}
//                 />
//               ) : (
//                 itinerary.itinerary_data.budgetCalculation.food.totalFood
//               )}
//             </p>
//             <p className="itinerary-text">
//               Activities Entry Fees:{" "}
//               {isEditing ? (
//                 <input
//                   type="text"
//                   value={itinerary.itinerary_data.budgetCalculation.activitiesEntryFees}
//                   onChange={(e) => handleInputChange(e, "activitiesEntryFees", "budgetCalculation")}
//                 />
//               ) : (
//                 itinerary.itinerary_data.budgetCalculation.activitiesEntryFees
//               )}
//             </p>
//             <p className="itinerary-text">
//               Miscellaneous:{" "}
//               {isEditing ? (
//                 <input
//                   type="text"
//                   value={itinerary.itinerary_data.budgetCalculation.miscellaneous}
//                   onChange={(e) => handleInputChange(e, "miscellaneous", "budgetCalculation")}
//                 />
//               ) : (
//                 itinerary.itinerary_data.budgetCalculation.miscellaneous
//               )}
//             </p>
//           </div>
//         ) : (
//           <p className="itinerary-text">No budget breakdown available.</p>
//         )}
//       </div>

//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Important Notes and Tips</h3>
//         {itinerary.itinerary_data.importantNotesAndTips?.length > 0 ? (
//           <ul className="itinerary-list">
//             {itinerary.itinerary_data.importantNotesAndTips.map((tip, index) => (
//               <li key={index} className="itinerary-list-item">
//                 {isEditing ? (
//                   <input
//                     type="text"
//                     value={tip}
//                     onChange={(e) => handleTravelTipChange(e, index)}
//                   />
//                 ) : (
//                   tip
//                 )}
//               </li>
//             ))}
//           </ul>
//         ) : (
//           <p className="itinerary-text">No notes or tips available.</p>
//         )}
//       </div>

//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Map of Locations</h3>
//         {loadError ? (
//           <p>Error loading map: {loadError.message}</p>
//         ) : !isLoaded ? (
//           <p>Loading map...</p>
//         ) : !mapCenter || !isValidLatLng(mapCenter.lat, mapCenter.lng) ? (
//           <p>Waiting for valid destination coordinates...</p>
//         ) : (
//           <GoogleMap mapContainerStyle={mapContainerStyle} center={mapCenter} zoom={12}>
//             {locations.map((location, index) => (
//               isValidLatLng(location.lat, location.lng) ? (
//                 <Marker
//                   key={index}
//                   position={{ lat: location.lat, lng: location.lng }}
//                   label={{
//                     text: location.name.split(",")[0],
//                     color: "black",
//                     fontSize: "14px",
//                     fontWeight: "bold",
//                   }}
//                   icon={{
//                     url: "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
//                   }}
//                 />
//               ) : null
//             ))}
//           </GoogleMap>
//         )}
//       </div>

//       <div className="itinerary-button-container">
//         {isEditing ? (
//           <button className="itinerary-button" onClick={saveChanges}>
//             Save Changes
//           </button>
//         ) : (
//           <button className="itinerary-button" onClick={toggleEdit}>
//             Edit Itinerary
//           </button>
//         )}
//         <button className="itinerary-button" onClick={downloadPDF}>
//           Download as PDF
//         </button>
//         <button className="itinerary-button" onClick={() => navigate("/chatbot")}>
//           Create Another Itinerary
//         </button>
//         <button className="itinerary-button" onClick={() => navigate("/past-itineraries")}>
//           View Past Itineraries
//         </button>
//       </div>
//     </div>
//   );
// };

// export default Itinerary;







//----------maybe work-------------

// import React, { useState, useEffect } from "react";
// import { useLocation, useNavigate } from "react-router-dom";
// import {
//   GoogleMap,
//   useJsApiLoader,
//   Marker,
//   DirectionsRenderer,
// } from "@react-google-maps/api";
// import { jsPDF } from "jspdf";
// import "./Itinerary.css";

// const LIBRARIES = ["places", "geocoding", "directions"];

// const Itinerary = () => {
//   const navigate = useNavigate();
//   const { state } = useLocation();
//   const backendItinerary = state?.itinerary;

//   const [itinerary, setItinerary] = useState(backendItinerary || { itinerary_data: {} });
//   const [locations, setLocations] = useState([]);
//   const [defaultCenter, setDefaultCenter] = useState(null);
//   const [isEditing, setIsEditing] = useState(false);
//   const [route, setRoute] = useState(null);
//   const [routeHotels, setRouteHotels] = useState([]);
//   const [destHotels, setDestHotels] = useState([]);
//   const [error, setError] = useState(null);

//   const googleMapsApiKey = "AIzaSyCPbEx2Cx-nxPvOEEYsMG3VsvAMkodoRI4";
//   const { isLoaded, loadError } = useJsApiLoader({
//     googleMapsApiKey,
//     libraries: LIBRARIES,
//   });

//   const mapContainerStyle = { width: "100%", height: "400px", border: "2px solid red" };

//   useEffect(() => {
//     console.log("Component mounted. Backend Itinerary:", JSON.stringify(backendItinerary, null, 2));
//     console.log("isLoaded:", isLoaded, "loadError:", loadError);
//     setItinerary(backendItinerary || { itinerary_data: {} });
//     setLocations([]);

//     if (loadError) {
//       console.error("Google Maps load error:", loadError);
//       setError("Failed to load Google Maps API");
//       return;
//     }

//     if (!isLoaded) {
//       console.log("Google Maps API not loaded yet");
//       return;
//     }

//     const startPoint = backendItinerary?.itinerary_data?.startPoint;
//     const destination = backendItinerary?.itinerary_data?.tripName?.match(/to\s(.+?)(\s|$)/)?.[1];
//     console.log("Start and Destination:", { startPoint, destination });

//     if (startPoint && destination) {
//       try {
//         const geocoder = new window.google.maps.Geocoder();
//         const directionsService = new window.google.maps.DirectionsService();
//         const placesService = new window.google.maps.places.PlacesService(document.createElement("div"));

//         Promise.all([
//           new Promise((resolve) => geocoder.geocode({ address: startPoint }, resolve)),
//           new Promise((resolve) => geocoder.geocode({ address: destination }, resolve)),
//         ])
//           .then(([startResults, destResults]) => {
//             console.log("Geocode results:", { startResults, destResults });
//             if (startResults[0] && destResults[0]) {
//               const startLatLng = startResults[0].geometry.location;
//               const destLatLng = destResults[0].geometry.location;

//               setDefaultCenter({ lat: destLatLng.lat(), lng: destLatLng.lng() });
//               console.log("Default center set:", { lat: destLatLng.lat(), lng: destLatLng.lng() });

//               directionsService.route(
//                 {
//                   origin: startLatLng,
//                   destination: destLatLng,
//                   travelMode: window.google.maps.TravelMode.DRIVING,
//                 },
//                 (result, status) => {
//                   console.log("Directions result:", { result, status });
//                   if (status === "OK") {
//                     setRoute(result);

//                     const legs = result.routes[0].legs[0];
//                     const midPoint = legs.steps[Math.floor(legs.steps.length / 2)].end_location;

//                     placesService.nearbySearch(
//                       { location: midPoint, radius: 5000, type: "lodging" },
//                       (results, status) => {
//                         console.log("Route hotels search:", { results, status });
//                         if (status === "OK" && results) {
//                           const hotels = results.slice(0, 3).map((place) => ({
//                             name: place.name,
//                             lat: place.geometry.location.lat(),
//                             lng: place.geometry.location.lng(),
//                             type: "hotel",
//                           }));
//                           setRouteHotels(hotels);
//                         }
//                       }
//                     );

//                     placesService.nearbySearch(
//                       { location: destLatLng, radius: 2000, type: "lodging" },
//                       (results, status) => {
//                         console.log("Destination hotels search:", { results, status });
//                         if (status === "OK" && results) {
//                           const hotels = results.slice(0, 3).map((place) => ({
//                             name: place.name,
//                             lat: place.geometry.location.lat(),
//                             lng: place.geometry.location.lng(),
//                             type: "hotel",
//                           }));
//                           setDestHotels(hotels);
//                         }
//                       }
//                     );
//                   } else {
//                     console.error(`Directions failed: ${status}`);
//                   }
//                   loadLocations();
//                 }
//               );
//             } else {
//               console.error("Geocoding failed: No results");
//               loadLocations();
//             }
//           })
//           .catch((err) => {
//             console.error("Geocoding error:", err);
//             setError("Error fetching map data");
//             loadLocations();
//           });
//       } catch (err) {
//         console.error("Unexpected error in useEffect:", err);
//         setError("Unexpected error occurred");
//         loadLocations();
//       }
//     } else {
//       console.log("No startPoint or destination, loading locations only");
//       loadLocations();
//     }
//   }, [backendItinerary, isLoaded, loadError]);

//   const loadLocations = () => {
//     console.log("Loading locations...");
//     const hotelLocations = backendItinerary?.hotels?.map((h) => ({
//       name: h.name || "Unnamed Hotel",
//       lat: h.lat,
//       lng: h.lng,
//       type: "hotel",
//     })) || [];

//     const restaurantLocations = backendItinerary?.restaurants?.map((r) => ({
//       name: r.name || "Unnamed Restaurant",
//       lat: r.lat,
//       lng: r.lng,
//       type: "restaurant",
//     })) || [];

//     const activityLocations = backendItinerary?.activities?.length
//       ? backendItinerary.activities.map((a) => ({
//           name: a.name || "Unnamed Activity",
//           lat: a.lat,
//           lng: a.lng,
//           type: "activity",
//         }))
//       : backendItinerary?.itinerary_data?.itinerary?.flatMap((day) =>
//           day.schedule
//             .filter(
//               (item) =>
//                 item.placeId &&
//                 item.placeId !== "ID not available" &&
//                 !["lunch", "dinner", "breakfast", "drive", "check in"].some((k) =>
//                   item.activity.toLowerCase().includes(k)
//                 )
//             )
//             .map((item) => ({
//               name: item.activity,
//               lat: defaultCenter?.lat || 0,
//               lng: defaultCenter?.lng || 0,
//               type: "activity",
//             }))
//         ) || [];

//     const allLocations = [...hotelLocations, ...restaurantLocations, ...activityLocations];
//     console.log("Locations set:", JSON.stringify(allLocations, null, 2));
//     setLocations(allLocations);

//     if (!defaultCenter && allLocations.length > 0) {
//       setDefaultCenter({ lat: allLocations[0].lat, lng: allLocations[0].lng });
//     }
//   };

//   // Handle input changes for editing
//   const handleInputChange = (e, field, subField = null, dayIndex = null, scheduleIndex = null) => {
//     const updatedItinerary = { ...itinerary };
//     if (dayIndex !== null && scheduleIndex !== null) {
//       updatedItinerary.itinerary_data.itinerary[dayIndex].schedule[scheduleIndex][field] = e.target.value;
//     } else if (subField === "budgetCalculation.breakdown") {
//       updatedItinerary.itinerary_data.budgetCalculation[field] = e.target.value;
//     } else if (subField === "hotelCostEstimate") {
//       updatedItinerary.itinerary_data.hotelCostEstimate[field] = e.target.value;
//     } else if (subField) {
//       updatedItinerary.itinerary_data[subField][field] = e.target.value;
//     } else {
//       updatedItinerary.itinerary_data[field] = e.target.value;
//     }
//     setItinerary(updatedItinerary);
//   };

//   // Handle travel tips editing
//   const handleTravelTipChange = (e, index) => {
//     const updatedItinerary = { ...itinerary };
//     updatedItinerary.itinerary_data.importantNotesAndTips[index] = e.target.value;
//     setItinerary(updatedItinerary);
//   };

//   // Toggle editing mode
//   const toggleEdit = () => {
//     setIsEditing(!isEditing);
//   };

//   // Save changes (logs for now; could send to backend)
//   const saveChanges = () => {
//     console.log("Updated Itinerary:", JSON.stringify(itinerary, null, 2));
//     setIsEditing(false);
//   };

//   // Download as PDF
//   const downloadPDF = () => {
//     const doc = new jsPDF();
//     let yOffset = 10;
//     const pageHeight = 297;
//     const marginBottom = 20;
//     const maxPageHeight = pageHeight - marginBottom;
//     const lineHeight = 7;

//     const addText = (text, x, y, fontSize, maxWidth = null) => {
//       doc.setFontSize(fontSize);
//       let lines = maxWidth ? doc.splitTextToSize(text, maxWidth) : [text];
//       let textHeight = lines.length * lineHeight;

//       if (y + textHeight > maxPageHeight) {
//         doc.addPage();
//         yOffset = 10;
//       } else {
//         yOffset = y;
//       }

//       if (maxWidth) {
//         doc.text(lines, x, yOffset, { maxWidth });
//       } else {
//         doc.text(text, x, yOffset);
//       }

//       yOffset += textHeight;
//       return yOffset;
//     };

//     yOffset = addText("Travel Itinerary", 10, yOffset, 20);
//     yOffset += 5;

//     yOffset = addText("Overview", 10, yOffset, 16);
//     yOffset = addText(`Trip Name: ${itinerary.itinerary_data.tripName || "N/A"}`, 10, yOffset, 14);
//     yOffset = addText(`Duration: ${itinerary.itinerary_data.duration || "N/A"}`, 10, yOffset, 14);
//     yOffset = addText(`Start Point: ${itinerary.itinerary_data.startPoint || "N/A"}`, 10, yOffset, 14);
//     yOffset = addText(`End Point: ${itinerary.itinerary_data.endPoint || "N/A"}`, 10, yOffset, 14);
//     yOffset = addText(`Travel Style: ${itinerary.itinerary_data.travelStyle || "N/A"}`, 10, yOffset, 14);
//     yOffset += 5;

//     yOffset = addText("Daily Plan", 10, yOffset, 16);
//     itinerary.itinerary_data.itinerary?.forEach((day) => {
//       yOffset = addText(`Day ${day.day}: ${day.title}`, 10, yOffset, 14);
//       day.schedule.forEach((item) => {
//         yOffset = addText(`${item.time}: ${item.activity} (Cost: ${item.costPerPerson})`, 15, yOffset, 12, 170);
//       });
//       yOffset += 5;
//     });

//     yOffset = addText("Hotel Recommendations", 10, yOffset, 16);
//     itinerary.itinerary_data.hotelRecommendations?.forEach((hotel) => {
//       yOffset = addText(`${hotel.category}: ${hotel.options.join(", ")}`, 15, yOffset, 12);
//     });
//     if (itinerary.itinerary_data.hotelCostEstimate) {
//       yOffset = addText(`Hotel Cost Estimate:`, 15, yOffset, 12);
//       yOffset = addText(`Cost per Room per Night: ${itinerary.itinerary_data.hotelCostEstimate.costPerRoomPerNight}`, 20, yOffset, 12);
//       yOffset = addText(`Cost per Person: ${itinerary.itinerary_data.hotelCostEstimate.costPerPerson}`, 20, yOffset, 12);
//       yOffset = addText(`Assumptions: ${itinerary.itinerary_data.hotelCostEstimate.assumptions}`, 20, yOffset, 12, 160);
//     }
//     yOffset += 5;

//     yOffset = addText("Budget Breakdown", 10, yOffset, 16);
//     if (itinerary.itinerary_data.budgetCalculation) {
//       yOffset = addText(`Total: ${itinerary.itinerary_data.budgetCalculation.totalEstimatedBudgetPerPerson}`, 15, yOffset, 12);
//       yOffset = addText(`Transportation: ${itinerary.itinerary_data.budgetCalculation.transportation.totalTransportation}`, 15, yOffset, 12);
//       yOffset = addText(`Accommodation: ${itinerary.itinerary_data.budgetCalculation.accommodation}`, 15, yOffset, 12);
//       yOffset = addText(`Food: ${itinerary.itinerary_data.budgetCalculation.food.totalFood}`, 15, yOffset, 12);
//       yOffset = addText(`Activities: ${itinerary.itinerary_data.budgetCalculation.activitiesEntryFees}`, 15, yOffset, 12);
//       yOffset = addText(`Miscellaneous: ${itinerary.itinerary_data.budgetCalculation.miscellaneous}`, 15, yOffset, 12);
//     }
//     yOffset += 5;

//     yOffset = addText("Important Notes and Tips", 10, yOffset, 16);
//     itinerary.itinerary_data.importantNotesAndTips?.forEach((tip, index) => {
//       yOffset = addText(`${index + 1}. ${tip}`, 15, yOffset, 12, 170);
//     });

//     doc.save(`Itinerary_${itinerary.itinerary_data.tripName || "Trip"}.pdf`);
//   };

//   if (error) {
//     return (
//       <div className="itinerary-container">
//         <h2 className="itinerary-header">Error Loading Itinerary</h2>
//         <p>{error}</p>
//         <button className="itinerary-button" onClick={() => navigate("/chatbot")}>
//           Back to Chatbot
//         </button>
//       </div>
//     );
//   }

//   if (!backendItinerary) {
//     return (
//       <div className="itinerary-container">
//         <h2 className="itinerary-header">No Itinerary Available</h2>
//         <p>Please create an itinerary using the chatbot.</p>
//         <button className="itinerary-button" onClick={() => navigate("/chatbot")}>
//           Go to Chatbot
//         </button>
//       </div>
//     );
//   }

//   const center = defaultCenter || (locations.length > 0 ? locations[0] : { lat: 11.41, lng: 76.69 });

//   return (
//     <div className="itinerary-container">
//       <h2 className="itinerary-header">Your Personalized Travel Itinerary</h2>

//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Overview</h3>
//         <p className="itinerary-text">
//           <strong>Trip Name:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.tripName || ""}
//               onChange={(e) => handleInputChange(e, "tripName")}
//             />
//           ) : (
//             itinerary.itinerary_data.tripName || "N/A"
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>Duration:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.duration || ""}
//               onChange={(e) => handleInputChange(e, "duration")}
//             />
//           ) : (
//             itinerary.itinerary_data.duration || "N/A"
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>Start Point:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.startPoint || ""}
//               onChange={(e) => handleInputChange(e, "startPoint")}
//             />
//           ) : (
//             itinerary.itinerary_data.startPoint || "N/A"
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>End Point:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.endPoint || ""}
//               onChange={(e) => handleInputChange(e, "endPoint")}
//             />
//           ) : (
//             itinerary.itinerary_data.endPoint || "N/A"
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>Travel Style:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.travelStyle || ""}
//               onChange={(e) => handleInputChange(e, "travelStyle")}
//             />
//           ) : (
//             itinerary.itinerary_data.travelStyle || "N/A"
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>Season:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.season || ""}
//               onChange={(e) => handleInputChange(e, "season")}
//             />
//           ) : (
//             itinerary.itinerary_data.season || "N/A"
//           )}
//         </p>
//       </div>

//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Daily Plan</h3>
//         {itinerary.itinerary_data.itinerary?.length > 0 ? (
//           <ul className="itinerary-list">
//             {itinerary.itinerary_data.itinerary.map((day, dayIndex) => (
//               <li key={dayIndex} className="itinerary-list-item">
//                 <h4>
//                   Day {day.day}:{" "}
//                   {isEditing ? (
//                     <input
//                       type="text"
//                       value={day.title}
//                       onChange={(e) => {
//                         const updated = { ...itinerary };
//                         updated.itinerary_data.itinerary[dayIndex].title = e.target.value;
//                         setItinerary(updated);
//                       }}
//                     />
//                   ) : (
//                     day.title
//                   )}
//                 </h4>
//                 {day.schedule.map((item, scheduleIndex) => (
//                   <p key={scheduleIndex} className="itinerary-text">
//                     {isEditing ? (
//                       <>
//                         <input
//                           type="text"
//                           value={item.time}
//                           onChange={(e) => handleInputChange(e, "time", null, dayIndex, scheduleIndex)}
//                         />
//                         :{" "}
//                         <input
//                           type="text"
//                           value={item.activity}
//                           onChange={(e) => handleInputChange(e, "activity", null, dayIndex, scheduleIndex)}
//                         />{" "}
//                         (Cost:{" "}
//                         <input
//                           type="text"
//                           value={item.costPerPerson}
//                           onChange={(e) => handleInputChange(e, "costPerPerson", null, dayIndex, scheduleIndex)}
//                         />
//                         )
//                       </>
//                     ) : (
//                       `${item.time}: ${item.activity} (Cost: ${item.costPerPerson})`
//                     )}
//                   </p>
//                 ))}
//               </li>
//             ))}
//           </ul>
//         ) : (
//           <p className="itinerary-text">No daily itinerary available.</p>
//         )}
//       </div>

//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Hotel Recommendations</h3>
//         {itinerary.itinerary_data.hotelRecommendations?.length > 0 ? (
//           <ul className="itinerary-list">
//             {itinerary.itinerary_data.hotelRecommendations.map((hotel, index) => (
//               <li key={index} className="itinerary-list-item">
//                 {isEditing ? (
//                   <>
//                     <input
//                       type="text"
//                       value={hotel.category}
//                       onChange={(e) => {
//                         const updated = { ...itinerary };
//                         updated.itinerary_data.hotelRecommendations[index].category = e.target.value;
//                         setItinerary(updated);
//                       }}
//                     />
//                     :{" "}
//                     <input
//                       type="text"
//                       value={hotel.options.join(", ")}
//                       onChange={(e) => {
//                         const updated = { ...itinerary };
//                         updated.itinerary_data.hotelRecommendations[index].options = e.target.value.split(", ");
//                         setItinerary(updated);
//                       }}
//                     />
//                   </>
//                 ) : (
//                   `${hotel.category}: ${hotel.options.join(", ")}`
//                 )}
//               </li>
//             ))}
//           </ul>
//         ) : (
//           <p className="itinerary-text">No hotel recommendations available.</p>
//         )}
//         {itinerary.itinerary_data.hotelCostEstimate && (
//           <div>
//             <p className="itinerary-text"><strong>Hotel Cost Estimate:</strong></p>
//             <p className="itinerary-text">
//               Cost per Room per Night:{" "}
//               {isEditing ? (
//                 <input
//                   type="text"
//                   value={itinerary.itinerary_data.hotelCostEstimate.costPerRoomPerNight}
//                   onChange={(e) => handleInputChange(e, "costPerRoomPerNight", "hotelCostEstimate")}
//                 />
//               ) : (
//                 itinerary.itinerary_data.hotelCostEstimate.costPerRoomPerNight
//               )}
//             </p>
//             <p className="itinerary-text">
//               Cost per Person:{" "}
//               {isEditing ? (
//                 <input
//                   type="text"
//                   value={itinerary.itinerary_data.hotelCostEstimate.costPerPerson}
//                   onChange={(e) => handleInputChange(e, "costPerPerson", "hotelCostEstimate")}
//                 />
//               ) : (
//                 itinerary.itinerary_data.hotelCostEstimate.costPerPerson
//               )}
//             </p>
//             <p className="itinerary-text">
//               Assumptions:{" "}
//               {isEditing ? (
//                 <textarea
//                   value={itinerary.itinerary_data.hotelCostEstimate.assumptions}
//                   onChange={(e) => handleInputChange(e, "assumptions", "hotelCostEstimate")}
//                 />
//               ) : (
//                 itinerary.itinerary_data.hotelCostEstimate.assumptions
//               )}
//             </p>
//           </div>
//         )}
//       </div>

//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Budget Breakdown</h3>
//         {itinerary.itinerary_data.budgetCalculation ? (
//           <div>
//             <p className="itinerary-text">
//               <strong>Total Estimated Budget:</strong>{" "}
//               {isEditing ? (
//                 <input
//                   type="text"
//                   value={itinerary.itinerary_data.budgetCalculation.totalEstimatedBudgetPerPerson}
//                   onChange={(e) => handleInputChange(e, "totalEstimatedBudgetPerPerson", "budgetCalculation")}
//                 />
//               ) : (
//                 itinerary.itinerary_data.budgetCalculation.totalEstimatedBudgetPerPerson
//               )}
//             </p>
//             <p className="itinerary-text">
//               Transportation:{" "}
//               {isEditing ? (
//                 <input
//                   type="text"
//                   value={itinerary.itinerary_data.budgetCalculation.transportation.totalTransportation}
//                   onChange={(e) => handleInputChange(e, "totalTransportation", "budgetCalculation.transportation")}
//                 />
//               ) : (
//                 itinerary.itinerary_data.budgetCalculation.transportation.totalTransportation
//               )}
//             </p>
//             <p className="itinerary-text">
//               Accommodation:{" "}
//               {isEditing ? (
//                 <input
//                   type="text"
//                   value={itinerary.itinerary_data.budgetCalculation.accommodation}
//                   onChange={(e) => handleInputChange(e, "accommodation", "budgetCalculation")}
//                 />
//               ) : (
//                 itinerary.itinerary_data.budgetCalculation.accommodation
//               )}
//             </p>
//             <p className="itinerary-text">
//               Food:{" "}
//               {isEditing ? (
//                 <input
//                   type="text"
//                   value={itinerary.itinerary_data.budgetCalculation.food.totalFood}
//                   onChange={(e) => handleInputChange(e, "totalFood", "budgetCalculation.food")}
//                 />
//               ) : (
//                 itinerary.itinerary_data.budgetCalculation.food.totalFood
//               )}
//             </p>
//             <p className="itinerary-text">
//               Activities Entry Fees:{" "}
//               {isEditing ? (
//                 <input
//                   type="text"
//                   value={itinerary.itinerary_data.budgetCalculation.activitiesEntryFees}
//                   onChange={(e) => handleInputChange(e, "activitiesEntryFees", "budgetCalculation")}
//                 />
//               ) : (
//                 itinerary.itinerary_data.budgetCalculation.activitiesEntryFees
//               )}
//             </p>
//             <p className="itinerary-text">
//               Miscellaneous:{" "}
//               {isEditing ? (
//                 <input
//                   type="text"
//                   value={itinerary.itinerary_data.budgetCalculation.miscellaneous}
//                   onChange={(e) => handleInputChange(e, "miscellaneous", "budgetCalculation")}
//                 />
//               ) : (
//                 itinerary.itinerary_data.budgetCalculation.miscellaneous
//               )}
//             </p>
//           </div>
//         ) : (
//           <p className="itinerary-text">No budget breakdown available.</p>
//         )}
//       </div>

//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Important Notes and Tips</h3>
//         {itinerary.itinerary_data.importantNotesAndTips?.length > 0 ? (
//           <ul className="itinerary-list">
//             {itinerary.itinerary_data.importantNotesAndTips.map((tip, index) => (
//               <li key={index} className="itinerary-list-item">
//                 {isEditing ? (
//                   <input
//                     type="text"
//                     value={tip}
//                     onChange={(e) => handleTravelTipChange(e, index)}
//                   />
//                 ) : (
//                   tip
//                 )}
//               </li>
//             ))}
//           </ul>
//         ) : (
//           <p className="itinerary-text">No notes or tips available.</p>
//         )}
//       </div>

//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Map of Route and Locations</h3>
//         {loadError ? (
//           <p>Error loading Google Maps: {loadError.message}</p>
//         ) : !isLoaded ? (
//           <p>Loading map...</p>
//         ) : center.lat === 0 && center.lng === 0 ? (
//           <p>No valid map center available</p>
//         ) : (
//           <GoogleMap mapContainerStyle={mapContainerStyle} center={center} zoom={8}>
//             {route && <DirectionsRenderer directions={route} />}
//             {locations.map((location, index) => (
//               <Marker
//                 key={index}
//                 position={{ lat: location.lat, lng: location.lng }}
//                 label={{
//                   text: location.name.split(",")[0],
//                   color: "black",
//                   fontSize: "14px",
//                   fontWeight: "bold",
//                 }}
//                 icon={{
//                   url: location.type === "hotel"
//                     ? "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
//                     : location.type === "restaurant"
//                     ? "http://maps.google.com/mapfiles/ms/icons/red-dot.png"
//                     : "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
//                 }}
//               />
//             ))}
//             {routeHotels.map((hotel, index) => (
//               <Marker
//                 key={`route-hotel-${index}`}
//                 position={{ lat: hotel.lat, lng: hotel.lng }}
//                 label={{
//                   text: hotel.name.split(",")[0],
//                   color: "black",
//                   fontSize: "14px",
//                   fontWeight: "bold",
//                 }}
//                 icon={{ url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png" }}
//               />
//             ))}
//             {destHotels.map((hotel, index) => (
//               <Marker
//                 key={`dest-hotel-${index}`}
//                 position={{ lat: hotel.lat, lng: hotel.lng }}
//                 label={{
//                   text: hotel.name.split(",")[0],
//                   color: "black",
//                   fontSize: "14px",
//                   fontWeight: "bold",
//                 }}
//                 icon={{ url: "http://maps.google.com/mapfiles/ms/icons/blue-dot.png" }}
//               />
//             ))}
//           </GoogleMap>
//         )}
//       </div>

//       <div className="itinerary-button-container">
//         {isEditing ? (
//           <button className="itinerary-button" onClick={saveChanges}>
//             Save Changes
//           </button>
//         ) : (
//           <button className="itinerary-button" onClick={toggleEdit}>
//             Edit Itinerary
//           </button>
//         )}
//         <button className="itinerary-button" onClick={downloadPDF}>
//           Download as PDF
//         </button>
//         <button className="itinerary-button" onClick={() => navigate("/chatbot")}>
//           Create Another Itinerary
//         </button>
//         <button className="itinerary-button" onClick={() => navigate("/past-itineraries")}>
//           View Past Itineraries
//         </button>
//       </div>
//     </div>
//   );
// };

// export default Itinerary;







//-----working code-------

// src/pages/Itinerary/Itinerary.jsx
// import React, { useState, useEffect } from "react";
// import { useLocation, useNavigate } from "react-router-dom";
// import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
// import { jsPDF } from "jspdf"; // Import jsPDF for PDF generation
// import "./Itinerary.css";

// const LIBRARIES = ["places", "geocoding"];

// const Itinerary = () => {
//   const navigate = useNavigate();
//   const { state } = useLocation();
//   const backendItinerary = state?.itinerary;

//   const [itinerary, setItinerary] = useState(backendItinerary || { itinerary_data: {} });
//   const [locations, setLocations] = useState([]);
//   const [defaultCenter, setDefaultCenter] = useState(null);
//   const [isEditing, setIsEditing] = useState(false);

//   const googleMapsApiKey = "AIzaSyCPbEx2Cx-nxPvOEEYsMG3VsvAMkodoRI4"; // Replace with your actual API key
//   const { isLoaded } = useJsApiLoader({
//     googleMapsApiKey,
//     libraries: LIBRARIES,
//   });

//   const mapContainerStyle = { width: "100%", height: "400px" };

//   useEffect(() => {
//     console.log("New backendItinerary received:", JSON.stringify(backendItinerary, null, 2));
//     setLocations([]);
//     setItinerary(backendItinerary || { itinerary_data: {} });

//     const destination = backendItinerary?.itinerary_data?.tripName?.match(/to\s(.+?)(\s|$)/)?.[1];
//     if (destination && isLoaded) {
//       const geocoder = new window.google.maps.Geocoder();
//       geocoder.geocode({ address: destination }, (results, status) => {
//         if (status === "OK" && results[0]) {
//           const { lat, lng } = results[0].geometry.location;
//           setDefaultCenter({ lat: lat(), lng: lng() });
//           console.log(`Set default center for ${destination}:`, { lat: lat(), lng: lng() });
//           loadLocations();
//         } else {
//           console.error(`Geocoding failed for ${destination}: ${status}`);
//           loadLocations();
//         }
//       });
//     } else if (isLoaded) {
//       loadLocations();
//     }
//   }, [backendItinerary, isLoaded]);

//   const loadLocations = () => {
//     const hotelLocations = backendItinerary?.hotels?.map(h => ({
//       name: h.name || "Unnamed Hotel",
//       lat: h.lat,
//       lng: h.lng,
//       type: "hotel",
//     })) || [];

//     const restaurantLocations = backendItinerary?.restaurants?.map(r => ({
//       name: r.name || "Unnamed Restaurant",
//       lat: r.lat,
//       lng: r.lng,
//       type: "restaurant",
//     })) || [];

//     const activityLocations = backendItinerary?.activities?.length
//       ? backendItinerary.activities.map(a => ({
//           name: a.name || "Unnamed Activity",
//           lat: a.lat,
//           lng: a.lng,
//           type: "activity",
//         }))
//       : backendItinerary?.itinerary_data?.itinerary?.flatMap(day =>
//           day.schedule
//             .filter(item => 
//               item.placeId && item.placeId !== "ID not available" &&
//               !["lunch", "dinner", "breakfast", "drive", "check in"].some(k => item.activity.toLowerCase().includes(k))
//             )
//             .map(item => ({
//               name: item.activity,
//               lat: defaultCenter?.lat || 0,
//               lng: defaultCenter?.lng || 0,
//               type: "activity",
//             }))
//         ) || [];

//     const allLocations = [...hotelLocations, ...restaurantLocations, ...activityLocations];
//     console.log("All locations to plot:", JSON.stringify(allLocations, null, 2));
//     setLocations(allLocations);

//     if (!defaultCenter && allLocations.length > 0) {
//       setDefaultCenter({ lat: allLocations[0].lat, lng: allLocations[0].lng });
//     }
//   };

//   // Handle input changes for editing
//   const handleInputChange = (e, field, subField = null, dayIndex = null, scheduleIndex = null) => {
//     const updatedItinerary = { ...itinerary };
//     if (dayIndex !== null && scheduleIndex !== null) {
//       updatedItinerary.itinerary_data.itinerary[dayIndex].schedule[scheduleIndex][field] = e.target.value;
//     } else if (subField === "budgetCalculation.breakdown") {
//       updatedItinerary.itinerary_data.budgetCalculation[field] = e.target.value;
//     } else if (subField === "hotelCostEstimate") {
//       updatedItinerary.itinerary_data.hotelCostEstimate[field] = e.target.value;
//     } else if (subField) {
//       updatedItinerary.itinerary_data[subField][field] = e.target.value;
//     } else {
//       updatedItinerary.itinerary_data[field] = e.target.value;
//     }
//     setItinerary(updatedItinerary);
//   };

//   // Handle travel tips editing
//   const handleTravelTipChange = (e, index) => {
//     const updatedItinerary = { ...itinerary };
//     updatedItinerary.itinerary_data.importantNotesAndTips[index] = e.target.value;
//     setItinerary(updatedItinerary);
//   };

//   // Toggle editing mode
//   const toggleEdit = () => {
//     setIsEditing(!isEditing);
//   };

//   // Save changes (logs for now; could send to backend)
//   const saveChanges = () => {
//     console.log("Updated Itinerary:", JSON.stringify(itinerary, null, 2));
//     setIsEditing(false);
//   };

//   // Download as PDF
//   const downloadPDF = () => {
//     const doc = new jsPDF();
//     let yOffset = 10;
//     const pageHeight = 297;
//     const marginBottom = 20;
//     const maxPageHeight = pageHeight - marginBottom;
//     const lineHeight = 7;

//     const addText = (text, x, y, fontSize, maxWidth = null) => {
//       doc.setFontSize(fontSize);
//       let lines = maxWidth ? doc.splitTextToSize(text, maxWidth) : [text];
//       let textHeight = lines.length * lineHeight;

//       if (y + textHeight > maxPageHeight) {
//         doc.addPage();
//         yOffset = 10;
//       } else {
//         yOffset = y;
//       }

//       if (maxWidth) {
//         doc.text(lines, x, yOffset, { maxWidth });
//       } else {
//         doc.text(text, x, yOffset);
//       }

//       yOffset += textHeight;
//       return yOffset;
//     };

//     yOffset = addText("Travel Itinerary", 10, yOffset, 20);
//     yOffset += 5;

//     yOffset = addText("Overview", 10, yOffset, 16);
//     yOffset = addText(`Trip Name: ${itinerary.itinerary_data.tripName || "N/A"}`, 10, yOffset, 14);
//     yOffset = addText(`Duration: ${itinerary.itinerary_data.duration || "N/A"}`, 10, yOffset, 14);
//     yOffset = addText(`Start Point: ${itinerary.itinerary_data.startPoint || "N/A"}`, 10, yOffset, 14);
//     yOffset = addText(`End Point: ${itinerary.itinerary_data.endPoint || "N/A"}`, 10, yOffset, 14);
//     yOffset = addText(`Travel Style: ${itinerary.itinerary_data.travelStyle || "N/A"}`, 10, yOffset, 14);
//     yOffset += 5;

//     yOffset = addText("Daily Plan", 10, yOffset, 16);
//     itinerary.itinerary_data.itinerary?.forEach(day => {
//       yOffset = addText(`Day ${day.day}: ${day.title}`, 10, yOffset, 14);
//       day.schedule.forEach(item => {
//         yOffset = addText(`${item.time}: ${item.activity} (Cost: ${item.costPerPerson})`, 15, yOffset, 12, 170);
//       });
//       yOffset += 5;
//     });

//     yOffset = addText("Hotel Recommendations", 10, yOffset, 16);
//     itinerary.itinerary_data.hotelRecommendations?.forEach(hotel => {
//       yOffset = addText(`${hotel.category}: ${hotel.options.join(", ")}`, 15, yOffset, 12);
//     });
//     if (itinerary.itinerary_data.hotelCostEstimate) {
//       yOffset = addText(`Hotel Cost Estimate:`, 15, yOffset, 12);
//       yOffset = addText(`Cost per Room per Night: ${itinerary.itinerary_data.hotelCostEstimate.costPerRoomPerNight}`, 20, yOffset, 12);
//       yOffset = addText(`Cost per Person: ${itinerary.itinerary_data.hotelCostEstimate.costPerPerson}`, 20, yOffset, 12);
//       yOffset = addText(`Assumptions: ${itinerary.itinerary_data.hotelCostEstimate.assumptions}`, 20, yOffset, 12, 160);
//     }
//     yOffset += 5;

//     yOffset = addText("Budget Breakdown", 10, yOffset, 16);
//     if (itinerary.itinerary_data.budgetCalculation) {
//       yOffset = addText(`Total: ${itinerary.itinerary_data.budgetCalculation.totalEstimatedBudgetPerPerson}`, 15, yOffset, 12);
//       yOffset = addText(`Transportation: ${itinerary.itinerary_data.budgetCalculation.transportation.totalTransportation}`, 15, yOffset, 12);
//       yOffset = addText(`Accommodation: ${itinerary.itinerary_data.budgetCalculation.accommodation}`, 15, yOffset, 12);
//       yOffset = addText(`Food: ${itinerary.itinerary_data.budgetCalculation.food.totalFood}`, 15, yOffset, 12);
//       yOffset = addText(`Activities: ${itinerary.itinerary_data.budgetCalculation.activitiesEntryFees}`, 15, yOffset, 12);
//       yOffset = addText(`Miscellaneous: ${itinerary.itinerary_data.budgetCalculation.miscellaneous}`, 15, yOffset, 12);
//     }
//     yOffset += 5;

//     yOffset = addText("Important Notes and Tips", 10, yOffset, 16);
//     itinerary.itinerary_data.importantNotesAndTips?.forEach((tip, index) => {
//       yOffset = addText(`${index + 1}. ${tip}`, 15, yOffset, 12, 170);
//     });

//     doc.save(`Itinerary_${itinerary.itinerary_data.tripName || "Trip"}.pdf`);
//   };

//   if (!backendItinerary) {
//     return (
//       <div className="itinerary-container">
//         <h2 className="itinerary-header">No Itinerary Available</h2>
//         <p>Please create an itinerary using the chatbot.</p>
//         <button className="itinerary-button" onClick={() => navigate("/chatbot")}>
//           Go to Chatbot
//         </button>
//       </div>
//     );
//   }

//   const center = defaultCenter || (locations.length > 0 ? locations[0] : { lat: 0, lng: 0 });

//   return (
//     <div className="itinerary-container">
//       <h2 className="itinerary-header">Your Personalized Travel Itinerary</h2>

//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Overview</h3>
//         <p className="itinerary-text">
//           <strong>Trip Name:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.tripName || ""}
//               onChange={(e) => handleInputChange(e, "tripName")}
//             />
//           ) : (
//             itinerary.itinerary_data.tripName || "N/A"
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>Duration:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.duration || ""}
//               onChange={(e) => handleInputChange(e, "duration")}
//             />
//           ) : (
//             itinerary.itinerary_data.duration || "N/A"
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>Start Point:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.startPoint || ""}
//               onChange={(e) => handleInputChange(e, "startPoint")}
//             />
//           ) : (
//             itinerary.itinerary_data.startPoint || "N/A"
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>End Point:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.endPoint || ""}
//               onChange={(e) => handleInputChange(e, "endPoint")}
//             />
//           ) : (
//             itinerary.itinerary_data.endPoint || "N/A"
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>Travel Style:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.travelStyle || ""}
//               onChange={(e) => handleInputChange(e, "travelStyle")}
//             />
//           ) : (
//             itinerary.itinerary_data.travelStyle || "N/A"
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>Season:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.season || ""}
//               onChange={(e) => handleInputChange(e, "season")}
//             />
//           ) : (
//             itinerary.itinerary_data.season || "N/A"
//           )}
//         </p>
//       </div>

//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Daily Plan</h3>
//         {itinerary.itinerary_data.itinerary?.length > 0 ? (
//           <ul className="itinerary-list">
//             {itinerary.itinerary_data.itinerary.map((day, dayIndex) => (
//               <li key={dayIndex} className="itinerary-list-item">
//                 <h4>
//                   Day {day.day}:{" "}
//                   {isEditing ? (
//                     <input
//                       type="text"
//                       value={day.title}
//                       onChange={(e) => {
//                         const updated = { ...itinerary };
//                         updated.itinerary_data.itinerary[dayIndex].title = e.target.value;
//                         setItinerary(updated);
//                       }}
//                     />
//                   ) : (
//                     day.title
//                   )}
//                 </h4>
//                 {day.schedule.map((item, scheduleIndex) => (
//                   <p key={scheduleIndex} className="itinerary-text">
//                     {isEditing ? (
//                       <>
//                         <input
//                           type="text"
//                           value={item.time}
//                           onChange={(e) => handleInputChange(e, "time", null, dayIndex, scheduleIndex)}
//                         />
//                         :{" "}
//                         <input
//                           type="text"
//                           value={item.activity}
//                           onChange={(e) => handleInputChange(e, "activity", null, dayIndex, scheduleIndex)}
//                         />{" "}
//                         (Cost:{" "}
//                         <input
//                           type="text"
//                           value={item.costPerPerson}
//                           onChange={(e) => handleInputChange(e, "costPerPerson", null, dayIndex, scheduleIndex)}
//                         />
//                         )
//                       </>
//                     ) : (
//                       `${item.time}: ${item.activity} (Cost: ${item.costPerPerson})`
//                     )}
//                   </p>
//                 ))}
//               </li>
//             ))}
//           </ul>
//         ) : (
//           <p className="itinerary-text">No daily itinerary available.</p>
//         )}
//       </div>

//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Hotel Recommendations</h3>
//         {itinerary.itinerary_data.hotelRecommendations?.length > 0 ? (
//           <ul className="itinerary-list">
//             {itinerary.itinerary_data.hotelRecommendations.map((hotel, index) => (
//               <li key={index} className="itinerary-list-item">
//                 {isEditing ? (
//                   <>
//                     <input
//                       type="text"
//                       value={hotel.category}
//                       onChange={(e) => {
//                         const updated = { ...itinerary };
//                         updated.itinerary_data.hotelRecommendations[index].category = e.target.value;
//                         setItinerary(updated);
//                       }}
//                     />
//                     :{" "}
//                     <input
//                       type="text"
//                       value={hotel.options.join(", ")}
//                       onChange={(e) => {
//                         const updated = { ...itinerary };
//                         updated.itinerary_data.hotelRecommendations[index].options = e.target.value.split(", ");
//                         setItinerary(updated);
//                       }}
//                     />
//                   </>
//                 ) : (
//                   `${hotel.category}: ${hotel.options.join(", ")}`
//                 )}
//               </li>
//             ))}
//           </ul>
//         ) : (
//           <p className="itinerary-text">No hotel recommendations available.</p>
//         )}
//         {itinerary.itinerary_data.hotelCostEstimate && (
//           <div>
//             <p className="itinerary-text"><strong>Hotel Cost Estimate:</strong></p>
//             <p className="itinerary-text">
//               Cost per Room per Night:{" "}
//               {isEditing ? (
//                 <input
//                   type="text"
//                   value={itinerary.itinerary_data.hotelCostEstimate.costPerRoomPerNight}
//                   onChange={(e) => handleInputChange(e, "costPerRoomPerNight", "hotelCostEstimate")}
//                 />
//               ) : (
//                 itinerary.itinerary_data.hotelCostEstimate.costPerRoomPerNight
//               )}
//             </p>
//             <p className="itinerary-text">
//               Cost per Person:{" "}
//               {isEditing ? (
//                 <input
//                   type="text"
//                   value={itinerary.itinerary_data.hotelCostEstimate.costPerPerson}
//                   onChange={(e) => handleInputChange(e, "costPerPerson", "hotelCostEstimate")}
//                 />
//               ) : (
//                 itinerary.itinerary_data.hotelCostEstimate.costPerPerson
//               )}
//             </p>
//             <p className="itinerary-text">
//               Assumptions:{" "}
//               {isEditing ? (
//                 <textarea
//                   value={itinerary.itinerary_data.hotelCostEstimate.assumptions}
//                   onChange={(e) => handleInputChange(e, "assumptions", "hotelCostEstimate")}
//                 />
//               ) : (
//                 itinerary.itinerary_data.hotelCostEstimate.assumptions
//               )}
//             </p>
//           </div>
//         )}
//       </div>

//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Budget Breakdown</h3>
//         {itinerary.itinerary_data.budgetCalculation ? (
//           <div>
//             <p className="itinerary-text">
//               <strong>Total Estimated Budget:</strong>{" "}
//               {isEditing ? (
//                 <input
//                   type="text"
//                   value={itinerary.itinerary_data.budgetCalculation.totalEstimatedBudgetPerPerson}
//                   onChange={(e) => handleInputChange(e, "totalEstimatedBudgetPerPerson", "budgetCalculation")}
//                 />
//               ) : (
//                 itinerary.itinerary_data.budgetCalculation.totalEstimatedBudgetPerPerson
//               )}
//             </p>
//             <p className="itinerary-text">
//               Transportation:{" "}
//               {isEditing ? (
//                 <input
//                   type="text"
//                   value={itinerary.itinerary_data.budgetCalculation.transportation.totalTransportation}
//                   onChange={(e) => handleInputChange(e, "totalTransportation", "budgetCalculation.transportation")}
//                 />
//               ) : (
//                 itinerary.itinerary_data.budgetCalculation.transportation.totalTransportation
//               )}
//             </p>
//             <p className="itinerary-text">
//               Accommodation:{" "}
//               {isEditing ? (
//                 <input
//                   type="text"
//                   value={itinerary.itinerary_data.budgetCalculation.accommodation}
//                   onChange={(e) => handleInputChange(e, "accommodation", "budgetCalculation")}
//                 />
//               ) : (
//                 itinerary.itinerary_data.budgetCalculation.accommodation
//               )}
//             </p>
//             <p className="itinerary-text">
//               Food:{" "}
//               {isEditing ? (
//                 <input
//                   type="text"
//                   value={itinerary.itinerary_data.budgetCalculation.food.totalFood}
//                   onChange={(e) => handleInputChange(e, "totalFood", "budgetCalculation.food")}
//                 />
//               ) : (
//                 itinerary.itinerary_data.budgetCalculation.food.totalFood
//               )}
//             </p>
//             <p className="itinerary-text">
//               Activities Entry Fees:{" "}
//               {isEditing ? (
//                 <input
//                   type="text"
//                   value={itinerary.itinerary_data.budgetCalculation.activitiesEntryFees}
//                   onChange={(e) => handleInputChange(e, "activitiesEntryFees", "budgetCalculation")}
//                 />
//               ) : (
//                 itinerary.itinerary_data.budgetCalculation.activitiesEntryFees
//               )}
//             </p>
//             <p className="itinerary-text">
//               Miscellaneous:{" "}
//               {isEditing ? (
//                 <input
//                   type="text"
//                   value={itinerary.itinerary_data.budgetCalculation.miscellaneous}
//                   onChange={(e) => handleInputChange(e, "miscellaneous", "budgetCalculation")}
//                 />
//               ) : (
//                 itinerary.itinerary_data.budgetCalculation.miscellaneous
//               )}
//             </p>
//           </div>
//         ) : (
//           <p className="itinerary-text">No budget breakdown available.</p>
//         )}
//       </div>

//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Important Notes and Tips</h3>
//         {itinerary.itinerary_data.importantNotesAndTips?.length > 0 ? (
//           <ul className="itinerary-list">
//             {itinerary.itinerary_data.importantNotesAndTips.map((tip, index) => (
//               <li key={index} className="itinerary-list-item">
//                 {isEditing ? (
//                   <input
//                     type="text"
//                     value={tip}
//                     onChange={(e) => handleTravelTipChange(e, index)}
//                   />
//                 ) : (
//                   tip
//                 )}
//               </li>
//             ))}
//           </ul>
//         ) : (
//           <p className="itinerary-text">No notes or tips available.</p>
//         )}
//       </div>

//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Map of Locations</h3>
//         {isLoaded && center.lat !== 0 && center.lng !== 0 ? (
//           <GoogleMap mapContainerStyle={mapContainerStyle} center={center} zoom={12}>
//             {locations.map((location, index) => (
//               <Marker
//                 key={index}
//                 position={{ lat: location.lat, lng: location.lng }}
//                 label={{
//                   text: location.name.split(",")[0],
//                   color: "black",
//                   fontSize: "14px",
//                   fontWeight: "bold",
//                 }}
//                 icon={{
//                   url: location.type === "hotel"
//                     ? "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
//                     : location.type === "restaurant"
//                     ? "http://maps.google.com/mapfiles/ms/icons/red-dot.png"
//                     : "http://maps.google.com/mapfiles/ms/icons/green-dot.png",
//                 }}
//               />
//             ))}
//           </GoogleMap>
//         ) : (
//           <p>Loading map or no valid center available...</p>
//         )}
//       </div>

//       <div className="itinerary-button-container">
//         {isEditing ? (
//           <button className="itinerary-button" onClick={saveChanges}>
//             Save Changes
//           </button>
//         ) : (
//           <button className="itinerary-button" onClick={toggleEdit}>
//             Edit Itinerary
//           </button>
//         )}
//         <button className="itinerary-button" onClick={downloadPDF}>
//           Download as PDF
//         </button>
//         <button className="itinerary-button" onClick={() => navigate("/chatbot")}>
//           Create Another Itinerary
//         </button>
//         <button className="itinerary-button" onClick={() => navigate("/past-itineraries")}>
//           View Past Itineraries
//         </button>
//       </div>
//     </div>
//   );
// };

// export default Itinerary;







//-----------backup--------------





// // src/pages/Itinerary/Itinerary.jsx
// import React, { useState, useEffect } from "react";
// import { useLocation, useNavigate } from "react-router-dom";
// import { jsPDF } from "jspdf";
// import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
// import "./Itinerary.css";

// const Itinerary = () => {
//   const navigate = useNavigate();
//   const { state } = useLocation();
//   const backendItinerary = state?.itinerary;

//   const [itinerary, setItinerary] = useState(backendItinerary || { itinerary_data: {} });
//   const [isEditing, setIsEditing] = useState(false);
//   const [locations, setLocations] = useState([]);
//   const [defaultCenter, setDefaultCenter] = useState({ lat: 10.2381, lng: 77.4892 }); // Initial fallback

//   const googleMapsApiKey = "AIzaSyCPbEx2Cx-nxPvOEEYsMG3VsvAMkodoRI4"; // Replace with your actual API key
//   const { isLoaded } = useJsApiLoader({
//     googleMapsApiKey,
//     libraries: ["places"],
//   });

//   const mapContainerStyle = { width: "100%", height: "400px" };

//   useEffect(() => {
//     console.log("New backendItinerary received:", JSON.stringify(backendItinerary, null, 2));
//     setLocations([]); // Reset locations for new itinerary
//     setItinerary(backendItinerary || { itinerary_data: {} });

//     // Dynamically set default center based on destination (if possible)
//     const destination = backendItinerary?.itinerary_data?.tripName?.match(/to\s(.+?)(\s|$)/)?.[1];
//     if (destination && isLoaded) {
//       const geocoder = new window.google.maps.Geocoder();
//       geocoder.geocode({ address: destination }, (results, status) => {
//         if (status === "OK" && results[0]) {
//           const { lat, lng } = results[0].geometry.location;
//           setDefaultCenter({ lat: lat(), lng: lng() });
//           console.log(`Set default center for ${destination}:`, { lat: lat(), lng: lng() });
//         } else {
//           console.log(`Geocoding failed for ${destination}, using fallback center`);
//         }
//       });
//     }
//   }, [backendItinerary, isLoaded]);

//   useEffect(() => {
//     if (!isLoaded || !itinerary?.itinerary_data) {
//       console.log("Skipping loadLocations: Map not loaded or no itinerary data");
//       return;
//     }

//     console.log("Processing itinerary_data:", JSON.stringify(itinerary.itinerary_data, null, 2));

//     const fetchPlaceDetails = async (placeId) => {
//       return new Promise((resolve) => {
//         const service = new window.google.maps.places.PlacesService(document.createElement("div"));
//         service.getDetails({ placeId }, (place, status) => {
//           if (status === window.google.maps.places.PlacesServiceStatus.OK) {
//             console.log(`Fetched coords for placeId ${placeId}:`, {
//               lat: place.geometry.location.lat(),
//               lng: place.geometry.location.lng(),
//             });
//             resolve({
//               lat: place.geometry.location.lat(),
//               lng: place.geometry.location.lng(),
//             });
//           } else {
//             console.error(`Failed to fetch details for placeId: ${placeId}, status: ${status}`);
//             resolve(null);
//           }
//         });
//       });
//     };

//     const loadLocations = async () => {
//       const hotelLocations = [];
//       const restaurantLocations = [];

//       if (itinerary.itinerary_data.hotelRecommendations?.length > 0) {
//         for (const hotel of itinerary.itinerary_data.hotelRecommendations) {
//           const placeId = hotel.placeId;
//           const name = hotel.options[0];
//           console.log(`Processing hotel: ${name}, placeId: ${placeId}`);
//           if (placeId && placeId !== "ID not available") {
//             const coords = await fetchPlaceDetails(placeId);
//             if (coords) {
//               hotelLocations.push({ name, lat: coords.lat, lng: coords.lng, type: "hotel" });
//             } else {
//               console.log(`Skipping ${name}: No coords fetched`);
//             }
//           } else {
//             console.log(`Skipping ${name}: Invalid or missing placeId`);
//           }
//         }
//       } else {
//         console.log("No hotelRecommendations found");
//       }

//       if (itinerary.itinerary_data.itinerary?.length > 0) {
//         for (const day of itinerary.itinerary_data.itinerary) {
//           for (const item of day.schedule) {
//             if (
//               item.activity.toLowerCase().includes("lunch") ||
//               item.activity.toLowerCase().includes("dinner") ||
//               item.activity.toLowerCase().includes("breakfast")
//             ) {
//               const placeId = item.placeId;
//               const name = item.activity.split("at ")[1] || item.activity;
//               console.log(`Processing restaurant: ${name}, placeId: ${placeId}`);
//               if (placeId && placeId !== "ID not available") {
//                 const coords = await fetchPlaceDetails(placeId);
//                 if (coords) {
//                   restaurantLocations.push({ name, lat: coords.lat, lng: coords.lng, type: "restaurant" });
//                 } else {
//                   console.log(`Skipping ${name}: No coords fetched`);
//                 }
//               } else {
//                 console.log(`Skipping ${name}: Invalid or missing placeId`);
//               }
//             }
//           }
//         }
//       } else {
//         console.log("No itinerary schedule found");
//       }

//       const allLocations = [...hotelLocations, ...restaurantLocations];
//       console.log("All locations to plot:", JSON.stringify(allLocations, null, 2));
//       setLocations(allLocations);
//     };

//     loadLocations();
//   }, [isLoaded, itinerary]);

//   if (!backendItinerary) {
//     return (
//       <div className="itinerary-container">
//         <h2 className="itinerary-header">No Itinerary Available</h2>
//         <p>Please create an itinerary using the chatbot.</p>
//         <button className="itinerary-button" onClick={() => navigate("/chatbot")}>
//           Go to Chatbot
//         </button>
//       </div>
//     );
//   }

//   const center = locations.length > 0 ? locations[0] : defaultCenter;

//   return (
//     <div className="itinerary-container">
//       <h2 className="itinerary-header">Your Personalized Travel Itinerary</h2>

//       {/* Overview */}
//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Overview</h3>
//         <p className="itinerary-text">
//           <strong>Trip Name:</strong> {itinerary.itinerary_data.tripName || "N/A"}
//         </p>
//         <p className="itinerary-text">
//           <strong>Duration:</strong> {itinerary.itinerary_data.duration || "N/A"}
//         </p>
//         <p className="itinerary-text">
//           <strong>Start Point:</strong> {itinerary.itinerary_data.startPoint || "N/A"}
//         </p>
//       </div>

//       {/* Daily Plan */}
//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Daily Plan</h3>
//         {itinerary.itinerary_data.itinerary?.length > 0 ? (
//           <ul className="itinerary-list">
//             {itinerary.itinerary_data.itinerary.map((day, dayIndex) => (
//               <li key={dayIndex} className="itinerary-list-item">
//                 <h4>Day {day.day}: {day.title}</h4>
//                 {day.schedule.map((item, scheduleIndex) => (
//                   <p key={scheduleIndex} className="itinerary-text">
//                     {item.time}: {item.activity} (Cost: {item.costPerPerson})
//                   </p>
//                 ))}
//               </li>
//             ))}
//           </ul>
//         ) : (
//           <p className="itinerary-text">No daily itinerary available.</p>
//         )}
//       </div>

//       {/* Hotels */}
//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Hotel Recommendations</h3>
//         {itinerary.itinerary_data.hotelRecommendations?.length > 0 ? (
//           <ul className="itinerary-list">
//             {itinerary.itinerary_data.hotelRecommendations.map((hotel, index) => (
//               <li key={index} className="itinerary-list-item">
//                 {hotel.category}: {hotel.options.join(", ")}
//               </li>
//             ))}
//           </ul>
//         ) : (
//           <p className="itinerary-text">No hotel recommendations available.</p>
//         )}
//       </div>

//       {/* Map */}
//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Map of Locations</h3>
//         {isLoaded ? (
//           <GoogleMap mapContainerStyle={mapContainerStyle} center={center} zoom={12}>
//             {locations.map((location, index) => (
//               location.lat && location.lng ? (
//                 <Marker
//                   key={index}
//                   position={{ lat: location.lat, lng: location.lng }}
//                   label={{
//                     text: location.name.split(",")[0],
//                     color: "black",
//                     fontSize: "14px",
//                     fontWeight: "bold",
//                   }}
//                   icon={{
//                     url: location.type === "hotel"
//                       ? "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
//                       : "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
//                   }}
//                 />
//               ) : (
//                 console.log(`Skipping marker for ${location.name} due to missing lat/lng`)
//               )
//             ))}
//           </GoogleMap>
//         ) : (
//           <p>Loading map...</p>
//         )}
//       </div>

//       {/* Buttons */}
//       <div className="itinerary-button-container">
//         <button className="itinerary-button" onClick={() => navigate("/chatbot")}>
//           Create Another Itinerary
//         </button>
//       </div>
//     </div>
//   );
// };

// export default Itinerary;










// // src/pages/Itinerary/Itinerary.jsx
// import React, { useState, useEffect } from "react";
// import { useLocation, useNavigate } from "react-router-dom";
// import { jsPDF } from "jspdf";
// import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
// import "./Itinerary.css";

// const Itinerary = () => {
//   const navigate = useNavigate();
//   const { state } = useLocation();
//   const backendItinerary = state?.itinerary;

//   const [itinerary, setItinerary] = useState(backendItinerary || { itinerary_data: {} });
//   const [isEditing, setIsEditing] = useState(false);
//   const [locations, setLocations] = useState([]);

//   const googleMapsApiKey = "AIzaSyCPbEx2Cx-nxPvOEEYsMG3VsvAMkodoRI4"; // Replace with your actual API key
//   const { isLoaded } = useJsApiLoader({
//     googleMapsApiKey,
//     libraries: ["places"],
//   });

//   const mapContainerStyle = {
//     width: "100%",
//     height: "400px",
//   };

//   const defaultCenter = { lat: 11.4102, lng: 76.6950 }; // Ooty

//   useEffect(() => {
//     if (!isLoaded || !itinerary.itinerary_data) return;

//     const fetchPlaceDetails = async (placeId) => {
//       return new Promise((resolve) => {
//         console.log(`Fetching details for placeId: ${placeId}`);
//         const service = new window.google.maps.places.PlacesService(document.createElement("div"));
//         service.getDetails({ placeId }, (place, status) => {
//           if (status === window.google.maps.places.PlacesServiceStatus.OK) {
//             const coords = {
//               lat: place.geometry.location.lat(),
//               lng: place.geometry.location.lng(),
//             };
//             console.log(`Success for ${placeId}:`, coords);
//             resolve(coords);
//           } else {
//             console.error(`Failed to fetch details for placeId: ${placeId}, status: ${status}`);
//             resolve(null);
//           }
//         });
//       });
//     };

//     const loadLocations = async () => {
//       const hotelLocations = [];
//       const restaurantLocations = [];

//       // Hotels from hotelRecommendations
//       if (itinerary.itinerary_data.hotelRecommendations) {
//         for (const hotel of itinerary.itinerary_data.hotelRecommendations) {
//           const placeId = hotel.placeId;
//           console.log(`Processing hotel: ${hotel.options[0]}, placeId: ${placeId}`);
//           const coords = itinerary.hotels?.find(h => h.placeId === placeId && h.lat && h.lng);
//           if (coords) {
//             hotelLocations.push({
//               name: hotel.options[0],
//               lat: coords.lat,
//               lng: coords.lng,
//               type: "hotel",
//             });
//           } else if (placeId && placeId !== "ID not available") {
//             const coords = await fetchPlaceDetails(placeId);
//             if (coords) {
//               hotelLocations.push({
//                 name: hotel.options[0],
//                 lat: coords.lat,
//                 lng: coords.lng,
//                 type: "hotel",
//               });
//             }
//           }
//         }
//       }

//       // Restaurants from itinerary schedule
//       if (itinerary.itinerary_data.itinerary) {
//         for (const day of itinerary.itinerary_data.itinerary) {
//           for (const item of day.schedule) {
//             if (
//               item.activity.toLowerCase().includes("lunch") ||
//               item.activity.toLowerCase().includes("dinner") ||
//               item.activity.toLowerCase().includes("breakfast")
//             ) {
//               const placeId = item.placeId;
//               const name = item.activity.split("at ")[1] || item.activity;
//               console.log(`Processing restaurant: ${name}, placeId: ${placeId}`);
//               const coords = itinerary.restaurants?.find(r => r.placeId === placeId && r.lat && r.lng);
//               if (coords) {
//                 restaurantLocations.push({
//                   name,
//                   lat: coords.lat,
//                   lng: coords.lng,
//                   type: "restaurant",
//                 });
//               } else if (placeId && placeId !== "ID not available") {
//                 const coords = await fetchPlaceDetails(placeId);
//                 if (coords) {
//                   restaurantLocations.push({
//                     name,
//                     lat: coords.lat,
//                     lng: coords.lng,
//                     type: "restaurant",
//                   });
//                 }
//               }
//             }
//           }
//         }
//       }

//       const allLocations = [...hotelLocations, ...restaurantLocations];
//       console.log("All locations to plot:", allLocations);

//       if (allLocations.length === 0) {
//         console.warn("No valid locations found, falling back to hardcoded data");
//         const hardcodedLocations = [
//           { name: "Hotel Lakeview Ooty", lat: 11.4086, lng: 76.6947, type: "hotel" },
//           { name: "Nahum Restaurant", lat: 11.4130, lng: 76.7000, type: "restaurant" },
//           { name: "Earl's Secret", lat: 11.4100, lng: 76.6980, type: "restaurant" },
//           { name: "Adayar Ananda Bhavan", lat: 11.4120, lng: 76.6960, type: "restaurant" },
//           { name: "Hotel Annapoorna Sree Gowrishankar", lat: 11.0168, lng: 76.9558, type: "restaurant" },
//           { name: "Sree Krishna Inn", lat: 10.7721, lng: 76.6801, type: "restaurant" },
//         ];
//         setLocations(hardcodedLocations);
//       } else {
//         setLocations(allLocations);
//       }
//     };

//     loadLocations();
//   }, [isLoaded, itinerary]);

//   if (!backendItinerary) {
//     return (
//       <div className="itinerary-container">
//         <h2 className="itinerary-header">No Itinerary Available</h2>
//         <p>Please create an itinerary using the chatbot.</p>
//         <button className="itinerary-button" onClick={() => navigate("/chatbot")}>
//           Go to Chatbot
//         </button>
//       </div>
//     );
//   }

//   const handleInputChange = (e, field, subField = null, dayIndex = null, scheduleIndex = null) => {
//     const updatedItinerary = { ...itinerary };
//     if (dayIndex !== null && scheduleIndex !== null) {
//       updatedItinerary.itinerary_data.itinerary[dayIndex].schedule[scheduleIndex][field] = e.target.value;
//     } else if (subField) {
//       updatedItinerary.itinerary_data[subField][field] = e.target.value;
//     } else {
//       updatedItinerary.itinerary_data[field] = e.target.value;
//     }
//     setItinerary(updatedItinerary);
//   };

//   const handleTravelTipChange = (e, index) => {
//     const updatedItinerary = { ...itinerary };
//     updatedItinerary.itinerary_data.importantNotesAndTips[index] = e.target.value;
//     setItinerary(updatedItinerary);
//   };

//   const toggleEdit = () => setIsEditing(!isEditing);

//   const saveChanges = () => {
//     console.log("Updated Itinerary:", itinerary);
//     setIsEditing(false);
//   };

//   const downloadPDF = () => {
//     const doc = new jsPDF();
//     let yOffset = 10;
//     const pageHeight = 297;
//     const marginBottom = 20;
//     const maxPageHeight = pageHeight - marginBottom;
//     const lineHeight = 7;

//     const addText = (text, x, y, fontSize, maxWidth = null) => {
//       doc.setFontSize(fontSize);
//       let lines = maxWidth ? doc.splitTextToSize(text, maxWidth) : [text];
//       let textHeight = lines.length * lineHeight;

//       if (y + textHeight > maxPageHeight) {
//         doc.addPage();
//         yOffset = 10;
//       } else {
//         yOffset = y;
//       }

//       if (maxWidth) {
//         doc.text(lines, x, yOffset, { maxWidth });
//       } else {
//         doc.text(text, x, yOffset);
//       }

//       yOffset += textHeight;
//       return yOffset;
//     };

//     yOffset = addText("Travel Itinerary", 10, yOffset, 20);
//     yOffset += 5;
//     yOffset = addText("Overview", 10, yOffset, 16);
//     yOffset = addText(`Trip Name: ${itinerary.itinerary_data.tripName}`, 10, yOffset, 14);
//     yOffset = addText(`Duration: ${itinerary.itinerary_data.duration}`, 10, yOffset, 14);
//     yOffset = addText(`Start Point: ${itinerary.itinerary_data.startPoint}`, 10, yOffset, 14);
//     yOffset += 5;

//     yOffset = addText("Daily Plan", 10, yOffset, 16);
//     itinerary.itinerary_data.itinerary.forEach((day) => {
//       yOffset = addText(`Day ${day.day}: ${day.title}`, 10, yOffset, 14);
//       day.schedule.forEach((item) => {
//         yOffset = addText(
//           `${item.time}: ${item.activity} (Cost: ${item.costPerPerson}, Place ID: ${item.placeId})`,
//           15,
//           yOffset,
//           12,
//           170
//         );
//       });
//       yOffset += 5;
//     });

//     yOffset = addText("Hotel Recommendations", 10, yOffset, 16);
//     itinerary.itinerary_data.hotelRecommendations.forEach((hotel) => {
//       yOffset = addText(
//         `${hotel.category}: ${hotel.options.join(", ")} (Place ID: ${hotel.placeId})`,
//         15,
//         yOffset,
//         12,
//         170
//       );
//     });

//     yOffset = addText("Estimated Budget", 10, yOffset, 16);
//     yOffset = addText(
//       `Total: ${itinerary.itinerary_data.budgetCalculation.totalEstimatedBudgetPerPerson}`,
//       15,
//       yOffset,
//       12
//     );
//     yOffset += 5;

//     yOffset = addText("Travel Tips", 10, yOffset, 16);
//     itinerary.itinerary_data.importantNotesAndTips.forEach((tip, index) => {
//       yOffset = addText(`${index + 1}. ${tip}`, 15, yOffset, 12, 170);
//     });

//     doc.save(`Itinerary_${itinerary.itinerary_data.tripName || "Trip"}.pdf`);
//   };

//   const center = locations.length > 0 ? locations[0] : defaultCenter;

//   return (
//     <div className="itinerary-container">
//       <h2 className="itinerary-header">Your Personalized Travel Itinerary</h2>

//       {/* Overview */}
//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Overview</h3>
//         <p className="itinerary-text">
//           <strong>Trip Name:</strong>{" "}
//           {isEditing ? (
//             <input type="text" value={itinerary.itinerary_data.tripName} onChange={(e) => handleInputChange(e, "tripName")} />
//           ) : (
//             itinerary.itinerary_data.tripName
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>Duration:</strong>{" "}
//           {isEditing ? (
//             <input type="text" value={itinerary.itinerary_data.duration} onChange={(e) => handleInputChange(e, "duration")} />
//           ) : (
//             itinerary.itinerary_data.duration
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>Start Point:</strong>{" "}
//           {isEditing ? (
//             <input type="text" value={itinerary.itinerary_data.startPoint} onChange={(e) => handleInputChange(e, "startPoint")} />
//           ) : (
//             itinerary.itinerary_data.startPoint
//           )}
//         </p>
//       </div>

//       {/* Daily Plan */}
//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Daily Plan</h3>
//         {itinerary.itinerary_data.itinerary?.length > 0 ? (
//           <ul className="itinerary-list">
//             {itinerary.itinerary_data.itinerary.map((day, dayIndex) => (
//               <li key={dayIndex} className="itinerary-list-item">
//                 <h4>
//                   Day {day.day}:{" "}
//                   {isEditing ? (
//                     <input
//                       type="text"
//                       value={day.title}
//                       onChange={(e) => {
//                         const updated = { ...itinerary };
//                         updated.itinerary_data.itinerary[dayIndex].title = e.target.value;
//                         setItinerary(updated);
//                       }}
//                     />
//                   ) : (
//                     day.title
//                   )}
//                 </h4>
//                 {day.schedule.map((item, scheduleIndex) => (
//                   <p key={scheduleIndex} className="itinerary-text">
//                     {isEditing ? (
//                       <>
//                         <input
//                           type="text"
//                           value={item.time}
//                           onChange={(e) => handleInputChange(e, "time", null, dayIndex, scheduleIndex)}
//                         />
//                         <input
//                           type="text"
//                           value={item.activity}
//                           onChange={(e) => handleInputChange(e, "activity", null, dayIndex, scheduleIndex)}
//                         />
//                         <input
//                           type="text"
//                           value={item.costPerPerson}
//                           onChange={(e) => handleInputChange(e, "costPerPerson", null, dayIndex, scheduleIndex)}
//                         />
//                       </>
//                     ) : (
//                       `${item.time}: ${item.activity} (Cost: ${item.costPerPerson})`
//                     )}
//                   </p>
//                 ))}
//               </li>
//             ))}
//           </ul>
//         ) : (
//           <p className="itinerary-text">No daily itinerary available.</p>
//         )}
//       </div>

//       {/* Hotels */}
//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Hotel Recommendations</h3>
//         {itinerary.itinerary_data.hotelRecommendations?.length > 0 ? (
//           <ul className="itinerary-list">
//             {itinerary.itinerary_data.hotelRecommendations.map((hotel, index) => (
//               <li key={index} className="itinerary-list-item">
//                 {isEditing ? (
//                   <>
//                     <input
//                       type="text"
//                       value={hotel.category}
//                       onChange={(e) => {
//                         const updated = { ...itinerary };
//                         updated.itinerary_data.hotelRecommendations[index].category = e.target.value;
//                         setItinerary(updated);
//                       }}
//                     />
//                     <input
//                       type="text"
//                       value={hotel.options.join(", ")}
//                       onChange={(e) => {
//                         const updated = { ...itinerary };
//                         updated.itinerary_data.hotelRecommendations[index].options = e.target.value.split(", ");
//                         setItinerary(updated);
//                       }}
//                     />
//                   </>
//                 ) : (
//                   `${hotel.category}: ${hotel.options.join(", ")}`
//                 )}
//               </li>
//             ))}
//           </ul>
//         ) : (
//           <p className="itinerary-text">No hotel recommendations available.</p>
//         )}
//       </div>

//       {/* Budget */}
//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Estimated Budget</h3>
//         <p className="itinerary-text">
//           <strong>Total:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.budgetCalculation.totalEstimatedBudgetPerPerson}
//               onChange={(e) => handleInputChange(e, "totalEstimatedBudgetPerPerson", "budgetCalculation")}
//             />
//           ) : (
//             itinerary.itinerary_data.budgetCalculation.totalEstimatedBudgetPerPerson
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>Transportation:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.budgetCalculation.transportation.totalTransportation}
//               onChange={(e) => handleInputChange(e, "totalTransportation", "budgetCalculation.transportation")}
//             />
//           ) : (
//             itinerary.itinerary_data.budgetCalculation.transportation.totalTransportation
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>Accommodation:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.budgetCalculation.accommodation}
//               onChange={(e) => handleInputChange(e, "accommodation", "budgetCalculation")}
//             />
//           ) : (
//             itinerary.itinerary_data.budgetCalculation.accommodation
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>Food:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.budgetCalculation.food.totalFood}
//               onChange={(e) => handleInputChange(e, "totalFood", "budgetCalculation.food")}
//             />
//           ) : (
//             itinerary.itinerary_data.budgetCalculation.food.totalFood
//           )}
//         </p>
//       </div>

//       {/* Travel Tips */}
//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Travel Tips</h3>
//         {itinerary.itinerary_data.importantNotesAndTips?.length > 0 ? (
//           <ul className="itinerary-list">
//             {itinerary.itinerary_data.importantNotesAndTips.map((tip, index) => (
//               <li key={index} className="itinerary-list-item">
//                 {isEditing ? (
//                   <input
//                     type="text"
//                     value={tip}
//                     onChange={(e) => handleTravelTipChange(e, index)}
//                   />
//                 ) : (
//                   tip
//                 )}
//               </li>
//             ))}
//           </ul>
//         ) : (
//           <p className="itinerary-text">No travel tips available.</p>
//         )}
//       </div>

//       {/* Google Maps */}
//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Map of Locations</h3>
//         {isLoaded ? (
//           <GoogleMap mapContainerStyle={mapContainerStyle} center={center} zoom={10}>
//             {locations.map((location, index) => (
//               location.lat && location.lng ? (
//                 <Marker
//                   key={index}
//                   position={{ lat: location.lat, lng: location.lng }}
//                   label={{ text: location.name.split(",")[0], color: location.type === "hotel" ? "blue" : "red" }}
//                   icon={{
//                     url: location.type === "hotel"
//                       ? "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
//                       : "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
//                   }}
//                 />
//               ) : (
//                 console.log(`Skipping marker for ${location.name} due to missing lat/lng`)
//               )
//             ))}
//           </GoogleMap>
//         ) : (
//           <p>Loading map...</p>
//         )}
//       </div>

//       {/* Buttons */}
//       <div className="itinerary-button-container">
//         {isEditing ? (
//           <button className="itinerary-button" onClick={saveChanges}>
//             Save Changes
//           </button>
//         ) : (
//           <button className="itinerary-button" onClick={toggleEdit}>
//             Edit Itinerary
//           </button>
//         )}
//         <button className="itinerary-button" onClick={downloadPDF}>
//           Download as PDF
//         </button>
//         <button className="itinerary-button" onClick={() => navigate("/chatbot")}>
//           Create Another Itinerary
//         </button>
//         <button className="itinerary-button" onClick={() => navigate("/past-itineraries")}>
//           View Past Itineraries
//         </button>
//       </div>
//     </div>
//   );
// };

// export default Itinerary;











// // src/pages/Itinerary/Itinerary.jsx
// import React, { useState, useEffect } from "react";
// import { useLocation, useNavigate } from "react-router-dom";
// import { jsPDF } from "jspdf";
// import { GoogleMap, LoadScript, Marker, useJsApiLoader } from "@react-google-maps/api";
// import "./Itinerary.css";

// const Itinerary = () => {
//   const navigate = useNavigate();
//   const { state } = useLocation();
//   const backendItinerary = state?.itinerary;

//   const [itinerary, setItinerary] = useState(backendItinerary || { itinerary_data: {} });
//   const [isEditing, setIsEditing] = useState(false);
//   const [locations, setLocations] = useState([]); // Hotels and restaurants with lat/lng

//   const googleMapsApiKey = "AIzaSyCPbEx2Cx-nxPvOEEYsMG3VsvAMkodoRI4"; // Replace with your actual API key
//   const { isLoaded } = useJsApiLoader({
//     googleMapsApiKey,
//     libraries: ["places"],
//   });

//   const mapContainerStyle = {
//     width: "100%",
//     height: "400px",
//   };

//   const defaultCenter = { lat: 11.4102, lng: 76.6950 }; // Ooty

//   useEffect(() => {
//     if (!isLoaded || !itinerary.itinerary_data) return;

//     const fetchPlaceDetails = async (placeId) => {
//       return new Promise((resolve) => {
//         const service = new window.google.maps.places.PlacesService(document.createElement("div"));
//         service.getDetails({ placeId }, (place, status) => {
//           if (status === window.google.maps.places.PlacesServiceStatus.OK) {
//             resolve({
//               lat: place.geometry.location.lat(),
//               lng: place.geometry.location.lng(),
//             });
//           } else {
//             resolve(null);
//           }
//         });
//       });
//     };

//     const loadLocations = async () => {
//       const hotelLocations = [];
//       const restaurantLocations = [];

//       // Hotels from hotelRecommendations
//       if (itinerary.itinerary_data.hotelRecommendations) {
//         for (const hotel of itinerary.itinerary_data.hotelRecommendations) {
//           const placeId = hotel.placeId;
//           const coords = itinerary.hotels?.find(h => h.placeId === placeId && h.lat && h.lng);
//           if (coords) {
//             hotelLocations.push({
//               name: hotel.options[0],
//               lat: coords.lat,
//               lng: coords.lng,
//               type: "hotel",
//             });
//           } else if (placeId && placeId !== "ID not available") {
//             const coords = await fetchPlaceDetails(placeId);
//             if (coords) {
//               hotelLocations.push({
//                 name: hotel.options[0],
//                 lat: coords.lat,
//                 lng: coords.lng,
//                 type: "hotel",
//               });
//             }
//           }
//         }
//       }

//       // Restaurants from itinerary schedule
//       if (itinerary.itinerary_data.itinerary) {
//         for (const day of itinerary.itinerary_data.itinerary) {
//           for (const item of day.schedule) {
//             if (
//               item.activity.toLowerCase().includes("lunch") ||
//               item.activity.toLowerCase().includes("dinner") ||
//               item.activity.toLowerCase().includes("breakfast")
//             ) {
//               const placeId = item.placeId;
//               const name = item.activity.split("at ")[1] || item.activity;
//               const coords = itinerary.restaurants?.find(r => r.placeId === placeId && r.lat && r.lng);
//               if (coords) {
//                 restaurantLocations.push({
//                   name,
//                   lat: coords.lat,
//                   lng: coords.lng,
//                   type: "restaurant",
//                 });
//               } else if (placeId && placeId !== "ID not available") {
//                 const coords = await fetchPlaceDetails(placeId);
//                 if (coords) {
//                   restaurantLocations.push({
//                     name,
//                     lat: coords.lat,
//                     lng: coords.lng,
//                     type: "restaurant",
//                   });
//                 }
//               }
//             }
//           }
//         }
//       }

//       setLocations([...hotelLocations, ...restaurantLocations]);
//     };

//     loadLocations();
//   }, [isLoaded, itinerary]);

//   if (!backendItinerary) {
//     return (
//       <div className="itinerary-container">
//         <h2 className="itinerary-header">No Itinerary Available</h2>
//         <p>Please create an itinerary using the chatbot.</p>
//         <button className="itinerary-button" onClick={() => navigate("/chatbot")}>
//           Go to Chatbot
//         </button>
//       </div>
//     );
//   }

//   const handleInputChange = (e, field, subField = null, dayIndex = null, scheduleIndex = null) => {
//     const updatedItinerary = { ...itinerary };
//     if (dayIndex !== null && scheduleIndex !== null) {
//       updatedItinerary.itinerary_data.itinerary[dayIndex].schedule[scheduleIndex][field] = e.target.value;
//     } else if (subField) {
//       updatedItinerary.itinerary_data[subField][field] = e.target.value;
//     } else {
//       updatedItinerary.itinerary_data[field] = e.target.value;
//     }
//     setItinerary(updatedItinerary);
//   };

//   const handleTravelTipChange = (e, index) => {
//     const updatedItinerary = { ...itinerary };
//     updatedItinerary.itinerary_data.importantNotesAndTips[index] = e.target.value;
//     setItinerary(updatedItinerary);
//   };

//   const toggleEdit = () => setIsEditing(!isEditing);

//   const saveChanges = () => {
//     console.log("Updated Itinerary:", itinerary);
//     setIsEditing(false);
//   };

//   const downloadPDF = () => {
//     const doc = new jsPDF();
//     let yOffset = 10;
//     const pageHeight = 297;
//     const marginBottom = 20;
//     const maxPageHeight = pageHeight - marginBottom;
//     const lineHeight = 7;

//     const addText = (text, x, y, fontSize, maxWidth = null) => {
//       doc.setFontSize(fontSize);
//       let lines = maxWidth ? doc.splitTextToSize(text, maxWidth) : [text];
//       let textHeight = lines.length * lineHeight;

//       if (y + textHeight > maxPageHeight) {
//         doc.addPage();
//         yOffset = 10;
//       } else {
//         yOffset = y;
//       }

//       if (maxWidth) {
//         doc.text(lines, x, yOffset, { maxWidth });
//       } else {
//         doc.text(text, x, yOffset);
//       }

//       yOffset += textHeight;
//       return yOffset;
//     };

//     yOffset = addText("Travel Itinerary", 10, yOffset, 20);
//     yOffset += 5;
//     yOffset = addText("Overview", 10, yOffset, 16);
//     yOffset = addText(`Trip Name: ${itinerary.itinerary_data.tripName}`, 10, yOffset, 14);
//     yOffset = addText(`Duration: ${itinerary.itinerary_data.duration}`, 10, yOffset, 14);
//     yOffset = addText(`Start Point: ${itinerary.itinerary_data.startPoint}`, 10, yOffset, 14);
//     yOffset += 5;

//     yOffset = addText("Daily Plan", 10, yOffset, 16);
//     itinerary.itinerary_data.itinerary.forEach((day) => {
//       yOffset = addText(`Day ${day.day}: ${day.title}`, 10, yOffset, 14);
//       day.schedule.forEach((item) => {
//         yOffset = addText(
//           `${item.time}: ${item.activity} (Cost: ${item.costPerPerson}, Place ID: ${item.placeId})`,
//           15,
//           yOffset,
//           12,
//           170
//         );
//       });
//       yOffset += 5;
//     });

//     yOffset = addText("Hotel Recommendations", 10, yOffset, 16);
//     itinerary.itinerary_data.hotelRecommendations.forEach((hotel) => {
//       yOffset = addText(
//         `${hotel.category}: ${hotel.options.join(", ")} (Place ID: ${hotel.placeId})`,
//         15,
//         yOffset,
//         12,
//         170
//       );
//     });

//     yOffset = addText("Estimated Budget", 10, yOffset, 16);
//     yOffset = addText(
//       `Total: ${itinerary.itinerary_data.budgetCalculation.totalEstimatedBudgetPerPerson}`,
//       15,
//       yOffset,
//       12
//     );
//     yOffset += 5;

//     yOffset = addText("Travel Tips", 10, yOffset, 16);
//     itinerary.itinerary_data.importantNotesAndTips.forEach((tip, index) => {
//       yOffset = addText(`${index + 1}. ${tip}`, 15, yOffset, 12, 170);
//     });

//     doc.save(`Itinerary_${itinerary.itinerary_data.tripName || "Trip"}.pdf`);
//   };

//   const center = locations.length > 0 ? locations[0] : defaultCenter;

//   return (
//     <div className="itinerary-container">
//       <h2 className="itinerary-header">Your Personalized Travel Itinerary</h2>

//       {/* Overview */}
//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Overview</h3>
//         <p className="itinerary-text">
//           <strong>Trip Name:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.tripName}
//               onChange={(e) => handleInputChange(e, "tripName")}
//             />
//           ) : (
//             itinerary.itinerary_data.tripName
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>Duration:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.duration}
//               onChange={(e) => handleInputChange(e, "duration")}
//             />
//           ) : (
//             itinerary.itinerary_data.duration
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>Start Point:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.startPoint}
//               onChange={(e) => handleInputChange(e, "startPoint")}
//             />
//           ) : (
//             itinerary.itinerary_data.startPoint
//           )}
//         </p>
//       </div>

//       {/* Daily Plan */}
//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Daily Plan</h3>
//         {itinerary.itinerary_data.itinerary?.length > 0 ? (
//           <ul className="itinerary-list">
//             {itinerary.itinerary_data.itinerary.map((day, dayIndex) => (
//               <li key={dayIndex} className="itinerary-list-item">
//                 <h4>
//                   Day {day.day}:{" "}
//                   {isEditing ? (
//                     <input
//                       type="text"
//                       value={day.title}
//                       onChange={(e) => {
//                         const updated = { ...itinerary };
//                         updated.itinerary_data.itinerary[dayIndex].title = e.target.value;
//                         setItinerary(updated);
//                       }}
//                     />
//                   ) : (
//                     day.title
//                   )}
//                 </h4>
//                 {day.schedule.map((item, scheduleIndex) => (
//                   <p key={scheduleIndex} className="itinerary-text">
//                     {isEditing ? (
//                       <>
//                         <input
//                           type="text"
//                           value={item.time}
//                           onChange={(e) => handleInputChange(e, "time", null, dayIndex, scheduleIndex)}
//                         />
//                         <input
//                           type="text"
//                           value={item.activity}
//                           onChange={(e) => handleInputChange(e, "activity", null, dayIndex, scheduleIndex)}
//                         />
//                         <input
//                           type="text"
//                           value={item.costPerPerson}
//                           onChange={(e) => handleInputChange(e, "costPerPerson", null, dayIndex, scheduleIndex)}
//                         />
//                       </>
//                     ) : (
//                       `${item.time}: ${item.activity} (Cost: ${item.costPerPerson})`
//                     )}
//                   </p>
//                 ))}
//               </li>
//             ))}
//           </ul>
//         ) : (
//           <p className="itinerary-text">No daily itinerary available.</p>
//         )}
//       </div>

//       {/* Hotels */}
//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Hotel Recommendations</h3>
//         {itinerary.itinerary_data.hotelRecommendations?.length > 0 ? (
//           <ul className="itinerary-list">
//             {itinerary.itinerary_data.hotelRecommendations.map((hotel, index) => (
//               <li key={index} className="itinerary-list-item">
//                 {isEditing ? (
//                   <>
//                     <input
//                       type="text"
//                       value={hotel.category}
//                       onChange={(e) => {
//                         const updated = { ...itinerary };
//                         updated.itinerary_data.hotelRecommendations[index].category = e.target.value;
//                         setItinerary(updated);
//                       }}
//                     />
//                     <input
//                       type="text"
//                       value={hotel.options.join(", ")}
//                       onChange={(e) => {
//                         const updated = { ...itinerary };
//                         updated.itinerary_data.hotelRecommendations[index].options = e.target.value.split(", ");
//                         setItinerary(updated);
//                       }}
//                     />
//                   </>
//                 ) : (
//                   `${hotel.category}: ${hotel.options.join(", ")}`
//                 )}
//               </li>
//             ))}
//           </ul>
//         ) : (
//           <p className="itinerary-text">No hotel recommendations available.</p>
//         )}
//       </div>

//       {/* Budget */}
//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Estimated Budget</h3>
//         <p className="itinerary-text">
//           <strong>Total:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.budgetCalculation.totalEstimatedBudgetPerPerson}
//               onChange={(e) => handleInputChange(e, "totalEstimatedBudgetPerPerson", "budgetCalculation")}
//             />
//           ) : (
//             itinerary.itinerary_data.budgetCalculation.totalEstimatedBudgetPerPerson
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>Transportation:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.budgetCalculation.transportation.totalTransportation}
//               onChange={(e) => handleInputChange(e, "totalTransportation", "budgetCalculation.transportation")}
//             />
//           ) : (
//             itinerary.itinerary_data.budgetCalculation.transportation.totalTransportation
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>Accommodation:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.budgetCalculation.accommodation}
//               onChange={(e) => handleInputChange(e, "accommodation", "budgetCalculation")}
//             />
//           ) : (
//             itinerary.itinerary_data.budgetCalculation.accommodation
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>Food:</strong>{" "}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.budgetCalculation.food.totalFood}
//               onChange={(e) => handleInputChange(e, "totalFood", "budgetCalculation.food")}
//             />
//           ) : (
//             itinerary.itinerary_data.budgetCalculation.food.totalFood
//           )}
//         </p>
//       </div>

//       {/* Travel Tips */}
//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Travel Tips</h3>
//         {itinerary.itinerary_data.importantNotesAndTips?.length > 0 ? (
//           <ul className="itinerary-list">
//             {itinerary.itinerary_data.importantNotesAndTips.map((tip, index) => (
//               <li key={index} className="itinerary-list-item">
//                 {isEditing ? (
//                   <input
//                     type="text"
//                     value={tip}
//                     onChange={(e) => handleTravelTipChange(e, index)}
//                   />
//                 ) : (
//                   tip
//                 )}
//               </li>
//             ))}
//           </ul>
//         ) : (
//           <p className="itinerary-text">No travel tips available.</p>
//         )}
//       </div>

//       {/* Google Maps */}
//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Map of Locations</h3>
//         {isLoaded ? (
//           <GoogleMap mapContainerStyle={mapContainerStyle} center={center} zoom={10}>
//             {locations.map((location, index) => (
//               location.lat && location.lng && (
//                 <Marker
//                   key={index}
//                   position={{ lat: location.lat, lng: location.lng }}
//                   label={{ text: location.name.split(",")[0], color: location.type === "hotel" ? "blue" : "red" }}
//                   icon={{
//                     url: location.type === "hotel"
//                       ? "http://maps.google.com/mapfiles/ms/icons/blue-dot.png"
//                       : "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
//                   }}
//                 />
//               )
//             ))}
//           </GoogleMap>
//         ) : (
//           <p>Loading map...</p>
//         )}
//       </div>

//       {/* Buttons */}
//       <div className="itinerary-button-container">
//         {isEditing ? (
//           <button className="itinerary-button" onClick={saveChanges}>
//             Save Changes
//           </button>
//         ) : (
//           <button className="itinerary-button" onClick={toggleEdit}>
//             Edit Itinerary
//           </button>
//         )}
//         <button className="itinerary-button" onClick={downloadPDF}>
//           Download as PDF
//         </button>
//         <button className="itinerary-button" onClick={() => navigate("/chatbot")}>
//           Create Another Itinerary
//         </button>
//         <button className="itinerary-button" onClick={() => navigate("/past-itineraries")}>
//           View Past Itineraries
//         </button>
//       </div>
//     </div>
//   );
// };

// export default Itinerary;





















// // src/pages/Itinerary/Itinerary.jsx
// import React, { useState } from 'react';
// import { useLocation, useNavigate } from 'react-router-dom';
// import { jsPDF } from 'jspdf';
// import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
// import './Itinerary.css';

// const Itinerary = () => {
//   const navigate = useNavigate();
//   const { state } = useLocation();
//   const backendItinerary = state?.itinerary;

//   const [itinerary, setItinerary] = useState(backendItinerary || { itinerary_data: {} });
//   const [isEditing, setIsEditing] = useState(false);

//   // Google Maps configuration
//   const mapContainerStyle = {
//     width: '100%',
//     height: '400px',
//   };

//   // Center map on the first hotel or restaurant coordinate (or default to Ooty)
//   const center = itinerary.hotels?.[0]?.lat
//     ? { lat: itinerary.hotels[0].lat, lng: itinerary.hotels[0].lng }
//     : { lat: 11.4102, lng: 76.6950 }; // Default to Ooty coordinates

//   const googleMapsApiKey = 'AIzaSyCPbEx2Cx-nxPvOEEYsMG3VsvAMkodoRI4'; // Replace with your API key

//   if (!backendItinerary) {
//     return (
//       <div className="itinerary-container">
//         <h2 className="itinerary-header">No Itinerary Available</h2>
//         <p>Please create an itinerary using the chatbot.</p>
//         <button className="itinerary-button" onClick={() => navigate('/chatbot')}>
//           Go to Chatbot
//         </button>
//       </div>
//     );
//   }

//   // Handle input changes for editing
//   const handleInputChange = (e, field, subField = null, dayIndex = null, scheduleIndex = null) => {
//     const updatedItinerary = { ...itinerary };
//     if (dayIndex !== null && scheduleIndex !== null) {
//       updatedItinerary.itinerary_data.itinerary[dayIndex].schedule[scheduleIndex][field] = e.target.value;
//     } else if (subField) {
//       updatedItinerary.itinerary_data[subField][field] = e.target.value;
//     } else {
//       updatedItinerary.itinerary_data[field] = e.target.value;
//     }
//     setItinerary(updatedItinerary);
//   };

//   // Handle travel tips editing
//   const handleTravelTipChange = (e, index) => {
//     const updatedItinerary = { ...itinerary };
//     updatedItinerary.itinerary_data.importantNotesAndTips[index] = e.target.value;
//     setItinerary(updatedItinerary);
//   };

//   // Toggle editing mode
//   const toggleEdit = () => {
//     setIsEditing(!isEditing);
//   };

//   // Save changes (logs for now)
//   const saveChanges = () => {
//     console.log("Updated Itinerary:", itinerary);
//     setIsEditing(false);
//   };

//   // Download the itinerary as a PDF
//   const downloadPDF = () => {
//     const doc = new jsPDF();
//     let yOffset = 10;
//     const pageHeight = 297;
//     const marginBottom = 20;
//     const maxPageHeight = pageHeight - marginBottom;
//     const lineHeight = 7;

//     const addText = (text, x, y, fontSize, maxWidth = null) => {
//       doc.setFontSize(fontSize);
//       let lines = maxWidth ? doc.splitTextToSize(text, maxWidth) : [text];
//       let textHeight = lines.length * lineHeight;

//       if (y + textHeight > maxPageHeight) {
//         doc.addPage();
//         yOffset = 10;
//       } else {
//         yOffset = y;
//       }

//       if (maxWidth) {
//         doc.text(lines, x, yOffset, { maxWidth });
//       } else {
//         doc.text(text, x, yOffset);
//       }

//       yOffset += textHeight;
//       return yOffset;
//     };

//     yOffset = addText("Travel Itinerary", 10, yOffset, 20);
//     yOffset += 5;

//     yOffset = addText("Overview", 10, yOffset, 16);
//     yOffset = addText(`Trip Name: ${itinerary.itinerary_data.tripName}`, 10, yOffset, 14);
//     yOffset = addText(`Duration: ${itinerary.itinerary_data.duration}`, 10, yOffset, 14);
//     yOffset = addText(`Start Point: ${itinerary.itinerary_data.startPoint}`, 10, yOffset, 14);
//     yOffset += 5;

//     yOffset = addText("Daily Plan", 10, yOffset, 16);
//     itinerary.itinerary_data.itinerary.forEach((day) => {
//       yOffset = addText(`Day ${day.day}: ${day.title}`, 10, yOffset, 14);
//       day.schedule.forEach((item) => {
//         yOffset = addText(
//           `${item.time}: ${item.activity} (Cost: ${item.costPerPerson}, Place ID: ${item.placeId})`,
//           15,
//           yOffset,
//           12,
//           170
//         );
//       });
//       yOffset += 5;
//     });
//     yOffset += 5;

//     yOffset = addText("Hotel Recommendations", 10, yOffset, 16);
//     itinerary.itinerary_data.hotelRecommendations.forEach((hotel) => {
//       yOffset = addText(
//         `${hotel.category}: ${hotel.options.join(", ")} (Place ID: ${hotel.placeId})`,
//         15,
//         yOffset,
//         12,
//         170
//       );
//     });
//     yOffset += 5;

//     yOffset = addText("Estimated Budget", 10, yOffset, 16);
//     yOffset = addText(
//       `Total: ${itinerary.itinerary_data.budgetCalculation.totalEstimatedBudgetPerPerson}`,
//       15,
//       yOffset,
//       12
//     );
//     yOffset = addText(
//       `Transportation: ${itinerary.itinerary_data.budgetCalculation.transportation.totalTransportation}`,
//       15,
//       yOffset,
//       12
//     );
//     yOffset = addText(
//       `Accommodation: ${itinerary.itinerary_data.budgetCalculation.accommodation}`,
//       15,
//       yOffset,
//       12
//     );
//     yOffset = addText(
//       `Food: ${itinerary.itinerary_data.budgetCalculation.food.totalFood}`,
//       15,
//       yOffset,
//       12
//     );
//     yOffset += 5;

//     yOffset = addText("Travel Tips", 10, yOffset, 16);
//     itinerary.itinerary_data.importantNotesAndTips.forEach((tip, index) => {
//       yOffset = addText(`${index + 1}. ${tip}`, 15, yOffset, 12, 170);
//     });

//     doc.save(`Itinerary_${itinerary.itinerary_data.tripName || 'Trip'}.pdf`);
//   };

//   return (
//     <div className="itinerary-container">
//       <h2 className="itinerary-header">Your Personalized Travel Itinerary</h2>

//       {/* Overview Section */}
//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Overview</h3>
//         <p className="itinerary-text">
//           <strong>Trip Name:</strong>{' '}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.tripName}
//               onChange={(e) => handleInputChange(e, 'tripName')}
//             />
//           ) : (
//             itinerary.itinerary_data.tripName
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>Duration:</strong>{' '}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.duration}
//               onChange={(e) => handleInputChange(e, 'duration')}
//             />
//           ) : (
//             itinerary.itinerary_data.duration
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>Start Point:</strong>{' '}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.startPoint}
//               onChange={(e) => handleInputChange(e, 'startPoint')}
//             />
//           ) : (
//             itinerary.itinerary_data.startPoint
//           )}
//         </p>
//       </div>

//       {/* Daily Plan Section */}
//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Daily Plan</h3>
//         {itinerary.itinerary_data.itinerary?.length > 0 ? (
//           <ul className="itinerary-list">
//             {itinerary.itinerary_data.itinerary.map((day, dayIndex) => (
//               <li key={dayIndex} className="itinerary-list-item">
//                 <h4>
//                   Day {day.day}: {isEditing ? (
//                     <input
//                       type="text"
//                       value={day.title}
//                       onChange={(e) => {
//                         const updated = { ...itinerary };
//                         updated.itinerary_data.itinerary[dayIndex].title = e.target.value;
//                         setItinerary(updated);
//                       }}
//                     />
//                   ) : (
//                     day.title
//                   )}
//                 </h4>
//                 {day.schedule.map((item, scheduleIndex) => (
//                   <p key={scheduleIndex} className="itinerary-text">
//                     {isEditing ? (
//                       <>
//                         <input
//                           type="text"
//                           value={item.time}
//                           onChange={(e) => handleInputChange(e, 'time', null, dayIndex, scheduleIndex)}
//                         />
//                         <input
//                           type="text"
//                           value={item.activity}
//                           onChange={(e) => handleInputChange(e, 'activity', null, dayIndex, scheduleIndex)}
//                         />
//                         <input
//                           type="text"
//                           value={item.costPerPerson}
//                           onChange={(e) => handleInputChange(e, 'costPerPerson', null, dayIndex, scheduleIndex)}
//                         />
//                       </>
//                     ) : (
//                       `${item.time}: ${item.activity} (Cost: ${item.costPerPerson}, Place ID: ${item.placeId})`
//                     )}
//                   </p>
//                 ))}
//               </li>
//             ))}
//           </ul>
//         ) : (
//           <p className="itinerary-text">No daily itinerary available.</p>
//         )}
//       </div>

//       {/* Hotels Section */}
//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Hotel Recommendations</h3>
//         {itinerary.itinerary_data.hotelRecommendations?.length > 0 ? (
//           <ul className="itinerary-list">
//             {itinerary.itinerary_data.hotelRecommendations.map((hotel, index) => (
//               <li key={index} className="itinerary-list-item">
//                 {isEditing ? (
//                   <>
//                     <input
//                       type="text"
//                       value={hotel.category}
//                       onChange={(e) => {
//                         const updated = { ...itinerary };
//                         updated.itinerary_data.hotelRecommendations[index].category = e.target.value;
//                         setItinerary(updated);
//                       }}
//                     />
//                     <input
//                       type="text"
//                       value={hotel.options.join(", ")}
//                       onChange={(e) => {
//                         const updated = { ...itinerary };
//                         updated.itinerary_data.hotelRecommendations[index].options = e.target.value.split(", ");
//                         setItinerary(updated);
//                       }}
//                     />
//                   </>
//                 ) : (
//                   `${hotel.category}: ${hotel.options.join(", ")} (Place ID: ${hotel.placeId})`
//                 )}
//               </li>
//             ))}
//           </ul>
//         ) : (
//           <p className="itinerary-text">No hotel recommendations available.</p>
//         )}
//       </div>

//       {/* Budget Section */}
//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Estimated Budget</h3>
//         <p className="itinerary-text">
//           <strong>Total:</strong>{' '}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.budgetCalculation.totalEstimatedBudgetPerPerson}
//               onChange={(e) => handleInputChange(e, 'totalEstimatedBudgetPerPerson', 'budgetCalculation')}
//             />
//           ) : (
//             itinerary.itinerary_data.budgetCalculation.totalEstimatedBudgetPerPerson
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>Transportation:</strong>{' '}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.budgetCalculation.transportation.totalTransportation}
//               onChange={(e) => handleInputChange(e, 'totalTransportation', 'budgetCalculation.transportation')}
//             />
//           ) : (
//             itinerary.itinerary_data.budgetCalculation.transportation.totalTransportation
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>Accommodation:</strong>{' '}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.budgetCalculation.accommodation}
//               onChange={(e) => handleInputChange(e, 'accommodation', 'budgetCalculation')}
//             />
//           ) : (
//             itinerary.itinerary_data.budgetCalculation.accommodation
//           )}
//         </p>
//         <p className="itinerary-text">
//           <strong>Food:</strong>{' '}
//           {isEditing ? (
//             <input
//               type="text"
//               value={itinerary.itinerary_data.budgetCalculation.food.totalFood}
//               onChange={(e) => handleInputChange(e, 'totalFood', 'budgetCalculation.food')}
//             />
//           ) : (
//             itinerary.itinerary_data.budgetCalculation.food.totalFood
//           )}
//         </p>
//       </div>

//       {/* Travel Tips Section */}
//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Travel Tips</h3>
//         {itinerary.itinerary_data.importantNotesAndTips?.length > 0 ? (
//           <ul className="itinerary-list">
//             {itinerary.itinerary_data.importantNotesAndTips.map((tip, index) => (
//               <li key={index} className="itinerary-list-item">
//                 {isEditing ? (
//                   <input
//                     type="text"
//                     value={tip}
//                     onChange={(e) => handleTravelTipChange(e, index)}
//                   />
//                 ) : (
//                   tip
//                 )}
//               </li>
//             ))}
//           </ul>
//         ) : (
//           <p className="itinerary-text">No travel tips available.</p>
//         )}
//       </div>

//       {/* Google Maps Section */}
//       <div className="itinerary-section">
//         <h3 className="itinerary-subheader">Map of Locations</h3>
//         <LoadScript googleMapsApiKey={googleMapsApiKey}>
//           <GoogleMap
//             mapContainerStyle={mapContainerStyle}
//             center={center}
//             zoom={10}
//           >
//             {/* Plot hotels */}
//             {itinerary.hotels?.map((hotel, index) => (
//               hotel.lat && hotel.lng && (
//                 <Marker
//                   key={`hotel-${index}`}
//                   position={{ lat: hotel.lat, lng: hotel.lng }}
//                   label={{ text: hotel.address.split(',')[0], color: 'blue' }}
//                 />
//               )
//             ))}
//             {/* Plot restaurants */}
//             {itinerary.restaurants?.map((restaurant, index) => (
//               restaurant.lat && restaurant.lng && (
//                 <Marker
//                   key={`restaurant-${index}`}
//                   position={{ lat: restaurant.lat, lng: restaurant.lng }}
//                   label={{ text: restaurant.address.split(',')[0], color: 'red' }}
//                 />
//               )
//             ))}
//           </GoogleMap>
//         </LoadScript>
//       </div>

//       {/* Action Buttons */}
//       <div className="itinerary-button-container">
//         {isEditing ? (
//           <button className="itinerary-button" onClick={saveChanges}>
//             Save Changes
//           </button>
//         ) : (
//           <button className="itinerary-button" onClick={toggleEdit}>
//             Edit Itinerary
//           </button>
//         )}
//         <button className="itinerary-button" onClick={downloadPDF}>
//           Download as PDF
//         </button>
//         <button className="itinerary-button" onClick={() => navigate('/chatbot')}>
//           Create Another Itinerary
//         </button>
//         <button className="itinerary-button" onClick={() => navigate('/past-itineraries')}>
//           View Past Itineraries
//         </button>
//       </div>
//     </div>
//   );
// };

// export default Itinerary;