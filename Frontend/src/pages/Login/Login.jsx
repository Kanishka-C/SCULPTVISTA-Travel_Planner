// src/pages/Login/Login.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Login.css";
import api from "../../api";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    console.log("Login attempt with:", { email, password });

    try {
      const response = await api.post(
        "/api/users/login/",
        { email, password },
        { withCredentials: true } // Ensure cookies are sent/received
      );
      console.log("Login response (raw):", response);
      console.log("Login response data:", response.data);

      if (response.data && response.data.success === true) {
        console.log("Login successful, redirecting to /chatbot");
        navigate("/chatbot"); // Redirect to Chatbot
      } else {
        setError("Login failed: " + (response.data.error || "Unexpected response"));
      }
    } catch (error) {
      if (error.response) {
        console.error("Login error response:", error.response.data);
        setError("Login failed: " + (error.response.data.error || JSON.stringify(error.response.data)));
      } else if (error.request) {
        console.error("Login error request:", error.request);
        setError("Login failed: No response from server.");
      } else {
        console.error("Login error:", error.message);
        setError("Login failed: " + error.message);
      }
    }
  };

  return (
    <div className="login-container">
      <video autoPlay muted loop className="background-video">
        <source src="/background.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      <div className="login-card">
        <img src="/logo1.png" alt="Logo" className="logo" />
        <h1 className="title">SculptVista</h1>
        <p className="subtitle">AI-Powered Personalized Travel Planner.</p>
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>
          {error && <p style={{ color: "red" }}>{error}</p>}
          <button type="submit" className="login-button">
            Login
          </button>
        </form>
        <p className="footer-text">
          New here? <Link to="/signup">Create an account</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;






