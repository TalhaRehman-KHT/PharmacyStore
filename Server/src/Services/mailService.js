// src/Services/mailService.js
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false, // use true for port 465
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export async function sendEmail(to, subject, html) {
    try {
        const info = await transporter.sendMail({
            from: `"Pharmacy Store" <${process.env.SMTP_USER}>`,
            to,
            subject,
            html,
        });
        console.log(`✅ Email sent to ${to}: ${info.messageId}`);
    } catch (error) {
        console.error("❌ Email sending error:", error.message);
    }
}
