import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { eq } from "drizzle-orm"
import { getDb } from "@/db"
import { users } from "@/db/schema"

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "development" ? "dev-insecure-auth-secret" : undefined),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email
        const password = credentials?.password
        if (typeof email !== "string" || typeof password !== "string") {
          throw new Error("Неверный формат email или пароля")
        }
        
        const db = getDb()
        const normalizedEmail = email.toLowerCase().trim()
        const row = await db.query.users.findFirst({
          where: eq(users.email, normalizedEmail),
        })
        
        if (!row) {
          throw new Error("Пользователь с таким email не найден")
        }
        
        const ok = await compare(password, row.passwordHash)
        if (!ok) {
          throw new Error("Неверный пароль")
        }
        
        return {
          id: row.userId,
          name: row.username,
          email: row.email,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id
      return token
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
  },
})
