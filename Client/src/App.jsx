import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { AuthProvider } from "./context/AuthContext.jsx";
import { GOOGLE_WEB_CLIENT_ID } from "./lib/googleConstants.js";
import { VendorDashboardProvider } from "./context/VendorDashboardContext.jsx";
import { UserNotificationsProvider } from "./context/UserNotificationsContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import RedirectIfAuthenticated from "./components/RedirectIfAuthenticated.jsx";
import { Toaster } from "react-hot-toast";
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
import VendorExpiringSoon from "./pages/Dashboard/VendorExpiringSoon.jsx";
import VendorReports from "./pages/Dashboard/VendorReports.jsx";
import VendorSettings from "./pages/Dashboard/VendorSettings.jsx";
import VendorOrderDetail from "./pages/Dashboard/VendorOrderDetail.jsx";
import AdminOrders from "./pages/Dashboard/AdminOrders.jsx";
import CreateStore from "./pages/Dashboard/CreateStore.jsx";
import UserDashboard from "./pages/Dashboard/UserDashboard.jsx";
import UserShop from "./pages/User/UserShop.jsx";
import UserCart from "./pages/User/UserCart.jsx";
import UserNotifications from "./pages/User/UserNotifications.jsx";
import UserNotificationDetail from "./pages/User/UserNotificationDetail.jsx";
import UserHealth from "./pages/User/UserHealth.jsx";
import UserHealthScanPrescription from "./pages/User/UserHealthScanPrescription.jsx";
import UserHealthAlternatives from "./pages/User/UserHealthAlternatives.jsx";
import UserHealthReminders from "./pages/User/UserHealthReminders.jsx";
import UserHealthRemindersManage from "./pages/User/UserHealthRemindersManage.jsx";
import UserHealthRemindersAddEdit from "./pages/User/UserHealthRemindersAddEdit.jsx";
import UserProfile from "./pages/User/UserProfile.jsx";
import UserOrders from "./pages/User/UserOrders.jsx";
import UserOrderDetail from "./pages/User/UserOrderDetail.jsx";

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_WEB_CLIENT_ID}>
    <BrowserRouter>
      <AuthProvider>
        <VendorDashboardProvider>
          <UserNotificationsProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 2200,
              style: { borderRadius: 12 },
            }}
          />
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
            path="/vendor/orders/:orderId"
            element={
              <ProtectedRoute allowedRoles={["vendor", "admin"]}>
                <VendorOrderDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vendor/admin-orders"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminOrders />
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
            path="/vendor/expiring-soon"
            element={
              <ProtectedRoute allowedRoles={["vendor", "admin"]}>
                <VendorExpiringSoon />
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
            path="/vendor/create-store"
            element={
              <ProtectedRoute allowedRoles={["vendor", "admin"]}>
                <CreateStore />
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
          <Route
            path="/user/shop"
            element={
              <ProtectedRoute allowedRoles={["user", "doctor"]}>
                <UserShop />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/cart"
            element={
              <ProtectedRoute allowedRoles={["user", "doctor"]}>
                <UserCart />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/notifications"
            element={
              <ProtectedRoute allowedRoles={["user", "doctor"]}>
                <UserNotifications />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/notifications/:id"
            element={
              <ProtectedRoute allowedRoles={["user", "doctor"]}>
                <UserNotificationDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/health"
            element={
              <ProtectedRoute allowedRoles={["user", "doctor"]}>
                <UserHealth />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/health/scan-prescription"
            element={
              <ProtectedRoute allowedRoles={["user", "doctor"]}>
                <UserHealthScanPrescription />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/health/alternatives"
            element={
              <ProtectedRoute allowedRoles={["user", "doctor"]}>
                <UserHealthAlternatives />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/health/reminders"
            element={
              <ProtectedRoute allowedRoles={["user", "doctor"]}>
                <UserHealthReminders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/health/reminders/manage"
            element={
              <ProtectedRoute allowedRoles={["user", "doctor"]}>
                <UserHealthRemindersManage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/health/reminders/add"
            element={
              <ProtectedRoute allowedRoles={["user", "doctor"]}>
                <UserHealthRemindersAddEdit />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/health/reminders/edit/:id"
            element={
              <ProtectedRoute allowedRoles={["user", "doctor"]}>
                <UserHealthRemindersAddEdit />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/profile"
            element={
              <ProtectedRoute allowedRoles={["user", "doctor"]}>
                <UserProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/orders"
            element={
              <ProtectedRoute allowedRoles={["user", "doctor"]}>
                <UserOrders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/orders/:orderId"
            element={
              <ProtectedRoute allowedRoles={["user", "doctor"]}>
                <UserOrderDetail />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
          </UserNotificationsProvider>
        </VendorDashboardProvider>
      </AuthProvider>
    </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;
