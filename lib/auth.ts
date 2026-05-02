import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { eq } from "drizzle-orm"
import { getDb } from "@/db"
import { users } from "@/db/schema"
import { authConfig } from "./auth.config"

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
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
          return null
        }
        
        const db = getDb()
        const normalizedEmail = email.toLowerCase().trim()
        const row = await db.query.users.findFirst({
          where: eq(users.email, normalizedEmail),
        })
        
        if (!row) {
          return null
        }
        
        const ok = await compare(password, row.passwordHash)
        if (!ok) {
          return null
        }
        
        return {
          id: row.userId,
          name: row.username,
          email: row.email,
        }
      },
    }),
  ],
})
