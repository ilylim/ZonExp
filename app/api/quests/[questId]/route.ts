import { auth } from "@/lib/auth"
import { getDb } from "@/db"
import { quests, userQuestAssignments } from "@/db/schema"
import { eq, sql, and } from "drizzle-orm"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ questId: string }> }

export async function GET(req: Request, context: Params) {
  const session = await auth()
  const userId = session?.user?.id
  
  const { questId } = await context.params
  const db = getDb()

  const questRow = await db.query.quests.findFirst({
    where: eq(quests.questId, questId),
  })

  if (!questRow) {
    return Response.json({ error: "Quest not found" }, { status: 404 })
  }

  const coordsResult = await db.execute(
    sql`SELECT ST_Y(location) as latitude, ST_X(location) as longitude
        FROM quests WHERE quest_id = ${questId}`
  )
  const coordsRow = (coordsResult as any).rows?.[0] ?? (coordsResult as unknown as any[])?.[0]

  let isAssigned = false
  let routeColorIndex: number | null = null

  if (userId) {
    const assignment = await db.query.userQuestAssignments.findFirst({
      where: and(
        eq(userQuestAssignments.userId, userId),
        eq(userQuestAssignments.questId, questId)
      ),
    })
    if (assignment) {
      isAssigned = true
      routeColorIndex = assignment.routeColorIndex
    }
  }

  return Response.json({
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
    isAssigned,
    routeColorIndex,
  })
}
