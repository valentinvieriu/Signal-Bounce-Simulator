import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Move, Waves } from "lucide-react";

import {
  MAP_TIPS,
  clamp,
  degToRad,
  getSimulationTelemetry,
  norm360,
  radToDeg,
} from "../lib/simulation";
import { Badge, Button, InfoCard, NumberField, SliderRow, StatCard, WallPassToggle } from "./ui";

function getMapMetrics({ widthUnits, depthUnits, viewWidth, viewDepth, paddingX, paddingY }) {
  const maxWidth = viewWidth - paddingX * 2;
  const maxHeight = viewDepth - paddingY * 2;
  const aspectRatio = widthUnits / depthUnits;
  const availableRatio = maxWidth / maxHeight;

  const mapWidth = aspectRatio > availableRatio ? maxWidth : maxHeight * aspectRatio;
  const mapHeight = aspectRatio > availableRatio ? maxWidth / aspectRatio : maxHeight;

  return {
    mapX: paddingX + (maxWidth - mapWidth) / 2,
    mapY: paddingY + (maxHeight - mapHeight) / 2,
    mapW: mapWidth,
    mapH: mapHeight,
  };
}

function getWallSegments({ mapX, mapY, mapW, mapH }) {
  return [
    { key: "top", x1: mapX, y1: mapY, x2: mapX + mapW, y2: mapY, fx: mapX, fy: mapY - 46, fw: mapW, fh: 40, align: "justify-center" },
    { key: "right", x1: mapX + mapW, y1: mapY, x2: mapX + mapW, y2: mapY + mapH, fx: mapX + mapW, fy: mapY, fw: 80, fh: mapH, align: "justify-start pl-3" },
    { key: "bottom", x1: mapX, y1: mapY + mapH, x2: mapX + mapW, y2: mapY + mapH, fx: mapX, fy: mapY + mapH + 6, fw: mapW, fh: 40, align: "justify-center" },
    { key: "left", x1: mapX, y1: mapY, x2: mapX, y2: mapY + mapH, fx: mapX - 80, fy: mapY, fw: 80, fh: mapH, align: "justify-end pr-3" },
  ];
}

const MotionCircle = motion.circle;

