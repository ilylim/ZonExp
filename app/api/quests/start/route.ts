import { auth } from "@/lib/auth"
import { eq, count, and } from "drizzle-orm"
import { randomUUID } from "crypto"
import { getDb } from "@/db"
import { quests, userQuestAssignments, questSessions } from "@/db/schema"

export const dynamic = "force-dynamic"

const MAX_ACTIVE_QUESTS = 4
const ROUTE_COLORS = ["#8b5cf6", "#ef4444", "#06b6d4", "#f59e0b"]

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

    // 1. Проверяем существование квеста
    const quest = await executeWithRetry(async () => {
      return db.query.quests.findFirst({
        where: eq(quests.questId, questId),
      })
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

      assignment = { userId: session.user.id, questId, routeColorIndex: colorIndex }
    }

    // 4. Создаём сессию
    const sessionId = randomUUID()
    console.log(`[StartQuest] Creating session ${sessionId} for quest ${questId}`)

    await executeWithRetry(async () => {
      return db.insert(questSessions).values({
        sessionId,
        userId: session.user.id,
        questId,
        startedAt: new Date(),
        status: "active",
      })
    })

    console.log(`[StartQuest] ✅ Started quest ${questId}, session ${sessionId}`)

    return Response.json({
      success: true,
      sessionId,
      quest,
      routeColorIndex: assignment.routeColorIndex,
    })
  } catch (error) {
    console.error("[StartQuest] ❌ Failed to start quest:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return Response.json({ error: `Failed to start quest: ${errorMessage}` }, { status: 500 })
  }
}
