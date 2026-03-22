import { useEffect, useState } from "react";

import Compass from "./components/Compass";
import MapView from "./components/MapView";
import { DEFAULTS, clamp, getResetMapState, norm360 } from "./lib/simulation";

function useDeviceHeading(enabled) {
  const [heading, setHeading] = useState(null);
  const supported = typeof window !== "undefined" && "DeviceOrientationEvent" in window;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return undefined;
    }

    const handler = (event) => {
      const nextHeading =
        typeof event.webkitCompassHeading === "number"
          ? event.webkitCompassHeading
          : typeof event.alpha === "number"
            ? norm360(360 - event.alpha)
            : null;

      if (nextHeading !== null) {
        setHeading(nextHeading);
      }
    };

    window.DeviceOrientationEvent?.requestPermission?.()
      .then((permission) => {
        if (permission === "granted") {
          window.addEventListener("deviceorientation", handler, true);
        }
      })
      .catch(() => {});

    window.addEventListener("deviceorientation", handler, true);
    return () => window.removeEventListener("deviceorientation", handler, true);
  }, [enabled]);

  return { heading, supported };
}

function createNextState(currentState, key, value, heading, useCompass) {
  if (key === "resetMap") {
    return getResetMapState(currentState);
  }

  const nextValue = typeof value === "function" ? value(currentState[key]) : value;
  const nextState = { ...currentState, [key]: nextValue };
  const nextForwardBearing = useCompass && heading !== null ? Math.round(heading) : nextState.forwardBearing;

  nextState.forwardBearing = nextForwardBearing;

  if (key === "widthUnits" || key === "depthUnits" || key === "antenna") {
    nextState.antenna = {
      x: clamp(nextState.antenna.x, 0.1, nextState.widthUnits - 0.1),
      y: clamp(nextState.antenna.y, 0.1, nextState.depthUnits - 0.1),
    };
  }

  return nextState;
}

export default function App() {
  const [sim, setSim] = useState(DEFAULTS);
  const [useCompass, setUseCompass] = useState(false);
  const { heading, supported } = useDeviceHeading(useCompass);

  const hydratedSim = useCompass && heading !== null
    ? { ...sim, forwardBearing: Math.round(heading) }
    : sim;

  const updateSim = (key, value) => {
    setSim((currentState) => createNextState(currentState, key, value, heading, useCompass));
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
            sim={hydratedSim}
            updateSim={updateSim}
            useCompass={useCompass}
            setUseCompass={setUseCompass}
            heading={heading}
            supported={supported}
          />
          <MapView sim={hydratedSim} updateSim={updateSim} />
        </div>
      </div>
    </div>
  );
}
