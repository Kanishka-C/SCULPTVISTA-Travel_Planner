import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home/Home";  // Home is now the default page
import Login from "./pages/Login/Login";
import SignUp from "./pages/SignUp/SignUp";
import Chatbot from "./pages/Chatbot/Chatbot";


const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />  {/* Home is now the default page */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
          <Route path="/chatbot" element={<Chatbot />} />
      </Routes>
    </Router>
  );
};

export default App;
