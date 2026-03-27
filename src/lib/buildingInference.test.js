import { describe, expect, it } from "vitest";

import { inferSimulationFromBuildings } from "./buildingInference";
import { createDefaultSimulationState } from "./simulation";

describe("inferSimulationFromBuildings", () => {
  it("infers width/depth and concrete walls from nearest building", () => {
    const sim = createDefaultSimulationState();
    const result = inferSimulationFromBuildings({
      latitude: 37.7749,
      longitude: -122.4194,
      currentSim: sim,
      buildings: [
        {
          id: "way-far",
          footprint: [
            { latitude: 37.7755, longitude: -122.4204 },
            { latitude: 37.7755, longitude: -122.4200 },
            { latitude: 37.7752, longitude: -122.4200 },
            { latitude: 37.7752, longitude: -122.4204 },
          ],
        },
        {
          id: "way-near",
          footprint: [
            { latitude: 37.77498, longitude: -122.41946 },
            { latitude: 37.77498, longitude: -122.41933 },
            { latitude: 37.77490, longitude: -122.41933 },
            { latitude: 37.77490, longitude: -122.41946 },
          ],
        },
      ],
    });

    expect(result).not.toBeNull();
    expect(result.metadata.buildingId).toBe("way-near");
    expect(result.inferredSim.widthUnits).toBeGreaterThanOrEqual(10);
    expect(result.inferredSim.depthUnits).toBeGreaterThanOrEqual(10);
    expect(result.inferredSim.surfaces).toEqual({
      top: "concrete",
      right: "concrete",
      bottom: "concrete",
      left: "concrete",
    });
  });

  it("returns null when there are no viable buildings", () => {
    const result = inferSimulationFromBuildings({
      latitude: 0,
      longitude: 0,
      currentSim: createDefaultSimulationState(),
      buildings: [],
    });

    expect(result).toBeNull();
  });
});
