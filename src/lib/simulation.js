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

const ALIGNMENT_LOCK_THRESHOLD_DEG = 2;
const ALIGNMENT_FEATHER_RATIO = 0.35;
const ALIGNMENT_CONE_WEIGHT = 0.75;
const ALIGNMENT_APPROACH_WEIGHT = 0.25;
const ALIGNMENT_FOCUS_BASE = 0.92;
const ALIGNMENT_FOCUS_SCORE_MULTIPLIER = 0.56;
const BEAM_SAMPLE_MIN = 7;
const BEAM_SAMPLE_MAX = 17;
const ALIGNMENT_GUIDE_PATTERNS = [
  { minScore: 0.92, pattern: [-0.85, -0.35, 0.35, 0.85] },
  { minScore: 0.7, pattern: [-0.75, 0, 0.75] },
  { minScore: 0.4, pattern: [-0.55, 0.55] },
  { minScore: 0.12, pattern: [-0.35, 0.35] },
];

const ALIGNMENT_PALETTES = {
  locked: {
    stroke: "#16a34a",
    glow: "rgba(22,163,74,0.18)",
    edge: "#86efac",
    fill: "rgba(22,163,74,0.14)",
    guide: "rgba(22,163,74,0.36)",
    badgeClassName: "bg-emerald-100 text-emerald-800",
    panelClassName: "border-emerald-200 bg-emerald-50",
    textClassName: "text-emerald-900",
    subtextClassName: "text-emerald-700",
  },
  converging: {
    stroke: "#0891b2",
    glow: "rgba(8,145,178,0.18)",
    edge: "#67e8f9",
    fill: "rgba(8,145,178,0.12)",
    guide: "rgba(8,145,178,0.3)",
    badgeClassName: "bg-cyan-100 text-cyan-800",
    panelClassName: "border-cyan-200 bg-cyan-50",
    textClassName: "text-cyan-900",
    subtextClassName: "text-cyan-700",
  },
  fringe: {
    stroke: "#d97706",
    glow: "rgba(217,119,6,0.18)",
    edge: "#fdba74",
    fill: "rgba(217,119,6,0.11)",
    guide: "rgba(217,119,6,0.24)",
    badgeClassName: "bg-amber-100 text-amber-800",
    panelClassName: "border-amber-200 bg-amber-50",
    textClassName: "text-amber-900",
    subtextClassName: "text-amber-700",
  },
  default: {
    stroke: "#2563eb",
    glow: "rgba(37,99,235,0.16)",
    edge: "#93c5fd",
    fill: "rgba(37,99,235,0.08)",
    guide: "rgba(37,99,235,0.18)",
    badgeClassName: "bg-zinc-100 text-zinc-700",
    panelClassName: "border-zinc-200 bg-white",
    textClassName: "text-zinc-900",
    subtextClassName: "text-zinc-500",
  },
};

const EARTH_RADIUS_M = 6371000;

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

export function getAlignmentPalette(state) {
  return ALIGNMENT_PALETTES[state] ?? ALIGNMENT_PALETTES.default;
}

function roundCoordinate(value, digits = 6) {
  return Number(value.toFixed(digits));
}

function splitCsvRow(row) {
  return row.split(",").map((cell) => cell.trim());
}

