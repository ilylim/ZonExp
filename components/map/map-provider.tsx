"use client"

import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from "react"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import type { GeoJsonFeatureCollection, TerritoryBoundary } from "@/lib/exploration"
import { getExplorationCellIndex } from "@/lib/exploration"

type MapViewMode = "full" | "header" | "hidden"

interface ExplorationCell {
  h3Index: string
  discoveredAt: string
}

interface TerritoryExploration {
  id: string
  name: string
  city: string
  boundary: TerritoryBoundary
  fog: GeoJsonFeatureCollection
}

interface ExplorationState {
  territories: TerritoryExploration[]
  cells: ExplorationCell[]
  fog: GeoJsonFeatureCollection
  resolution: number
}

interface MapContextType {
  map: maplibregl.Map | null
  setMap: (map: maplibregl.Map | null) => void
  viewMode: MapViewMode
  setViewMode: (mode: MapViewMode) => void
  flyTo: (center: [number, number], zoom?: number) => void
  exploration: ExplorationState | null
  refreshExploration: () => Promise<void>
  
  // Location states
  userLocation: [number, number] | null
  setUserLocation: (loc: [number, number] | null) => void
  locationAccuracy: number | null
  setLocationAccuracy: (acc: number | null) => void
  isSelectingLocation: boolean
  setIsSelectingLocation: (val: boolean) => void
  tempLocation: [number, number] | null
  setTempLocation: (loc: [number, number] | null) => void
  isGettingGPS: boolean
  setIsGettingGPS: (val: boolean) => void
  gpsError: string | null
  setGpsError: (err: string | null) => void
  handleGetGPS: () => void
}

const MapContext = createContext<MapContextType | undefined>(undefined)

export function MapProvider({ children }: { children: React.ReactNode }) {
  const [map, setMapInstance] = useState<maplibregl.Map | null>(null)
  const [viewMode, setViewMode] = useState<MapViewMode>("hidden")
  const [exploration, setExploration] = useState<ExplorationState | null>(null)
  const lastDiscoveredCellRef = useRef<string | null>(null)

  // Location states
  const [userLocation, setUserLocationState] = useState<[number, number] | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("user_location")
        return saved ? JSON.parse(saved) : null
      } catch {}
    }
    return null
  })
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("location_accuracy")
        return saved ? Number(saved) : null
      } catch {}
    }
    return null
  })
  const [isSelectingLocation, setIsSelectingLocation] = useState(false)
  const [tempLocation, setTempLocation] = useState<[number, number] | null>(null)
  const [isGettingGPS, setIsGettingGPS] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)

  // Initialize from localStorage (эффект удален, так как читаем синхронно при инициализации)

  const setUserLocation = useCallback((loc: [number, number] | null) => {
    setUserLocationState(loc)
    if (loc) {
      localStorage.setItem("user_location", JSON.stringify(loc))
    } else {
      localStorage.removeItem("user_location")
    }
  }, [])

  const handleGetGPS = useCallback(() => {
    setIsGettingGPS(true)
    setGpsError(null)
    if (!navigator.geolocation) {
      setGpsError("Геолокация недоступна")
      setIsGettingGPS(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords: [number, number] = [position.coords.longitude, position.coords.latitude]
        const accuracy = position.coords.accuracy
        setUserLocation(coords)
        setLocationAccuracy(accuracy)
        if (accuracy) {
          localStorage.setItem("location_accuracy", String(accuracy))
        }
        setIsGettingGPS(false)
        if (accuracy > 500) {
          setGpsError(`Низкая точность GPS (~${Math.round(accuracy)}м).`)
        }
      },
      (err) => {
        setGpsError("Ошибка получения GPS")
        setIsGettingGPS(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [setUserLocation])

  // Автоматический запрос локации при старте (если еще нет)
  useEffect(() => {
    if (userLocation === null && !isGettingGPS) {
      handleGetGPS()
    }
  }, [userLocation, isGettingGPS, handleGetGPS])

  const setMap = useCallback((instance: maplibregl.Map | null) => {
    setMapInstance(instance)
  }, [])

  const flyTo = useCallback((center: [number, number], zoom: number = 14) => {
    if (map) {
      map.flyTo({ center, zoom, duration: 2000 })
    }
  }, [map])

  const refreshExploration = useCallback(async () => {
    try {
      const res = await fetch("/api/map/exploration")
      if (!res.ok) return
      const data = await res.json()
      
      const territories = Array.isArray(data.territories) ? data.territories : []
      const combinedFog: GeoJsonFeatureCollection = {
        type: "FeatureCollection",
        features: territories.flatMap((t: TerritoryExploration) => t.fog.features),
      }

      setExploration({
        territories,
        cells: data.cells ?? [],
        fog: combinedFog,
        resolution: data.resolution ?? 9,
      })
    } catch (error) {
      console.error("[MapProvider] Failed to fetch exploration:", error)
    }
  }, [])

  // Первоначальная загрузка тумана
  useEffect(() => {
    refreshExploration()
  }, [refreshExploration])

  // Автоматическое открытие гексагонов при изменении локации
  useEffect(() => {
    if (!userLocation) return
    const currentCell = getExplorationCellIndex(userLocation[1], userLocation[0])
    if (lastDiscoveredCellRef.current === currentCell) return
    lastDiscoveredCellRef.current = currentCell

    const reveal = async () => {
      try {
        const res = await fetch("/api/map/exploration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: userLocation[1], lng: userLocation[0] }),
        })
        if (res.ok) refreshExploration()
      } catch (e) {
        console.error("Failed to reveal fog:", e)
      }
    }
    reveal()
  }, [userLocation, refreshExploration])

  return (
    <MapContext.Provider value={{ 
      map, 
      setMap, 
      viewMode, 
      setViewMode, 
      flyTo,
      exploration,
      refreshExploration,
      userLocation,
      setUserLocation,
      locationAccuracy,
      setLocationAccuracy,
      isSelectingLocation,
      setIsSelectingLocation,
      tempLocation,
      setTempLocation,
      isGettingGPS,
      setIsGettingGPS,
      gpsError,
      setGpsError,
      handleGetGPS
    }}>
      {children}
    </MapContext.Provider>
  )
}

export function useMap() {
  const context = useContext(MapContext)
  if (context === undefined) {
    throw new Error("useMap must be used within a MapProvider")
  }
  return context
}
