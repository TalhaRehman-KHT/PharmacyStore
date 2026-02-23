import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const secret = process.env.JWT_SECRET;
const expiry = process.env.JWT_EXPIRY || "1h";

export function signToken(payload) {
    return jwt.sign(payload, secret, { expiresIn: expiry });
}

export function verifyToken(token) {
    return jwt.verify(token, secret);
}
