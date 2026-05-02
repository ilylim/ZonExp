import { auth } from "@/lib/auth"
import { eq, sql, and } from "drizzle-orm"
import { getDb } from "@/db"
import { quests, userQuestAssignments, questSessions } from "@/db/schema"

export const dynamic = "force-dynamic"

function debugLog(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") {
    console.log(...args)
  }
}

export async function GET(req: Request) {
  try {
    debugLog("[API] GET /api/quests called")

    const session = await auth()
    const db = getDb()

    // Получаем координаты пользователя из query параметров
    const url = new URL(req.url)
    const userLng = url.searchParams.get("lng")
    const userLat = url.searchParams.get("lat")

    // Получаем ID выполненных квестов для пользователя (только со статусом 'completed')
    const userId = session?.user?.id
    let completedQuestIds: string[] = []

    if (userId) {
      const completedSessions = await db
        .select({ questId: questSessions.questId })
        .from(questSessions)
        .where(and(
          eq(questSessions.userId, userId),
          sql`${questSessions.status} IN ('completed', 'abandoned')`
        ))

      completedQuestIds = completedSessions
        .filter((s) => s.questId !== null)
        .map((s) => s.questId as string)
    }

    let questsList: any[]

    // Если есть координаты — используем PostGIS ST_Distance для сортировки
    if (userLng && userLat) {
      const userPoint = sql`ST_SetSRID(ST_MakePoint(${parseFloat(userLng)}, ${parseFloat(userLat)}), 4326)`

      questsList = await db
        .select({
          questId: quests.questId,
          title: quests.title,
          durationMinutes: quests.durationMinutes,
          intensity: quests.intensity,
          questType: quests.questType,
          xpReward: quests.xpReward,
          isActive: quests.isActive,
          routeDescription: quests.routeDescription,
          latitude: sql<number>`ST_Y(${quests.location})`.as("latitude"),
          longitude: sql<number>`ST_X(${quests.location})`.as("longitude"),
          distanceMeters: sql<number>`ST_Distance(${quests.location}::geography, ${userPoint}::geography)`.as("distance_meters"),
        })
        .from(quests)
        .where(eq(quests.isActive, true))

      // Исключаем выполненные квесты
      if (completedQuestIds.length > 0) {
        questsList = questsList.filter(
          (q) => !completedQuestIds.includes(q.questId)
        )
      }

      questsList = questsList.sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0))

      debugLog(`[API] Found ${questsList.length} quests, sorted by PostGIS distance from (${userLat}, ${userLng})`)
    } else {
      // Без координат — просто все активные квесты, исключая выполненные
      const baseQuery = db
        .select({
          questId: quests.questId,
          title: quests.title,
          durationMinutes: quests.durationMinutes,
          intensity: quests.intensity,
          questType: quests.questType,
          xpReward: quests.xpReward,
          isActive: quests.isActive,
          routeDescription: quests.routeDescription,
          latitude: sql<number>`ST_Y(${quests.location})`.as("latitude"),
          longitude: sql<number>`ST_X(${quests.location})`.as("longitude"),
        })
        .from(quests)

      let filteredQuests = await baseQuery.where(eq(quests.isActive, true))

      // Исключаем выполненные квесты
      if (completedQuestIds.length > 0) {
        filteredQuests = filteredQuests.filter(
          (q) => !completedQuestIds.includes(q.questId)
        )
      }

      questsList = filteredQuests

      debugLog(`[API] Found ${questsList.length} quests (no location, unsorted)`)
    }

    // Получаем назначения и активные сессии пользователя
    let assignments: { questId: string; routeColorIndex: number }[] = []
    let activeSessions: { questId: string; sessionId: string }[] = []

    if (userId) {
      assignments = await db
        .select({
          questId: userQuestAssignments.questId,
          routeColorIndex: userQuestAssignments.routeColorIndex,
        })
        .from(userQuestAssignments)
        .where(eq(userQuestAssignments.userId, userId))

      activeSessions = await db
        .select({
          questId: questSessions.questId,
          sessionId: questSessions.sessionId,
        })
        .from(questSessions)
        .where(and(
          eq(questSessions.userId, userId),
          eq(questSessions.status, "active")
        ))
    }

    const assignmentMap = new Map(assignments.map((a) => [a.questId, a.routeColorIndex]))
    const sessionMap = new Map(activeSessions.map((s) => [s.questId, s.sessionId]))

    const result = questsList.map((q: any) => {
      const qId = q.questId || q.quest_id
      return {
        questId: qId,
        title: q.title,
        durationMinutes: q.durationMinutes || q.duration_minutes,
        intensity: q.intensity,
        questType: q.questType || q.quest_type,
        xpReward: q.xpReward || q.xp_reward,
        isActive: q.isActive ?? q.is_active,
        routeDescription: q.routeDescription || q.route_description,
        latitude: Number(q.latitude) || 0,
        longitude: Number(q.longitude) || 0,
        distanceMeters: Number(q.distanceMeters || q.distance_meters),
        isAssigned: assignmentMap.has(qId),
        routeColorIndex: assignmentMap.get(qId) ?? null,
        sessionId: sessionMap.get(qId) ?? null,
      }
    })

    debugLog(`[API] Returning ${result.length} quests`)
    return Response.json({ quests: result })

  } catch (error) {
    console.error("[API] Failed to fetch quests:", error)
    return Response.json({
      quests: [],
      error: "Не удалось загрузить квесты"
    }, { status: 500 })
  }
}
