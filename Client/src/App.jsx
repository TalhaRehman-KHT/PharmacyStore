import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import RoleBasedRoute from "./components/routes/RoleBasedRoute.jsx";
import DashboardPage from "./pages/Dashboard/DashboardPage.jsx";
import Dashboard from "./pages/Dashboard/Dashboard.jsx";
import Orders from "./pages/Dashboard/Orders.jsx";
import Store from "./pages/Dashboard/Store.jsx";
import Products from "./pages/Dashboard/Products.jsx";
import "./App.css";
import Start from "./pages/StartPage/Start.jsx";
import Login from "./pages/Register/Login.jsx";
import Register from "./pages/Register/Register.jsx";
import VerifyOtp from "./pages/Register/VerifyOtp.jsx";
import ForgotPassword from "./pages/Register/ForgotPassword.jsx";
import ResetPassword from "./pages/Register/ResetPassword.jsx";
import Profile from "./pages/Dashboard/Profile.jsx";
import Reminders from "./pages/Dashboard/Reminders.jsx";
import VendorStoreSetup from "./pages/Dashboard/VendorStoreSetup.jsx";
import AddMedicine from "./pages/Dashboard/AddMedicine.jsx";
import MedicineStock from "./pages/Dashboard/MedicineStock.jsx";
import Sales from "./pages/Dashboard/Sales.jsx";

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
          <Route
            path="/dashboard"
            element={
              <RoleBasedRoute>
                <DashboardPage />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/dashboard/orders"
            element={
              <RoleBasedRoute>
                <Orders />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/dashboard/store"
            element={
              <RoleBasedRoute>
                <Store />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/dashboard/products"
            element={
              <RoleBasedRoute>
                <Products />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/dashboard/profile"
            element={
              <RoleBasedRoute>
                <Profile />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/dashboard/reminders"
            element={
              <RoleBasedRoute>
                <Reminders />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/dashboard/store-setup"
            element={
              <RoleBasedRoute>
                <VendorStoreSetup />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/dashboard/add-medicine"
            element={
              <RoleBasedRoute>
                <AddMedicine />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/dashboard/medicine-stock"
            element={
              <RoleBasedRoute>
                <MedicineStock />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/dashboard/sales"
            element={
              <RoleBasedRoute>
                <Sales />
              </RoleBasedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App
