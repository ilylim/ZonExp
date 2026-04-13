import { hash } from "bcryptjs"
import { randomUUID } from "crypto"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { progress, users } from "@/db/schema"

export const dynamic = "force-dynamic"

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  username: z.string().min(1).max(64),
  characterClass: z.string().optional().default("warrior"),
})

export async function POST(req: Request) {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }
  
  console.log("Registration attempt with:", { email: (json as any)?.email, username: (json as any)?.username })
  
  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    console.error("Validation error:", parsed.error.flatten())
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  
  const { email, password, username, characterClass } = parsed.data
  const db = getDb()
  
  try {
    const normalizedEmail = email.toLowerCase().trim()
    console.log("Checking for existing user:", normalizedEmail)
    
    const existing = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    })
    
    if (existing) {
      console.log("Email already registered:", normalizedEmail)
      return Response.json({ error: "Email already registered" }, { status: 409 })
    }
    
    const userId = randomUUID()
    console.log("Creating user:", { userId, username, email: normalizedEmail })
    
    const passwordHash = await hash(password, 12)
    
    await db.insert(users).values({
      userId,
      username: username.trim(),
      email: normalizedEmail,
      passwordHash,
      characterClass,
    })
    
    console.log("User created, adding progress...")
    
    await db.insert(progress).values({ userId })
    
    console.log("Registration successful:", userId)
    return Response.json({ userId })
  } catch (error) {
    console.error("Registration error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return Response.json({ error: `Database error: ${errorMessage}` }, { status: 500 })
  }
}
