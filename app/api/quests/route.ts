import { auth } from "@/lib/auth"
import { eq } from "drizzle-orm"
import { getDb } from "@/db"
import { quests, userQuestAssignments } from "@/db/schema"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    console.log("[API] GET /api/quests called")

    // 1. Запускаем проверку сессии
    const sessionPromise = auth()

    // 2. Сразу же, параллельно, запускаем запрос квестов
    const db = getDb()
    const questsPromise = db.select().from(quests).where(eq(quests.isActive, true))

    // 3. Ждём их ОДНОВРЕМЕННО (экономим сотни миллисекунд)
    const [session, questsList] = await Promise.all([sessionPromise, questsPromise])

    const userId = session?.user?.id

    // 4. Запрос назначений выполняем только если юзер авторизован
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

    // 5. Быстро склеиваем в JS (для 15 элементов это занимает 0.1мс)
    const assignmentMap = new Map(assignments.map((a) => [a.questId, a.routeColorIndex]))

    const result = questsList.map((q: any) => ({
      ...q,
      isAssigned: assignmentMap.has(q.questId),
      routeColorIndex: assignmentMap.get(q.questId) ?? null,
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