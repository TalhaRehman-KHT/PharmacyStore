import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import RedirectIfAuthenticated from "./components/RedirectIfAuthenticated.jsx";
import "./App.css";
import Start from "./pages/StartPage/Start.jsx";
import Login from "./pages/Register/Login.jsx";
import Register from "./pages/Register/Register.jsx";
import VerifyOtp from "./pages/Register/VerifyOtp.jsx";
import ForgotPassword from "./pages/Register/ForgotPassword.jsx";
import VerifyResetOtp from "./pages/Register/VerifyResetOtp.jsx";
import ResetPassword from "./pages/Register/ResetPassword.jsx";
import VendorDashboard from "./pages/Dashboard/VendorDashboard.jsx";
import VendorOrders from "./pages/Dashboard/VendorOrders.jsx";
import VendorMedicine from "./pages/Dashboard/VendorMedicine.jsx";
import VendorReports from "./pages/Dashboard/VendorReports.jsx";
import VendorSettings from "./pages/Dashboard/VendorSettings.jsx";
import UserDashboard from "./pages/Dashboard/UserDashboard.jsx";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route
            path="/"
            element={
              <RedirectIfAuthenticated>
                <Start />
              </RedirectIfAuthenticated>
            }
          />
          <Route
            path="/vendor/login"
            element={
              <RedirectIfAuthenticated>
                <Login role="vendor" />
              </RedirectIfAuthenticated>
            }
          />
          <Route
            path="/user/login"
            element={
              <RedirectIfAuthenticated>
                <Login role="user" />
              </RedirectIfAuthenticated>
            }
          />
          <Route
            path="/vendor/register"
            element={
              <RedirectIfAuthenticated>
                <Register role="vendor" />
              </RedirectIfAuthenticated>
            }
          />
          <Route
            path="/user/register"
            element={
              <RedirectIfAuthenticated>
                <Register role="user" />
              </RedirectIfAuthenticated>
            }
          />
          <Route path="/verify-otp" element={<VerifyOtp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/verify-reset-otp" element={<VerifyResetOtp />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/vendor/dashboard"
            element={
              <ProtectedRoute allowedRoles={["vendor", "admin"]}>
                <VendorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendor/orders"
            element={
              <ProtectedRoute allowedRoles={["vendor", "admin"]}>
                <VendorOrders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendor/medicine"
            element={
              <ProtectedRoute allowedRoles={["vendor", "admin"]}>
                <VendorMedicine />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendor/reports"
            element={
              <ProtectedRoute allowedRoles={["vendor", "admin"]}>
                <VendorReports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendor/settings"
            element={
              <ProtectedRoute allowedRoles={["vendor", "admin"]}>
                <VendorSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/dashboard"
            element={
              <ProtectedRoute allowedRoles={["user", "doctor"]}>
                <UserDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App
