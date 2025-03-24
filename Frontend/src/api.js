// src/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable cookies for all requests
});

export default api;











// import axios from "axios";

// const api = axios.create({
//   baseURL: "http://127.0.0.1:8000", 
//   withCredentials: true, // Include cookies in requests
// });

// export default api;