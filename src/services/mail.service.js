const QRCode = require('qrcode');
const { transporter } = require('../config/mail');
const {
  regestration_mail_content,
  verify_mail_content,
  order_mail_content,
  completion_mail_content,
  cancellation_mail_content
} = require('../Data/email.data');

const from = process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.MAIL_USER || process.env.SMTP_USER;

const sendMail = async ({ to, subject, html, attachments }) => {
  if (!to || !from || (!process.env.MAIL_HOST && !process.env.SMTP_HOST)) {
    console.warn('Email skipped because SMTP configuration or recipient is missing.');
    return null;
  }

  return transporter.sendMail({ from, to, subject, html, attachments });
};

const sendRegistrationEmail = (user) => sendMail({
  to: user && user.email,
  subject: 'Welcome to UniKart',
  html: regestration_mail_content(user && user.fullName)
});

const sendVerificationEmail = (user, otp) => sendMail({
  to: user,
  subject: 'Verify your UniKart account',
  html: verify_mail_content(user, otp)
});

const sendOrderEmail = async (user, order, trackUrl = '#', invoiceUrl = '#') => {
  const orderNum = order.orderNumber || order.id || 'UK-ORDER';
  let qrBuffer = null;
  try {
    qrBuffer = await QRCode.toBuffer(orderNum, { margin: 1, width: 250 });
  } catch (e) {
    console.error('QR email error:', e);
  }

  const attachments = qrBuffer ? [{
    filename: 'qrcode.png',
    content: qrBuffer,
    cid: 'order_qrcode'
  }] : [];

  return sendMail({
    to: user && user.email,
    subject: `UniKart order ${orderNum} confirmed`,
    html: order_mail_content(
      user && user.fullName,
      orderNum,
      order.paymentMethod || 'Razorpay',
      Number(order.totalAmount || 0).toFixed(2),
      new Date().toLocaleString(),
      trackUrl,
      invoiceUrl,
      'cid:order_qrcode'
    ),
    attachments
  });
};

const sendCompletionEmail = async (user, order) => {
  const orderNum = order.orderNumber || order.id || 'UK-ORDER';
  let qrBuffer = null;
  try {
    qrBuffer = await QRCode.toBuffer(orderNum, { margin: 1, width: 250 });
  } catch (e) {
    console.error('QR email error:', e);
  }

  const attachments = qrBuffer ? [{
    filename: 'qrcode.png',
    content: qrBuffer,
    cid: 'order_qrcode'
  }] : [];

  return sendMail({
    to: user && user.email,
    subject: `UniKart order ${orderNum} is ready`,
    html: completion_mail_content(
      user && user.fullName,
      orderNum,
      process.env.PRINT_PICKUP_TIME || '9:00 AM - 5:00 PM',
      'cid:order_qrcode',
      orderNum,
      process.env.STORE_ADDRESS || 'UniKart Print Center, SGT University',
      process.env.STORE_PHONE || '+91-9319669644',
      process.env.STORE_LOCATION_URL || '#'
    ),
    attachments
  });
};

const sendCancellationEmail = (user, order, reason = 'Cancelled by UniKart') => sendMail({
  to: user && user.email,
  subject: `UniKart order ${order.orderNumber || order.id} cancelled`,
  html: cancellation_mail_content(
    user && user.fullName,
    order.orderNumber || order.id,
    reason,
    process.env.STORE_ADDRESS || '',
    process.env.STORE_PHONE || '',
    process.env.STORE_LOCATION_URL || '#'
  )
});

module.exports = {
  sendMail,
  sendRegistrationEmail,
  sendVerificationEmail,
  sendOrderEmail,
  sendCompletionEmail,
  sendCancellationEmail
};
