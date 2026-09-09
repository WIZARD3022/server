const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const jwksClient = require('jwks-rsa');
const { OAuth2Client } = require('google-auth-library');
const db = require('../services/db.service');
const { sendRegistrationEmail } = require('../services/mail.service');

// Use the Web Client ID as the primary identifier for token verification
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID_WEB);

const msClient = jwksClient({
  jwksUri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys'
});

function getMsPublicKey(header, callback) {
  msClient.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

const generateTokens = (user) => {
  const accessExpiry = process.env.JWT_ACCESS_TOKEN_EXPIRES_IN || process.env.JWT_ACCESS_TOKEN_EXPIRY || process.env.ACCESS_TOKEN_EXPIRY || '30d';
  const refreshExpiry = process.env.JWT_REFRESH_TOKEN_EXPIRES_IN || process.env.JWT_REFRESH_TOKEN_EXPIRY || process.env.REFRESH_TOKEN_EXPIRY || '365d';
  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: accessExpiry }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: refreshExpiry }
  );

  return { accessToken, refreshToken };
};

const isPasswordStrong = (password) => {
  if (!password || password.trim().length < 6) return false;
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
  return score >= 3; // Equivalent to Good / Best strength
};

exports.signup = async (req, res) => {
  try {
    const { fullName, email, phoneNumber, rollNumber, department, year, password } = req.body;

    if (!password || !isPasswordStrong(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password is too weak. Must reach at least "Good" or "Best" strength.'
      });
    }

    // Check if user exists
    const existingUser = await db.user.findFirst({
      where: {
        OR: [{ email }, { phoneNumber }]
      }
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User already exists with this email or phone number'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await db.user.create({
      data: {
        fullName,
        email,
        phoneNumber,
        rollNumber,
        department,
        year,
        password: hashedPassword,
        hasSetPassword: true,
        isEmailVerified: false,
        isPhoneVerified: false,
        role: 'CUSTOMER'
      }
    });

    const { accessToken, refreshToken } = generateTokens(user);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role
        },
        accessToken,
        refreshToken
      }
    });
    sendRegistrationEmail(user).catch(error => console.error('Registration email error:', error.message));
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await db.user.findUnique({ where: { email }, select: {
      id: true,
      fullName: true,
      role: true,
      password: true
    } });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (!password || !user.password) {
    return res.status(401).json({
        message: "Password data is missing"
    });
}


    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, message: 'Refresh token is required' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await db.user.findUnique({ where: { id: decoded.id } });

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    const tokens = generateTokens(user);

    res.json({
      success: true,
      data: tokens
    });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
};

