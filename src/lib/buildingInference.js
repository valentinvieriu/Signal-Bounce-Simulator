import { clamp, norm360 } from "./simulation";

const EARTH_RADIUS_M = 6371000;
const DEFAULT_RADIUS_METERS = 140;
const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function projectToLocalMeters(point, origin) {
  const lat0 = toRadians(origin.latitude);
  const dLat = toRadians(point.latitude - origin.latitude);
  const dLon = toRadians(point.longitude - origin.longitude);

  return {
    x: EARTH_RADIUS_M * dLon * Math.cos(lat0),
    y: EARTH_RADIUS_M * dLat,
  };
}

function normalizePoint(point) {
  const longitude = Number(point.lon ?? point.longitude);
  const latitude = Number(point.lat ?? point.latitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

function getBoundingBox(points) {
  return points.reduce((acc, point) => ({
    minX: Math.min(acc.minX, point.x),
    maxX: Math.max(acc.maxX, point.x),
    minY: Math.min(acc.minY, point.y),
    maxY: Math.max(acc.maxY, point.y),
  }), {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  });
}

function getCentroid(points) {
  const total = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return {
    x: total.x / points.length,
    y: total.y / points.length,
  };
}

function getFarthestPair(points) {
  let bestDistanceSq = -1;
  let pair = null;

  for (let i = 0; i < points.length - 1; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const dx = points[j].x - points[i].x;
      const dy = points[j].y - points[i].y;
      const distanceSq = dx * dx + dy * dy;

      if (distanceSq > bestDistanceSq) {
        bestDistanceSq = distanceSq;
        pair = [points[i], points[j]];
      }
    }
  }

  return pair;
}

function getBuildingMetrics(localPoints) {
  const bbox = getBoundingBox(localPoints);
  const widthMeters = Math.max(4, bbox.maxX - bbox.minX);
  const depthMeters = Math.max(4, bbox.maxY - bbox.minY);

  const farthestPair = getFarthestPair(localPoints);
  const inferredForwardBearing = farthestPair
    ? norm360((Math.atan2(farthestPair[1].x - farthestPair[0].x, farthestPair[1].y - farthestPair[0].y) * 180) / Math.PI)
    : 0;

  return {
    widthMeters,
    depthMeters,
    inferredForwardBearing,
    centroid: getCentroid(localPoints),
  };
}

function toOverpassQuery(latitude, longitude, radiusMeters) {
  return `
[out:json][timeout:25];
(
  way["building"](around:${radiusMeters},${latitude},${longitude});
  relation["building"](around:${radiusMeters},${latitude},${longitude});
);
out geom tags;
`.trim();
}

export async function fetchNearbyBuildings({ latitude, longitude, radiusMeters = DEFAULT_RADIUS_METERS, signal }) {
  const response = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: new URLSearchParams({ data: toOverpassQuery(latitude, longitude, radiusMeters) }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Building lookup failed (${response.status})`);
  }

  const payload = await response.json();
  const buildings = (payload.elements ?? [])
    .map((element) => {
      const footprint = (element.geometry ?? []).map(normalizePoint).filter(Boolean);
      if (footprint.length < 3) {
        return null;
      }

      return {
        id: `${element.type}-${element.id}`,
        levels: Number(element.tags?.["building:levels"] ?? null),
        footprint,
      };
    })
    .filter(Boolean);

  return buildings;
}

export function inferSimulationFromBuildings({ latitude, longitude, buildings, currentSim }) {
  const origin = { latitude, longitude };

  const candidates = buildings
    .map((building) => {
      const localPoints = building.footprint.map((point) => projectToLocalMeters(point, origin));
      const metrics = getBuildingMetrics(localPoints);

      return {
        ...building,
        localPoints,
        metrics,
        centroidDistance: Math.hypot(metrics.centroid.x, metrics.centroid.y),
      };
    })
    .filter((building) => Number.isFinite(building.centroidDistance));

  if (!candidates.length) {
    return null;
  }

  const nearest = candidates.reduce((best, current) => (
    current.centroidDistance < best.centroidDistance ? current : best
  ));

  const widthUnits = clamp(Number(nearest.metrics.widthMeters.toFixed(1)), 10, 500);
  const depthUnits = clamp(Number(nearest.metrics.depthMeters.toFixed(1)), 10, 500);

  return {
    inferredSim: {
      ...currentSim,
      widthUnits,
      depthUnits,
      antenna: {
        x: clamp(widthUnits / 2, 0.1, widthUnits - 0.1),
        y: clamp(depthUnits / 2, 0.1, depthUnits - 0.1),
      },
      forwardBearing: Math.round(nearest.metrics.inferredForwardBearing),
      surfaces: {
        top: "concrete",
        right: "concrete",
        bottom: "concrete",
        left: "concrete",
      },
    },
    metadata: {
      source: "OpenStreetMap / Overpass",
      buildingId: nearest.id,
      levels: Number.isFinite(nearest.levels) ? nearest.levels : null,
      radiusMeters: DEFAULT_RADIUS_METERS,
      sampledBuildings: candidates.length,
      centroidDistanceMeters: Number(nearest.centroidDistance.toFixed(1)),
    },
  };
}
