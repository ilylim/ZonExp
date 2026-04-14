import { auth } from "@/lib/auth"
import { eq, sql } from "drizzle-orm"
import { getDb } from "@/db"
import { quests, userQuestAssignments } from "@/db/schema"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    console.log("[API] GET /api/quests called")

    const session = await auth()
    const db = getDb()

    // Получаем координаты пользователя из query параметров
    const url = new URL(req.url)
    const userLng = url.searchParams.get("lng")
    const userLat = url.searchParams.get("lat")

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
          // Извлекаем lat/lng из PostGIS geometry
          latitude: sql<number>`ST_Y(${quests.location})`.as("latitude"),
          longitude: sql<number>`ST_X(${quests.location})`.as("longitude"),
          // Расстояние в метрах через PostGIS
          distanceMeters: sql<number>`ST_Distance(${quests.location}::geography, ${userPoint}::geography)`.as("distance_meters"),
        })
        .from(quests)
        .where(eq(quests.isActive, true))
        .orderBy(sql`distance_meters ASC`)

      console.log(`[API] Found ${questsList.length} quests, sorted by PostGIS distance from (${userLat}, ${userLng})`)
    } else {
      // Без координат — просто все активные квесты
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
        })
        .from(quests)
        .where(eq(quests.isActive, true))

      console.log(`[API] Found ${questsList.length} quests (no location, unsorted)`)
    }

    // Получаем назначения пользователя
    const userId = session?.user?.id
    let assignments: { questId: string; routeColorIndex: number }[] = []

    if (userId) {
      assignments = await db
        .select({
          questId: userQuestAssignments.questId,
          routeColorIndex: userQuestAssignments.routeColorIndex,
        })
        .from(userQuestAssignments)
        .where(eq(userQuestAssignments.userId, userId))
    }

    const assignmentMap = new Map(assignments.map((a) => [a.questId, a.routeColorIndex]))

    const result = questsList.map((q: any) => ({
      questId: q.questId || q.quest_id,
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
      isAssigned: assignmentMap.has(q.questId || q.quest_id),
      routeColorIndex: assignmentMap.get(q.questId || q.quest_id) ?? null,
    }))

    console.log(`[API] Returning ${result.length} quests`)
    return Response.json({ quests: result })

  } catch (error) {
    console.error("[API] Failed to fetch quests:", error)
    return Response.json({
      quests: [],
      error: "Не удалось загрузить квесты"
    }, { status: 500 })
  }
}
