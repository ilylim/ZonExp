import { getDb } from "@/db"
import { quests, userQuestAssignments } from "@/db/schema"
import { count, eq, sql } from "drizzle-orm"
import crypto from "crypto"

export async function POST(req: Request) {
  try {
    // 1. Проверка API-ключа для безопасности интеграции
    const authHeader = req.headers.get("authorization")
    const apiKey = process.env.BPMS_API_KEY

    if (!apiKey) {
      console.error("[BPMS API] BPMS_API_KEY is not configured in environment variables.")
      return Response.json({ error: "API configuration error" }, { status: 500 })
    }

    if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { userId, title, routeDescription, durationMinutes, intensity, questType, xpReward, lat, lng } = body

    if (!userId || !title || !lat || !lng) {
      return Response.json({ error: "Missing required fields: userId, title, lat, lng" }, { status: 400 })
    }

    const db = getDb()

    // 2. Создание уникального ID для ИИ-квеста
    const questId = `quest_ai_${crypto.randomUUID()}`

    // 3. Вставка квеста в таблицу с PostGIS геометрией точки
    await db.execute(sql`
      INSERT INTO quests (quest_id, title, duration_minutes, intensity, quest_type, xp_reward, is_active, route_description, location, created_by)
      VALUES (
        ${questId}, 
        ${title}, 
        ${Number(durationMinutes) || 30}, 
        ${intensity || "moderate"}, 
        ${questType || "walk"}, 
        ${Number(xpReward) || 200}, 
        true, 
        ${routeDescription || ""}, 
        ST_SetSRID(ST_MakePoint(${parseFloat(lng)}, ${parseFloat(lat)}), 4326),
        ${userId}
      )
    `)

    // 4. Назначение квеста игроку (если количество активных квестов < 4)
    const activeCountResult = await db
      .select({ count: count() })
      .from(userQuestAssignments)
      .where(eq(userQuestAssignments.userId, userId))

    const currentCount = activeCountResult[0]?.count || 0
    const MAX_ACTIVE_QUESTS = 4

    if (currentCount >= MAX_ACTIVE_QUESTS) {
      return Response.json({
        success: true,
        questId,
        assigned: false,
        message: `Quest created but not assigned: user has reached maximum of ${MAX_ACTIVE_QUESTS} active quests.`
      })
    }

    // Поиск свободного индекса цвета для отображения маршрута на карте (0-3)
    const assignedColors = await db
      .select({ routeColorIndex: userQuestAssignments.routeColorIndex })
      .from(userQuestAssignments)
      .where(eq(userQuestAssignments.userId, userId))

    const usedColors = new Set(assignedColors.map((a: any) => a.routeColorIndex))
    let colorIndex = 0
    for (let i = 0; i < MAX_ACTIVE_QUESTS; i++) {
      if (!usedColors.has(i)) {
        colorIndex = i
        break
      }
    }

    // Вставка назначения квеста
    await db.insert(userQuestAssignments).values({
      userId,
      questId,
      routeColorIndex: colorIndex,
    })

    return Response.json({
      success: true,
      questId,
      assigned: true,
      routeColorIndex: colorIndex
    })

  } catch (error) {
    console.error("[BPMS API] Error generating/assigning quest:", error)
    return Response.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
