import { and, eq, sql } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { getDb } from "@/db"
import { progress, quests, questSessions, userQuestAssignments } from "@/db/schema"

export const dynamic = "force-dynamic"

const COMPLETION_THRESHOLD_METERS = 40

type Params = { params: Promise<{ sessionId: string }> }

export async function GET(req: Request, context: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { sessionId } = await context.params
  const db = getDb()

  const row = await db.query.questSessions.findFirst({
    where: eq(questSessions.sessionId, sessionId),
    with: {
      quest: true,
      user: true,
    },
  })

  if (!row || row.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  // Получаем координаты из PostGIS для квеста
  const coordsResult = await db.execute(
    sql`SELECT ST_Y(location) as latitude, ST_X(location) as longitude
        FROM quests WHERE quest_id = ${row.questId}`
  )
  const coordsRow = (coordsResult as any).rows?.[0] ?? (coordsResult as unknown as any[])?.[0]

  return Response.json({
    sessionId: row.sessionId,
    startedAt: row.startedAt.toISOString(),
    status: row.status,
    initialDistanceMeters: row.initialDistanceMeters,
    quest: {
      ...row.quest,
      latitude: Number(coordsRow?.latitude ?? 0),
      longitude: Number(coordsRow?.longitude ?? 0),
    },
  })
}

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

  const requestedSuccessful = body?.successful !== false
  const userLat = Number(body?.userLat)
  const userLng = Number(body?.userLng)
  let actualDistanceMeters: number | null = null

  if (
    requestedSuccessful &&
    Number.isFinite(userLat) &&
    Number.isFinite(userLng) &&
    userLat >= -90 &&
    userLat <= 90 &&
    userLng >= -180 &&
    userLng <= 180
  ) {
    const userPoint = sql`ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)`
    const result = await db.execute(
      sql`SELECT ST_Distance(q.location::geography, ${userPoint}::geography) as dist FROM quests q WHERE q.quest_id = ${row.questId}`
    )
    const distanceRow = (result as any).rows?.[0] ?? (result as any)[0]
    const distance = Number(distanceRow?.dist)
    actualDistanceMeters = Number.isFinite(distance) ? Math.round(distance) : null
  }

  const successful =
    requestedSuccessful &&
    actualDistanceMeters !== null &&
    actualDistanceMeters <= COMPLETION_THRESHOLD_METERS

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
        and(
          eq(userQuestAssignments.userId, session.user.id),
          eq(userQuestAssignments.questId, row.questId)
        )
      )
  })

  const updated = await db.query.progress.findFirst({
    where: eq(progress.userId, session.user.id),
  })

  return Response.json({
    ok: true,
    earnedXp,
    successful,
    distanceMeters: actualDistanceMeters,
    progress: updated,
  })
}