function parseNumericCell(value) {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  const directParse = Number(trimmed);
  if (Number.isFinite(directParse)) {
    return directParse;
  }

  const match = trimmed.match(/[-+]?\d*\.?\d+/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function isHeaderLine(line) {
  return /SeqNo/i.test(line) && /Latitude/i.test(line) && /Longitude/i.test(line);
}

function isDividerLine(line) {
  return /^[-—–]{2,}$/.test(line);
}

function createImportedNodeId({ seqNo, latitude, longitude, rowIndex }) {
  const normalizedSeq = String(seqNo || rowIndex).replace(/\s+/g, "-").toLowerCase();
  return `node-${normalizedSeq}-${latitude.toFixed(6)}-${longitude.toFixed(6)}`;
}

function buildImportedNode(row, rowIndex) {
  const latitude = parseNumericCell(row.Latitude ?? "");
  const longitude = parseNumericCell(row.Longitude ?? "");

  if (
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 ||
    longitude < -180 || longitude > 180
  ) {
    return null;
  }

  const seqNo = (row.SeqNo ?? String(rowIndex + 1)).trim();
  const roundedLatitude = roundCoordinate(latitude);
  const roundedLongitude = roundCoordinate(longitude);

  return {
    id: createImportedNodeId({ seqNo, latitude: roundedLatitude, longitude: roundedLongitude, rowIndex }),
    name: `Node ${seqNo || rowIndex + 1}`,
    seqNo,
    latitude: roundedLatitude,
    longitude: roundedLongitude,
    altitude: parseNumericCell(row.Altitude ?? ""),
    sats: parseNumericCell(row.Sats ?? ""),
    speed: parseNumericCell(row.Speed ?? ""),
    heading: parseNumericCell(row.Heading ?? ""),
    snr: parseNumericCell(row.SNR ?? ""),
    timestamp: (row.Timestamp ?? "Unknown Age").trim() || "Unknown Age",
    source: "log import",
  };
}

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

export function normalizeGeoLocation(location) {
  if (!location) {
    return null;
  }

  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);

  if (
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 ||
    longitude < -180 || longitude > 180
  ) {
    return null;
  }

  return {
    latitude: roundCoordinate(latitude),
    longitude: roundCoordinate(longitude),
    accuracy: Number.isFinite(Number(location.accuracy)) ? Number(location.accuracy) : null,
    source: location.source ?? "manual",
    label: location.label ?? "Reference location",
  };
}

export function extractNodeLogs(text) {
  if (!text) {
    return [];
  }

  const rawLines = text.split(/\r?\n/).map((line) => line.trim());
  const nodes = [];
  let activeHeaders = null;

  rawLines.forEach((line) => {
    if (!line || isDividerLine(line)) {
      return;
    }

    if (isHeaderLine(line)) {
      activeHeaders = splitCsvRow(line);
      return;
    }

    if (!activeHeaders) {
      return;
    }

    const values = splitCsvRow(line);
    const row = Object.fromEntries(activeHeaders.map((header, cellIndex) => [header, values[cellIndex] ?? ""]));
    const node = buildImportedNode(row, nodes.length);

    if (node) {
      nodes.push(node);
    }
  });

  return nodes;
}

export function getGeoMetrics(referenceLocation, nodeLocation) {
  const reference = normalizeGeoLocation(referenceLocation);
  const node = normalizeGeoLocation(nodeLocation);

  if (!reference || !node) {
    return null;
  }

  const lat1 = degToRad(reference.latitude);
  const lat2 = degToRad(node.latitude);
  const deltaLat = degToRad(node.latitude - reference.latitude);
  const deltaLon = degToRad(node.longitude - reference.longitude);

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  const distanceMeters = 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);
  const bearing = norm360(radToDeg(Math.atan2(y, x)));

  return {
    distanceMeters,
    distanceKm: distanceMeters / 1000,
    bearing,
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
  const sampledBeam = sampleBeamRays({
    ...sharedParams,
    beamSpread,
    bearingLocalDeg: localAntennaDirection,
  });
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
    rays: {
      main,
      left,
      right,
      guide: guideRays,
      beam: {
        samples: sampledBeam,
        exitedCount: sampledBeam.filter((sample) => sample.result.didExit).length,
      },
    },
    alignmentError,
    alignment,
    isAligned: main.didExit && alignmentError !== null && alignmentError <= ALIGNMENT_LOCK_THRESHOLD_DEG,
  };
}

export function getAlignmentProfile({ beamSpread, didExit, signedError }) {
  const halfSpread = Math.max(beamSpread / 2, 1);
  const lockThreshold = ALIGNMENT_LOCK_THRESHOLD_DEG;
  const featherThreshold = halfSpread + Math.max(4, halfSpread * ALIGNMENT_FEATHER_RATIO);

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
  const score = clamp(coneScore * ALIGNMENT_CONE_WEIGHT + approachScore * ALIGNMENT_APPROACH_WEIGHT, 0, 1);
  const focusSpread = Math.max(lockThreshold, halfSpread * (ALIGNMENT_FOCUS_BASE - score * ALIGNMENT_FOCUS_SCORE_MULTIPLIER));
  const guidePattern = ALIGNMENT_GUIDE_PATTERNS.find(({ minScore }) => score >= minScore)?.pattern ?? [];
  const visualGuideOffsets = guidePattern.map((position) => position * focusSpread);

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

export function getBeamSampleCount(beamSpread) {
  return clamp(Math.round(beamSpread / 12) * 2 + 1, BEAM_SAMPLE_MIN, BEAM_SAMPLE_MAX);
}

export function getBeamSampleOffsets(beamSpread) {
  const sampleCount = getBeamSampleCount(beamSpread);
  const halfSpread = beamSpread / 2;

  if (sampleCount === 1) {
    return [0];
  }

  return Array.from({ length: sampleCount }, (_, index) => {
    const ratio = index / (sampleCount - 1);
    return -halfSpread + ratio * beamSpread;
  });
}

function sampleBeamRays({
  origin,
  bearingLocalDeg,
  width,
  depth,
  maxReflections,
  escapeDistanceUnits,
  forwardBearingDeg,
  surfaces,
  beamSpread,
}) {
  return getBeamSampleOffsets(beamSpread).map((offsetDeg, index, allOffsets) => ({
    offsetDeg,
    ratio: allOffsets.length === 1 ? 0.5 : index / (allOffsets.length - 1),
    result: traceRay({
      origin,
      bearingLocalDeg: bearingLocalDeg + offsetDeg,
      width,
      depth,
      maxReflections,
      escapeDistanceUnits,
      forwardBearingDeg,
      surfaces,
    }),
  }));
}
