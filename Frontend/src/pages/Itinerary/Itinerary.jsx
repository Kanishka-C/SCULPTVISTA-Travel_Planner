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

  const googleMapsApiKey = "your key"; // Replace with your actual key

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
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });
  
    // Set font and margins
    const leftMargin = 15;
    const rightMargin = 25; // Corrected margin
    const pageWidth = 150; // A4 width in mm
    const maxWidth = 120; // Corrected max width
    const pageHeight = 297; // A4 height in mm
    let yOffset = 20;
  
    // Clean and trim cost text to avoid unnecessary symbols
    const cleanCost = (cost) => {
      if (typeof cost === "string") {
        return cost
          .replace(/[^\d₹.,-]/g, "") // Keep only digits, ₹, and punctuation
          .replace(/11/g, "") // Remove unwanted small 11
          .trim();
      }
      return cost;
    };
  
    // Function to clean and format text to remove unnecessary spaces
    const cleanText = (text) => {
      return text.replace(/\s+/g, " ").trim(); // Remove extra spaces
    };
  
    // Function to add a section title with consistent formatting
    const addSectionTitle = (title, fontSize = 14) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(fontSize);
      doc.text(cleanText(title), leftMargin, yOffset);
      yOffset += 8;
    };
  
    // Function to add content with dynamic text wrapping and margin checks
    const addContent = (text, indent = 5, spacing = 5, fontSize = 11) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fontSize);
  
      const cleanedText = cleanText(text);
      const lines = doc.splitTextToSize(cleanedText, maxWidth - indent);
  
      lines.forEach((line) => {
        if (yOffset + 6 > pageHeight - 20) {
          doc.addPage();
          yOffset = 20;
        }
        doc.text(line, leftMargin + indent, yOffset);
        yOffset += 6;
      });
  
      yOffset += spacing;
    };
  
    // ✅ Overview Section
    addSectionTitle("Overview");
    addContent(`Trip Name: ${cleanText(itinerary.itinerary_data.tripName || "N/A")}`);
    addContent(`Duration: ${cleanText(itinerary.itinerary_data.duration || "N/A")}`);
    addContent(`Start Point: ${cleanText(itinerary.itinerary_data.startPoint || "N/A")}`);
    addContent(`End Point: ${cleanText(itinerary.itinerary_data.endPoint || "N/A")}`);
    addContent(`Travel Style: ${cleanText(itinerary.itinerary_data.travelStyle || "N/A")}`);
    addContent(`Season: ${cleanText(itinerary.itinerary_data.season || "N/A")}`);
    yOffset += 5;
  
    // ✅ Daily Plan Section
    addSectionTitle("Daily Plan");
    if (itinerary.itinerary_data.itinerary?.length > 0) {
      itinerary.itinerary_data.itinerary.forEach((day) => {
        addContent(`Day ${day.day}: ${cleanText(day.title)}`, 0, 3, 12);
  
        day.schedule.forEach((item) => {
          const timeLabel =
            item.time.includes(":") || ["Breakfast", "Lunch", "Dinner"].includes(item.time)
              ? item.time
              : `${item.time}:`;
  
          const activityText = cleanText(item.activity);
          const cost = item.costPerPerson ? ` (Cost: ₹${cleanCost(item.costPerPerson)})` : "";
  
          // Ensure multi-line split for long activity details
          addContent(`${timeLabel} ${activityText}${cost}`, 5, 2);
        });
        yOffset += 3;
      });
    } else {
      addContent("No daily itinerary available.");
    }
    yOffset += 5;
  
    // ✅ Hotel Recommendations Section
    addSectionTitle("Hotel Recommendations");
    if (itinerary.itinerary_data.hotelRecommendations?.length > 0) {
      itinerary.itinerary_data.hotelRecommendations.forEach((hotel) => {
        addContent(`${hotel.category}:`, 5, 3, 12);
        addContent(`${hotel.options.join(", ")}`, 10, 2);
      });
    } else {
      addContent("No hotel recommendations available.");
    }
    yOffset += 5;
  
    // ✅ Hotel Cost Estimate Section
    if (itinerary.itinerary_data.hotelCostEstimate) {
      addSectionTitle("Hotel Cost Estimate");
  
      addContent(
        `Cost per Room per Night: ₹${cleanCost(itinerary.itinerary_data.hotelCostEstimate.costPerRoomPerNight)}`,
        5
      );
      addContent(
        `Cost per Person: ₹${cleanCost(itinerary.itinerary_data.hotelCostEstimate.costPerPerson)}`,
        5
      );
      addContent(`Assumptions: ${cleanText(itinerary.itinerary_data.hotelCostEstimate.assumptions)}`, 5);
    }
    yOffset += 5;
  
    // ✅ Budget Breakdown Section
    addSectionTitle("Budget Breakdown");
    if (itinerary.itinerary_data.budgetCalculation) {
      const budgetItems = [
        {
          label: "Total Estimated Budget",
          value: `₹${cleanCost(itinerary.itinerary_data.budgetCalculation.totalEstimatedBudgetPerPerson)}`,
        },
        {
          label: "Transportation",
          value: `₹${cleanCost(itinerary.itinerary_data.budgetCalculation.transportation.totalTransportation)}`,
        },
        {
          label: "Accommodation",
          value: `₹${cleanCost(itinerary.itinerary_data.budgetCalculation.accommodation)}`,
        },
        {
          label: "Food",
          value: `₹${cleanCost(itinerary.itinerary_data.budgetCalculation.food.totalFood)}`,
        },
        {
          label: "Activities Entry Fees",
          value: `₹${cleanCost(itinerary.itinerary_data.budgetCalculation.activitiesEntryFees)}`,
        },
        {
          label: "Miscellaneous",
          value: `₹${cleanCost(itinerary.itinerary_data.budgetCalculation.miscellaneous)}`,
        },
      ];
  
      budgetItems.forEach((item) => {
        addContent(`${item.label}: ${item.value}`, 5, 3);
      });
    } else {
      addContent("No budget breakdown available.");
    }
    yOffset += 5;
  
    // ✅ Important Notes and Tips Section
    addSectionTitle("Important Notes and Tips");
    if (itinerary.itinerary_data.importantNotesAndTips?.length > 0) {
      itinerary.itinerary_data.importantNotesAndTips.forEach((tip, index) => {
        addContent(`${index + 1}. ${cleanText(tip)}`, 5, 2);
      });
    } else {
      addContent("No notes or tips available.");
    }
  
    // Save the PDF with all cleaned and aligned content
    doc.save(`Itinerary_${cleanText(itinerary.itinerary_data.tripName || "Trip")}.pdf`);
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