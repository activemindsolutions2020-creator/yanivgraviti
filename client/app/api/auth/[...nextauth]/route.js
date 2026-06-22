import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

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
        // Fallback login for the admin
        if (credentials.username === "yaniv" && credentials.password === "123456") {
          return { id: "1", name: "יניב (מנהל)", email: "activemind.solutions2020@gmail.com" };
        }
        return null;
      }
    })
  ],
  secret: process.env.NEXTAUTH_SECRET || "fallback_secret_if_not_set",
});

export { handler as GET, handler as POST };