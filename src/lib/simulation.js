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
const ALIGNMENT_GUIDE_PATTERNS = [
  { minScore: 0.92, pattern: [-0.85, -0.35, 0.35, 0.85] },
  { minScore: 0.7, pattern: [-0.75, 0, 0.75] },
  { minScore: 0.4, pattern: [-0.55, 0.55] },
  { minScore: 0.12, pattern: [-0.35, 0.35] },
];

const ALIGNMENT_PALETTES = {
  locked: {
    stroke: "#16a34a",
    main: "#16a34a",
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
    main: "#0891b2",
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
    main: "#d97706",
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
    main: "#2563eb",
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

// LoRa 868 MHz RF parameters
export const LORA = {
  frequencyMHz: 868,
  txPowerDbm: 14,
  sensitivityDbm: -137, // SF12 worst-case
  fsplRefDb: 20 * Math.log10(868) + 20 * Math.log10(1) - 27.55, // FSPL at 1 m ≈ 31.3 dB
};

// Wall material RF properties at ~868 MHz (dB values from ITU-R P.1238 / measured studies)
export const WALL_MATERIALS = {
  open:     { label: "Open",     penDb: 0,  refDb: 0,   color: "#f59e0b", dash: "10 8" },
  glass:    { label: "Glass",    penDb: 2,  refDb: 8,   color: "#38bdf8", dash: null },
  drywall:  { label: "Drywall",  penDb: 4,  refDb: 5,   color: "#a3a3a3", dash: null },
  brick:    { label: "Brick",    penDb: 9,  refDb: 4,   color: "#b45309", dash: null },
  concrete: { label: "Concrete", penDb: 14, refDb: 3,   color: "#525252", dash: null },
  metal:    { label: "Metal",    penDb: 30, refDb: 0.5, color: "#27272a", dash: null },
};

export const MATERIAL_KEYS = Object.keys(WALL_MATERIALS);

export const EIRP_LIMIT_DBM = 14; // EU ETSI EN 300 220 limit for 868 MHz

export const DEFAULTS = {
  gyroMode: "north",
  distanceKm: 5.32,
  targetBearing: 206,
  forwardBearing: 188,
  antennaDirection: 206,
  beamSpread: 120,
  antennaGainDbi: 5.5, // Moxon rectangle default
  wallBounces: 4,
  widthUnits: 68,
  depthUnits: 22,
  antenna: { x: 34, y: 11 },
  surfaces: { top: "brick", right: "brick", bottom: "brick", left: "brick" },
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
    label: "Wall materials",
    icon: "waves",
    tone: "text-zinc-500",
    text: "Each wall material has different penetration and reflection loss. Open walls let signal pass freely. Concrete and metal are near-opaque.",
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
    antennaGainDbi: defaults.antennaGainDbi,
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
    antennaGainDbi = 0,
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
    antennaGainDbi,
  };

  const main = traceRay({ ...sharedParams, bearingLocalDeg: localAntennaDirection });
  const left = traceRay({ ...sharedParams, bearingLocalDeg: localAntennaDirection - beamSpread / 2 });
  const right = traceRay({ ...sharedParams, bearingLocalDeg: localAntennaDirection + beamSpread / 2 });

  const bestExit = findBestExitOpportunity(main.exitOpportunities, targetBearing, antennaGainDbi);
  const signedAlignmentError = bestExit ? shortestDelta(bestExit.exitBearing, targetBearing) : null;
  const alignmentError = signedAlignmentError === null ? null : Math.abs(signedAlignmentError);
  const alignment = getAlignmentProfile({
    beamSpread,
    didExit: bestExit !== null,
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
    bestExit,
    isAligned: bestExit !== null && alignmentError !== null && alignmentError <= ALIGNMENT_LOCK_THRESHOLD_DEG,
  };
}

function findBestExitOpportunity(exitOpportunities, targetBearing, antennaGainDbi = 0) {
  const effectiveSensitivity = LORA.sensitivityDbm - antennaGainDbi;
  const eirpDbm = Math.min(LORA.txPowerDbm + antennaGainDbi, EIRP_LIMIT_DBM);
  let best = null;

  for (const opp of exitOpportunities) {
    if (opp.powerDbm < effectiveSensitivity) continue;

    const alignmentError = Math.abs(shortestDelta(opp.bearing, targetBearing));
    const powerRange = eirpDbm - effectiveSensitivity;
    const powerScore = clamp((opp.powerDbm - effectiveSensitivity) / powerRange, 0, 1);
    const alignmentScore = 1 - alignmentError / 180;
    // How well does the exit wall face the target?
    const wallFacingError = Math.abs(shortestDelta(opp.wallNormalBearing ?? opp.bearing, targetBearing));
    const wallFacingScore = 1 - wallFacingError / 180;
    // Power (50%), ray-target alignment (30%), wall-faces-target (20%)
    const score = 0.5 * powerScore + 0.3 * alignmentScore + 0.2 * wallFacingScore;

    if (!best || score > best.score) {
      best = {
        bounceIndex: opp.bounceIndex,
        wall: opp.wall,
        material: opp.material,
        exitBearing: opp.bearing,
        alignmentError,
        powerDbm: opp.powerDbm,
        pathMeters: opp.pathMeters,
        score,
      };
    }
  }

  return best;
}

export function findBestBearing(sim) {
  const {
    antenna,
    antennaGainDbi = 0,
    depthUnits,
    distanceKm,
    forwardBearing,
    surfaces,
    targetBearing,
    wallBounces,
    widthUnits,
  } = sim;

  const escapeDistance = Math.max(500, Math.min(distanceKm * 1000, 20000));
  const sharedParams = {
    origin: antenna,
    width: widthUnits,
    depth: depthUnits,
    maxReflections: wallBounces,
    escapeDistanceUnits: escapeDistance,
    forwardBearingDeg: forwardBearing,
    surfaces,
    antennaGainDbi,
  };

  let best = null;

  for (let bearing = 0; bearing < 360; bearing++) {
    const localDir = norm360(bearing - forwardBearing);
    const result = traceRay({ ...sharedParams, bearingLocalDeg: localDir });
    const scored = findBestExitOpportunity(result.exitOpportunities, targetBearing, antennaGainDbi);
    if (scored && (!best || scored.score > best.score)) {
      best = { antennaBearing: bearing, ...scored };
    }
  }

  return best;
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

function fsplDb(distanceMeters) {
  if (distanceMeters <= 0) return 0;
  return LORA.fsplRefDb + 20 * Math.log10(distanceMeters);
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
  antennaGainDbi = 0,
}) {
  // EIRP = TX + gain, capped at regulatory limit; RX sensitivity improved by gain
  const eirpDbm = Math.min(LORA.txPowerDbm + antennaGainDbi, EIRP_LIMIT_DBM);
  const effectiveSensitivity = LORA.sensitivityDbm - antennaGainDbi;

  let x = clamp(origin.x, 0.1, width - 0.1);
  let y = clamp(origin.y, 0.1, depth - 0.1);
  let dx = Math.sin(degToRad(norm360(bearingLocalDeg)));
  let dy = -Math.cos(degToRad(norm360(bearingLocalDeg)));
  let reflectionsUsed = 0;
  let exitedVia = null;
  let didExit = false;
  let pathMeters = 0;
  let accumulatedRefLossDb = 0;
  let powerDbm = eirpDbm;
  const points = [{ x, y, wall: null, powerDbm: eirpDbm }];
  const exitOpportunities = [];

  for (let step = 0; step < 48; step += 1) {
    const hits = [
      { wall: "left", t: dx < 0 ? (0 - x) / dx : Number.POSITIVE_INFINITY },
      { wall: "right", t: dx > 0 ? (width - x) / dx : Number.POSITIVE_INFINITY },
      { wall: "top", t: dy < 0 ? (0 - y) / dy : Number.POSITIVE_INFINITY },
      { wall: "bottom", t: dy > 0 ? (depth - y) / dy : Number.POSITIVE_INFINITY },
    ].filter((hit) => hit.t > 1e-4);

    const hit = hits.length ? hits.reduce((best, candidate) => (candidate.t < best.t ? candidate : best)) : null;

    if (!hit) {
      points.push({ x: x + dx * escapeDistanceUnits, y: y + dy * escapeDistanceUnits, wall: null, isExit: true, powerDbm });
      didExit = true;
      break;
    }

    pathMeters += hit.t;
    // Power = EIRP - FSPL(total distance) - accumulated reflection losses
    powerDbm = eirpDbm - fsplDb(pathMeters) - accumulatedRefLossDb;
    x += dx * hit.t;
    y += dy * hit.t;

    // At every wall hit, record what happens if the signal transmits through
    const material = WALL_MATERIALS[surfaces[hit.wall]] ?? WALL_MATERIALS.concrete;
    const exitLocalBearing = norm360(radToDeg(Math.atan2(dx, -dy)));

    // Angle-dependent losses (Fresnel approximation):
    // cosTheta = cos(incidence angle from wall normal)
    // Grazing angles → high penetration loss, low reflection loss
    // Normal incidence → base penetration loss, base reflection loss
    const cosTheta = (hit.wall === "left" || hit.wall === "right") ? Math.abs(dx) : Math.abs(dy);
    const clampedCos = Math.max(cosTheta, 0.15);
    const effectivePenDb = material.penDb / clampedCos;
    const effectiveRefDb = material.refDb * clampedCos;

    const transmittedPower = powerDbm - effectivePenDb;

    // Wall outward normal in true bearing (for exit-position scoring)
    const WALL_NORMAL_LOCAL = { top: 0, right: 90, bottom: 180, left: 270 };
    const wallNormalBearing = norm360(WALL_NORMAL_LOCAL[hit.wall] + forwardBearingDeg);

    exitOpportunities.push({
      bounceIndex: reflectionsUsed,
      wall: hit.wall,
      material: surfaces[hit.wall],
      bearing: norm360(exitLocalBearing + forwardBearingDeg),
      wallNormalBearing,
      x, y,
      powerDbm: transmittedPower,
      pathMeters,
    });

    // Open walls always let the signal through; otherwise check bounce limit
    const isTerminal = surfaces[hit.wall] === "open" || reflectionsUsed >= maxReflections;
    points.push({ x, y, wall: hit.wall, isTerminal, powerDbm });

    if (isTerminal) {
      points.push({ x: x + dx * escapeDistanceUnits, y: y + dy * escapeDistanceUnits, wall: null, isExit: true, powerDbm });
      exitedVia = hit.wall;
      didExit = true;
      break;
    }

    // Accumulate reflection loss and continue bouncing (angle-dependent)
    accumulatedRefLossDb += effectiveRefDb;
    powerDbm = eirpDbm - fsplDb(pathMeters) - accumulatedRefLossDb;
    if (powerDbm < effectiveSensitivity) break;

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
    powerDbm,
    exitOpportunities,
  };
}

export function buildBeamSegments(leftRay, rightRay) {
  const segments = [];
  const maxPairs = Math.min(leftRay.points.length - 1, rightRay.points.length - 1);
  const uiMaxDbm = -80;
  const uiMinDbm = LORA.sensitivityDbm;

  for (let i = 0; i < maxPairs; i++) {
    const leftFrom = leftRay.points[i];
    const leftTo = leftRay.points[i + 1];
    const rightFrom = rightRay.points[i];
    const rightTo = rightRay.points[i + 1];

    if (i > 0 && leftTo.wall && rightTo.wall && leftTo.wall !== rightTo.wall) {
      break;
    }

    const leftExited = !!(leftTo.isExit);
    const rightExited = !!(rightTo.isExit);
    if (leftExited !== rightExited) {
      break;
    }

    const isExterior = leftExited || rightExited;
    const avgPower = ((leftFrom.powerDbm ?? 14) + (rightFrom.powerDbm ?? 14)) / 2;
    const normalized = clamp((avgPower - uiMinDbm) / (uiMaxDbm - uiMinDbm), 0, 1);
    const attenuation = Math.max(0.05, smoothstep(0, 1, normalized));

    segments.push({
      index: i,
      leftStart: leftFrom,
      leftEnd: leftTo,
      rightStart: rightFrom,
      rightEnd: rightTo,
      attenuation,
      isExterior,
    });

    if (isExterior) break;
  }

  return {
    segments,
    leftTail: leftRay.points.slice(segments.length),
    rightTail: rightRay.points.slice(segments.length),
  };
}
