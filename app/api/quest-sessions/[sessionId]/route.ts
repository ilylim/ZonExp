import { eq, sql } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { getDb } from "@/db"
import { progress, quests, questSessions } from "@/db/schema"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ sessionId: string }> }

export async function PATCH(req: Request, context: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { sessionId } = await context.params
  const body = await req.json().catch(() => null)
  const action = body?.action as string | undefined
  if (action !== "complete") {
    return Response.json({ error: "Unsupported action" }, { status: 400 })
  }
  const db = getDb()
  const row = await db.query.questSessions.findFirst({
    where: eq(questSessions.sessionId, sessionId),
  })
  if (!row || row.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }
  if (row.status === "completed") {
    return Response.json({ ok: true, alreadyCompleted: true })
  }
  const questRow = await db.query.quests.findFirst({
    where: eq(quests.questId, row.questId),
  })
  if (!questRow) {
    return Response.json({ error: "Quest missing" }, { status: 500 })
  }
  await db.transaction(async (tx) => {
    await tx
      .update(questSessions)
      .set({
        status: "completed",
        completedAt: new Date(),
      })
      .where(eq(questSessions.sessionId, sessionId))
    await tx
      .update(progress)
      .set({
        xp: sql`${progress.xp} + ${questRow.xpReward}`,
        completedQuests: sql`${progress.completedQuests} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(progress.userId, session.user.id))
  })
  const updated = await db.query.progress.findFirst({
    where: eq(progress.userId, session.user.id),
  })
  return Response.json({ ok: true, progress: updated })
}
