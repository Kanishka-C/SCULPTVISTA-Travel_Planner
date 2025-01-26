import React from 'react';
import './Login.css';
import { useState } from 'react';
import { Link } from 'react-router-dom';

const Login = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
  
    const handleLogin = (e) => {
      e.preventDefault();
      console.log("Login attempted with", email, password);
      // Add authentication logic here
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
            <button type="submit" className="login-button">
              Login
            </button>
          </form>
          <p className="footer-text">
          New here? <Link to="/SignUp">Create an account</Link>
          </p>
        </div>
      </div>
    );
  };
  
  export default Login;