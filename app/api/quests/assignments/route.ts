import { auth } from "@/lib/auth"
import { eq, count, and } from "drizzle-orm"
import { getDb } from "@/db"
import { userQuestAssignments, quests } from "@/db/schema"

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
        console.warn(`[Assignments] Connection lost, retrying (${i + 1}/${retries}) in 2s...`)
        await new Promise(res => setTimeout(res, 2000))
        continue
      }
      console.error("[Assignments] Non-retryable error:", msg || error)
      throw error
    }
  }
  throw new Error("Database connection failed after multiple retries")
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const db = getDb()
    const assignments = await executeWithRetry(async () => {
      return db
        .select({
          questId: userQuestAssignments.questId,
          routeColorIndex: userQuestAssignments.routeColorIndex,
          assignedAt: userQuestAssignments.assignedAt,
        })
        .from(userQuestAssignments)
        .where(eq(userQuestAssignments.userId, session.user.id))
    })

    return Response.json({ assignments })
  } catch (error) {
    console.error("Failed to fetch assignments:", error)
    return Response.json({ assignments: [] })
  }
}

// Assign a quest to user (max 4 active)
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { questId } = body

    if (!questId) {
      return Response.json({ error: "Quest ID is required" }, { status: 400 })
    }

    const db = getDb()

    // Проверяем существование квеста
    const quest = await executeWithRetry(async () => {
      return db.query.quests.findFirst({
        where: eq(quests.questId, questId),
      })
    })

    if (!quest) {
      return Response.json({ error: "Quest not found" }, { status: 404 })
    }

    // Проверяем, не взят ли уже
    const existing = await executeWithRetry(async () => {
      return db.query.userQuestAssignments.findFirst({
        where: and(
          eq(userQuestAssignments.userId, session.user.id),
          eq(userQuestAssignments.questId, questId)
        ),
      })
    })

    if (existing) {
      return Response.json({ error: "Quest already assigned" }, { status: 409 })
    }

    // Считаем текущие активные
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

    // Назначаем квест
    await executeWithRetry(async () => {
      return db.insert(userQuestAssignments).values({
        userId: session.user.id,
        questId,
        routeColorIndex: colorIndex,
      })
    })

    return Response.json({
      success: true,
      routeColorIndex: colorIndex,
      routeColor: ROUTE_COLORS[colorIndex],
      activeCount: currentCount + 1,
    })
  } catch (error) {
    console.error("Failed to assign quest:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Remove quest assignment
export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { questId } = body

    if (!questId) {
      return Response.json({ error: "Quest ID is required" }, { status: 400 })
    }

    const db = getDb()

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

    return Response.json({ success: true })
  } catch (error) {
    console.error("Failed to remove assignment:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
