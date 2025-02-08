import React from "react";
import "./Home.css";
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="home full-screen">
      <div className="hero-container centered">
        <video autoPlay loop muted className="background-video">
          <source src="/background2.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        <div className="nav-links">
          <Link to="/login" className="nav-link">Login</Link>
          <Link to="/signup" className="nav-link">Sign Up</Link>
        </div>

        <div className="hero-content">
          <h1 className="hero-title">Plan Your Next Adventure with Ease</h1>
          <p className="hero-subtitle">
            Discover personalized travel recommendations and create unforgettable memories.
          </p>
        
          <button className="cta-button">Create Itinerary</button>
        </div>
      </div>

      <section className="features-section hidden-on-load">
        <h2>Why Choose Us?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <h3>Personalized Recommendations</h3>
            <p>Tailored suggestions based on your preferences and interests.</p>
          </div>
          <div className="feature-card">
            <h3>Seamless Planning</h3>
            <p>Organize everything in one place for a stress-free trip.</p>
          </div>
          <div className="feature-card">
            <h3>Collaborative Tools</h3>
            <p>Plan with friends and family effortlessly.</p>
          </div>
          <div className="feature-card">
            <h3>Health-Specific Recommendations</h3>
            <p> Get health-based recommendations.</p>
          </div>
          <div className="feature-card">
            <h3>Budgetary Advice</h3>
            <p>Get comprehensive budget breakdown, allowing users to effectively manage their finances.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;