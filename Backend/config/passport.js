const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "PLACEHOLDER_CLIENT_ID";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "PLACEHOLDER_CLIENT_SECRET";

if (GOOGLE_CLIENT_ID === "PLACEHOLDER_CLIENT_ID") {
    console.warn("[Auth Warning] GOOGLE_CLIENT_ID is missing. Google Login will fail.");
}

passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
},
    async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await User.findOne({ googleId: profile.id });

            if (!user) {
                user = await User.create({
                    googleId: profile.id,
                    email: profile.emails[0].value,
                    name: profile.displayName,
                    avatar: profile.photos[0].value
                });
            }
            return done(null, user);
        } catch (err) {
            return done(err, null);
        }
    }));

module.exports = passport;
