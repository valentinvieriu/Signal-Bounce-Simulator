import { useRef, useState } from "react";

import { COMPASS_MARKERS, degToRad, getAlignmentPalette, norm360, radToDeg } from "../lib/simulation";
import { Button, SliderRow, Switch } from "./ui";

function getArcPoint(radius, arcRadius, bearing) {
  return {
    x: radius + Math.cos(degToRad(bearing - 90)) * arcRadius,
    y: radius + Math.sin(degToRad(bearing - 90)) * arcRadius,
  };
}

function describeArc(radius, arcRadius, startBearing, endBearing) {
  const sweep = (endBearing - startBearing + 360) % 360;
  const start = getArcPoint(radius, arcRadius, startBearing);
  const end = getArcPoint(radius, arcRadius, endBearing);
  const largeArcFlag = sweep > 180 ? 1 : 0;

  return `M ${start.x} ${start.y} A ${arcRadius} ${arcRadius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

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

export default function Compass({ sim, updateSim, useCompass, setUseCompass, heading, supported, telemetry, gyroMode }) {
  const { distanceKm, forwardBearing, targetBearing, antennaDirection } = sim;
  const { alignment, alignmentError, isAligned } = telemetry;
  const size = 330;
  const radius = size / 2;
  const dialRef = useRef(null);
  const dragMovedRef = useRef(false);
  const [drag, setDrag] = useState(null); // { mode, pointerId }
  const gyroControlsNorth = useCompass && gyroMode === "north";
  const gyroControlsAntenna = useCompass && gyroMode === "antenna";

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
    { id: "north", ...markerPositions.north, fill: "rgba(17,24,39,0.14)", dot: "#111827", lock: gyroControlsNorth },
    { id: "node", ...markerPositions.node, fill: "rgba(191,141,140,0.22)", dot: "#bf8d8c", lock: false },
    { id: "direction", ...markerPositions.direction, fill: "rgba(37,99,235,0.22)", dot: "#2563eb", lock: gyroControlsAntenna },
  ];

  const targetSweepStart = norm360(targetBearing - forwardBearing);
  const targetSweepEnd = norm360(antennaDirection - forwardBearing);
  const sweep = ((targetSweepEnd - targetSweepStart + 540) % 360) - 180;
  const sweepRadius = radius - 98;
  const sweepDirection = sweep >= 0 ? 1 : 0;
  const sweepStart = getArcPoint(radius, sweepRadius, targetSweepStart);
  const sweepEnd = getArcPoint(radius, sweepRadius, targetSweepStart + sweep);
  const targetLocalBearing = norm360(targetBearing - forwardBearing);
  const sweepAnchor = getArcPoint(radius, sweepRadius, targetLocalBearing);
  const featherArcPath = describeArc(radius, sweepRadius, targetLocalBearing - alignment.featherThreshold, targetLocalBearing + alignment.featherThreshold);
  const coneArcPath = describeArc(radius, sweepRadius, targetLocalBearing - alignment.halfSpread, targetLocalBearing + alignment.halfSpread);
  const lockArcPath = describeArc(radius, sweepRadius, targetLocalBearing - alignment.lockThreshold, targetLocalBearing + alignment.lockThreshold);
  const useLockPulse = alignmentError !== null && alignmentError < Math.max(0.75, alignment.lockThreshold * 0.35);
  const alignmentPalette = getAlignmentPalette(alignment.state);

  return (
    <div className="flex flex-col rounded-[2rem] border border-zinc-200 bg-white/90 shadow-sm">
      <div className="space-y-6 p-6 md:p-7">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-black">Compass</h2>
          <p className="mt-1 text-sm text-zinc-500">Preview target bearing and antenna direction.</p>
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
            className="h-[330px] w-[330px] touch-none select-none"
            onClick={() => {
              if (dragMovedRef.current) {
                dragMovedRef.current = false;
                return;
              }

              if (useCompass) {
                updateSim("gyroMode", gyroMode === "north" ? "antenna" : "north");
              }
            }}
            onPointerMove={(event) => {
              if (!drag || event.pointerId !== drag.pointerId) return;

              dragMovedRef.current = true;
              const angle = pointToAngle(event.clientX, event.clientY);
              if (drag.mode === "north" && !gyroControlsNorth) {
                updateSim("forwardBearing", norm360(-angle));
              }
              if (drag.mode === "node") {
                updateSim("targetBearing", norm360(forwardBearing + angle));
              }
              if (drag.mode === "direction" && !gyroControlsAntenna) {
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
            <path
              d={featherArcPath}
              fill="none"
              stroke="rgba(245,158,11,0.12)"
              strokeWidth="26"
              strokeLinecap="round"
              pointerEvents="none"
            />
            <path
              d={coneArcPath}
              fill="none"
              stroke={alignmentPalette.glow}
              strokeWidth="18"
              strokeLinecap="round"
              pointerEvents="none"
            />
            <path
              d={lockArcPath}
              fill="none"
              stroke="rgba(22,163,74,0.18)"
              strokeWidth="10"
              strokeLinecap="round"
              pointerEvents="none"
            />
            {useLockPulse ? (
              <>
                <circle
                  cx={sweepAnchor.x}
                  cy={sweepAnchor.y}
                  r={10 + alignment.score * 2}
                  fill={alignmentPalette.glow}
                  pointerEvents="none"
                />
                <circle
                  cx={sweepAnchor.x}
                  cy={sweepAnchor.y}
                  r={4 + alignment.score * 1.5}
                  fill={alignmentPalette.stroke}
                  pointerEvents="none"
                />
              </>
            ) : (
              <>
                <path
                  d={`M ${sweepStart.x} ${sweepStart.y} A ${sweepRadius} ${sweepRadius} 0 ${Math.abs(sweep) > 180 ? 1 : 0} ${sweepDirection} ${sweepEnd.x} ${sweepEnd.y}`}
                  fill="none"
                  stroke={alignmentPalette.glow}
                  strokeWidth={14 + alignment.score * 5}
                  strokeLinecap="round"
                  opacity={0.8}
                  pointerEvents="none"
                />
                <path
                  d={`M ${sweepStart.x} ${sweepStart.y} A ${sweepRadius} ${sweepRadius} 0 ${Math.abs(sweep) > 180 ? 1 : 0} ${sweepDirection} ${sweepEnd.x} ${sweepEnd.y}`}
                  fill="none"
                  stroke={alignmentPalette.stroke}
                  strokeWidth={7 + alignment.score * 3}
                  strokeLinecap="round"
                  opacity={alignment.state === "missed" ? 0.7 : 1}
                  pointerEvents="none"
                />
              </>
            )}

            {draggableHandles.map((handle) => (
              <g key={handle.id}>
                <circle cx={handle.x} cy={handle.y} r="16" fill={handle.fill} pointerEvents="none" />
                <circle
                  cx={handle.x}
                  cy={handle.y}
                  r="18"
                  fill="transparent"
                  className={handle.lock ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"}
                  onPointerDown={(event) => {
                    if (handle.lock) return;
                    event.stopPropagation();
                    dragMovedRef.current = false;
                    setDrag({ mode: handle.id, pointerId: event.pointerId });
                    dialRef.current?.setPointerCapture(event.pointerId);
                  }}
                />
                <circle cx={handle.x} cy={handle.y} r="6" fill={handle.dot} pointerEvents="none" />
              </g>
            ))}
          </svg>
        </div>

        <div className="mt-2 grid gap-4 rounded-3xl border border-zinc-100 bg-zinc-50 p-4">
          <div className={`rounded-2xl border px-4 py-3 ${alignmentPalette.panelClassName}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className={`text-sm font-semibold ${alignmentPalette.textClassName}`}>
                  {isAligned ? "Radar aligned" : "Radar convergence"}
                </p>
                <p className={`mt-1 text-xs ${alignmentPalette.subtextClassName}`}>
                  {isAligned
                    ? "The main exit ray is inside the lock window. Keep the antenna here for a stable handoff."
                    : alignmentError !== null
                      ? `The target corridor now has a feathered edge. As the antenna enters it, the sweep thickens and extra guide beams appear. Current error: ${alignmentError.toFixed(1)}°.`
                      : "No exit path yet. Adjust the beam or wall openings until the radar can see the target."}
                </p>
              </div>
              <div className={`rounded-full px-3 py-1 text-xs font-semibold ${alignmentPalette.badgeClassName}`}>
                {alignmentError !== null ? `${Math.round(alignment.score * 100)}% ${alignment.label.toLowerCase()}` : "No exit"}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Lock window</p>
              <p className="mt-1 text-lg font-semibold text-zinc-900">±{alignment.lockThreshold.toFixed(1)}°</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Cone body</p>
              <p className="mt-1 text-lg font-semibold text-zinc-900">±{alignment.halfSpread.toFixed(1)}°</p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Feather edge</p>
              <p className="mt-1 text-lg font-semibold text-zinc-900">±{alignment.featherThreshold.toFixed(1)}°</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-zinc-900">Use gyroscope</p>
              <p className="mt-1 text-xs text-zinc-500">
                {useCompass
                  ? `Tap the compass to switch gyro control. Right now it is moving ${gyroMode === "north" ? "north" : "the blue antenna dot"}.`
                  : "Enable the gyroscope, then tap the compass to switch between moving north and moving the blue antenna dot."}
              </p>
            </div>
            <Switch checked={useCompass} onCheckedChange={setUseCompass} />
          </div>

          {useCompass && (
            <div className="flex items-center justify-between rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs text-sky-800">
              <span className="font-medium">
                Gyro mode: {gyroMode === "north" ? "North follows phone heading" : "Antenna follows phone heading"}
              </span>
              <span>Tap compass to toggle</span>
            </div>
          )}

          <div className="space-y-4 rounded-3xl border border-zinc-100 bg-white p-4 shadow-sm">
            <SliderRow
              label="Forward bearing"
              value={forwardBearing}
              onChange={(value) => updateSim("forwardBearing", value)}
              min={0}
              max={359}
              disabled={gyroControlsNorth}
            />
            <SliderRow label="Target node" value={targetBearing} onChange={(value) => updateSim("targetBearing", value)} min={0} max={359} />
            <SliderRow
              label="Antenna bearing"
              value={antennaDirection}
              onChange={(value) => updateSim("antennaDirection", value)}
              min={0}
              max={359}
              disabled={gyroControlsAntenna}
            />
            <SliderRow
              label="Node distance"
              value={distanceKm}
              onChange={(value) => updateSim("distanceKm", value)}
              min={0}
              max={20}
              step={0.01}
              unit="km"
            />
          </div>

          <div className="text-xs text-zinc-500">
            {supported
              ? `Live heading ${heading !== null ? `${Math.round(heading)}°` : "waiting…"}${useCompass ? ` · controlling ${gyroMode === "north" ? "north" : "antenna"}` : ""}`
              : "Compass sensor not detected."}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              onClick={() => {
                updateSim("resetCompass");
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
