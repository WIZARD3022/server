const path = require('path');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const mailHost = (process.env.MAIL_HOST || process.env.SMTP_HOST || '').trim();
const mailUser = (process.env.MAIL_USER || process.env.SMTP_USER || '').trim();
const mailPassword = process.env.MAIL_PASSWORD || process.env.SMTP_PASSWORD || '';
const mailPort = Number(process.env.MAIL_PORT || process.env.SMTP_PORT || 587);
const secure = String(process.env.MAIL_SECURE || process.env.SMTP_SECURE || '').toLowerCase() === 'true' || mailPort === 465;

const transporter = nodemailer.createTransport({
  host: mailHost,
  port: mailPort,
  secure,
  auth: {
    user: mailUser,
    pass: mailPassword
  },
  tls: {
    minVersion: process.env.MAIL_VERSION || process.env.SMTP_TLS_MIN_VERSION || 'TLSv1.2'
  }
});

const verifyMailTransport = async () => {
  if (!mailHost || !mailUser || !mailPassword) {
    console.warn('Email transport is not configured; email notifications are disabled.');
    return false;
  }

  await transporter.verify();
  console.log(`🚀 Email transport connected`);
  return true;
};

module.exports = { transporter, verifyMailTransport };
