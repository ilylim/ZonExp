import { NextRequest, NextResponse } from "next/server"

// Маппинг OSM amenity/shop типов на иконки
const POI_MAPPING: Record<string, string> = {
  pharmacy: "pharmacy",
  supermarket: "supermarket",
  bar: "bar",
  pub: "bar",
  restaurant: "restaurant",
  cafe: "restaurant",
  hospital: "hospital",
  clinic: "hospital",
  library: "library",
  police: "library",
  fire_station: "library",
  blacksmith: "blacksmith",
  weapon: "blacksmith",
  bakery: "supermarket",
  butcher: "supermarket",
}

// Тестовые POI данные для Красноярска
const TEST_POI_FEATURES = [
  {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [92.87, 56.01],
    },
    properties: {
      id: "test_1",
      amenity: "pharmacy",
      icon_type: "pharmacy",
      name: "Аптека",
    },
  },
  {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [92.86, 56.015],
    },
    properties: {
      id: "test_2",
      amenity: "supermarket",
      icon_type: "supermarket",
      name: "Супермаркет",
    },
  },
  {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [92.88, 56.008],
    },
    properties: {
      id: "test_3",
      amenity: "restaurant",
      icon_type: "restaurant",
      name: "Ресторан",
    },
  },
  {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [92.89, 56.02],
    },
    properties: {
      id: "test_4",
      amenity: "bar",
      icon_type: "bar",
      name: "Бар",
    },
  },
  {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [92.85, 56.005],
    },
    properties: {
      id: "test_5",
      amenity: "hospital",
      icon_type: "hospital",
      name: "Больница",
    },
  },
  {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [92.91, 56.015],
    },
    properties: {
      id: "test_6",
      amenity: "library",
      icon_type: "library",
      name: "Библиотека",
    },
  },
  {
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [92.84, 56.018],
    },
    properties: {
      id: "test_7",
      amenity: "blacksmith",
      icon_type: "blacksmith",
      name: "Кузница",
    },
  },
]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const bbox = searchParams.get("bbox")

  if (!bbox) {
    return NextResponse.json(
      { error: "bbox parameter required" },
      { status: 400 }
    )
  }

  try {
    const [minLng, minLat, maxLng, maxLat] = bbox.split(",").map(Number)

    // Фильтруем тестовые POI которые находятся в bbox
    const features = TEST_POI_FEATURES.filter((feature) => {
      const [lng, lat] = feature.geometry.coordinates
      return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat
    })

    return NextResponse.json({
      type: "FeatureCollection",
      features: features,
    })
  } catch (error) {
    console.error("[POI API] Error:", error)
    return NextResponse.json({
      type: "FeatureCollection",
      features: [],
    })
  }
}
