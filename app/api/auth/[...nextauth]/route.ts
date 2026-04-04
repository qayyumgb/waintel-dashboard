import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import axios from "axios";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const res = await axios.post(`${API}/api/auth/login`, {
            email: credentials.email,
            password: credentials.password,
          });

          if (res.data.success) {
            const t = res.data.tenant;
            return {
              id: t.id,
              name: t.name,
              email: t.email,
              plan: t.plan,
              botId: t.botId,
            } as any;
          }
          return null;
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.tenantId = (user as any).id;
        token.plan = (user as any).plan;
        token.botId = (user as any).botId;
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).tenantId = token.tenantId;
      (session as any).plan = token.plan;
      (session as any).botId = token.botId;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