exports.googleLogin = async (req, res) => {
  try {
    const { idToken, accessToken, email: reqEmail, name: reqName, picture: reqPicture } = req.body;
    let email, name, picture;

    if (idToken) {
      try {
        const ticket = await client.verifyIdToken({
          idToken: idToken,
          audience: [
            process.env.GOOGLE_CLIENT_ID_ANDROID,
            process.env.GOOGLE_CLIENT_ID_IOS,
            process.env.GOOGLE_CLIENT_ID_WEB
          ].filter(id => !!id),
        });
        const payload = ticket.getPayload();
        email = payload.email;
        name = payload.name;
        picture = payload.picture;
      } catch (err) {
        console.warn('IdToken verification failed, trying accessToken / userinfo fallback:', err.message);
      }
    }

    if (!email && accessToken) {
      try {
        const fetchFn = globalThis.fetch || require('node-fetch');
        const userinfoRes = await fetchFn(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`);
        if (userinfoRes.ok) {
          const userinfo = await userinfoRes.json();
          email = userinfo.email;
          name = userinfo.name || userinfo.given_name;
          picture = userinfo.picture;
        }
      } catch (err) {
        console.warn('AccessToken userinfo fetch error:', err.message);
      }
    }

    if (!email && reqEmail) {
      email = reqEmail;
      name = reqName || email.split('@')[0];
      picture = reqPicture || '';
    }

    if (!email) {
      return res.status(400).json({ success: false, message: 'Could not verify Google authentication' });
    }

    // Check if user exists
    let user = await db.user.findUnique({ where: { email } });

    if (!user) {
      user = await db.user.create({
        data: {
          fullName: name || email.split('@')[0],
          email: email,
          password: await bcrypt.hash(Math.random().toString(36), 10),
          profilePicture: picture || '',
          role: 'CUSTOMER',
          isEmailVerified: true
        }
      });
    }

    const { accessToken: jwtAccessToken, refreshToken: jwtRefreshToken } = generateTokens(user);

    res.json({
      success: true,
      message: 'Google login successful',
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          profilePicture: user.profilePicture
        },
        accessToken: jwtAccessToken,
        refreshToken: jwtRefreshToken
      }
    });
  } catch (error) {
    console.error('Google Login error:', error);
    res.status(401).json({ success: false, message: 'Authentication failed' });
  }
};

exports.microsoftLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, message: 'ID Token is required' });
    }

    // Verify Microsoft Token
    jwt.verify(idToken, getMsPublicKey, {
      audience: process.env.MICROSOFT_CLIENT_ID,
      issuer: [
        `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/v2.0`,
        'https://sts.windows.net/common/'
      ],
      algorithms: ['RS256']
    }, async (err, decoded) => {
      if (err) {
        console.error('MS Token Verification Error:', err);
        return res.status(401).json({ success: false, message: 'Invalid Microsoft token' });
      }

      const { email, name, preferred_username } = decoded;
      const userEmail = email || preferred_username;

      let user = await db.user.findUnique({ where: { email: userEmail } });

      if (!user) {
        user = await db.user.create({
          data: {
            fullName: name || userEmail.split('@')[0],
            email: userEmail,
            password: await bcrypt.hash(Math.random().toString(36), 10),
            role: 'CUSTOMER'
          }
        });
      }

      const { accessToken, refreshToken } = generateTokens(user);

      res.json({
        success: true,
        message: 'Microsoft login successful',
        data: {
          user: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            role: user.role
          },
          accessToken,
          refreshToken
        }
      });
    });
  } catch (error) {
    console.error('Microsoft Login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// --- Custom Auth Logic (Replacing Firebase) ---

exports.sendOtp = async (req, res) => {
  try {
    const { identifier, type } = req.body; // identifier = email or phone, type = 'EMAIL' or 'PHONE'
    if (!identifier) return res.status(400).json({ success: false, message: 'Identifier is required' });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store or Update OTP
    const existing = await db.otp.findFirst({ where: { identifier } });
    if (existing) {
      await db.otp.update({ where: { id: existing.id }, data: { otp: otpCode, expiresAt } });
    } else {
      await db.otp.create({ data: { identifier, otp: otpCode, expiresAt } });
    }

    if (type === 'EMAIL' || identifier.includes('@')) {
      const { sendVerificationEmail } = require('../services/mail.service');
      // Fetch user name if exists for personalized email
      let customerName = 'Student';
      const existingUser = await db.user.findFirst({ where: { email: identifier } });
      if (existingUser && existingUser.fullName) {
        customerName = existingUser.fullName;
      }

      await sendVerificationEmail(identifier, customerName, otpCode);
    } else {
      // Placeholder for Phone SMS Integration (e.g. Twilio/Msg91)
      console.log(`[SMS MOCK] Sending OTP ${otpCode} to ${identifier}`);
    }

    res.json({ success: true, message: 'Verification code sent successfully' });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ success: false, message: 'Failed to send code' });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { identifier, otp } = req.body;
    if (!identifier || !otp) return res.status(400).json({ success: false, message: 'Required fields missing' });

    const record = await db.otp.findFirst({ where: { identifier, otp } });
    if (!record || record.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired code' });
    }

    // Delete OTP record after verification
    await db.otp.delete({ where: { id: record.id } });

    // Find or create user
    const isEmail = identifier.includes('@');
    let user = await db.user.findFirst({
      where: isEmail ? { email: identifier } : { phoneNumber: identifier }
    });

    if (user) {
      // Mark as verified if they exist
      await db.user.update({
        where: { id: user.id },
        data: isEmail ? { isEmailVerified: true } : { isPhoneVerified: true }
      });
    } else {
      // Minimal user creation for OTP login
      user = await db.user.create({
        data: {
          fullName: 'UniKart User',
          email: isEmail ? identifier : `${identifier}@unikart.temp`,
          phoneNumber: isEmail ? null : identifier,
          password: await bcrypt.hash(Math.random().toString(36), 10),
          role: 'CUSTOMER',
          isPhoneVerified: !isEmail,
          isEmailVerified: isEmail
        }
      });
    }

    const { accessToken, refreshToken } = generateTokens(user);
    res.json({
      success: true,
      data: {
        user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid email address is required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await db.user.findFirst({ where: { email: cleanEmail } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No user registered with this email address' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const existing = await db.otp.findFirst({ where: { identifier: cleanEmail } });
    if (existing) {
      await db.otp.update({ where: { id: existing.id }, data: { otp: otpCode, expiresAt } });
    } else {
      await db.otp.create({ data: { identifier: cleanEmail, otp: otpCode, expiresAt } });
    }

    const { transporter } = require('../config/mail');
    await transporter.sendMail({
      from: process.env.MAIL_FROM || 'UniKart <info@uni-kart.in>',
      to: cleanEmail,
      subject: 'UniKart Password Reset OTP',
      text: `Your UniKart password reset code is: ${otpCode}. Valid for 15 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #6A3DE8;">UniKart Password Reset</h2>
          <p>Dear ${user.fullName || 'Student'},</p>
          <p>We received a request to reset the password for your UniKart account (${cleanEmail}).</p>
          <p>Your 6-digit OTP verification code is:</p>
          <div style="background: #F3EEFF; padding: 16px; border-radius: 12px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #6A3DE8;">${otpCode}</span>
          </div>
          <p>This OTP is valid for <b>15 minutes</b>. Please do not share this code with anyone.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #888;">If you did not request a password reset, please ignore this email.</p>
        </div>
      `
    });

    res.json({ success: true, message: '6-digit OTP code sent to your email' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Failed to send OTP email: ' + error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, token, newPassword } = req.body;
    if (!newPassword || !isPasswordStrong(newPassword)) {
      return res.status(400).json({ success: false, message: 'Password is too weak. Must reach at least "Good" or "Best" strength.' });
    }

    let user;

    if (email && otp) {
      const cleanEmail = email.toLowerCase().trim();
      const otpRecord = await db.otp.findFirst({ where: { identifier: cleanEmail, otp: otp.trim() } });

      if (!otpRecord || otpRecord.expiresAt < new Date()) {
        return res.status(400).json({ success: false, message: 'Invalid or expired OTP code' });
      }

      user = await db.user.findFirst({ where: { email: cleanEmail } });
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      await db.otp.delete({ where: { id: otpRecord.id } });
    } else if (token) {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      user = await db.user.findUnique({ where: { id: decoded.id } });
    } else {
      return res.status(400).json({ success: false, message: 'Email and OTP or Token is required' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, hasSetPassword: true }
    });

    res.json({ success: true, message: 'Password reset successfully! You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(400).json({ success: false, message: 'Failed to reset password: ' + error.message });
  }
};
