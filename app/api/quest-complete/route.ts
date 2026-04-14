import { eq, sql, and } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { getDb } from "@/db"
import { progress, quests, questSessions, userQuestAssignments } from "@/db/schema"

export const dynamic = "force-dynamic"

async function executeWithRetry<T>(fn: () => Promise<T>, retries = 5): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (error: any) {
      const code = error?.cause?.code || error?.code
      const msg = (error?.message || "") + " " + (error?.cause?.message || "")
      const isConnError =
        code === "ECONNRESET" ||
        msg.toLowerCase().includes("terminated unexpectedly") ||
        msg.toLowerCase().includes("connection terminated") ||
        msg.toLowerCase().includes("read econnreset")

      if (isConnError) {
        console.warn(`[QuestComplete] Connection lost, retrying (${i + 1}/${retries}) in 2s...`)
        await new Promise(res => setTimeout(res, 2000))
        continue
      }
      console.error("[QuestComplete] Non-retryable error:", msg || error)
      throw error
    }
  }
  throw new Error("Database connection failed after multiple retries")
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { questId, successful, userLat, userLng } = body

  if (!questId) {
    return Response.json({ error: "questId is required" }, { status: 400 })
  }

  const db = getDb()

  // Ищем квест
  const questRow = await executeWithRetry(async () => {
    return db.query.quests.findFirst({
      where: eq(quests.questId, questId),
    })
  })

  if (!questRow) {
    return Response.json({ error: "Quest not found" }, { status: 404 })
  }

  // Если есть координаты пользователя — проверяем расстояние через PostGIS
  let actualDistanceMeters: number | null = null
  if (userLat && userLng) {
    const userPoint = sql`ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)`
    const result = await executeWithRetry(async () => {
      return db.execute(
        sql`SELECT ST_Distance(q.location::geography, ${userPoint}::geography) as dist FROM quests q WHERE q.quest_id = ${questId}`
      )
    })
    actualDistanceMeters = Math.round(Number((result as any)[0]?.dist) || 0)
    console.log(`[QuestComplete] Distance to destination (PostGIS): ${actualDistanceMeters}m`)
  }

  // Ищем активную сессию
  const activeSession = await executeWithRetry(async () => {
    return db.query.questSessions.findFirst({
      where: and(
        eq(questSessions.userId, session.user.id),
        eq(questSessions.questId, questId),
        eq(questSessions.status, "active")
      ),
    })
  })

  if (!activeSession) {
    const sessionId = crypto.randomUUID()
    await executeWithRetry(async () => {
      return db.insert(questSessions).values({
        sessionId,
        userId: session.user.id,
        questId,
        startedAt: new Date(),
        status: successful ? "completed" : "abandoned",
        completedAt: new Date(),
      })
    })
  } else {
    await executeWithRetry(async () => {
      return db
        .update(questSessions)
        .set({
          status: successful ? "completed" : "abandoned",
          completedAt: new Date(),
        })
        .where(eq(questSessions.sessionId, activeSession.sessionId))
    })
  }

  // Рассчитываем XP
  const earnedXp = successful ? questRow.xpReward : Math.max(Math.round(questRow.xpReward * 0.1), 10)

  // Начисляем XP
  await executeWithRetry(async () => {
    return db
      .update(progress)
      .set({
        xp: sql`${progress.xp} + ${earnedXp}`,
        completedQuests: successful
          ? sql`${progress.completedQuests} + 1`
          : progress.completedQuests,
        updatedAt: new Date(),
      })
      .where(eq(progress.userId, session.user.id))
  })

  // Удаляем assignment
  await executeWithRetry(async () => {
    return db
      .delete(userQuestAssignments)
      .where(
        and(
          eq(userQuestAssignments.userId, session.user.id),
          eq(userQuestAssignments.questId, questId)
        )
      )
  })

  return Response.json({
    ok: true,
    earnedXp,
    successful,
    distanceMeters: actualDistanceMeters,
  })
}
