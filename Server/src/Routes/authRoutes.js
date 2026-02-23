import express from 'express';
import { register } from '../Controllers/authController.js';
import { login } from '../Controllers/loginController.js';
import { logout } from '../Controllers/logout.js';
import { verifyOtp } from '../Controllers/verifyOtp.js';
import { resendOtp } from '../Controllers/resendOtp.js';
import { forgotPassword } from '../Controllers/forgotPasswordController.js';
import { resetPassword } from '../Controllers/resetPasswordController.js';
const authRoutes = express.Router();

authRoutes.post('/register', register)
authRoutes.post('/verify-otp', verifyOtp)
authRoutes.post('/resend-otp', resendOtp)
authRoutes.post('/login', login)
authRoutes.post('/logout', logout)
authRoutes.post("/forgot-password", forgotPassword);
authRoutes.post("/reset-password", resetPassword);


export default authRoutes;