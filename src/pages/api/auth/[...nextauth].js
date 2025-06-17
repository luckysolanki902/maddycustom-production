import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { adminAuth } from "@/lib/firebase/firebaseAdmin";
import connectToDatabase from "@/lib/middleware/connectToDb";
import User from "@/models/User"; 

export const authOptions = {
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "Phone Number",
      credentials: {
        idToken: { label: "ID Token", type: "text" }
      },
      async authorize(credentials) {
        try {
          if (!credentials?.idToken) {
            throw new Error("No ID token provided");
          }

          // Verify the Firebase token
          const decodedToken = await adminAuth.verifyIdToken(credentials.idToken);
          const phoneNumber = decodedToken.phone_number;
          
          // SOLUTION: Instead of using fetch, query the database directly
          // This avoids URL resolution issues entirely
          await connectToDatabase();
          const user = await User.findOne({ phoneNumber });
          
          if (!user) {
            // If user doesn't exist, return minimal user data
            return {
              id: decodedToken.uid,
              phoneNumber: phoneNumber,
              email: decodedToken.email || null,
              name: decodedToken.name || null
            };
          }
          
          // Return user data from database
          return {
            id: user._id.toString(),
            phoneNumber: user.phoneNumber,
            email: user.email || null,
            name: user.name || null,
            hasAddress: user.addresses && user.addresses.length > 0
          };
        } catch (error) {
          console.error("NextAuth authorize error:", error);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.phoneNumber = user.phoneNumber;
        token.email = user.email;
        token.name = user.name;
        token.hasAddress = user.hasAddress;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub;
      session.user.phoneNumber = token.phoneNumber;
      session.user.email = token.email;
      session.user.name = token.name;
      session.user.hasAddress = token.hasAddress;
      return session;
    }
  },
  pages: {
    signIn: '/',
    error: '/'
  },
  debug: process.env.NODE_ENV === 'development'
};

export default NextAuth(authOptions);