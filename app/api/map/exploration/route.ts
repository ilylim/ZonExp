import { and, eq, sql } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { getDb } from "@/db"
import {
  territories,
  userExplorationCells,
  userTerritoryStats,
} from "@/db/schema"
import {
  buildFogFeatureCollection,
  EXPLORATION_H3_RESOLUTION,
  getExplorationCellIndex,
  type TerritoryBoundary,
} from "@/lib/exploration"

export const dynamic = "force-dynamic"

/** Returns territory GeoJSON and current user's discovered H3 cells as GeoJSON features */
export async function GET() {
  try {
    const session = await auth()
    const db = getDb()
    const territoryRows = await db
      .select({
        territoryId: territories.territoryId,
        name: territories.name,
        city: territories.city,
        boundaryGeojson: territories.boundaryGeojson,
      })
      .from(territories)

    let cells: { h3Index: string; discoveredAt: Date | string }[] = []
    if (session?.user?.id) {
      cells = await db
      .select({
        h3Index: userExplorationCells.h3Index,
        discoveredAt: userExplorationCells.discoveredAt,
        territoryId: userExplorationCells.territoryId,
      })
      .from(userExplorationCells)
      .where(eq(userExplorationCells.userId, session.user.id))
    }
      const territoriesData = territoryRows.map((t) => {
      const territoryCells = cells
        .map((c) => c.h3Index)

      return {
        id: t.territoryId,
        name: t.name,
        city: t.city,
        boundary: t.boundaryGeojson,
        fog: buildFogFeatureCollection(
          t.boundaryGeojson as TerritoryBoundary,
          territoryCells
        ),
      }
    })

    return Response.json({
    territories: territoriesData,
    cells,
    fog: {
      type: "FeatureCollection",
      features: territoriesData.flatMap((t) => t.fog.features),
    },
    resolution: EXPLORATION_H3_RESOLUTION,
  })
  } catch {
    return Response.json({
      territory: null,
      territories: [],
      cells: [],
      fog: { type: "FeatureCollection", features: [] },
      resolution: EXPLORATION_H3_RESOLUTION,
    })
  }
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const start = Date.now()
    const body = await req.json()
    const lat = Number(body?.lat)
    const lng = Number(body?.lng)

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return Response.json(
        { error: "Valid lat and lng are required" },
        { status: 400 }
      )
    }

    const db = getDb()
    const userPoint = sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`
    
    const territoryResult = await db.execute(sql`
      SELECT territory_id, name, city
      FROM territories
      WHERE boundary_polygon IS NOT NULL
        AND ST_Contains(boundary_polygon, ${userPoint})
      LIMIT 1
    `)
    const tCheckTime = Date.now() - start

    const rows = (territoryResult as any).rows || territoryResult
    const territoryRow = rows?.[0]

    if (!territoryRow || !territoryRow.territory_id) {
      return Response.json({
        discovered: false,
        reason: "outside_territory",
      })
    }

    const territoryId = String(territoryRow.territory_id)
    const h3Index = getExplorationCellIndex(lat, lng)

    const existingCell = await db.query.userExplorationCells.findFirst({
      where: and(
        eq(userExplorationCells.userId, session.user.id),
        eq(userExplorationCells.h3Index, h3Index)
      ),
    })
    const cellCheckTime = Date.now() - start

    let discoveredNow = false;
    if (!existingCell) {
      await db.insert(userExplorationCells).values({
        userId: session.user.id,
        territoryId,
        h3Index,
      })
      discoveredNow = true;
    }
    const insertCellTime = Date.now() - start

    const lastVisitAt = new Date()
    
    // Используем более простой способ обновления, чтобы избежать возможных проблем с Returning + SQL-фрагментами в драйвере
    let finalCount = 0;
    try {
      const stats = await db.query.userTerritoryStats.findFirst({
        where: and(
          eq(userTerritoryStats.userId, session.user.id),
          eq(userTerritoryStats.territoryId, territoryId)
        )
      })

      if (stats) {
        const newCount = discoveredNow ? stats.openedCellsCount + 1 : stats.openedCellsCount
        await db.update(userTerritoryStats)
          .set({ openedCellsCount: newCount, lastVisitAt })
          .where(and(
            eq(userTerritoryStats.userId, session.user.id),
            eq(userTerritoryStats.territoryId, territoryId)
          ))
        finalCount = newCount
      } else {
        const res = await db.insert(userTerritoryStats).values({
          userId: session.user.id,
          territoryId,
          openedCellsCount: 1,
          lastVisitAt,
        }).returning({ count: userTerritoryStats.openedCellsCount })
        finalCount = Number(res[0]?.count ?? 0)
      }
    } catch (statsError) {
      console.error("[MapExploration] Stats update failed:", statsError)
      // Не прерываем основной поток, если статистика временно недоступна
    }
    const statsUpdateTime = Date.now() - start

    if (process.env.NODE_ENV !== "production") {
      console.log(`[MapExploration] Latency: Territory=${tCheckTime}ms, Cell=${cellCheckTime}ms, InsertCell=${insertCellTime}ms, Stats=${statsUpdateTime}ms`)
    }

    return Response.json({
      discovered: true,
      discoveredNow,
      h3Index,
      territoryId,
      territoryName: String(territoryRow.name ?? ""),
      city: String(territoryRow.city ?? ""),
      openedCellsCount: finalCount,
      resolution: EXPLORATION_H3_RESOLUTION,
    })
  } catch (error) {
    console.error("[MapExploration] Critical error during cell discovery:", error)
    return Response.json(
      { error: "Failed to update exploration" },
      { status: 500 }
    )
  }
}
