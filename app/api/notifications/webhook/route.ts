import { eq } from "drizzle-orm"
import { getDb } from "@/db"
import { users, notifications } from "@/db/schema"
import crypto from "crypto"

export async function POST(req: Request) {
  try {
    // 2. Чтение и валидация тела запроса
    const body = await req.json()
    const { email, title, message } = body

    // 1. Проверка авторизации вебхука по API ключу безопасности
    const apiKeyHeader = req.headers.get("x-api-key")
    const urlKey = new URL(req.url).searchParams.get("key")
    const bodyKey = body.key || body.api_key
    const systemApiKey = process.env.BPMS_API_KEY

    const providedKey = apiKeyHeader || urlKey || bodyKey

    if (!providedKey || providedKey !== systemApiKey) {
      console.warn("[DEBUG Notification Webhook] Unauthorized request attempt")
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!email || !title || !message) {
      return Response.json({ error: "Missing required fields: email, title, or message" }, { status: 400 })
    }

    console.log(`[DEBUG Notification Webhook] Received notification for ${email}: "${title}"`)

    const db = getDb()

    // 3. Поиск пользователя по Email
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    })

    if (!user) {
      console.warn(`[DEBUG Notification Webhook] User with email ${email} not found.`)
      return Response.json({ error: `User with email ${email} not found` }, { status: 404 })
    }

    // 4. Добавление записи уведомления
    const notificationId = crypto.randomUUID()
    await db.insert(notifications).values({
      notificationId,
      userId: user.userId,
      title,
      message,
      isRead: false,
      createdAt: new Date(),
    })

    console.log(`[DEBUG Notification Webhook] Successfully saved notification ${notificationId} for userId ${user.userId}`)

    return Response.json({ success: true, notificationId })
  } catch (error) {
    console.error("[DEBUG Notification Webhook] Fatal error:", error)
    return Response.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
