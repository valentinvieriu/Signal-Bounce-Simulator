import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Compass from "./components/Compass";
import MapView from "./components/MapView";
import NodeImportWizard from "./components/NodeImportWizard";
import {
  clamp,
  createDefaultSimulationState,
  getResetCompassState,
  getResetMapState,
  getSimulationTelemetry,
  norm360,
} from "./lib/simulation";
import { fetchNearbyBuildings, inferSimulationFromBuildings } from "./lib/buildingInference";

function useDeviceHeading(enabled, onHeadingChange) {
  const [heading, setHeading] = useState(null);
  const onHeadingChangeRef = useRef(onHeadingChange);
  const supported = typeof window !== "undefined" && "DeviceOrientationEvent" in window;

  useEffect(() => {
    onHeadingChangeRef.current = onHeadingChange;
  }, [onHeadingChange]);

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
        onHeadingChangeRef.current?.(nextHeading);
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
  }, [enabled]);

  return { heading, supported };
}

function createNextState(currentState, key, value) {
  if (key === "resetMap") {
    return getResetMapState(currentState);
  }

  if (key === "resetCompass") {
    return getResetCompassState(currentState);
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
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [buildingInference, setBuildingInference] = useState({ status: "idle", message: null, details: null });
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

  const telemetry = useMemo(() => getSimulationTelemetry(sim), [sim]);

  const updateSim = (key, value) => {
    setSim((currentState) => createNextState(currentState, key, value));
  };

  const handleImportComplete = useCallback((targetBearing, distanceKm) => {
    setSim((current) => ({ ...current, targetBearing, distanceKm }));
    setImportWizardOpen(false);
  }, []);

  const handleInferFromNearbyBuildings = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setBuildingInference({ status: "error", message: "Geolocation is unavailable in this browser.", details: null });
      return;
    }

    setBuildingInference({ status: "loading", message: "Locating and loading nearby building footprints…", details: null });

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 15000,
          timeout: 12000,
        });
      });

      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const buildings = await fetchNearbyBuildings({ latitude, longitude });
      const inferred = inferSimulationFromBuildings({ latitude, longitude, buildings, currentSim: sim });

      if (!inferred) {
        setBuildingInference({ status: "error", message: "No nearby building geometry was available to infer a layout.", details: null });
        return;
      }

      setSim(inferred.inferredSim);
      setBuildingInference({
        status: "success",
        message: `Loaded ${inferred.metadata.sampledBuildings} nearby buildings and inferred a ${inferred.inferredSim.widthUnits.toFixed(1)}m × ${inferred.inferredSim.depthUnits.toFixed(1)}m shell.`,
        details: inferred.metadata,
      });
    } catch (error) {
      setBuildingInference({
        status: "error",
        message: error?.message ?? "Failed to infer building geometry from nearby map data.",
        details: null,
      });
    }
  }, [sim]);

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
        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Compass
            sim={sim}
            updateSim={updateSim}
            useCompass={useCompass}
            setUseCompass={setUseCompass}
            heading={heading}
            supported={supported}
            telemetry={telemetry}
            gyroMode={gyroMode}
            onOpenImportWizard={() => setImportWizardOpen(true)}
          />
          <MapView
            sim={sim}
            updateSim={updateSim}
            useCompass={useCompass}
            telemetry={telemetry}
            gyroMode={gyroMode}
            buildingInference={buildingInference}
            onInferFromNearbyBuildings={handleInferFromNearbyBuildings}
          />
        </div>
      </div>
      <NodeImportWizard
        open={importWizardOpen}
        onClose={() => setImportWizardOpen(false)}
        onComplete={handleImportComplete}
      />
    </div>
  );
}
