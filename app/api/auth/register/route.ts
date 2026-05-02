import { hash } from "bcryptjs"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { getDb } from "@/db"
import { progress, users } from "@/db/schema"

export const dynamic = "force-dynamic"

const characterClassSchema = z.enum([
  "warrior",
  "mage",
  "ranger",
  "ninja",
  "shapeshifter",
])

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  username: z.string().trim().min(1).max(64),
  characterClass: characterClassSchema.optional().default("warrior"),
})

export async function POST(req: Request) {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  
  const { email, password, username, characterClass } = parsed.data
  const db = getDb()
  
  try {
    const normalizedEmail = email.toLowerCase().trim()
    
    const existing = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    })
    
    if (existing) {
      return Response.json({ error: "Email already registered" }, { status: 409 })
    }
    
    const userId = crypto.randomUUID()
    
    const passwordHash = await hash(password, 12)
    
    await db.insert(users).values({
      userId,
      username,
      email: normalizedEmail,
      passwordHash,
      characterClass,
    })

    await db.insert(progress).values({ userId })

    return Response.json({ userId })
  } catch (error) {
    console.error("Registration error:", error)
    return Response.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
