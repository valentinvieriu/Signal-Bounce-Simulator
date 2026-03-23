import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Compass from "./components/Compass";
import MapView from "./components/MapView";
import NodeImportPanel from "./components/NodeImportPanel";
import {
  clamp,
  createDefaultSimulationState,
  extractNodeLogs,
  getGeoMetrics,
  getResetCompassState,
  getResetMapState,
  getSimulationTelemetry,
  norm360,
  normalizeGeoLocation,
} from "./lib/simulation";

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
  const [referenceLocation, setReferenceLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("Use GPS or enter coordinates manually.");
  const [locationFields, setLocationFields] = useState({ latitude: "", longitude: "" });
  const [importedNodes, setImportedNodes] = useState([]);
  const [activeNodeId, setActiveNodeId] = useState(null);
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
  const activeNode = useMemo(
    () => importedNodes.find((node) => node.id === activeNodeId) ?? null,
    [activeNodeId, importedNodes],
  );
  const activeNodeMetrics = useMemo(
    () => (activeNode ? getGeoMetrics(referenceLocation, activeNode) : null),
    [activeNode, referenceLocation],
  );

  const syncSimulationToNode = useCallback((node, location) => {
    const metrics = node ? getGeoMetrics(location, node) : null;
    if (!metrics) {
      return;
    }

    setSim((currentState) => {
      const nextBearing = Math.round(metrics.bearing * 10) / 10;
      const nextDistance = Math.round(metrics.distanceKm * 1000) / 1000;
      if (currentState.targetBearing === nextBearing && currentState.distanceKm === nextDistance) {
        return currentState;
      }

      return {
        ...currentState,
        targetBearing: nextBearing,
        distanceKm: nextDistance,
      };
    });
  }, []);

  const updateSim = (key, value) => {
    setSim((currentState) => createNextState(currentState, key, value));
  };

  const activeNodeRef = useRef(activeNode);
  const referenceLocationRef = useRef(referenceLocation);
  useEffect(() => { activeNodeRef.current = activeNode; }, [activeNode]);
  useEffect(() => { referenceLocationRef.current = referenceLocation; }, [referenceLocation]);

  const selectActiveNode = useCallback((nodeId) => {
    setActiveNodeId(nodeId);
    setImportedNodes((currentNodes) => {
      const nextNode = currentNodes.find((node) => node.id === nodeId) ?? null;
      syncSimulationToNode(nextNode, referenceLocationRef.current);
      return currentNodes;
    });
  }, [syncSimulationToNode]);

  const handleImportText = useCallback((text) => {
    const parsedNodes = extractNodeLogs(text);
    if (!parsedNodes.length) {
      return { imported: 0, message: "No valid node rows were found in the uploaded log." };
    }

    let result;
    setImportedNodes((currentNodes) => {
      const knownIds = new Set(currentNodes.map((node) => node.id));
      const uniqueNodes = parsedNodes.filter((node) => !knownIds.has(node.id));

      if (!uniqueNodes.length) {
        result = { imported: 0, message: "Those node rows are already loaded." };
        return currentNodes;
      }

      result = {
        imported: uniqueNodes.length,
        message: `Imported ${uniqueNodes.length} node${uniqueNodes.length === 1 ? "" : "s"} from the log.`,
      };

      setActiveNodeId((currentActiveId) => {
        if (!currentActiveId) {
          syncSimulationToNode(uniqueNodes[0], referenceLocationRef.current);
          return uniqueNodes[0].id;
        }
        return currentActiveId;
      });

      return [...currentNodes, ...uniqueNodes];
    });

    return result;
  }, [syncSimulationToNode]);

  const updateNode = useCallback((nodeId, updates) => {
    setImportedNodes((currentNodes) => {
      const nextNodes = currentNodes.map((node) => (node.id === nodeId ? { ...node, ...updates } : node));
      setActiveNodeId((currentActiveId) => {
        const nextActiveNode = nextNodes.find((node) => node.id === currentActiveId) ?? null;
        syncSimulationToNode(nextActiveNode, referenceLocationRef.current);
        return currentActiveId;
      });
      return nextNodes;
    });
  }, [syncSimulationToNode]);

  const removeNode = useCallback((nodeId) => {
    setImportedNodes((currentNodes) => {
      const nextNodes = currentNodes.filter((node) => node.id !== nodeId);
      setActiveNodeId((currentActiveId) => {
        const nextActiveNode = currentActiveId === nodeId
          ? (nextNodes[0] ?? null)
          : (nextNodes.find((node) => node.id === currentActiveId) ?? null);
        syncSimulationToNode(nextActiveNode, referenceLocationRef.current);
        return nextActiveNode?.id ?? null;
      });
      return nextNodes;
    });
  }, [syncSimulationToNode]);

  const applyReferenceLocation = useCallback((normalized) => {
    setReferenceLocation(normalized);
    referenceLocationRef.current = normalized;
    setLocationFields({ latitude: normalized.latitude, longitude: normalized.longitude });
    syncSimulationToNode(activeNodeRef.current, normalized);
  }, [syncSimulationToNode]);

  const updateReferenceLocation = useCallback((location) => {
    const normalized = normalizeGeoLocation(location);
    if (!normalized) {
      setLocationStatus("Enter a valid latitude and longitude to calculate node bearings.");
      return false;
    }

    applyReferenceLocation(normalized);
    setLocationStatus(`Reference location set to ${normalized.latitude}, ${normalized.longitude}.`);
    return true;
  }, [applyReferenceLocation]);

  const requestCurrentLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationStatus("Geolocation is not available in this browser.");
      return;
    }

    setLocationStatus("Requesting your current location…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const normalized = normalizeGeoLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          source: "device",
          label: "My location",
        });

        if (!normalized) {
          setLocationStatus("Location was returned, but it could not be parsed.");
          return;
        }

        applyReferenceLocation(normalized);
        setLocationStatus(
          `Using GPS/geolocation${normalized.accuracy ? ` (±${Math.round(normalized.accuracy)} m)` : ""}.`,
        );
      },
      (error) => {
        setLocationStatus(`Location request failed: ${error.message}`);
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 },
    );
  }, [applyReferenceLocation]);

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
          <div className="space-y-6">
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
            <NodeImportPanel
              importedNodes={importedNodes}
              activeNodeId={activeNodeId}
              activeNodeMetrics={activeNodeMetrics}
              referenceLocation={referenceLocation}
              locationStatus={locationStatus}
              locationFields={locationFields}
              requestCurrentLocation={requestCurrentLocation}
              onImportText={handleImportText}
              onSelectNode={selectActiveNode}
              onUpdateNode={updateNode}
              onRemoveNode={removeNode}
              onUpdateReferenceLocation={updateReferenceLocation}
              onLocationFieldsChange={setLocationFields}
            />
          </div>
          <MapView
            sim={sim}
            updateSim={updateSim}
            useCompass={useCompass}
            telemetry={telemetry}
            gyroMode={gyroMode}
            activeNode={activeNode}
            activeNodeMetrics={activeNodeMetrics}
            referenceLocation={referenceLocation}
          />
        </div>
      </div>
    </div>
  );
}
