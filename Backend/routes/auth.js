const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key'; // user should set this in env

// 1. Google Auth Trigger
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// 2. Google Auth Callback
router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/', session: false }),
    (req, res) => {
        // Successful authentication
        const token = jwt.sign(
            { id: req.user._id, email: req.user.email, name: req.user.name },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Redirect to Frontend with Token
        // Assuming Frontend runs on localhost:5173 (Dev) or similar. 
        // ideally getting FRONTEND_URL from env
        const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${FRONTEND_URL}/auth/success?token=${token}`);
    }
);

// 3. Verify Token / Get Current User
router.get('/me', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token provided' });

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({ user: decoded }); // Or fetch full user from DB if needed
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

module.exports = router;
