// src/pages/Itinerary.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf'; // Import jsPDF for PDF generation
import './Itinerary.css';

const Itinerary = () => {
  const navigate = useNavigate();

  // Hardcoded mock itinerary data (same as provided)
  const mockItinerary = {
    id: 9,
    user: 2,
    preference: 10,
    itinerary_data: {
      destination: "Paris",
      duration: "5 days",
      overview: "A solo trip to Paris focusing on sightseeing, wine tasting, and museum visits, balancing iconic landmarks with local experiences.",
      daily_plan: [
        {
          day: 1,
          title: "Arrival and Iconic Paris",
          description: "Settle in and explore some of Paris's most famous sights.",
          morning: {
            activity: "Eiffel Tower Visit",
            description: "Ascend the Eiffel Tower for panoramic views of the city.",
            location: "Champ de Mars"
          },
          afternoon: {
            activity: "Seine River Cruise",
            description: "Enjoy a relaxing cruise along the Seine, admiring the city's architecture.",
            location: "Seine River"
          },
          evening: {
            activity: "Dinner in the Latin Quarter",
            description: "Enjoy traditional French cuisine in the charming Latin Quarter.",
            location: "Latin Quarter"
          }
        },
        {
          day: 2,
          title: "Museums and Montmartre Charm",
          description: "Explore world-renowned museums and the artistic heart of Montmartre.",
          morning: {
            activity: "Louvre Museum",
            description: "Visit the Louvre Museum, home to masterpieces like the Mona Lisa.",
            location: "Louvre Museum"
          },
          afternoon: {
            activity: "Montmartre Exploration",
            description: "Explore the charming streets of Montmartre, visit the Sacré-Cœur Basilica, and Place du Tertre.",
            location: "Montmartre"
          },
          evening: {
            activity: "Dinner and Show in Montmartre",
            description: "Enjoy dinner and perhaps a cabaret show in Montmartre.",
            location: "Montmartre"
          }
        },
        {
          day: 3,
          title: "Palace of Versailles and Wine Tasting",
          description: "Day trip to the Palace of Versailles followed by a wine tasting experience.",
          morning: {
            activity: "Palace of Versailles",
            description: "Visit the opulent Palace of Versailles, the former residence of French royalty.",
            location: "Versailles"
          },
          afternoon: {
            activity: "Wine Tasting in the Champagne Region (Optional Day Trip)",
            description: "Embark on a day trip to the Champagne region for a wine tasting experience (consider pre-booking a tour).",
            location: "Champagne Region (requires separate transportation)"
          },
          evening: {
            activity: "Dinner near your hotel",
            description: "Relax and enjoy dinner near your accommodation.",
            location: "Near your hotel"
          }
        },
        {
          day: 4,
          title: "Latin Quarter and Museums",
          description: "Explore the Latin Quarter and visit more museums.",
          morning: {
            activity: "Panthéon Visit",
            description: "Visit the Panthéon, a neoclassical monument housing the tombs of notable French citizens.",
            location: "Latin Quarter"
          },
          afternoon: {
            activity: "Musée d'Orsay",
            description: "Visit the Musée d'Orsay, showcasing Impressionist and Post-Impressionist art.",
            location: "Musée d'Orsay"
          },
          evening: {
            activity: "Dinner and drinks in Le Marais",
            description: "Explore the trendy Le Marais district and enjoy dinner and drinks.",
            location: "Le Marais"
          }
        },
        {
          day: 5,
          title: "Departure",
          description: "Enjoy a final Parisian breakfast before heading to the airport for your departure.",
          morning: {
            activity: "Final Parisian Breakfast",
            description: "Enjoy a final Parisian breakfast at a local patisserie.",
            location: "Local Patisserie"
          },
          afternoon: {
            activity: "Departure",
            description: "Transfer to the airport for your flight home.",
            location: "Charles de Gaulle Airport (CDG)"
          },
          evening: {
            activity: "N/A",
            description: "N/A",
            location: "N/A"
          }
        }
      ],
      estimated_budget: {
        currency: "Rupees",
        total: "150000",
        breakdown: {
          accommodation: "40000",
          food: "30000",
          activities: "50000",
          transportation: "30000"
        }
      },
      travel_tips: [
        "Purchase a Paris Pass for access to museums and transportation.",
        "Learn basic French phrases for better communication.",
        "Use the metro for efficient transportation within the city.",
        "Book accommodations and tours in advance, especially during peak season."
      ]
    },
    created_at: "2025-03-10T06:20:33.503307Z"
  };

  const [itinerary, setItinerary] = useState(mockItinerary);
  const [isEditing, setIsEditing] = useState(false);

  // Handle input changes for editing
  const handleInputChange = (e, field, subField = null, dayIndex = null, timeOfDay = null) => {
    const updatedItinerary = { ...itinerary };
    if (dayIndex !== null && timeOfDay !== null) {
      updatedItinerary.itinerary_data.daily_plan[dayIndex][timeOfDay][field] = e.target.value;
    } else if (subField) {
      updatedItinerary.itinerary_data[subField][field] = e.target.value;
    } else {
      updatedItinerary.itinerary_data[field] = e.target.value;
    }
    setItinerary(updatedItinerary);
  };

  // Handle travel tips editing
  const handleTravelTipChange = (e, index) => {
    const updatedItinerary = { ...itinerary };
    updatedItinerary.itinerary_data.travel_tips[index] = e.target.value;
    setItinerary(updatedItinerary);
  };

  // Toggle editing mode
  const toggleEdit = () => {
    setIsEditing(!isEditing);
  };

  // Save changes (logs the updated data; in a real app, you'd send this to the backend)
  const saveChanges = () => {
    console.log("Updated Itinerary:", itinerary);
    setIsEditing(false);
  };

  // Download the itinerary as a PDF
  const downloadPDF = () => {
    const doc = new jsPDF();
    let yOffset = 10;
    const pageHeight = 297; // A4 page height in mm (jsPDF uses mm as the default unit)
    const marginBottom = 20; // Margin at the bottom of the page
    const maxPageHeight = pageHeight - marginBottom; // Maximum yOffset before a page break
    const lineHeight = 7; // Approximate height per line (adjust based on font size)
  
    // Helper function to add text with dynamic height calculation and page breaks
    const addText = (text, x, y, fontSize, maxWidth = null) => {
      doc.setFontSize(fontSize);
      let lines = maxWidth ? doc.splitTextToSize(text, maxWidth) : [text];
      let textHeight = lines.length * lineHeight;
  
      // Check if the text will exceed the page height
      if (y + textHeight > maxPageHeight) {
        doc.addPage();
        yOffset = 10; // Reset yOffset for the new page
      } else {
        yOffset = y; // Update yOffset to the current y position
      }
  
      // Render the text
      if (maxWidth) {
        doc.text(lines, x, yOffset, { maxWidth });
      } else {
        doc.text(text, x, yOffset);
      }
  
      // Update yOffset based on the number of lines
      yOffset += textHeight;
      return yOffset;
    };
  
    // Title
    yOffset = addText("Travel Itinerary", 10, yOffset, 20);
    yOffset += 5; // Extra spacing after the title
  
    // Overview Section
    yOffset = addText("Overview", 10, yOffset, 16);
    yOffset = addText(`Destination: ${itinerary.itinerary_data.destination}`, 10, yOffset, 14);
    yOffset = addText(`Duration: ${itinerary.itinerary_data.duration}`, 10, yOffset, 14);
    yOffset = addText(`Overview: ${itinerary.itinerary_data.overview}`, 10, yOffset, 14, 180);
    yOffset += 5; // Extra spacing after the section
  
    // Daily Plan Section
    yOffset = addText("Daily Plan", 10, yOffset, 16);
    itinerary.itinerary_data.daily_plan.forEach((day) => {
      yOffset = addText(`Day ${day.day}: ${day.title}`, 10, yOffset, 14);
      yOffset = addText(`Description: ${day.description}`, 15, yOffset, 12, 170);
      yOffset = addText(
        `Morning: ${day.morning.activity} - ${day.morning.description} (${day.morning.location})`,
        15,
        yOffset,
        12,
        170
      );
      yOffset = addText(
        `Afternoon: ${day.afternoon.activity} - ${day.afternoon.description} (${day.afternoon.location})`,
        15,
        yOffset,
        12,
        170
      );
      yOffset = addText(
        `Evening: ${day.evening.activity} - ${day.evening.description} (${day.evening.location})`,
        15,
        yOffset,
        12,
        170
      );
      yOffset += 5; // Extra spacing after each day
    });
    yOffset += 5; // Extra spacing after the section
  
    // Estimated Budget Section
    yOffset = addText("Estimated Budget", 10, yOffset, 16);
    yOffset = addText(
      `Total: ${itinerary.itinerary_data.estimated_budget.total} ${itinerary.itinerary_data.estimated_budget.currency}`,
      15,
      yOffset,
      12
    );
    yOffset = addText(
      `Accommodation: ${itinerary.itinerary_data.estimated_budget.breakdown.accommodation}`,
      15,
      yOffset,
      12
    );
    yOffset = addText(
      `Food: ${itinerary.itinerary_data.estimated_budget.breakdown.food}`,
      15,
      yOffset,
      12
    );
    yOffset = addText(
      `Activities: ${itinerary.itinerary_data.estimated_budget.breakdown.activities}`,
      15,
      yOffset,
      12
    );
    yOffset = addText(
      `Transportation: ${itinerary.itinerary_data.estimated_budget.breakdown.transportation}`,
      15,
      yOffset,
      12
    );
    yOffset += 5; // Extra spacing after the section
  
    // Travel Tips Section
    yOffset = addText("Travel Tips", 10, yOffset, 16);
    itinerary.itinerary_data.travel_tips.forEach((tip, index) => {
      yOffset = addText(`${index + 1}. ${tip}`, 15, yOffset, 12, 170);
    });
  
    // Save the PDF
    doc.save(`Itinerary_${itinerary.itinerary_data.destination}.pdf`);
  };

  return (
    <div className="itinerary-container">
      <h2 className="itinerary-header">Your Personalized Travel Itinerary</h2>

      {/* Overview Section */}
      <div className="itinerary-section">
        <h3 className="itinerary-subheader">Overview</h3>
        <p className="itinerary-text">
          <strong>Destination:</strong>{' '}
          {isEditing ? (
            <input
              type="text"
              value={itinerary.itinerary_data.destination}
              onChange={(e) => handleInputChange(e, 'destination', 'itinerary_data')}
            />
          ) : (
            itinerary.itinerary_data.destination
          )}
        </p>
        <p className="itinerary-text">
          <strong>Duration:</strong>{' '}
          {isEditing ? (
            <input
              type="text"
              value={itinerary.itinerary_data.duration}
              onChange={(e) => handleInputChange(e, 'duration', 'itinerary_data')}
            />
          ) : (
            itinerary.itinerary_data.duration
          )}
        </p>
        <p className="itinerary-text">
          <strong>Overview:</strong>{' '}
          {isEditing ? (
            <textarea
              value={itinerary.itinerary_data.overview}
              onChange={(e) => handleInputChange(e, 'overview', 'itinerary_data')}
            />
          ) : (
            itinerary.itinerary_data.overview
          )}
        </p>
      </div>

      {/* Daily Plan Section */}
      <div className="itinerary-section">
        <h3 className="itinerary-subheader">Daily Plan</h3>
        {itinerary.itinerary_data.daily_plan && itinerary.itinerary_data.daily_plan.length > 0 ? (
          <ul className="itinerary-list">
            {itinerary.itinerary_data.daily_plan.map((day, index) => (
              <li key={index} className="itinerary-list-item">
                <h4>Day {day.day}: {isEditing ? (
                  <input
                    type="text"
                    value={day.title}
                    onChange={(e) => {
                      const updatedItinerary = { ...itinerary };
                      updatedItinerary.itinerary_data.daily_plan[index].title = e.target.value;
                      setItinerary(updatedItinerary);
                    }}
                  />
                ) : (
                  day.title
                )}</h4>
                <p className="itinerary-text">
                  <strong>Description:</strong>{' '}
                  {isEditing ? (
                    <textarea
                      value={day.description}
                      onChange={(e) => {
                        const updatedItinerary = { ...itinerary };
                        updatedItinerary.itinerary_data.daily_plan[index].description = e.target.value;
                        setItinerary(updatedItinerary);
                      }}
                    />
                  ) : (
                    day.description
                  )}
                </p>
                <p className="itinerary-text">
                  <strong>Morning:</strong>{' '}
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={day.morning.activity}
                        onChange={(e) => handleInputChange(e, 'activity', null, index, 'morning')}
                        placeholder="Activity"
                      />
                      <textarea
                        value={day.morning.description}
                        onChange={(e) => handleInputChange(e, 'description', null, index, 'morning')}
                        placeholder="Description"
                      />
                      <input
                        type="text"
                        value={day.morning.location}
                        onChange={(e) => handleInputChange(e, 'location', null, index, 'morning')}
                        placeholder="Location"
                      />
                    </>
                  ) : (
                    `${day.morning.activity} - ${day.morning.description} (${day.morning.location})`
                  )}
                </p>
                <p className="itinerary-text">
                  <strong>Afternoon:</strong>{' '}
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={day.afternoon.activity}
                        onChange={(e) => handleInputChange(e, 'activity', null, index, 'afternoon')}
                        placeholder="Activity"
                      />
                      <textarea
                        value={day.afternoon.description}
                        onChange={(e) => handleInputChange(e, 'description', null, index, 'afternoon')}
                        placeholder="Description"
                      />
                      <input
                        type="text"
                        value={day.afternoon.location}
                        onChange={(e) => handleInputChange(e, 'location', null, index, 'afternoon')}
                        placeholder="Location"
                      />
                    </>
                  ) : (
                    `${day.afternoon.activity} - ${day.afternoon.description} (${day.afternoon.location})`
                  )}
                </p>
                <p className="itinerary-text">
                  <strong>Evening:</strong>{' '}
                  {isEditing ? (
                    <>
                      <input
                        type="text"
                        value={day.evening.activity}
                        onChange={(e) => handleInputChange(e, 'activity', null, index, 'evening')}
                        placeholder="Activity"
                      />
                      <textarea
                        value={day.evening.description}
                        onChange={(e) => handleInputChange(e, 'description', null, index, 'evening')}
                        placeholder="Description"
                      />
                      <input
                        type="text"
                        value={day.evening.location}
                        onChange={(e) => handleInputChange(e, 'location', null, index, 'evening')}
                        placeholder="Location"
                      />
                    </>
                  ) : (
                    `${day.evening.activity} - ${day.evening.description} (${day.evening.location})`
                  )}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="itinerary-text">No daily itinerary available.</p>
        )}
      </div>

      {/* Estimated Budget Section */}
      <div className="itinerary-section">
        <h3 className="itinerary-subheader">Estimated Budget</h3>
        <p className="itinerary-text">
          <strong>Total:</strong>{' '}
          {isEditing ? (
            <input
              type="text"
              value={itinerary.itinerary_data.estimated_budget.total}
              onChange={(e) => handleInputChange(e, 'total', 'estimated_budget')}
            />
          ) : (
            itinerary.itinerary_data.estimated_budget.total
          )}{' '}
          {isEditing ? (
            <input
              type="text"
              value={itinerary.itinerary_data.estimated_budget.currency}
              onChange={(e) => handleInputChange(e, 'currency', 'estimated_budget')}
            />
          ) : (
            itinerary.itinerary_data.estimated_budget.currency
          )}
        </p>
        <p className="itinerary-text">
          <strong>Accommodation:</strong>{' '}
          {isEditing ? (
            <input
              type="text"
              value={itinerary.itinerary_data.estimated_budget.breakdown.accommodation}
              onChange={(e) => handleInputChange(e, 'accommodation', 'estimated_budget.breakdown')}
            />
          ) : (
            itinerary.itinerary_data.estimated_budget.breakdown.accommodation
          )}
        </p>
        <p className="itinerary-text">
          <strong>Food:</strong>{' '}
          {isEditing ? (
            <input
              type="text"
              value={itinerary.itinerary_data.estimated_budget.breakdown.food}
              onChange={(e) => handleInputChange(e, 'food', 'estimated_budget.breakdown')}
            />
          ) : (
            itinerary.itinerary_data.estimated_budget.breakdown.food
          )}
        </p>
        <p className="itinerary-text">
          <strong>Activities:</strong>{' '}
          {isEditing ? (
            <input
              type="text"
              value={itinerary.itinerary_data.estimated_budget.breakdown.activities}
              onChange={(e) => handleInputChange(e, 'activities', 'estimated_budget.breakdown')}
            />
          ) : (
            itinerary.itinerary_data.estimated_budget.breakdown.activities
          )}
        </p>
        <p className="itinerary-text">
          <strong>Transportation:</strong>{' '}
          {isEditing ? (
            <input
              type="text"
              value={itinerary.itinerary_data.estimated_budget.breakdown.transportation}
              onChange={(e) => handleInputChange(e, 'transportation', 'estimated_budget.breakdown')}
            />
          ) : (
            itinerary.itinerary_data.estimated_budget.breakdown.transportation
          )}
        </p>
      </div>

      {/* Travel Tips Section */}
      <div className="itinerary-section">
        <h3 className="itinerary-subheader">Travel Tips</h3>
        {itinerary.itinerary_data.travel_tips && itinerary.itinerary_data.travel_tips.length > 0 ? (
          <ul className="itinerary-list">
            {itinerary.itinerary_data.travel_tips.map((tip, index) => (
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
          <p className="itinerary-text">No travel tips available.</p>
        )}
      </div>

      {/* Action Buttons */}
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
        <button className="itinerary-button" onClick={() => navigate('/chatbot')}>
          Create Another Itinerary
        </button>
        <button className="itinerary-button" onClick={() => navigate('/past-itineraries')}>
          View Past Itineraries
        </button>
      </div>
    </div>
  );
};

export default Itinerary;