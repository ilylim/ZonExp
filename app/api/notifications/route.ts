import { auth } from "@/lib/auth"
import { eq, desc } from "drizzle-orm"
import { getDb } from "@/db"
import { notifications } from "@/db/schema"

export const dynamic = "force-dynamic"

// GET: Получение всех уведомлений текущего пользователя
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const db = getDb()
    const list = await db.query.notifications.findMany({
      where: eq(notifications.userId, session.user.id),
      orderBy: [desc(notifications.createdAt)],
    })

    return Response.json({ notifications: list })
  } catch (error) {
    console.error("Failed to fetch notifications:", error)
    return Response.json({ notifications: [], error: "Failed to load notifications" })
  }
}

// PATCH: Пометка всех уведомлений пользователя как прочитанных
export async function PATCH() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const db = getDb()
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, session.user.id))

    return Response.json({ success: true })
  } catch (error) {
    console.error("Failed to update notifications read status:", error)
    return Response.json({ error: "Failed to update status" }, { status: 500 })
  }
}

// DELETE: Полная очистка уведомлений пользователя
export async function DELETE() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const db = getDb()
    await db
      .delete(notifications)
      .where(eq(notifications.userId, session.user.id))

    return Response.json({ success: true })
  } catch (error) {
    console.error("Failed to clear notifications:", error)
    return Response.json({ error: "Failed to clear notifications" }, { status: 500 })
  }
}
