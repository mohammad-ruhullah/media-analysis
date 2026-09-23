import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const loggedIn = !!auth?.user;
      const isPublic =
        nextUrl.pathname.startsWith("/login") ||
        nextUrl.pathname.startsWith("/api/");
      if (isPublic) return true;
      return loggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.roles = user.roles ?? [];
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid ?? "";
        session.user.roles = token.roles ?? [];
      }
      return session;
    },
  },
} satisfies NextAuthConfig;