import { randomUUID } from "crypto"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { getDb } from "@/db"
import { questSessions, quests } from "@/db/schema"
import { eq } from "drizzle-orm"

export const dynamic = "force-dynamic"

const postSchema = z.object({
  questId: z.string().min(1),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = postSchema.safeParse(json)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const db = getDb()
  const quest = await db.query.quests.findFirst({
    where: eq(quests.questId, parsed.data.questId),
  })
  if (!quest?.isActive) {
    return Response.json({ error: "Quest not found" }, { status: 404 })
  }
  const sessionId = randomUUID()
  await db.insert(questSessions).values({
    sessionId,
    userId: session.user.id,
    questId: quest.questId,
    status: "active",
  })
  return Response.json({ sessionId, questId: quest.questId })
}
