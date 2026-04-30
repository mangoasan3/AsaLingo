import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import { User } from "../models";
import { env } from "./env";

export function configurePassport() {
  // ─── JWT Strategy ─────────────────────────────────────────────────────────
  passport.use(
    new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: env.JWT_SECRET,
      },
      async (payload, done) => {
        try {
          const user = await User.findById(payload.sub);
          if (!user) return done(null, false);
          return done(null, user);
        } catch (err) {
          return done(err, false);
        }
      }
    )
  );

  // ─── Google OAuth Strategy ────────────────────────────────────────────────
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          callbackURL: env.GOOGLE_CALLBACK_URL,
          scope: ["profile", "email"],
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            const googleAvatar = profile.photos?.[0]?.value;
            if (!email) return done(new Error("No email from Google"), false);

            let user = await User.findOne({ googleId: profile.id });

            if (!user) {
              // Check if email already exists (link accounts)
              user = await User.findOne({ email });
              if (user) {
                user.googleId = profile.id;
                user.authProvider = "GOOGLE";
                if (googleAvatar) {
                  user.avatar = googleAvatar;
                }
                await user.save();
              } else {
                user = await User.create({
                  name: profile.displayName || email.split("@")[0],
                  email,
                  googleId: profile.id,
                  authProvider: "GOOGLE",
                  avatar: googleAvatar,
                });
              }
            } else if (googleAvatar && user.avatar !== googleAvatar) {
              user.avatar = googleAvatar;
              await user.save();
            }

            return done(null, user);
          } catch (err) {
            return done(err, false);
          }
        }
      )
    );
  }
}
