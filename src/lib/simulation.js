export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const degToRad = (degrees) => (degrees * Math.PI) / 180;
export const radToDeg = (radians) => (radians * 180) / Math.PI;
export const norm360 = (degrees) => ((degrees % 360) + 360) % 360;
export const shortestDelta = (from, to) => ((norm360(to) - norm360(from) + 540) % 360) - 180;
export const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

export const DEFAULTS = {
  distanceKm: 5.32,
  targetBearing: 206,
  forwardBearing: 188,
  antennaDirection: 206,
  beamSpread: 120,
  wallBounces: 2,
  widthUnits: 68,
  depthUnits: 22,
  antenna: { x: 34, y: 11 },
  surfaces: { top: "reflect", right: "reflect", bottom: "reflect", left: "reflect" },
};

export const COMPASS_MARKERS = [
  { label: "North", key: "forwardBearing", color: "bg-zinc-900", description: "Rotates dial to true north." },
  { label: "Target", key: "targetBearing", color: "bg-[#bf8d8c]", description: "Sets signal exit bearing." },
  { label: "Antenna", key: "antennaDirection", color: "bg-blue-600", description: "Points antenna indoors." },
];

export const MAP_TIPS = [
  {
    label: "Drag controls",
    icon: "move",
    tone: "text-[#bf8d8c]",
    text: "Drag center blue dot to move antenna. Drag outer blue dot to change direction.",
  },
  {
    label: "Wall behavior",
    icon: "waves",
    tone: "text-zinc-500",
    text: "Open edges let the signal leave the building. Closed edges reflect it.",
  },
];

export function getResetMapState(currentState) {
  return {
    ...currentState,
    antennaDirection: DEFAULTS.antennaDirection,
    beamSpread: DEFAULTS.beamSpread,
    wallBounces: DEFAULTS.wallBounces,
    widthUnits: DEFAULTS.widthUnits,
    depthUnits: DEFAULTS.depthUnits,
    antenna: DEFAULTS.antenna,
    surfaces: DEFAULTS.surfaces,
  };
}

export function traceRay({
  origin,
  bearingLocalDeg,
  width,
  depth,
  maxReflections,
  escapeDistanceUnits,
  forwardBearingDeg,
  surfaces,
}) {
  let x = clamp(origin.x, 0.1, width - 0.1);
  let y = clamp(origin.y, 0.1, depth - 0.1);
  let dx = Math.sin(degToRad(norm360(bearingLocalDeg)));
  let dy = -Math.cos(degToRad(norm360(bearingLocalDeg)));
  let reflectionsUsed = 0;
  let exitedVia = null;
  let didExit = false;
  const points = [{ x, y }];

  for (let step = 0; step < 48; step += 1) {
    const hits = [
      { wall: "left", t: dx < 0 ? (0 - x) / dx : Number.POSITIVE_INFINITY },
      { wall: "right", t: dx > 0 ? (width - x) / dx : Number.POSITIVE_INFINITY },
      { wall: "top", t: dy < 0 ? (0 - y) / dy : Number.POSITIVE_INFINITY },
      { wall: "bottom", t: dy > 0 ? (depth - y) / dy : Number.POSITIVE_INFINITY },
    ].filter((hit) => hit.t > 1e-4);

    const hit = hits.length ? hits.reduce((best, candidate) => (candidate.t < best.t ? candidate : best)) : null;

    if (!hit) {
      points.push({ x: x + dx * escapeDistanceUnits, y: y + dy * escapeDistanceUnits });
      didExit = true;
      break;
    }

    x += dx * hit.t;
    y += dy * hit.t;
    points.push({ x, y });

    if (surfaces[hit.wall] === "pass" || reflectionsUsed >= maxReflections) {
      points.push({ x: x + dx * escapeDistanceUnits, y: y + dy * escapeDistanceUnits });
      exitedVia = hit.wall;
      didExit = true;
      break;
    }

    reflectionsUsed += 1;
    if (hit.wall === "left" || hit.wall === "right") {
      dx = -dx;
    } else {
      dy = -dy;
    }
  }

  const pathDistanceUnits = points.reduce(
    (accumulator, point, index, allPoints) => accumulator + (index ? distance(allPoints[index - 1], point) : 0),
    0,
  );
  const finalLocalBearing = norm360(radToDeg(Math.atan2(dx, -dy)));

  return {
    points,
    finalTrueBearing: norm360(finalLocalBearing + forwardBearingDeg),
    pathDistanceUnits,
    exitedVia,
    reflectionsUsed,
    didExit,
  };
}
