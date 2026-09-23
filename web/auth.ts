import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";
import { one, query } from "./lib/db";
import type { Role } from "./types/next-auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").toLowerCase().trim();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const user = await one<{
          id: string;
          email: string;
          full_name: string;
          password_hash: string;
          is_active: boolean;
        }>(
          `SELECT id, email, full_name, password_hash, is_active
             FROM users WHERE email = $1`,
          [email]
        );
        if (!user || !user.is_active) return null;

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return null;

        const roleRows = await query<{ role: Role }>(
          `SELECT role FROM user_roles WHERE user_id = $1`,
          [user.id]
        );

        return {
          id: user.id,
          email: user.email,
          name: user.full_name,
          roles: roleRows.map((r) => r.role),
        };
      },
    }),
  ],
});