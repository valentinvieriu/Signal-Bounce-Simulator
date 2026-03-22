import { describe, it, expect } from "vitest";
import {
  clamp,
  degToRad,
  radToDeg,
  norm360,
  shortestDelta,
  distance,
  createDefaultSimulationState,
  getAlignmentProfile,
  getResetCompassState,
  getResetMapState,
  getSimulationTelemetry,
  smoothstep,
  traceRay,
  DEFAULTS,
} from "./simulation";

// --- Math utilities ---

describe("clamp", () => {
  it("returns value when within range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it("clamps below minimum", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });
  it("clamps above maximum", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

describe("degToRad / radToDeg", () => {
  it("converts 180° to π", () => {
    expect(degToRad(180)).toBeCloseTo(Math.PI);
  });
  it("converts π to 180°", () => {
    expect(radToDeg(Math.PI)).toBeCloseTo(180);
  });
  it("round-trips correctly", () => {
    expect(radToDeg(degToRad(42))).toBeCloseTo(42);
  });
});

describe("norm360", () => {
  it("passes through value already in [0,360)", () => {
    expect(norm360(90)).toBe(90);
  });
  it("normalizes negative degrees", () => {
    expect(norm360(-90)).toBe(270);
  });
  it("normalizes degrees >= 360", () => {
    expect(norm360(450)).toBe(90);
  });
  it("normalizes 0", () => {
    expect(norm360(0)).toBe(0);
  });
});

describe("shortestDelta", () => {
  it("returns positive for clockwise short path", () => {
    expect(shortestDelta(10, 50)).toBe(40);
  });
  it("returns negative for counter-clockwise short path", () => {
    expect(shortestDelta(50, 10)).toBe(-40);
  });
  it("wraps around 0°/360° boundary", () => {
    expect(shortestDelta(350, 10)).toBe(20);
  });
  it("returns 0 for identical bearings", () => {
    expect(shortestDelta(180, 180)).toBe(0);
  });
});

describe("distance", () => {
  it("computes distance for a 3-4-5 triangle", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5);
  });
  it("returns 0 for same point", () => {
    expect(distance({ x: 7, y: 3 }, { x: 7, y: 3 })).toBe(0);
  });
});

describe("smoothstep", () => {
  it("returns 0 before the lower edge", () => {
    expect(smoothstep(10, 20, 5)).toBe(0);
  });

  it("returns 1 after the upper edge", () => {
    expect(smoothstep(10, 20, 25)).toBe(1);
  });

  it("eases values inside the range", () => {
    expect(smoothstep(0, 10, 5)).toBeCloseTo(0.5);
  });
});

// --- State helpers ---

describe("createDefaultSimulationState", () => {
  it("returns an object matching DEFAULTS values", () => {
    const state = createDefaultSimulationState();
    expect(state.distanceKm).toBe(DEFAULTS.distanceKm);
    expect(state.targetBearing).toBe(DEFAULTS.targetBearing);
  });
  it("returns a fresh copy each call (no shared references)", () => {
    const a = createDefaultSimulationState();
    const b = createDefaultSimulationState();
    expect(a).not.toBe(b);
    expect(a.antenna).not.toBe(b.antenna);
    expect(a.surfaces).not.toBe(b.surfaces);
  });
});

describe("getResetMapState", () => {
  it("resets map fields to defaults", () => {
    const modified = {
      ...createDefaultSimulationState(),
      widthUnits: 100,
      depthUnits: 50,
      beamSpread: 30,
    };
    const reset = getResetMapState(modified);
    expect(reset.widthUnits).toBe(DEFAULTS.widthUnits);
    expect(reset.depthUnits).toBe(DEFAULTS.depthUnits);
    expect(reset.beamSpread).toBe(DEFAULTS.beamSpread);
  });
  it("preserves compass fields", () => {
    const modified = {
      ...createDefaultSimulationState(),
      forwardBearing: 999,
      targetBearing: 42,
      distanceKm: 1.5,
    };
    const reset = getResetMapState(modified);
    expect(reset.forwardBearing).toBe(999);
    expect(reset.targetBearing).toBe(42);
    expect(reset.distanceKm).toBe(1.5);
  });
});

describe("getResetCompassState", () => {
  it("resets compass fields to defaults", () => {
    const modified = {
      ...createDefaultSimulationState(),
      gyroMode: "antenna",
      forwardBearing: 12,
      targetBearing: 34,
      antennaDirection: 56,
      distanceKm: 7.89,
    };

    const reset = getResetCompassState(modified);
    expect(reset.gyroMode).toBe(DEFAULTS.gyroMode);
    expect(reset.forwardBearing).toBe(DEFAULTS.forwardBearing);
    expect(reset.targetBearing).toBe(DEFAULTS.targetBearing);
    expect(reset.antennaDirection).toBe(DEFAULTS.antennaDirection);
    expect(reset.distanceKm).toBe(DEFAULTS.distanceKm);
  });

  it("preserves map configuration", () => {
    const modified = {
      ...createDefaultSimulationState(),
      widthUnits: 120,
      depthUnits: 40,
      antenna: { x: 15, y: 18 },
    };

    const reset = getResetCompassState(modified);
    expect(reset.widthUnits).toBe(120);
    expect(reset.depthUnits).toBe(40);
    expect(reset.antenna).toEqual({ x: 15, y: 18 });
  });
});

// --- Ray tracer ---

describe("traceRay", () => {
  const baseParams = {
    origin: { x: 34, y: 11 },
    width: 68,
    depth: 22,
    maxReflections: 2,
    escapeDistanceUnits: 20,
    forwardBearingDeg: 0,
    surfaces: { top: "reflect", right: "reflect", bottom: "reflect", left: "reflect" },
  };

  it("exits through a pass wall", () => {
    const result = traceRay({
      ...baseParams,
      bearingLocalDeg: 0, // straight up (north)
      surfaces: { ...baseParams.surfaces, top: "pass" },
    });
    expect(result.didExit).toBe(true);
    expect(result.exitedVia).toBe("top");
  });

  it("reflects off a closed wall", () => {
    const result = traceRay({
      ...baseParams,
      bearingLocalDeg: 0, // straight toward top (reflect)
      maxReflections: 8,
    });
    expect(result.reflectionsUsed).toBeGreaterThan(0);
  });

  it("respects maxReflections limit", () => {
    const result = traceRay({
      ...baseParams,
      bearingLocalDeg: 45,
      maxReflections: 1,
      surfaces: { top: "reflect", right: "reflect", bottom: "reflect", left: "reflect" },
    });
    expect(result.reflectionsUsed).toBeLessThanOrEqual(1);
    expect(result.didExit).toBe(true);
  });

  it("returns points array starting at origin", () => {
    const result = traceRay({
      ...baseParams,
      bearingLocalDeg: 30,
    });
    expect(result.points[0].x).toBeCloseTo(baseParams.origin.x);
    expect(result.points[0].y).toBeCloseTo(baseParams.origin.y);
    expect(result.points.length).toBeGreaterThanOrEqual(2);
  });

  it("computes pathDistanceUnits > 0", () => {
    const result = traceRay({
      ...baseParams,
      bearingLocalDeg: 90,
      surfaces: { ...baseParams.surfaces, right: "pass" },
    });
    expect(result.pathDistanceUnits).toBeGreaterThan(0);
  });

  it("stays inside when all walls reflect and maxReflections is high", () => {
    const result = traceRay({
      ...baseParams,
      bearingLocalDeg: 33,
      maxReflections: 48,
    });
    // With 48 max reflections and 48 max steps, ray should bounce around without exiting
    expect(result.exitedVia).toBeNull();
  });

  it("applies forwardBearingDeg offset to finalTrueBearing", () => {
    const result = traceRay({
      ...baseParams,
      bearingLocalDeg: 0,
      forwardBearingDeg: 90,
      surfaces: { ...baseParams.surfaces, top: "pass" },
    });
    // Local bearing 0 + forward 90 = true bearing 90
    expect(result.finalTrueBearing).toBeCloseTo(90);
  });
});

describe("getSimulationTelemetry", () => {
  it("returns aligned telemetry when the exit bearing matches the target", () => {
    const telemetry = getSimulationTelemetry({
      ...createDefaultSimulationState(),
      forwardBearing: 0,
      antennaDirection: 0,
      targetBearing: 0,
      beamSpread: 30,
      wallBounces: 0,
      surfaces: { top: "pass", right: "reflect", bottom: "reflect", left: "reflect" },
    });

    expect(telemetry.localAntennaDirection).toBe(0);
    expect(telemetry.rays.main.didExit).toBe(true);
    expect(telemetry.rays.main.finalTrueBearing).toBeCloseTo(0);
    expect(telemetry.alignmentError).toBeCloseTo(0);
    expect(telemetry.isAligned).toBe(true);
    expect(telemetry.alignment.state).toBe("locked");
    expect(telemetry.alignment.score).toBeCloseTo(1);
  });

  it("returns non-aligned telemetry when the exit bearing misses the target", () => {
    const telemetry = getSimulationTelemetry({
      ...createDefaultSimulationState(),
      forwardBearing: 0,
      antennaDirection: 0,
      targetBearing: 25,
      beamSpread: 30,
      wallBounces: 0,
      surfaces: { top: "pass", right: "reflect", bottom: "reflect", left: "reflect" },
    });

    expect(telemetry.rays.main.didExit).toBe(true);
    expect(telemetry.alignmentError).toBeCloseTo(25);
    expect(telemetry.isAligned).toBe(false);
    expect(telemetry.alignment.state).toBe("missed");
  });
});

describe("getAlignmentProfile", () => {
  it("returns blocked state when there is no exit", () => {
    const profile = getAlignmentProfile({
      beamSpread: 60,
      didExit: false,
      signedError: null,
    });

    expect(profile.state).toBe("blocked");
    expect(profile.score).toBe(0);
    expect(profile.visualGuideOffsets).toEqual([]);
  });

  it("marks exact matches as locked", () => {
    const profile = getAlignmentProfile({
      beamSpread: 60,
      didExit: true,
      signedError: 0,
    });

    expect(profile.state).toBe("locked");
    expect(profile.score).toBeCloseTo(1);
    expect(profile.visualGuideOffsets.length).toBeGreaterThan(0);
  });

  it("keeps rays converging inside the cone", () => {
    const profile = getAlignmentProfile({
      beamSpread: 60,
      didExit: true,
      signedError: 18,
    });

    expect(profile.state).toBe("converging");
    expect(profile.score).toBeGreaterThan(0);
  });

  it("uses a feather zone before fully missing the cone", () => {
    const profile = getAlignmentProfile({
      beamSpread: 60,
      didExit: true,
      signedError: 36,
    });

    expect(profile.state).toBe("fringe");
    expect(profile.approachScore).toBeGreaterThan(0);
  });

  it("keeps the same scoring and guide layout from either side of approach", () => {
    const leftApproach = getAlignmentProfile({
      beamSpread: 60,
      didExit: true,
      signedError: -18,
    });
    const rightApproach = getAlignmentProfile({
      beamSpread: 60,
      didExit: true,
      signedError: 18,
    });

    expect(leftApproach.state).toBe(rightApproach.state);
    expect(leftApproach.score).toBeCloseTo(rightApproach.score);
    expect(leftApproach.visualGuideOffsets).toEqual(rightApproach.visualGuideOffsets);
  });

  it("falls back to missed when well outside the cone", () => {
    const profile = getAlignmentProfile({
      beamSpread: 60,
      didExit: true,
      signedError: 60,
    });

    expect(profile.state).toBe("missed");
    expect(profile.score).toBe(0);
  });
});
