import { auth } from "@/lib/auth"
import { getDb } from "@/db"
import { quests } from "@/db/schema"
import { eq, sql } from "drizzle-orm"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ questId: string }> }

export async function GET(req: Request, context: Params) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { questId } = await context.params
  const url = new URL(req.url)
  const lng = Number(url.searchParams.get("lng"))
  const lat = Number(url.searchParams.get("lat"))

  if (!questId) {
    return Response.json({ error: "questId is required" }, { status: 400 })
  }

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return Response.json({ error: "Valid lng and lat are required" }, { status: 400 })
  }

  const db = getDb()

  const questRow = await db.query.quests.findFirst({
    where: eq(quests.questId, questId),
  })

  if (!questRow) {
    return Response.json({ error: "Quest not found" }, { status: 404 })
  }

  const userPoint = sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`

  const result = await db.execute(sql`
    SELECT
      ST_AsGeoJSON(ST_MakeLine(${userPoint}, q.location)) AS route_geojson,
      ST_Distance(q.location::geography, ${userPoint}::geography) AS distance_meters,
      ST_X(q.location) AS destination_lng,
      ST_Y(q.location) AS destination_lat
    FROM quests q
    WHERE q.quest_id = ${questId}
  `)

  const row = (result as any).rows?.[0] ?? (result as unknown as any[])?.[0]

  if (!row) {
    return Response.json({ error: "Route not found" }, { status: 404 })
  }

  return Response.json({
    route: typeof row.route_geojson === "string" ? JSON.parse(row.route_geojson) : row.route_geojson,
    distanceMeters: Math.round(Number(row.distance_meters) || 0),
    destination: {
      lng: Number(row.destination_lng),
      lat: Number(row.destination_lat),
    },
  })
}
