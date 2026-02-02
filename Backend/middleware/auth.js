const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

// Use env var or placeholder. The library can verify without Client ID if strictly checking signature, 
// but specifying Client ID is safer (audience check).
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(CLIENT_ID);

const authMiddleware = async (req, res, next) => {
  // 1. Bypass for Guest Mode (handled in controller)
  if (req.body && req.body.isGuest) {
    return next();
  }

  // 2. Check Header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // 3. Verify Google Token
    const verifyOptions = { idToken: token };
    // Only enforce audience check if CLIENT_ID is properly configured
    if (CLIENT_ID && !CLIENT_ID.startsWith('YOUR_')) {
      verifyOptions.audience = CLIENT_ID;
    }
    const ticket = await client.verifyIdToken(verifyOptions);
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // 4. Find or Create User
    // Note: In production you might separate "Login" from "Verify Session", 
    // but for this MVP, syncing user on every request ensures consistency without separate login flow.
    let user = await User.findOne({ googleId });

    if (!user) {
      user = new User({
        googleId,
        email,
        name,
        picture
      });
      await user.save();
      console.log(`[Auth] New User Created: ${email}`);
    } else {
      // Update last login
      user.lastLogin = Date.now();
      await user.save();
    }

    req.user = user;
    next();

  } catch (err) {
    console.error("[Auth Middleware] Verification Failed:", err.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

module.exports = authMiddleware;
