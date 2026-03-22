export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const degToRad = (degrees) => (degrees * Math.PI) / 180;
export const radToDeg = (radians) => (radians * 180) / Math.PI;
export const norm360 = (degrees) => ((degrees % 360) + 360) % 360;
export const shortestDelta = (from, to) => ((norm360(to) - norm360(from) + 540) % 360) - 180;
export const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
export const smoothstep = (edge0, edge1, value) => {
  if (edge0 === edge1) {
    return value >= edge1 ? 1 : 0;
  }

  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const DEFAULTS = {
  gyroMode: "north",
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
    text: "Drag center blue dot to move antenna. Drag outer blue dot unless gyro is steering it.",
  },
  {
    label: "Wall behavior",
    icon: "waves",
    tone: "text-zinc-500",
    text: "Open edges let the signal leave the building. Closed edges reflect it.",
  },
];

export function createDefaultSimulationState() {
  return {
    ...DEFAULTS,
    antenna: { ...DEFAULTS.antenna },
    surfaces: { ...DEFAULTS.surfaces },
  };
}

export function getResetMapState(currentState) {
  const defaults = createDefaultSimulationState();

  return {
    ...currentState,
    gyroMode: defaults.gyroMode,
    antennaDirection: defaults.antennaDirection,
    beamSpread: defaults.beamSpread,
    wallBounces: defaults.wallBounces,
    widthUnits: defaults.widthUnits,
    depthUnits: defaults.depthUnits,
    antenna: defaults.antenna,
    surfaces: defaults.surfaces,
  };
}

export function getResetCompassState(currentState) {
  const defaults = createDefaultSimulationState();

  return {
    ...currentState,
    gyroMode: defaults.gyroMode,
    distanceKm: defaults.distanceKm,
    targetBearing: defaults.targetBearing,
    forwardBearing: defaults.forwardBearing,
    antennaDirection: defaults.antennaDirection,
  };
}

export function getSimulationTelemetry(sim) {
  const {
    antenna,
    antennaDirection,
    beamSpread,
    depthUnits,
    distanceKm,
    forwardBearing,
    surfaces,
    targetBearing,
    wallBounces,
    widthUnits,
  } = sim;

  const localAntennaDirection = norm360(antennaDirection - forwardBearing);
  const escapeDistance = Math.max(500, Math.min(distanceKm * 1000, 20000));
  const sharedParams = {
    origin: antenna,
    width: widthUnits,
    depth: depthUnits,
    maxReflections: wallBounces,
    escapeDistanceUnits: escapeDistance,
    forwardBearingDeg: forwardBearing,
    surfaces,
  };

  const main = traceRay({ ...sharedParams, bearingLocalDeg: localAntennaDirection });
  const left = traceRay({ ...sharedParams, bearingLocalDeg: localAntennaDirection - beamSpread / 2 });
  const right = traceRay({ ...sharedParams, bearingLocalDeg: localAntennaDirection + beamSpread / 2 });
  const signedAlignmentError = main.didExit ? shortestDelta(main.finalTrueBearing, targetBearing) : null;
  const alignmentError = signedAlignmentError === null ? null : Math.abs(signedAlignmentError);
  const alignment = getAlignmentProfile({
    beamSpread,
    didExit: main.didExit,
    signedError: signedAlignmentError,
  });
  const guideRays = alignment.visualGuideOffsets.map((offsetDeg) => (
    traceRay({ ...sharedParams, bearingLocalDeg: localAntennaDirection + offsetDeg })
  ));

  return {
    escapeDistance,
    localAntennaDirection,
    rays: { main, left, right, guide: guideRays },
    alignmentError,
    alignment,
    isAligned: alignment.state === "locked",
  };
}

export function getAlignmentProfile({ beamSpread, didExit, signedError }) {
  const halfSpread = Math.max(beamSpread / 2, 1);
  const lockThreshold = Math.max(2, Math.min(8, halfSpread * 0.18));
  const featherThreshold = halfSpread + Math.max(4, halfSpread * 0.35);

  if (!didExit || signedError === null || !Number.isFinite(signedError)) {
    return {
      state: "blocked",
      label: "No exit",
      score: 0,
      coneScore: 0,
      approachScore: 0,
      centerBias: 0,
      halfSpread,
      lockThreshold,
      featherThreshold,
      signedError: null,
      error: null,
      visualGuideOffsets: [],
      focusSpread: halfSpread,
    };
  }

  const error = Math.abs(signedError);
  const coneScore = 1 - smoothstep(lockThreshold, halfSpread, error);
  const approachScore = 1 - smoothstep(halfSpread, featherThreshold, error);
  const centerBias = 1 - smoothstep(0, lockThreshold, error);
  const score = clamp(coneScore * 0.75 + approachScore * 0.25, 0, 1);
  const focusSpread = Math.max(lockThreshold, halfSpread * (0.92 - score * 0.56));
  const guideRayCount = score >= 0.92 ? 4 : score >= 0.7 ? 3 : score >= 0.4 ? 2 : score > 0.12 ? 1 : 0;
  const visualGuideOffsets =
    guideRayCount === 0
      ? []
      : Array.from({ length: guideRayCount }, (_, index) => {
          const position = guideRayCount === 1 ? 0.5 : index / (guideRayCount - 1);
          return (position - 0.5) * 2 * focusSpread;
        }).filter((offsetDeg) => Math.abs(offsetDeg) > 0.01);

  let state = "missed";
  let label = "Outside cone";

  if (error <= lockThreshold) {
    state = "locked";
    label = "Locked";
  } else if (error <= halfSpread) {
    state = "converging";
    label = "Inside cone";
  } else if (error <= featherThreshold) {
    state = "fringe";
    label = "Entering cone";
  }

  return {
    state,
    label,
    score,
    coneScore,
    approachScore,
    centerBias,
    halfSpread,
    lockThreshold,
    featherThreshold,
    signedError,
    error,
    visualGuideOffsets,
    focusSpread,
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
