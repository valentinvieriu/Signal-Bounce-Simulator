import { useRef, useState } from "react";

import { COMPASS_MARKERS, DEFAULTS, degToRad, norm360, radToDeg } from "../lib/simulation";
import { Button, Label, NumberField, SliderRow, Switch } from "./ui";

function CompassMarkerCard({ label, value, color, description }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-zinc-100 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <div className={`h-3 w-1.5 rounded-full ${color}`} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
      </div>
      <span className="text-2xl font-semibold leading-none text-zinc-900">{Math.round(value)}°</span>
      <span className="text-[11px] leading-tight text-zinc-500">{description}</span>
    </div>
  );
}

export default function Compass({ sim, updateSim, useCompass, setUseCompass, heading, supported }) {
  const { distanceKm, forwardBearing, targetBearing, antennaDirection } = sim;
  const size = 330;
  const radius = size / 2;
  const dialRef = useRef(null);
  const [drag, setDrag] = useState(null); // { mode, pointerId }

  const pointToAngle = (clientX, clientY) => {
    const rect = dialRef.current?.getBoundingClientRect();
    if (!rect) {
      return 0;
    }

    return norm360(
      radToDeg(Math.atan2(clientY - rect.top - rect.height / 2, clientX - rect.left - rect.width / 2)) + 90,
    );
  };

  const getPosition = (bearing, markerRadius) => ({
    x: radius + Math.cos(degToRad(norm360(bearing - forwardBearing) - 90)) * markerRadius,
    y: radius + Math.sin(degToRad(norm360(bearing - forwardBearing) - 90)) * markerRadius,
  });

  const markerPositions = {
    north: getPosition(0, radius - 16),
    node: getPosition(targetBearing, radius - 80),
    direction: getPosition(antennaDirection, radius - 116),
  };

  const draggableHandles = [
    { id: "north", ...markerPositions.north, fill: "rgba(17,24,39,0.14)", dot: "#111827", lock: useCompass },
    { id: "node", ...markerPositions.node, fill: "rgba(191,141,140,0.22)", dot: "#bf8d8c", lock: false },
    { id: "direction", ...markerPositions.direction, fill: "rgba(37,99,235,0.22)", dot: "#2563eb", lock: false },
  ];

  return (
    <div className="flex flex-col rounded-[2rem] border border-zinc-200 bg-white/90 shadow-sm">
      <div className="space-y-6 p-6 md:p-7">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-black">Compass</h2>
          <p className="mt-1 text-sm text-zinc-500">Preview target bearing, and antenna direction.</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {COMPASS_MARKERS.map((marker) => (
            <CompassMarkerCard
              key={marker.label}
              label={marker.label}
              value={sim[marker.key]}
              color={marker.color}
              description={marker.description}
            />
          ))}
        </div>

        <div className="flex justify-center pt-2">
          <div className="h-12 w-1.5 rounded-full bg-zinc-900" />
        </div>

        <div className="flex items-center justify-center">
          <svg
            ref={dialRef}
            viewBox={`0 0 ${size} ${size}`}
            className="h-[330px] w-[330px] select-none"
            onPointerMove={(event) => {
              if (!drag || event.pointerId !== drag.pointerId) return;

              const angle = pointToAngle(event.clientX, event.clientY);
              if (drag.mode === "north" && !useCompass) {
                updateSim("forwardBearing", norm360(-angle));
              }
              if (drag.mode === "node") {
                updateSim("targetBearing", norm360(forwardBearing + angle));
              }
              if (drag.mode === "direction") {
                updateSim("antennaDirection", norm360(forwardBearing + angle));
              }
            }}
            onPointerUp={(event) => {
              if (drag && event.pointerId === drag.pointerId) {
                setDrag(null);
                dialRef.current?.releasePointerCapture(event.pointerId);
              }
            }}
            onPointerCancel={(event) => {
              if (drag && event.pointerId === drag.pointerId) {
                setDrag(null);
                dialRef.current?.releasePointerCapture(event.pointerId);
              }
            }}
            onLostPointerCapture={() => setDrag(null)}
          >
            <g>
              {Array.from({ length: 36 }, (_, index) => index * 10).map((step) => {
                const angle = degToRad(step - 90 - forwardBearing);
                const isCardinal = step % 90 === 0;
                const isMajor = step % 30 === 0;
                const innerRadius = isCardinal ? radius - 64 : isMajor ? radius - 54 : radius - 46;
                const outerRadius = radius - 28;

                return (
                  <line
                    key={step}
                    x1={radius + Math.cos(angle) * innerRadius}
                    y1={radius + Math.sin(angle) * innerRadius}
                    x2={radius + Math.cos(angle) * outerRadius}
                    y2={radius + Math.sin(angle) * outerRadius}
                    stroke={isCardinal ? "#111111" : isMajor ? "#71717a" : "#d4d4d8"}
                    strokeWidth={isCardinal ? 4 : isMajor ? 2.5 : 1.5}
                    strokeLinecap="round"
                  />
                );
              })}
              {Array.from({ length: 12 }, (_, index) => index * 30).map((step) => {
                const angle = degToRad(step - 90 - forwardBearing);
                const isCardinal = step % 90 === 0;
                const label = step === 0 ? "N" : step === 90 ? "E" : step === 180 ? "S" : step === 270 ? "W" : `${step}`;

                return (
                  <text
                    key={`label-${step}`}
                    x={radius + Math.cos(angle) * (radius - 10)}
                    y={radius + Math.sin(angle) * (radius - 10) + 6}
                    textAnchor="middle"
                    fontSize={isCardinal ? "15" : "12"}
                    fontWeight={isCardinal ? "700" : "500"}
                    fill="#171717"
                  >
                    {label}
                  </text>
                );
              })}
            </g>

            <circle
              cx={radius}
              cy={radius}
              r={radius - 80}
              fill="none"
              stroke="rgba(191,141,140,0.4)"
              strokeWidth="1.5"
              strokeDasharray="4 5"
              pointerEvents="none"
            />
            <circle
              cx={radius}
              cy={radius}
              r={radius - 116}
              fill="none"
              stroke="rgba(37,99,235,0.4)"
              strokeWidth="1.5"
              strokeDasharray="4 5"
              pointerEvents="none"
            />

            {draggableHandles.map((handle) => (
              <g key={handle.id}>
                {/* Visible fill */}
                <circle cx={handle.x} cy={handle.y} r="16" fill={handle.fill} pointerEvents="none" />
                {/* Invisible enlarged hit target */}
                <circle
                  cx={handle.x}
                  cy={handle.y}
                  r="28"
                  fill="transparent"
                  className={handle.lock ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing touch-none"}
                  onPointerDown={(event) => {
                    if (handle.lock) return;
                    event.stopPropagation();
                    setDrag({ mode: handle.id, pointerId: event.pointerId });
                    dialRef.current?.setPointerCapture(event.pointerId);
                  }}
                />
                {/* Inner dot */}
                <circle cx={handle.x} cy={handle.y} r="6" fill={handle.dot} pointerEvents="none" />
              </g>
            ))}
          </svg>
        </div>

        <div className="mt-2 grid gap-4 rounded-3xl border border-zinc-100 bg-zinc-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-zinc-900">Use device compass</p>
              <p className="mt-1 text-xs text-zinc-500">Drag dots to adjust orientation manually.</p>
            </div>
            <Switch checked={useCompass} onCheckedChange={setUseCompass} />
          </div>
          <div className="space-y-4 rounded-3xl border border-zinc-100 bg-white p-4 shadow-sm">
            <SliderRow
              label="Forward bearing"
              value={forwardBearing}
              onChange={(value) => updateSim("forwardBearing", value)}
              min={0}
              max={359}
              disabled={useCompass}
            />
            <SliderRow label="Target node" value={targetBearing} onChange={(value) => updateSim("targetBearing", value)} min={0} max={359} />
            <SliderRow
              label="Antenna bearing"
              value={antennaDirection}
              onChange={(value) => updateSim("antennaDirection", value)}
              min={0}
              max={359}
            />
          </div>
          <NumberField
            label="Node distance (km)"
            value={distanceKm}
            min={0}
            step={0.01}
            onChange={(event) => updateSim("distanceKm", Math.max(0, Number(event.target.value) || 0))}
          />
          <div className="text-xs text-zinc-500">
            {supported ? `Live heading ${heading !== null ? `${Math.round(heading)}°` : "waiting…"}` : "Compass sensor not detected."}
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              onClick={() => {
                updateSim("forwardBearing", DEFAULTS.forwardBearing);
                updateSim("targetBearing", DEFAULTS.targetBearing);
                updateSim("antennaDirection", DEFAULTS.antennaDirection);
                updateSim("distanceKm", DEFAULTS.distanceKm);
                setUseCompass(false);
              }}
            >
              Reset compass
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
