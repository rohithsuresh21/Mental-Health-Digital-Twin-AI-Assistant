import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import UserDetails from './pages/UserDetails';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UserDetails />} />
        <Route path="/admin" element={<App />} />
        <Route path="/patient" element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
