import React, { useState } from "react";
import "./SignUp.css";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api";

const SignUp = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSignUp = (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match!");
      return;
    }
    api
      .post("/api/users/register/", { email, password })
      .then((response) => {
        console.log("Signup success:", response.data);
        if (response.data.success) {
          navigate("/login");
        } else {
          setError("Signup failed: " + (response.data.error || "Unexpected response"));
        }
      })
      .catch((error) => {
        if (error.response) {
          console.error("Signup error response:", error.response.data);
          setError("Signup failed: " + JSON.stringify(error.response.data.error || error.response.data));
        } else if (error.request) {
          console.error("Signup error request:", error.request);
          setError("Signup failed: No response from server.");
        } else {
          console.error("Signup error:", error.message);
          setError("Signup failed: " + error.message);
        }
      });
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
        <p className="subtitle">Create your account</p>
        <form onSubmit={handleSignUp}>
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
          <div className="input-group">
            <label htmlFor="confirm-password">Confirm Password</label>
            <input
              type="password"
              id="confirm-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
            />
          </div>
          {error && <p style={{ color: "red" }}>{error}</p>}
          <button type="submit" className="login-button">
            Sign Up
          </button>
        </form>
        <p className="footer-text">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
};

export default SignUp;

// import React from 'react';
// import './SignUp.css';
// import { useState } from 'react';
// import { Link } from 'react-router-dom';

// const SignUp = () => {
//     const [name, setName] = useState("");
//     const [email, setEmail] = useState("");
//     const [password, setPassword] = useState("");
//     const [confirmPassword, setConfirmPassword] = useState("");

//     const handleSignUp = (e) => {
//         e.preventDefault();
//         if (password !== confirmPassword) {
//             alert("Passwords do not match!");
//             return;
//         }
//         console.log("SignUp attempted with", name, email, password);
//         // Add registration logic here
//     };

//     return (
//         <div className="login-container">
//             <video autoPlay muted loop className="background-video">
//                 <source src="/background.mp4" type="video/mp4" />
//                 Your browser does not support the video tag.
//             </video>
//             <div className="login-card">
//                 <img src="/logo1.png" alt="Logo" className="logo" />
//                 <h1 className="title">SculptVista</h1>
//                 <p className="subtitle">Create your account</p>
//                 <form onSubmit={handleSignUp}>
//                     <div className="input-group">
//                         <label htmlFor="name">Full Name</label>
//                         <input
//                             type="text"
//                             id="name"
//                             value={name}
//                             onChange={(e) => setName(e.target.value)}
//                             placeholder="Enter your full name"
//                             required
//                         />
//                     </div>
//                     <div className="input-group">
//                         <label htmlFor="email">Email</label>
//                         <input
//                             type="email"
//                             id="email"
//                             value={email}
//                             onChange={(e) => setEmail(e.target.value)}
//                             placeholder="Enter your email"
//                             required
//                         />
//                     </div>
//                     <div className="input-group">
//                         <label htmlFor="password">Password</label>
//                         <input
//                             type="password"
//                             id="password"
//                             value={password}
//                             onChange={(e) => setPassword(e.target.value)}
//                             placeholder="Enter your password"
//                             required
//                         />
//                     </div>
//                     <div className="input-group">
//                         <label htmlFor="confirm-password">Confirm Password</label>
//                         <input
//                             type="password"
//                             id="confirm-password"
//                             value={confirmPassword}
//                             onChange={(e) => setConfirmPassword(e.target.value)}
//                             placeholder="Confirm your password"
//                             required
//                         />
//                     </div>
//                     <button type="submit" className="login-button">
//                         Sign Up
//                     </button>
//                 </form>
//                 <p className="footer-text">
//                     Already have an account? <Link to="/login">Log in</Link>
//                 </p>
//             </div>
//         </div>
//     );
// };

// export default SignUp;

