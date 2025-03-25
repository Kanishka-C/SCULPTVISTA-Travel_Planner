import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from 'react-router-dom';
import "./Chatbot.css";
import api from "../../api";

const Chatbot = () => {
  const [messages, setMessages] = useState(() => {
    const savedMessages = localStorage.getItem('chatbotMessages');
    return savedMessages ? JSON.parse(savedMessages) : [
      { text: "Hi, I am Noela TravelBot. Let's create your personalized itinerary!", sender: "bot" }
    ];
  });
  const [step, setStep] = useState(() => parseInt(localStorage.getItem('chatbotStep')) || 0);
  const [inputValue, setInputValue] = useState("");
  const [travelDates, setTravelDates] = useState(() => {
    const savedDates = localStorage.getItem('chatbotTravelDates');
    return savedDates ? JSON.parse(savedDates) : { start: "", end: "" };
  });
  const [userResponses, setUserResponses] = useState(() => {
    const savedResponses = localStorage.getItem('chatbotResponses');
    return savedResponses ? JSON.parse(savedResponses) : {
      destination: "",
      departure: "",
      travelDates: { start: "", end: "" },
      travelType: "",
      budget: "",
      transportation: "",
      interests: [],
      healthConditions: "",
    };
  });
  const [isLoading, setIsLoading] = useState(false);

  const chatWindowRef = useRef(null);
  const navigate = useNavigate();

  const questions = [
    "What is your destination?",
    "What is your departure point?",
    "What are your travel dates?",
    "Are you traveling solo, with family, with kids, or in a group?",
    "What is your budget range?",
    "What is your preferred mode of transportation?",
    "What are your main interests?",
    "Do you have any health problems or medical conditions?"
  ];

  const options = {
    0: ["Delhi", "Jaipur", "Goa", "Kerala", "Manali", "Varanasi", "Mysore", "Bengaluru"],
    3: ["Solo", "Family", "With Kids", "Group"],
    4: ["Low", "Medium", "High", "Luxury"],
    5: ["Flight", "Train", "Car", "Bus"],
    6: ["Nature", "Culture", "Adventure", "Relaxation", "Food", "Shopping"],
    7: ["Asthma", "Heart Conditions", "Allergies", "Mobility Issues", "No Issues"]
  };

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
    localStorage.setItem('chatbotMessages', JSON.stringify(messages));
    localStorage.setItem('chatbotStep', step);
    localStorage.setItem('chatbotTravelDates', JSON.stringify(travelDates));
    localStorage.setItem('chatbotResponses', JSON.stringify(userResponses));
  }, [messages, step, travelDates, userResponses]);

  useEffect(() => {
    if (step === questions.length && Object.keys(userResponses).every(key => userResponses[key])) {
      setIsLoading(true);
      sendDataToBackend(userResponses);
    }
  }, []);

  const validateInput = (answer) => {
    if (!answer.trim()) return "Input cannot be empty!";
    if (step === 0 && !/^[A-Za-z\s]+$/.test(answer.trim())) return "Please enter a valid destination (letters and spaces only).";
    if (step === 1 && !/^[A-Za-z\s]+$/.test(answer.trim())) return "Please enter a valid departure point (letters and spaces only).";
    if (step === 2) {
      if (!travelDates.start || !travelDates.end) return "Please select both start and end dates!";
      if (new Date(travelDates.start) > new Date(travelDates.end)) return "End date must be after the start date!";
    }
    if (step === 3 && !/^[A-Za-z\s]+$/.test(answer.trim())) return "Please enter a valid travel type (e.g., Solo, Family).";
    if (step === 4) {
      const validBudgets = ["Low", "Medium", "High", "Luxury"];
      if (!validBudgets.includes(answer) && !/^\d+k?$/.test(answer)) return "Please enter a valid budget (e.g., Low, Medium, High, Luxury, 5000, 5k)!";
    }
    if (step === 5 && !/^[A-Za-z\s]+$/.test(answer)) return "Please enter a valid transportation mode (letters and spaces only)!";
    if (step === 6 && !/^[A-Za-z\s]+$/.test(answer.trim())) return "Please enter a valid interest (letters and spaces only).";
    if (step === 7 && !/^[A-Za-z\s]+$/.test(answer.trim())) return "Please enter a valid health condition (letters and spaces only).";
    return null;
  };

  const handleNextStep = (answer) => {
    const validationError = validateInput(answer);
    if (validationError) {
      alert(validationError);
      return;
    }

    setMessages((prevMessages) => [
      ...prevMessages,
      { text: questions[step], sender: "bot" },
      { text: answer, sender: "user" }
    ]);

    const updatedResponses = { ...userResponses };
    switch (step) {
      case 0: updatedResponses.destination = answer; break;
      case 1: updatedResponses.departure = answer; break;
      case 2: updatedResponses.travelDates = { start: travelDates.start, end: travelDates.end }; break;
      case 3: updatedResponses.travelType = answer; break;
      case 4: updatedResponses.budget = answer; break;
      case 5: updatedResponses.transportation = answer; break;
      case 6: updatedResponses.interests = [...updatedResponses.interests, answer]; break;
      case 7: updatedResponses.healthConditions = answer; break;
      default: break;
    }
    setUserResponses(updatedResponses);
    setInputValue("");

    if (step < questions.length - 1) {
      setTimeout(() => setStep(step + 1), 500);
    } else {
      setIsLoading(true);
      sendDataToBackend(updatedResponses);
    }
  };

  const sendDataToBackend = async (data) => {
    try {
      const formattedData = {
        destination: data.destination,
        departure: data.departure,
        start_date: data.travelDates.start,
        end_date: data.travelDates.end,
        travel_style: data.travelType,
        budget: data.budget,
        transportation: data.transportation,
        activities: data.interests,
        health_issues: data.healthConditions ? [data.healthConditions] : []
      };

      console.log("Sending data to backend:", formattedData);

      const response = await api.post('/api/itinerary/generate-itinerary/', formattedData, {
        withCredentials: true
      });

      console.log("Backend response:", response.data);

      setMessages((prevMessages) => [
        ...prevMessages,
        { text: "Your personalized itinerary has been created! Redirecting...", sender: "bot" }
      ]);
      setTimeout(() => {
        setIsLoading(false);
        localStorage.removeItem('chatbotMessages');
        localStorage.removeItem('chatbotStep');
        localStorage.removeItem('chatbotTravelDates');
        localStorage.removeItem('chatbotResponses');
        navigate('/itinerary', { state: { itinerary: response.data } });
      }, 1000);
    } catch (error) {
      console.error("Error sending data:", error);
      setMessages((prevMessages) => [
        ...prevMessages,
        { text: `Error: ${error.response?.data?.detail || error.message}. Please try again or log in.`, sender: "bot" }
      ]);
      setIsLoading(false);
      setStep(0);
      navigate('/login');
    }
  };

  const handleViewPastItineraries = () => {
    navigate('/past-itineraries');
  };

  return (
    <div className="chatbot-wrapper">
      <div className="chatbot-container">
        <h2>TravelBot</h2>
        <div className="chatbot-actions">
          <button onClick={handleViewPastItineraries} className="past-itineraries-btn">
            View Past Itineraries
          </button>
        </div>
        <div className="chat-section">
          <div className="chat-window" ref={chatWindowRef}>
            {messages.map((msg, index) => (
              <div key={index} className={msg.sender === "user" ? "user-message" : "bot-message"}>
                {msg.text}
              </div>
            ))}
          </div>
        </div>
        <div className="question">
          <span>
            {isLoading
              ? "Generating your itinerary, please wait..."
              : step < questions.length
              ? questions[step]
              : "Ready to create another itinerary?"}
          </span>
        </div>
        {!isLoading && step < questions.length && (
          <div className="input-container">
            {step === 2 ? (
              <div className="date-group">
                <input
                  type="date"
                  value={travelDates.start}
                  onChange={(e) => setTravelDates({ ...travelDates, start: e.target.value })}
                  placeholder="Start Date"
                />
                <input
                  type="date"
                  value={travelDates.end}
                  onChange={(e) => setTravelDates({ ...travelDates, end: e.target.value })}
                  placeholder="End Date"
                />
                <button
                  className="confirm-btn"
                  onClick={() => handleNextStep(`From ${travelDates.start} to ${travelDates.end}`)}
                >
                  Confirm
                </button>
              </div>
            ) : (
              <>
                <div className="options">
                  {options[step]?.map((option) => (
                    <button key={option} onClick={() => handleNextStep(option)}>
                      {option}
                    </button>
                  ))}
                </div>
                <div className="input-group">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleNextStep(inputValue)}
                    placeholder="Type your answer..."
                  />
                  <button className="send-btn" onClick={() => handleNextStep(inputValue)}>Send</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <div className="background-section">
        <div className="image"><img src="/ai.png" alt="" /></div>
        <div className="welcome-text">Hi, I am Noela.</div>
      </div>
    </div>
  );
};

export default Chatbot;