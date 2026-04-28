import { cellToBoundary, latLngToCell, polygonToCells } from "h3-js"

export const EXPLORATION_H3_RESOLUTION = 9

type Position = [number, number]

type PolygonGeometry = {
  type: "Polygon"
  coordinates: Position[][]
}

type MultiPolygonGeometry = {
  type: "MultiPolygon"
  coordinates: Position[][][]
}

export type TerritoryBoundary = PolygonGeometry | MultiPolygonGeometry

type GeoJsonFeature = {
  type: "Feature"
  properties: Record<string, unknown>
  geometry: {
    type: "Polygon"
    coordinates: Position[][]
  }
}

export type GeoJsonFeatureCollection = {
  type: "FeatureCollection"
  features: GeoJsonFeature[]
}

function getPolygonCellIndexes(polygon: Position[][]): string[] {
  return polygonToCells(polygon as unknown as number[][][], EXPLORATION_H3_RESOLUTION, true)
}

export function getTerritoryCellIndexes(boundary: TerritoryBoundary): string[] {
  if (boundary.type === "Polygon") {
    return getPolygonCellIndexes(boundary.coordinates)
  }

  const uniqueIndexes = new Set<string>()

  for (const polygon of boundary.coordinates) {
    for (const cellIndex of getPolygonCellIndexes(polygon)) {
      uniqueIndexes.add(cellIndex)
    }
  }

  return Array.from(uniqueIndexes)
}

export function buildCellFeatureCollection(cellIndexes: string[]): GeoJsonFeatureCollection {
  return {
    type: "FeatureCollection",
    features: cellIndexes.map((cellIndex) => ({
      type: "Feature",
      properties: { cellIndex },
      geometry: {
        type: "Polygon",
        coordinates: [cellToBoundary(cellIndex, true) as Position[]],
      },
    })),
  }
}

export function buildFogFeatureCollection(
  boundary: TerritoryBoundary,
  discoveredCellIndexes: string[]
): GeoJsonFeatureCollection {
  const discoveredSet = new Set(discoveredCellIndexes)
  const fogCellIndexes = getTerritoryCellIndexes(boundary).filter(
    (cellIndex) => !discoveredSet.has(cellIndex)
  )

  return buildCellFeatureCollection(fogCellIndexes)
}

export function getExplorationCellIndex(lat: number, lng: number): string {
  return latLngToCell(lat, lng, EXPLORATION_H3_RESOLUTION)
}
