import { eq, sql } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { getDb } from "@/db"
import { progress, quests, questSessions, userQuestAssignments } from "@/db/schema"

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
  const successful = body?.successful !== false // по умолчанию true

  if (action !== "complete") {
    return Response.json({ error: "Unsupported action" }, { status: 400 })
  }

  const db = getDb()

  // Находим сессию
  const row = await db.query.questSessions.findFirst({
    where: eq(questSessions.sessionId, sessionId),
  })

  if (!row || row.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  if (row.status === "completed") {
    return Response.json({ ok: true, alreadyCompleted: true })
  }

  // Находим квест
  const questRow = await db.query.quests.findFirst({
    where: eq(quests.questId, row.questId),
  })

  if (!questRow) {
    return Response.json({ error: "Quest missing" }, { status: 500 })
  }

  // Рассчитываем XP
  const earnedXp = successful ? questRow.xpReward : Math.round(questRow.xpReward * 0.1) // досрочно = 10%

  await db.transaction(async (tx) => {
    // Обновляем статус сессии
    await tx
      .update(questSessions)
      .set({
        status: successful ? "completed" : "abandoned",
        completedAt: new Date(),
      })
      .where(eq(questSessions.sessionId, sessionId))

    // Начисляем XP
    await tx
      .update(progress)
      .set({
        xp: sql`${progress.xp} + ${earnedXp}`,
        completedQuests: successful
          ? sql`${progress.completedQuests} + 1`
          : progress.completedQuests, // досрочно не считаем
        updatedAt: new Date(),
      })
      .where(eq(progress.userId, session.user.id))

    // Если успешно — удаляем assignment (квест выполнен)
    // Если досрочно — тоже удаляем assignment (квест возвращается в доступные)
    await tx
      .delete(userQuestAssignments)
      .where(
        eq(userQuestAssignments.userId, session.user.id) &&
        eq(userQuestAssignments.questId, row.questId)
      )
  })

  const updated = await db.query.progress.findFirst({
    where: eq(progress.userId, session.user.id),
  })

  return Response.json({
    ok: true,
    earnedXp,
    successful,
    progress: updated,
  })
}
