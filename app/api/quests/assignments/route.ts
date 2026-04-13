import { auth } from "@/lib/auth"
import { eq, count, and } from "drizzle-orm"
import { getDb } from "@/db"
import { userQuestAssignments, quests } from "@/db/schema"

export const dynamic = "force-dynamic"

const MAX_ACTIVE_QUESTS = 4
const ROUTE_COLORS = ["#8b5cf6", "#ef4444", "#06b6d4", "#f59e0b"]

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
    const quest = await db.query.quests.findFirst({
      where: eq(quests.questId, questId),
    })

    if (!quest) {
      return Response.json({ error: "Quest not found" }, { status: 404 })
    }

    // Проверяем, не взят ли уже
    const existing = await db.query.userQuestAssignments.findFirst({
      where: and(
        eq(userQuestAssignments.userId, session.user.id),
        eq(userQuestAssignments.questId, questId)
      ),
    })

    if (existing) {
      return Response.json({ error: "Quest already assigned" }, { status: 409 })
    }

    // Считаем текущие активные
    const activeCountResult = await db
      .select({ count: count() })
      .from(userQuestAssignments)
      .where(eq(userQuestAssignments.userId, session.user.id))

    const currentCount = activeCountResult[0]?.count || 0

    if (currentCount >= MAX_ACTIVE_QUESTS) {
      return Response.json({
        error: `Maximum ${MAX_ACTIVE_QUESTS} active quests allowed`,
        maxReached: true,
        currentCount,
      }, { status: 409 })
    }

    // Ищем свободный цвет
    const assignedColors = await db
      .select({ routeColorIndex: userQuestAssignments.routeColorIndex })
      .from(userQuestAssignments)
      .where(eq(userQuestAssignments.userId, session.user.id))

    const usedColors = new Set(assignedColors.map((a) => a.routeColorIndex))
    const nextColor = ROUTE_COLORS.findIndex((_, i) => !usedColors.has(i))
    const colorIndex = nextColor >= 0 ? nextColor : 0

    // Назначаем квест
    await db.insert(userQuestAssignments).values({
      userId: session.user.id,
      questId,
      routeColorIndex: colorIndex,
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

    await db
      .delete(userQuestAssignments)
      .where(
        and(
          eq(userQuestAssignments.userId, session.user.id),
          eq(userQuestAssignments.questId, questId)
        )
      )

    return Response.json({ success: true })
  } catch (error) {
    console.error("Failed to remove assignment:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}