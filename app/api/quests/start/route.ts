import { auth } from "@/lib/auth"
import { eq, count, and, sql } from "drizzle-orm"
import { randomUUID } from "crypto"
import { getDb } from "@/db"
import { quests, userQuestAssignments, questSessions } from "@/db/schema"

export const dynamic = "force-dynamic"

const MAX_ACTIVE_QUESTS = 4
const ROUTE_COLORS = ["#8b5cf6", "#ef4444", "#06b6d4", "#f59e0b"]

type QuestStartPayload = {
  questId: string
  title: string
  durationMinutes: number
  intensity: "light" | "moderate" | "hard"
  questType: "walk" | "run" | "mixed"
  xpReward: number
  isActive: boolean
  routeDescription: string
  latitude: number
  longitude: number
}

// Функция для автоматической повторной попытки при обрыве соединения
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
        console.warn(`[StartQuest] Connection lost, retrying (${i + 1}/${retries}) in 2s...`)
        await new Promise(res => setTimeout(res, 2000))
        continue
      }
      console.error("[StartQuest] Non-retryable error:", msg || error)
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

  try {
    const body = await req.json()
    const { questId } = body

    if (!questId) {
      return Response.json({ error: "questId is required" }, { status: 400 })
    }

    console.log(`[StartQuest] Starting quest ${questId} for user ${session.user.id}`)

    const db = getDb()

    // 1. Проверяем существование квеста и получаем его координаты из PostGIS
    const quest = await executeWithRetry(async (): Promise<QuestStartPayload | null> => {
      const questRow = await db.query.quests.findFirst({
        where: eq(quests.questId, questId),
      })

      if (!questRow) {
        return null
      }

      const coordsResult = await db.execute(
        sql`SELECT ST_Y(location) as latitude, ST_X(location) as longitude
            FROM quests WHERE quest_id = ${questId}`
      )

      const coordsRow = (coordsResult as any).rows?.[0] ?? (coordsResult as unknown as any[])?.[0]

      return {
        questId: questRow.questId,
        title: questRow.title,
        durationMinutes: questRow.durationMinutes,
        intensity: questRow.intensity,
        questType: questRow.questType,
        xpReward: questRow.xpReward,
        isActive: questRow.isActive,
        routeDescription: questRow.routeDescription,
        latitude: Number(coordsRow?.latitude ?? 0),
        longitude: Number(coordsRow?.longitude ?? 0),
      }
    })

    if (!quest) {
      return Response.json({ error: "Quest not found" }, { status: 404 })
    }

    // 2. Проверяем, нет ли уже активной сессии
    const existingSession = await executeWithRetry(async () => {
      return db.query.questSessions.findFirst({
        where: and(
          eq(questSessions.userId, session.user.id),
          eq(questSessions.questId, questId),
          eq(questSessions.status, "active")
        ),
      })
    })

    if (existingSession) {
      console.log(`[StartQuest] Session already exists: ${existingSession.sessionId}`)
      return Response.json({
        success: true,
        sessionId: existingSession.sessionId,
        startedAt: existingSession.startedAt.toISOString(),
        alreadyStarted: true,
        quest,
      })
    }

    // 3. Проверяем, не взят ли уже квест
    let assignment = await executeWithRetry(async () => {
      return db.query.userQuestAssignments.findFirst({
        where: and(
          eq(userQuestAssignments.userId, session.user.id),
          eq(userQuestAssignments.questId, questId)
        ),
      })
    })

    // Если не взят — создаём assignment
    if (!assignment) {
      // Проверяем лимит
      const activeCountResult = await executeWithRetry(async () => {
        return db
          .select({ count: count() })
          .from(userQuestAssignments)
          .where(eq(userQuestAssignments.userId, session.user.id))
      })

      const currentCount = activeCountResult[0]?.count || 0

      if (currentCount >= MAX_ACTIVE_QUESTS) {
        return Response.json({
          error: `Maximum ${MAX_ACTIVE_QUESTS} active quests allowed`,
          maxReached: true,
          currentCount,
        }, { status: 409 })
      }

      // Ищем свободный цвет
      const assignedColors = await executeWithRetry(async () => {
        return db
          .select({ routeColorIndex: userQuestAssignments.routeColorIndex })
          .from(userQuestAssignments)
          .where(eq(userQuestAssignments.userId, session.user.id))
      })

      const usedColors = new Set(assignedColors.map((a: any) => a.routeColorIndex))
      const nextColor = ROUTE_COLORS.findIndex((_, i) => !usedColors.has(i))
      const colorIndex = nextColor >= 0 ? nextColor : 0

      console.log(`[StartQuest] Creating assignment for quest ${questId}, color ${colorIndex}`)

      // Создаём assignment
      await executeWithRetry(async () => {
        return db.insert(userQuestAssignments).values({
          userId: session.user.id,
          questId,
          routeColorIndex: colorIndex,
        })
      })

      assignment = {
        userId: session.user.id,
        questId,
        assignedAt: new Date(),
        routeColorIndex: colorIndex,
      }
    }

    // 4. Создаём сессию
    const sessionId = randomUUID()
    const startedAt = new Date()
    console.log(`[StartQuest] Creating session ${sessionId} for quest ${questId}`)

    await executeWithRetry(async () => {
      return db.insert(questSessions).values({
        sessionId,
        userId: session.user.id,
        questId,
        startedAt,
        status: "active",
      })
    })

    console.log(`[StartQuest] ✅ Started quest ${questId}, session ${sessionId}`)

    // Возвращаем данные квеста с координатами
    return Response.json({
      success: true,
      sessionId,
      startedAt: startedAt.toISOString(),
      quest,
      routeColorIndex: assignment?.routeColorIndex ?? null,
    })
  } catch (error) {
    console.error("[StartQuest] ❌ Failed to start quest:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return Response.json({ error: `Failed to start quest: ${errorMessage}` }, { status: 500 })
  }
}
