import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import axios from "axios";

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    CredentialsProvider({
      name: "כניסה ידנית (גיבוי)",
      credentials: {
        username: { label: "שם משתמש", type: "text", placeholder: "admin" },
        password: { label: "סיסמה", type: "password" }
      },
      async authorize(credentials) {
        if (credentials.username === "yaniv" && credentials.password === "123456") {
          return { id: "1", name: "יניב (מנהל)", email: "activemind.solutions2020@gmail.com" };
        }
        return null;
      }
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        // Check user status via backend
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
        const res = await axios.post(`${apiUrl}/api/users/auth`, {
          email: user.email,
          name: user.name
        });
        
        const userData = res.data.data;
        if (userData.status === "Pending") {
          return "/pending"; // Redirect to a pending approval page
        }
        if (userData.status === "Frozen") {
          return "/frozen"; // Redirect to a frozen page
        }
        if (userData.status === "Approved") {
          user.role = userData.role; // Attach role to user object
          return true;
        }
        return false;
      } catch (err) {
        console.error("Auth check error:", err);
        return false; // Reject on error
      }
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role || "User";
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback_secret_if_not_set",
  pages: {
    error: "/auth-error", // Custom error pages (optional)
  }
});

export { handler as GET, handler as POST };