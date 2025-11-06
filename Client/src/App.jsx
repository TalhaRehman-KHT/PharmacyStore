import { useState } from 'react'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import './App.css'
import Start from './pages/StartPage/Start.jsx'
import Login from './pages/Register/Login.jsx';
import Register from './pages/Register/Register.jsx';
import VerifyOtp from './pages/Register/VerifyOtp.jsx';
import ForgotPassword from './pages/Register/ForgotPassword.jsx';
import ResetPassword from './pages/Register/ResetPassword.jsx';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Start />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
