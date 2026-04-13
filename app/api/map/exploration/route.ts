import { and, eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { getDb } from "@/db"
import { territories, userExplorationCells } from "@/db/schema"

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
    .limit(1)

  const territory = territoryRows[0]
  if (!territory) {
    return Response.json({ territory: null, cells: [] })
  }

  let cells: { h3Index: string; discoveredAt: string }[] = []
  if (session?.user?.id) {
    cells = await db
      .select({
        h3Index: userExplorationCells.h3Index,
        discoveredAt: userExplorationCells.discoveredAt,
      })
      .from(userExplorationCells)
      .where(
        and(
          eq(userExplorationCells.userId, session.user.id),
          eq(userExplorationCells.territoryId, territory.territoryId)
        )
      )
  }

  return Response.json({
    territory: {
      id: territory.territoryId,
      name: territory.name,
      city: territory.city,
      boundary: territory.boundaryGeojson,
    },
    cells,
  })
  } catch {
    return Response.json({ territory: null, cells: [] })
  }
}
