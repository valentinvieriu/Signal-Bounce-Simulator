import { useCallback, useEffect, useState } from "react";

import Compass from "./components/Compass";
import MapView from "./components/MapView";
import {
  clamp,
  createDefaultSimulationState,
  getResetMapState,
  getSimulationTelemetry,
  norm360,
} from "./lib/simulation";

function useDeviceHeading(enabled, onHeadingChange) {
  const [heading, setHeading] = useState(null);
  const supported = typeof window !== "undefined" && "DeviceOrientationEvent" in window;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return undefined;
    }

    let cancelled = false;
    const handler = (event) => {
      const nextHeading =
        typeof event.webkitCompassHeading === "number"
          ? event.webkitCompassHeading
          : typeof event.alpha === "number"
            ? norm360(360 - event.alpha)
            : null;

      if (!cancelled && nextHeading !== null) {
        setHeading(nextHeading);
        onHeadingChange?.(nextHeading);
      }
    };

    const addListener = () => {
      if (!cancelled) {
        window.addEventListener("deviceorientation", handler, true);
      }
    };

    const requestPermission = window.DeviceOrientationEvent?.requestPermission;
    if (typeof requestPermission === "function") {
      requestPermission.call(window.DeviceOrientationEvent)
        .then((permission) => {
          if (permission === "granted") {
            addListener();
          }
        })
        .catch(() => {});
    } else {
      addListener();
    }

    return () => {
      cancelled = true;
      window.removeEventListener("deviceorientation", handler, true);
    };
  }, [enabled, onHeadingChange]);

  return { heading, supported };
}

function createNextState(currentState, key, value) {
  if (key === "resetMap") {
    return getResetMapState(currentState);
  }

  const nextValue = typeof value === "function" ? value(currentState[key]) : value;
  const nextState = { ...currentState, [key]: nextValue };

  if (key === "widthUnits" || key === "depthUnits" || key === "antenna") {
    nextState.antenna = {
      x: clamp(nextState.antenna.x, 0.1, nextState.widthUnits - 0.1),
      y: clamp(nextState.antenna.y, 0.1, nextState.depthUnits - 0.1),
    };
  }

  return nextState;
}

export default function App() {
  const [sim, setSim] = useState(createDefaultSimulationState);
  const [useCompass, setUseCompass] = useState(false);
  const gyroMode = sim.gyroMode ?? "north";
  const controlledKey = gyroMode === "antenna" ? "antennaDirection" : "forwardBearing";

  const handleHeadingChange = useCallback((nextHeading) => {
    const roundedHeading = Math.round(nextHeading);
    setSim((currentState) => (
      currentState[controlledKey] === roundedHeading
        ? currentState
        : { ...currentState, [controlledKey]: roundedHeading }
    ));
  }, [controlledKey]);

  const { heading, supported } = useDeviceHeading(useCompass, handleHeadingChange);

  const telemetry = getSimulationTelemetry(sim);

  const updateSim = (key, value) => {
    setSim((currentState) => createNextState(currentState, key, value));
  };

  return (
    <div className="min-h-screen bg-[#ececec] font-sans text-zinc-950">
      <div className="mx-auto max-w-[1500px] p-4 md:p-6 xl:p-8">
        <div className="mb-6">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">RF Propagation · Ray Tracing</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-black md:text-4xl">Signal Bounce Simulator</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600 md:text-base">
            Configure true north and target node placement. Adjust the transmitter direction and test wall materials to simulate signal paths.
          </p>
        </div>
        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Compass
            sim={sim}
            updateSim={updateSim}
            useCompass={useCompass}
            setUseCompass={setUseCompass}
            heading={heading}
            supported={supported}
            telemetry={telemetry}
            gyroMode={gyroMode}
          />
          <MapView
            sim={sim}
            updateSim={updateSim}
            useCompass={useCompass}
            telemetry={telemetry}
            gyroMode={gyroMode}
          />
        </div>
      </div>
    </div>
  );
}