export default function MapView({ sim, updateSim, useCompass, telemetry, gyroMode }) {
  const { widthUnits, depthUnits, beamSpread, wallBounces, forwardBearing, targetBearing, antennaDirection, antenna, surfaces } = sim;
  const viewWidth = 700;
  const viewDepth = 500;
  const paddingX = 90;
  const paddingY = 65;
  const mapRef = useRef(null);
  const [drag, setDrag] = useState(null); // { mode: "antenna"|"direction", pointerId, pointerType }

  const startDrag = (mode, event) => {
    if (event.pointerType !== "mouse") {
      event.preventDefault();
    }

    setDrag({ mode, pointerId: event.pointerId, pointerType: event.pointerType });
    mapRef.current?.setPointerCapture(event.pointerId);
  };

  const endDrag = (event) => {
    if (drag && event.pointerId === drag.pointerId) {
      setDrag(null);
      mapRef.current?.releasePointerCapture(event.pointerId);
    }
  };

  const { mapX, mapY, mapW, mapH } = useMemo(
    () => getMapMetrics({ widthUnits, depthUnits, viewWidth, viewDepth, paddingX, paddingY }),
    [depthUnits, widthUnits],
  );

  const scaleX = (value) => mapX + (value / widthUnits) * mapW;
  const scaleY = (value) => mapY + (value / depthUnits) * mapH;

  const getSvgPoint = (clientX, clientY) => {
    const point = mapRef.current?.createSVGPoint();
    if (!point) {
      return { x: 0, y: 0 };
    }

    point.x = clientX;
    point.y = clientY;
    return point.matrixTransform(mapRef.current.getScreenCTM().inverse());
  };

  const fromScreen = (clientX, clientY) => {
    const point = getSvgPoint(clientX, clientY);
    return {
      x: clamp(((point.x - mapX) / mapW) * widthUnits, 0.1, widthUnits - 0.1),
      y: clamp(((point.y - mapY) / mapH) * depthUnits, 0.1, depthUnits - 0.1),
    };
  };

  const screenToDirection = (clientX, clientY) => {
    const point = getSvgPoint(clientX, clientY);
    return norm360(radToDeg(Math.atan2(point.x - scaleX(antenna.x), scaleY(antenna.y) - point.y)));
  };

  const dominantDimension = Math.max(widthUnits, depthUnits);
  const gridStep = dominantDimension > 200 ? 25 : dominantDimension > 100 ? 10 : dominantDimension > 40 ? 5 : dominantDimension > 10 ? 2 : 1;
  const gridPx = (mapW / widthUnits) * gridStep;

  const fallbackTelemetry = useMemo(() => getSimulationTelemetry(sim), [sim]);
  const activeTelemetry = telemetry ?? fallbackTelemetry;
  const { escapeDistance, localAntennaDirection, rays, alignmentError, isAligned } = activeTelemetry;
  const { main, left, right } = rays;
  const gyroControlsAntenna = useCompass && gyroMode === "antenna";
  const wallSegments = useMemo(() => getWallSegments({ mapX, mapY, mapW, mapH }), [mapH, mapW, mapX, mapY]);

  const createPath = (result) => result.points.map((point, index) => `${index === 0 ? "M" : "L"} ${scaleX(point.x)} ${scaleY(point.y)}`).join(" ");

  const summaryCards = [
    { label: "Building size", value: `${widthUnits.toFixed(1)} m × ${depthUnits.toFixed(1)} m` },
    { label: "Antenna position", value: `X ${antenna.x.toFixed(1)} m · Y ${antenna.y.toFixed(1)} m` },
    { label: "Exit bearing", value: main.didExit ? `${main.finalTrueBearing.toFixed(1)}°` : "—", accent: isAligned },
    { label: "Path length", value: `${(main.pathDistanceUnits / 1000).toFixed(2)} km` },
    { label: "Reflections", value: String(main.reflectionsUsed) },
    { label: "Alignment error", value: alignmentError !== null ? `${alignmentError.toFixed(1)}°` : "—" },
  ];

  return (
    <div className="flex flex-col rounded-[2rem] border border-zinc-200 bg-white/90 shadow-sm">
      <div className="flex flex-col space-y-1.5 p-6 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-zinc-950">
          <div>
            <p className="text-xl font-semibold tracking-tight">Courtyard map</p>
            <p className="mt-1 text-sm font-normal text-zinc-500">Drag to move or rotate antenna. Choose pass/reflect for walls.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={isAligned ? "border-transparent bg-emerald-100 text-emerald-800" : "border-transparent bg-zinc-100 text-zinc-700"}>
              {isAligned ? "Bearing matched" : main.didExit ? "Exited but off target" : "No exit"}
            </Badge>
            <Badge className="border-transparent bg-zinc-100 text-zinc-700">{main.didExit ? `Exit ${main.finalTrueBearing.toFixed(1)}°` : "Contained"}</Badge>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-6 pt-0">
        <div className="relative overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-[#f7f7f7] p-2" style={{ touchAction: "pan-y pinch-zoom" }}>
          <svg
            ref={mapRef}
            viewBox={`0 0 ${viewWidth} ${viewDepth}`}
            className="w-full aspect-[7/5] max-h-[500px]"
            onPointerDown={(event) => {
              const t = event.target;
              const isSvgElement = t instanceof SVGElement;
              const isHandle = t.getAttribute?.("data-handle") === "true";
              const isMapControl = typeof t.closest === "function" && t.closest("[data-map-control='true']");

              if (event.pointerType === "mouse" && isSvgElement && !isHandle && !isMapControl) {
                startDrag("antenna", event);
                updateSim("antenna", fromScreen(event.clientX, event.clientY));
              }
            }}
            onPointerMove={(event) => {
              if (!drag || event.pointerId !== drag.pointerId) return;

              if (drag.pointerType !== "mouse") {
                event.preventDefault();
              }

              if (drag.mode === "antenna") {
                updateSim("antenna", fromScreen(event.clientX, event.clientY));
              } else if (drag.mode === "direction") {
                updateSim("antennaDirection", norm360(screenToDirection(event.clientX, event.clientY) + forwardBearing));
              }
            }}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onLostPointerCapture={() => setDrag(null)}
          >
            <defs>
              <pattern id="grid" x={mapX} y={mapY} width={gridPx} height={gridPx} patternUnits="userSpaceOnUse">
                <rect width={gridPx} height={gridPx} fill="none" stroke="rgba(161,161,170,0.18)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect x="0" y="0" width={viewWidth} height={viewDepth} fill="#f7f7f7" />
            <rect x={mapX} y={mapY} width={mapW} height={mapH} rx="26" fill="rgba(255,255,255,0.9)" />
            <rect x={mapX} y={mapY} width={mapW} height={mapH} rx="26" fill="url(#grid)" />

            <text x={viewWidth / 2} y="18" textAnchor="middle" fontSize="12" fill="#71717a">
              Top edge = courtyard front · north relative to this front edge
            </text>
            <text x={24} y={18} fontSize="12" fontWeight="500" fill="#71717a">
              Grid: {gridStep}m
            </text>
            <text x={mapX + mapW / 2} y={mapY - 48} textAnchor="middle" fontSize="12" fontWeight="700" letterSpacing="2" fill="#64748b">
              FRONT
            </text>

            <g transform={`translate(${viewWidth - 68}, 62) rotate(${-forwardBearing})`}>
              <circle cx="0" cy="0" r="20" fill="#f8fafc" stroke="#d4d4d8" strokeWidth="1.5" />
              <path d="M-6,0 L0,-14 L6,0 Z" fill="#ef4444" />
              <path d="M-6,0 L0,14 L6,0 Z" fill="#94a3b8" />
              <text x="0" y="-20" textAnchor="middle" fontSize="11" fontWeight="700" fill="#ef4444">N</text>
              <text x="0" y="28" textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748b">S</text>
            </g>

            <line
              x1={scaleX(antenna.x)}
              y1={scaleY(antenna.y)}
              x2={scaleX(antenna.x + Math.sin(degToRad(norm360(targetBearing - forwardBearing))) * escapeDistance)}
              y2={scaleY(antenna.y - Math.cos(degToRad(norm360(targetBearing - forwardBearing))) * escapeDistance)}
              stroke="#d08484"
              strokeWidth="2"
              strokeDasharray="8 8"
              opacity="0.65"
            />
            <path d={createPath(left)} fill="none" stroke={isAligned ? "#86efac" : "#93c5fd"} strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
            <path d={createPath(right)} fill="none" stroke={isAligned ? "#86efac" : "#93c5fd"} strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
            <path d={createPath(main)} fill="none" stroke={isAligned ? "#16a34a" : "#2563eb"} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

            {wallSegments.map((wall) => (
              <g key={wall.key}>
                <line
                  x1={wall.x1}
                  y1={wall.y1}
                  x2={wall.x2}
                  y2={wall.y2}
                  stroke={surfaces[wall.key] === "reflect" ? "#27272a" : "#f59e0b"}
                  strokeWidth="4"
                  strokeDasharray={surfaces[wall.key] === "reflect" ? undefined : "10 8"}
                  strokeLinecap="round"
                />
                <foreignObject x={wall.fx} y={wall.fy} width={wall.fw} height={wall.fh} style={{ overflow: "visible" }}>
                  <div data-map-control="true" className={`pointer-events-none flex h-full w-full items-center ${wall.align}`}>
                    <WallPassToggle
                      checked={surfaces[wall.key] === "pass"}
                      onChange={(checked) => updateSim("surfaces", { ...surfaces, [wall.key]: checked ? "pass" : "reflect" })}
                      className="pointer-events-auto"
                    />
                  </div>
                </foreignObject>
              </g>
            ))}

            <g transform={`translate(${scaleX(antenna.x)}, ${scaleY(antenna.y)})`}>
              <circle cx="0" cy="0" r="50" fill="none" stroke="rgba(37,99,235,0.14)" strokeWidth="1.5" strokeDasharray="4 5" />
              <MotionCircle cx="0" cy="0" r="10" fill="#2563eb" stroke="white" strokeWidth="3" animate={{ r: [10, 11.5, 10] }} transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }} pointerEvents="none" />
              <circle cx="0" cy="0" r="3.5" fill="white" pointerEvents="none" />
              <line x1="0" y1="0" x2={Math.sin(degToRad(localAntennaDirection)) * 42} y2={-Math.cos(degToRad(localAntennaDirection)) * 42} stroke="white" strokeWidth="3" strokeLinecap="round" pointerEvents="none" />
            </g>
            {/* Center antenna handle — invisible touch target */}
            <circle
              data-handle="true"
              cx={scaleX(antenna.x)}
              cy={scaleY(antenna.y)}
              r="36"
              fill="transparent"
              className="cursor-grab active:cursor-grabbing"
              onPointerDown={(event) => {
                event.stopPropagation();
                startDrag("antenna", event);
              }}
            />
            {/* Direction handle — invisible touch target */}
            <circle
              data-handle="true"
              cx={scaleX(antenna.x) + Math.cos(degToRad(localAntennaDirection - 90)) * 50}
              cy={scaleY(antenna.y) + Math.sin(degToRad(localAntennaDirection - 90)) * 50}
              r="36"
              fill="transparent"
              className={gyroControlsAntenna ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"}
              onPointerDown={(event) => {
                if (gyroControlsAntenna) return;
                event.stopPropagation();
                startDrag("direction", event);
                updateSim("antennaDirection", norm360(screenToDirection(event.clientX, event.clientY) + forwardBearing));
              }}
            />
            {/* Direction handle — visible dot */}
            <circle
              cx={scaleX(antenna.x) + Math.cos(degToRad(localAntennaDirection - 90)) * 50}
              cy={scaleY(antenna.y) + Math.sin(degToRad(localAntennaDirection - 90)) * 50}
              r="16"
              fill="rgba(37,99,235,0.22)"
              pointerEvents="none"
            />
            <circle
              cx={scaleX(antenna.x) + Math.cos(degToRad(localAntennaDirection - 90)) * 50}
              cy={scaleY(antenna.y) + Math.sin(degToRad(localAntennaDirection - 90)) * 50}
              r="6"
              fill="#2563eb"
              pointerEvents="none"
            />
          </svg>
        </div>

        <div className="grid gap-5 rounded-3xl border border-zinc-100 bg-zinc-50 p-4 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <SliderRow
              label="Antenna bearing"
              value={antennaDirection}
              onChange={(value) => updateSim("antennaDirection", value)}
              min={0}
              max={359}
              disabled={gyroControlsAntenna}
            />
            <SliderRow label="Beam spread" value={beamSpread} onChange={(value) => updateSim("beamSpread", value)} min={2} max={180} />
            <SliderRow label="Wall bounces" value={wallBounces} onChange={(value) => updateSim("wallBounces", value)} min={0} max={8} unit="" />
            <SliderRow label="Courtyard width" value={widthUnits} onChange={(value) => updateSim("widthUnits", value)} min={10} max={500} unit="m" />
            <SliderRow label="Courtyard depth" value={depthUnits} onChange={(value) => updateSim("depthUnits", value)} min={10} max={500} unit="m" />
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                label="Antenna X (m)"
                value={Number(antenna.x.toFixed(1))}
                min={0}
                max={widthUnits}
                step={0.1}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) {
                    updateSim("antenna", { ...antenna, x: clamp(value, 0.1, widthUnits - 0.1) });
                  }
                }}
              />
              <NumberField
                label="Antenna Y (m)"
                value={Number(antenna.y.toFixed(1))}
                min={0}
                max={depthUnits}
                step={0.1}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value)) {
                    updateSim("antenna", { ...antenna, y: clamp(value, 0.1, depthUnits - 0.1) });
                  }
                }}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
            {summaryCards.map((card) => (
              <StatCard key={card.label} label={card.label} value={card.value} accent={card.accent} />
            ))}
            {MAP_TIPS.map((tip) => (
              <InfoCard key={tip.label} icon={tip.icon === "move" ? Move : Waves} iconClassName={tip.tone}>
                {tip.text}
              </InfoCard>
            ))}
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-2 pt-2">
            <Button onClick={() => updateSim("resetMap")}>Reset map defaults</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
