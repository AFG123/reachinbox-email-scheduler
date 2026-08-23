import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from '../prisma';

// Save user ID to the session cookie
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Retrieve the full user object from the database using the session user ID
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// Configure the Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackURL: 'http://localhost:5000/api/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('No email address returned from Google profile.'), undefined);
        }

        // Create or update the user record in the database
        const user = await prisma.user.upsert({
          where: { googleId: profile.id },
          update: {
            name: profile.displayName,
            email,
            avatarUrl: profile.photos?.[0]?.value || null,
          },
          create: {
            googleId: profile.id,
            name: profile.displayName,
            email,
            avatarUrl: profile.photos?.[0]?.value || null,
          },
        });

        // Ensure this user has at least one verified sender profile (Ethereal test sender)
        // so they can test email composition immediately after login.
        const senderCount = await prisma.sender.count({
          where: { userId: user.id },
        });

        if (senderCount === 0) {
          await prisma.sender.create({
            data: {
              userId: user.id,
              email: 'hiram45@ethereal.email',
              displayName: profile.displayName,
            },
          });
        }

        return done(null, user);
      } catch (error) {
        return done(error as Error, undefined);
      }
    }
  )
);
export default passport;
