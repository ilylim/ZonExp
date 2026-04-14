import { auth } from "@/lib/auth"
import { and, eq } from "drizzle-orm"
import { getDb } from "@/db"
import { questSessions, userQuestAssignments } from "@/db/schema"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { questId } = await req.json()
  if (!questId) {
    return Response.json({ error: "questId is required" }, { status: 400 })
  }

  const db = getDb()

  // Проверяем, что квест действительно взят (assignment существует)
  const assignment = await db.query.userQuestAssignments.findFirst({
    where: and(
      eq(userQuestAssignments.userId, session.user.id),
      eq(userQuestAssignments.questId, questId)
    ),
  })

  if (!assignment) {
    return Response.json({ error: "Сначала возьмите квест" }, { status: 403 })
  }

  // Проверяем, нет ли уже активной сессии по этому квесту
  const existing = await db.query.questSessions.findFirst({
    where: and(
      eq(questSessions.userId, session.user.id),
      eq(questSessions.questId, questId),
      eq(questSessions.status, "active")
    ),
  })

  if (existing) {
    return Response.json({ 
      success: true, 
      sessionId: existing.sessionId, 
      alreadyStarted: true 
    })
  }

  const sessionId = crypto.randomUUID()

  await db.insert(questSessions).values({
    sessionId,
    userId: session.user.id,
    questId,
    startedAt: new Date(),
    status: "active",
  })

  console.log(`[Session] Created session ${sessionId} for quest ${questId}`)

  return Response.json({ 
    success: true, 
    sessionId,
    questId 
  })
}