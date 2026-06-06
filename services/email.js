const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

exports.sendOTP = async (email, otp) => {
  await transporter.sendMail({
    from: `"Broadcast App" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your Password Reset OTP',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto;">
        <div style="background: #2563EB; padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">📡 Broadcast</h1>
        </div>
        <div style="background: #f8fafc; padding: 24px; border-radius: 0 0 12px 12px;">
          <h2 style="color: #1E293B;">Your OTP Code</h2>
          <p style="color: #64748B;">Use this OTP to verify. Valid for 10 minutes.</p>
          <div style="background: white; border: 2px solid #2563EB; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #2563EB; font-size: 36px; letter-spacing: 8px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #94A3B8; font-size: 12px;">If you didn't request this, ignore this email.</p>
        </div>
      </div>
    `,
  });
};