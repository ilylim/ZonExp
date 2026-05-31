import { auth } from "@/lib/auth"
import { eq, sql, and, or, isNull } from "drizzle-orm"
import { getDb } from "@/db"
import { quests, userQuestAssignments, questSessions, userExplorationCells } from "@/db/schema"
import { cellToLatLng } from "h3-js"

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

    // Проверяем и генерируем ИИ-квест через ELMA365, если это первый вход за день
    if (userId) {
      try {
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)

        // Проверяем, есть ли уже созданный ИИ-квест для этого пользователя за сегодня
        const dailyQuestResult = await db
          .select({ questId: quests.questId })
          .from(userQuestAssignments)
          .innerJoin(quests, eq(userQuestAssignments.questId, quests.questId))
          .where(and(
            eq(userQuestAssignments.userId, userId),
            sql`${userQuestAssignments.assignedAt} >= ${todayStart}`,
            sql`${quests.questId} LIKE 'quest_ai_%'`
          ))
          .limit(1)

        if (dailyQuestResult.length === 0) {
          const elmaUrl = process.env.ELMA365_WEBHOOK_URL
          if (elmaUrl) {
            debugLog(`[Quests API] No daily AI quest found for user ${userId}. Triggering ELMA365...`)
            
            // Определяем координаты игрока
            let lat = parseFloat(userLat || "")
            let lng = parseFloat(userLng || "")

            if (isNaN(lat) || isNaN(lng)) {
              // Попытаемся взять координаты последней открытой ячейки H3
              const lastCell = await db
                .select({ h3Index: userExplorationCells.h3Index })
                .from(userExplorationCells)
                .where(eq(userExplorationCells.userId, userId))
                .orderBy(sql`${userExplorationCells.discoveredAt} DESC`)
                .limit(1)

              if (lastCell[0]?.h3Index) {
                try {
                  const [cellLat, cellLng] = cellToLatLng(lastCell[0].h3Index)
                  lat = cellLat
                  lng = cellLng
                  debugLog(`[Quests API] Got coordinates from last H3 cell: ${lat}, ${lng}`)
                } catch (h3Err) {
                  console.error("H3 conversion error:", h3Err)
                }
              }
            }

            // Если координаты все еще не определены — используем центр Красноярска
            if (isNaN(lat) || isNaN(lng)) {
              lat = 56.0068
              lng = 92.8744
              debugLog(`[Quests API] Using fallback center coordinates: ${lat}, ${lng}`)
            }

            // Отправляем запрос в ELMA365 с таймаутом 6 секунд
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 6000)

            try {
              const elmaResponse = await fetch(elmaUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, lat, lng }),
                signal: controller.signal
              })
              clearTimeout(timeoutId)
              
              if (elmaResponse.ok) {
                debugLog(`[Quests API] ELMA365 successfully triggered for user ${userId}`)
              } else {
                console.error(`[Quests API] ELMA365 returned status ${elmaResponse.status}`)
              }
            } catch (fetchErr: any) {
              clearTimeout(timeoutId)
              if (fetchErr.name === "AbortError") {
                console.warn(`[Quests API] ELMA365 trigger timed out after 6 seconds`)
              } else {
                console.error(`[Quests API] Failed to trigger ELMA365:`, fetchErr)
              }
            }
          } else {
            debugLog(`[Quests API] ELMA365_WEBHOOK_URL is not set. Skipping AI quest generation.`)
          }
        }
      } catch (err) {
        console.error("[Quests API] Error during daily AI quest generation process:", err)
      }
    }

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
        .where(and(
          eq(quests.isActive, true),
          userId
            ? or(isNull(quests.createdBy), eq(quests.createdBy, userId))
            : isNull(quests.createdBy)
        ))

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

      const userFilter = userId
        ? or(isNull(quests.createdBy), eq(quests.createdBy, userId))
        : isNull(quests.createdBy)

      let filteredQuests = await baseQuery.where(and(eq(quests.isActive, true), userFilter))

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
