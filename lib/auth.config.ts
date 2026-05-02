import type { NextAuthConfig } from "next-auth"

const authSecret = process.env.AUTH_SECRET

if (process.env.NODE_ENV === "production" && !authSecret) {
  // В Edge Runtime мы не можем бросать ошибку при импорте, если это мешает инициализации,
  // но NextAuth сам проверит наличие секретов.
  console.warn("AUTH_SECRET is missing in production environment!")
}

export const authConfig: NextAuthConfig = {
  trustHost: true,
  secret: authSecret ?? "dev-insecure-auth-secret",
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  providers: [
    // Провайдеры будут добавлены в auth.ts для Node.js и в middleware для Edge
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
}
