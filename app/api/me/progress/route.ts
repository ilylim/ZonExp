import { auth } from "@/lib/auth"
import { eq } from "drizzle-orm"
import { getDb } from "@/db"
import { progress } from "@/db/schema"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const db = getDb()
    const userProgress = await db.query.progress.findFirst({
      where: eq(progress.userId, session.user.id),
    })

    return Response.json({
      xp: userProgress?.xp || 0,
      level: userProgress?.level || 1,
      completedQuests: userProgress?.completedQuests || 0,
    })
  } catch (error) {
    console.error("Failed to fetch progress:", error)
    
    // Если ошибка соединения — возвращаем значения по умолчанию
    // Это предотвращает блокировку интерфейса
    return Response.json({ 
      xp: 0, 
      level: 1, 
      completedQuests: 0,
      error: "Не удалось загрузить прогресс. Попробуйте обновить страницу."
    })
  }
}
