import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Ruler, Navigation, Move, Waves } from "lucide-react";

// --- Math & Simulation Utilities ---

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const degToRad = (d) => (d * Math.PI) / 180;
const radToDeg = (r) => (r * 180) / Math.PI;
const norm360 = (d) => ((d % 360) + 360) % 360;
const shortestDelta = (from, to) => (((norm360(to) - norm360(from) + 540) % 360) - 180);
const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

const DEFAULTS = {
  distanceKm: 5.32,
  targetBearing: 206,
  forwardBearing: 188,
  antennaDirection: 206,
  beamSpread: 120,
  wallBounces: 2,
  widthUnits: 68,
  depthUnits: 22,
  antenna: { x: 34, y: 11 },
  surfaces: { top: "reflect", right: "reflect", bottom: "reflect", left: "reflect" },
};

function traceRay({ origin, bearingLocalDeg, width, depth, maxReflections, escapeDistanceUnits, forwardBearingDeg, surfaces }) {
  let x = clamp(origin.x, 0.1, width - 0.1), y = clamp(origin.y, 0.1, depth - 0.1);
  let dx = Math.sin(degToRad(norm360(bearingLocalDeg))), dy = -Math.cos(degToRad(norm360(bearingLocalDeg)));
  let reflectionsUsed = 0, exitedVia = null, didExit = false;
  const points = [{ x, y }];

  for (let step = 0; step < 48; step++) {
    const hits = [
      { wall: "left", t: dx < 0 ? (0 - x) / dx : Infinity },
      { wall: "right", t: dx > 0 ? (width - x) / dx : Infinity },
      { wall: "top", t: dy < 0 ? (0 - y) / dy : Infinity },
      { wall: "bottom", t: dy > 0 ? (depth - y) / dy : Infinity },
    ].filter(h => h.t > 1e-4);

    const hit = hits.length ? hits.reduce((b, c) => (c.t < b.t ? c : b)) : null;

    if (!hit) {
      points.push({ x: x + dx * escapeDistanceUnits, y: y + dy * escapeDistanceUnits });
      didExit = true; break;
    }

    x += dx * hit.t; y += dy * hit.t;
    points.push({ x, y });

    if (surfaces[hit.wall] === "pass" || reflectionsUsed >= maxReflections) {
      points.push({ x: x + dx * escapeDistanceUnits, y: y + dy * escapeDistanceUnits });
      exitedVia = hit.wall; didExit = true; break;
    }

    reflectionsUsed++;
    if (hit.wall === "left" || hit.wall === "right") dx = -dx; else dy = -dy;
  }

  let pathDistanceUnits = points.reduce((acc, p, i, arr) => acc + (i ? distance(arr[i - 1], p) : 0), 0);
  const finalLocalBearing = norm360(radToDeg(Math.atan2(dx, -dy)));

  return { points, finalTrueBearing: norm360(finalLocalBearing + forwardBearingDeg), pathDistanceUnits, exitedVia, reflectionsUsed, didExit };
}

// --- Custom Hooks ---

function useDeviceHeading(enabled) {
  const [heading, setHeading] = useState(null);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const handler = (e) => {
      const h = typeof e.webkitCompassHeading === "number" ? e.webkitCompassHeading : (typeof e.alpha === "number" ? norm360(360 - e.alpha) : null);
      if (h !== null) setHeading(h);
    };
    setSupported("DeviceOrientationEvent" in window);
    window.DeviceOrientationEvent?.requestPermission?.().then(p => p === "granted" && window.addEventListener("deviceorientation", handler, true)).catch(() => {});
    window.addEventListener("deviceorientation", handler, true);
    return () => window.removeEventListener("deviceorientation", handler, true);
  }, [enabled]);

  return { heading, supported };
}

// --- Internal UI Components ---

const Label = ({ children, className = "" }) => <label className={`text-sm font-medium text-zinc-700 ${className}`}>{children}</label>;
const Badge = ({ children, className = "" }) => <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className}`}>{children}</div>;
const Button = ({ children, onClick, variant = "default", className = "" }) => (
  <button onClick={onClick} className={`inline-flex items-center justify-center rounded-2xl text-sm font-medium h-10 px-4 py-2 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-950 ${variant === "default" ? "bg-zinc-900 text-zinc-50 hover:bg-zinc-900/90" : "bg-zinc-100 text-zinc-900 hover:bg-zinc-100/80"} ${className}`}>{children}</button>
);

const Switch = ({ checked, onCheckedChange }) => (
  <button type="button" role="switch" aria-checked={checked} onClick={() => onCheckedChange(!checked)} className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${checked ? "bg-zinc-900" : "bg-zinc-200"}`}>
    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? "translate-x-5" : "translate-x-1"}`} />
  </button>
);

const SliderRow = ({ label, value, onChange, min, max, step = 1, unit = "\u00B0", note, disabled = false }) => (
  <div className={`space-y-2 ${disabled ? "opacity-50 grayscale pointer-events-none" : ""}`}>
    <div className="flex items-center justify-between gap-3">
      <Label>{label}</Label>
      <span className="text-xs font-medium tabular-nums text-zinc-500">{Math.round(value)}{unit}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value) || min)} className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-zinc-200 accent-zinc-900 outline-none" />
    {note && <p className="text-xs text-zinc-500">{note}</p>}
  </div>
);

const WallPassToggle = ({ checked, onChange, className = "" }) => (
  <label className={`flex cursor-pointer items-center gap-2 rounded-2xl border border-zinc-200 bg-white/95 px-3 py-1.5 text-xs shadow-sm transition-colors hover:bg-zinc-50 ${className}`}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded border-zinc-300 accent-amber-500 cursor-pointer" />
    <span className="font-medium text-zinc-600">Pass</span>
  </label>
);

// --- Main Views ---

function Compass({ sim, updateSim, useCompass, setUseCompass, heading, supported }) {
  const { distanceKm, forwardBearing, targetBearing, antennaDirection } = sim;
  const size = 330, r = size / 2, dialRef = useRef(null);
  const [dragMode, setDragMode] = useState(null);

  const pointToAngle = (clientX, clientY) => {
    const rect = dialRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return norm360(radToDeg(Math.atan2(clientY - rect.top - rect.height / 2, clientX - rect.left - rect.width / 2)) + 90);
  };

  const getPos = (bearing, radius) => ({ x: r + Math.cos(degToRad(norm360(bearing - forwardBearing) - 90)) * radius, y: r + Math.sin(degToRad(norm360(bearing - forwardBearing) - 90)) * radius });
  const north = getPos(0, r - 16), target = getPos(targetBearing, r - 80), dir = getPos(antennaDirection, r - 116);

  return (
    <div className="rounded-[2rem] border border-zinc-200 bg-white/90 shadow-sm flex flex-col">
      <div className="space-y-6 p-6 md:p-7">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-black">Compass</h2>
          <p className="mt-1 text-sm text-zinc-500">Preview target bearing, and antenna direction.</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "North", val: forwardBearing, color: "bg-zinc-900", desc: "Rotates dial to true north." },
            { label: "Target", val: targetBearing, color: "bg-[#bf8d8c]", desc: "Sets signal exit bearing." },
            { label: "Antenna", val: antennaDirection, color: "bg-blue-600", desc: "Points antenna indoors." }
          ].map((item) => (
            <div key={item.label} className="flex flex-col gap-2 rounded-2xl border border-zinc-100 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-2">
                <div className={`h-3 w-1.5 rounded-full ${item.color}`} />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{item.label}</span>
              </div>
              <span className="text-2xl font-semibold text-zinc-900 leading-none">{Math.round(item.val)}{"\u00B0"}</span>
              <span className="text-[11px] leading-tight text-zinc-500">{item.desc}</span>
            </div>
          ))}
        </div>

        <div className="flex justify-center pt-2"><div className="h-12 w-1.5 rounded-full bg-zinc-900" /></div>

        <div className="flex items-center justify-center">
          <svg
            ref={dialRef} viewBox={`0 0 ${size} ${size}`} className="h-[330px] w-[330px] touch-none select-none"
            onPointerMove={(e) => {
              if (!dragMode) return;
              const angle = pointToAngle(e.clientX, e.clientY);
              if (dragMode === "north" && !useCompass) updateSim("forwardBearing", norm360(-angle));
              if (dragMode === "node") updateSim("targetBearing", norm360(forwardBearing + angle));
              if (dragMode === "direction") updateSim("antennaDirection", norm360(forwardBearing + angle));
            }}
            onPointerUp={(e) => { setDragMode(null); dialRef.current?.releasePointerCapture(e.pointerId); }}
            onPointerLeave={() => setDragMode(null)}
          >
            <g>
              {Array.from({ length: 36 }, (_, i) => i * 10).map((step) => {
                const a = degToRad(step - 90 - forwardBearing);
                const isCardinal = step % 90 === 0;
                const isMajor = step % 30 === 0;
                const innerR = isCardinal ? r - 64 : isMajor ? r - 54 : r - 46;
                const outerR = r - 28;
                return (
                  <line key={step} x1={r + Math.cos(a)*innerR} y1={r + Math.sin(a)*innerR} x2={r + Math.cos(a)*outerR} y2={r + Math.sin(a)*outerR} stroke={isCardinal ? "#111111" : isMajor ? "#71717a" : "#d4d4d8"} strokeWidth={isCardinal ? 4 : isMajor ? 2.5 : 1.5} strokeLinecap="round" />
                );
              })}
              {Array.from({ length: 12 }, (_, i) => i * 30).map((step) => {
                const a = degToRad(step - 90 - forwardBearing);
                const isCardinal = step % 90 === 0;
                const label = step === 0 ? "N" : step === 90 ? "E" : step === 180 ? "S" : step === 270 ? "W" : `${step}`;
                return (
                  <text key={`l${step}`} x={r + Math.cos(a)*(r-10)} y={r + Math.sin(a)*(r-10)+6} textAnchor="middle" fontSize={isCardinal ? "15" : "12"} fontWeight={isCardinal ? "700" : "500"} fill="#171717">{label}</text>
                );
              })}
            </g>

            <circle cx={r} cy={r} r={r-80} fill="none" stroke="rgba(191,141,140,0.4)" strokeWidth="1.5" strokeDasharray="4 5" pointerEvents="none" />
            <circle cx={r} cy={r} r={r-116} fill="none" stroke="rgba(37,99,235,0.4)" strokeWidth="1.5" strokeDasharray="4 5" pointerEvents="none" />

            {[
              { id: "north", x: north.x, y: north.y, fill: "rgba(17,24,39,0.14)", dot: "#111827", lock: useCompass },
              { id: "node", x: target.x, y: target.y, fill: "rgba(191,141,140,0.22)", dot: "#bf8d8c" },
              { id: "direction", x: dir.x, y: dir.y, fill: "rgba(37,99,235,0.22)", dot: "#2563eb" }
            ].map((h) => (
              <g key={h.id}>
                <circle cx={h.x} cy={h.y} r="16" fill={h.fill} stroke="transparent" className={h.lock ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"} onPointerDown={(e) => { if(h.lock) return; e.stopPropagation(); setDragMode(h.id); dialRef.current?.setPointerCapture(e.pointerId); }} />
                <circle cx={h.x} cy={h.y} r="6" fill={h.dot} pointerEvents="none" />
              </g>
            ))}
          </svg>
        </div>

        <div className="grid gap-4 rounded-3xl bg-zinc-50 p-4 border border-zinc-100 mt-2">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-sm font-medium text-zinc-900">Use device compass</p><p className="mt-1 text-xs text-zinc-500">Drag dots to adjust orientation manually.</p></div>
            <Switch checked={useCompass} onCheckedChange={setUseCompass} />
          </div>
          <div className="space-y-4 rounded-3xl border border-zinc-100 bg-white p-4 shadow-sm">
            <SliderRow label="Forward bearing" value={forwardBearing} onChange={(v) => updateSim("forwardBearing", v)} min={0} max={359} disabled={useCompass} />
            <SliderRow label="Target node" value={targetBearing} onChange={(v) => updateSim("targetBearing", v)} min={0} max={359} />
            <SliderRow label="Antenna bearing" value={antennaDirection} onChange={(v) => updateSim("antennaDirection", v)} min={0} max={359} />
          </div>
          <div className="space-y-2">
            <Label>Node distance (km)</Label>
            <input type="number" min="0" step="0.01" value={distanceKm} onChange={(e) => updateSim("distanceKm", Math.max(0, Number(e.target.value) || 0))} className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-950/10" />
          </div>
          <div className="text-xs text-zinc-500">{supported ? `Live heading ${heading !== null ? `${Math.round(heading)}\u00B0` : "waiting\u2026"}` : "Compass sensor not detected."}</div>
          <div className="flex flex-wrap gap-2 pt-2"><Button onClick={() => { updateSim("forwardBearing", DEFAULTS.forwardBearing); updateSim("targetBearing", DEFAULTS.targetBearing); updateSim("antennaDirection", DEFAULTS.antennaDirection); updateSim("distanceKm", DEFAULTS.distanceKm); setUseCompass(false); }}>Reset compass</Button></div>
        </div>
      </div>
    </div>
  );
}

function MapView({ sim, updateSim }) {
  const { widthUnits, depthUnits, beamSpread, wallBounces, forwardBearing, targetBearing, antennaDirection, distanceKm, antenna, surfaces } = sim;
  const viewWidth = 700, viewDepth = 500, paddingX = 90, paddingY = 65, mapRef = useRef(null);
  const [dragMode, setDragMode] = useState(null);

  const maxW = viewWidth - paddingX * 2, maxH = viewDepth - paddingY * 2;
  const mapW = (widthUnits / depthUnits > maxW / maxH) ? maxW : maxH * (widthUnits / depthUnits);
  const mapH = (widthUnits / depthUnits > maxW / maxH) ? maxW / (widthUnits / depthUnits) : maxH;
  const mapX = paddingX + (maxW - mapW) / 2, mapY = paddingY + (maxH - mapH) / 2;

  const sx = (x) => mapX + (x / widthUnits) * mapW;
  const sy = (y) => mapY + (y / depthUnits) * mapH;
  const getSvgPoint = (cx, cy) => { const pt = mapRef.current?.createSVGPoint(); if(!pt) return {x:0, y:0}; pt.x = cx; pt.y = cy; return pt.matrixTransform(mapRef.current.getScreenCTM().inverse()); };
  const fromScreen = (cx, cy) => { const p = getSvgPoint(cx, cy); return { x: clamp(((p.x - mapX) / mapW) * widthUnits, 0.1, widthUnits - 0.1), y: clamp(((p.y - mapY) / mapH) * depthUnits, 0.1, depthUnits - 0.1) }; };
  const screenToDir = (cx, cy) => { const p = getSvgPoint(cx, cy); return norm360(radToDeg(Math.atan2(p.x - sx(antenna.x), sy(antenna.y) - p.y))); };

  const localAntennaDir = norm360(antennaDirection - forwardBearing);
  const escapeDistance = Math.max(500, Math.min(distanceKm * 1000, 20000));
  const gridPx = (mapW / widthUnits) * (Math.max(widthUnits, depthUnits) > 200 ? 25 : Math.max(widthUnits, depthUnits) > 100 ? 10 : Math.max(widthUnits, depthUnits) > 40 ? 5 : Math.max(widthUnits, depthUnits) > 10 ? 2 : 1);

  const rayParams = { origin: antenna, width: widthUnits, depth: depthUnits, maxReflections: wallBounces, escapeDistanceUnits: escapeDistance, forwardBearingDeg: forwardBearing, surfaces };
  const main = useMemo(() => traceRay({ ...rayParams, bearingLocalDeg: localAntennaDir }), [JSON.stringify(rayParams), localAntennaDir]);
  const left = useMemo(() => traceRay({ ...rayParams, bearingLocalDeg: localAntennaDir - beamSpread / 2 }), [JSON.stringify(rayParams), localAntennaDir, beamSpread]);
  const right = useMemo(() => traceRay({ ...rayParams, bearingLocalDeg: localAntennaDir + beamSpread / 2 }), [JSON.stringify(rayParams), localAntennaDir, beamSpread]);

  const isAligned = main.didExit && Math.abs(shortestDelta(main.finalTrueBearing, targetBearing)) <= 2;
  const makePath = (sim) => sim.points.map((p, i) => `${i === 0 ? "M" : "L"} ${sx(p.x)} ${sy(p.y)}`).join(" ");

  const walls = [
    { k: "top", x1: mapX, y1: mapY, x2: mapX + mapW, y2: mapY, fx: mapX, fy: mapY - 46, fw: mapW, fh: 40, align: "justify-center" },
    { k: "right", x1: mapX + mapW, y1: mapY, x2: mapX + mapW, y2: mapY + mapH, fx: mapX + mapW, fy: mapY, fw: 80, fh: mapH, align: "justify-start pl-3" },
    { k: "bottom", x1: mapX, y1: mapY + mapH, x2: mapX + mapW, y2: mapY + mapH, fx: mapX, fy: mapY + mapH + 6, fw: mapW, fh: 40, align: "justify-center" },
    { k: "left", x1: mapX, y1: mapY, x2: mapX, y2: mapY + mapH, fx: mapX - 80, fy: mapY, fw: 80, fh: mapH, align: "justify-end pr-3" }
  ];

  return (
    <div className="rounded-[2rem] border border-zinc-200 bg-white/90 shadow-sm flex flex-col">
      <div className="flex flex-col space-y-1.5 p-6 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-zinc-950">
          <div><p className="text-xl font-semibold tracking-tight">Courtyard map</p><p className="mt-1 text-sm font-normal text-zinc-500">Drag to move or rotate antenna. Choose pass/reflect for walls.</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={isAligned ? "bg-emerald-100 text-emerald-800 border-transparent" : "bg-zinc-100 text-zinc-700 border-transparent"}>{isAligned ? "Bearing matched" : main.didExit ? "Exited but off target" : "No exit"}</Badge>
            <Badge className="bg-zinc-100 text-zinc-700 border-transparent">{main.didExit ? `Exit ${main.finalTrueBearing.toFixed(1)}\u00B0` : "Contained"}</Badge>
          </div>
        </div>
      </div>

      <div className="p-6 pt-0 space-y-5">
        <div className="relative overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-[#f7f7f7] p-2">
          <svg
            ref={mapRef} viewBox={`0 0 ${viewWidth} ${viewDepth}`} className="h-[500px] w-full touch-none"
            onPointerDown={(e) => { if (e.target.tagName !== 'circle' || e.target.getAttribute('data-handle') !== 'true') { setDragMode("antenna"); updateSim("antenna", fromScreen(e.clientX, e.clientY)); e.currentTarget.setPointerCapture(e.pointerId); } }}
            onPointerMove={(e) => { if (dragMode === "antenna" && e.buttons) updateSim("antenna", fromScreen(e.clientX, e.clientY)); else if (dragMode === "direction") updateSim("antennaDirection", norm360(screenToDir(e.clientX, e.clientY) + forwardBearing)); }}
            onPointerUp={(e) => { setDragMode(null); mapRef.current?.releasePointerCapture(e.pointerId); }}
            onPointerLeave={() => setDragMode(null)}
          >
            <defs><pattern id="grid" x={mapX} y={mapY} width={gridPx} height={gridPx} patternUnits="userSpaceOnUse"><rect width={gridPx} height={gridPx} fill="none" stroke="rgba(161,161,170,0.18)" strokeWidth="1" /></pattern></defs>
            <rect x="0" y="0" width={viewWidth} height={viewDepth} fill="#f7f7f7" />
            <rect x={mapX} y={mapY} width={mapW} height={mapH} rx="26" fill="rgba(255,255,255,0.9)" />
            <rect x={mapX} y={mapY} width={mapW} height={mapH} rx="26" fill="url(#grid)" />

            <text x={viewWidth / 2} y="18" textAnchor="middle" fontSize="12" fill="#71717a">Top edge = courtyard front {"\u00B7"} north relative to this front edge</text>
            <text x={24} y={18} fontSize="12" fontWeight="500" fill="#71717a">Grid: {Math.round((gridPx/mapW)*widthUnits)}m</text>
            <text x={mapX + mapW / 2} y={mapY - 48} textAnchor="middle" fontSize="12" fontWeight="700" letterSpacing="2" fill="#64748b">FRONT</text>

            <g transform={`translate(${viewWidth - 68}, 62) rotate(${-forwardBearing})`}>
              <circle cx="0" cy="0" r="20" fill="#f8fafc" stroke="#d4d4d8" strokeWidth="1.5" />
              <path d="M-6,0 L0,-14 L6,0 Z" fill="#ef4444" /><path d="M-6,0 L0,14 L6,0 Z" fill="#94a3b8" />
              <text x="0" y="-20" textAnchor="middle" fontSize="11" fontWeight="700" fill="#ef4444">N</text><text x="0" y="28" textAnchor="middle" fontSize="11" fontWeight="700" fill="#64748b">S</text>
            </g>

            <line x1={sx(antenna.x)} y1={sy(antenna.y)} x2={sx(antenna.x + Math.sin(degToRad(norm360(targetBearing - forwardBearing))) * escapeDistance)} y2={sy(antenna.y - Math.cos(degToRad(norm360(targetBearing - forwardBearing))) * escapeDistance)} stroke="#d08484" strokeWidth="2" strokeDasharray="8 8" opacity="0.65" />
            <path d={makePath(left)} fill="none" stroke={isAligned ? "#86efac" : "#93c5fd"} strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
            <path d={makePath(right)} fill="none" stroke={isAligned ? "#86efac" : "#93c5fd"} strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
            <path d={makePath(main)} fill="none" stroke={isAligned ? "#16a34a" : "#2563eb"} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />

            {walls.map((w) => (
              <React.Fragment key={w.k}>
                <line x1={w.x1} y1={w.y1} x2={w.x2} y2={w.y2} stroke={surfaces[w.k] === "reflect" ? "#27272a" : "#f59e0b"} strokeWidth="4" strokeDasharray={surfaces[w.k] === "reflect" ? undefined : "10 8"} strokeLinecap="round" />
                <foreignObject x={w.fx} y={w.fy} width={w.fw} height={w.fh} style={{ overflow: "visible" }}>
                  <div className={`w-full h-full flex items-center pointer-events-none ${w.align}`}>
                    <WallPassToggle checked={surfaces[w.k] === "pass"} onChange={(c) => updateSim("surfaces", { ...surfaces, [w.k]: c ? "pass" : "reflect" })} className="pointer-events-auto" />
                  </div>
                </foreignObject>
              </React.Fragment>
            ))}

            <g transform={`translate(${sx(antenna.x)}, ${sy(antenna.y)})`}>
              <circle cx="0" cy="0" r="34" fill="none" stroke="rgba(37,99,235,0.14)" strokeWidth="1.5" strokeDasharray="4 5" />
              <motion.circle cx="0" cy="0" r="10" fill="#2563eb" stroke="white" strokeWidth="3" animate={{ r: [10, 11.5, 10] }} transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }} />
              <circle cx="0" cy="0" r="3.5" fill="white" />
              <line x1="0" y1="0" x2={Math.sin(degToRad(localAntennaDir)) * 26} y2={-Math.cos(degToRad(localAntennaDir)) * 26} stroke="white" strokeWidth="3" strokeLinecap="round" />
            </g>
            <circle data-handle="true" cx={sx(antenna.x) + Math.cos(degToRad(localAntennaDir - 90)) * 34} cy={sy(antenna.y) + Math.sin(degToRad(localAntennaDir - 90)) * 34} r="16" fill="rgba(37,99,235,0.22)" stroke="transparent" className="cursor-grab active:cursor-grabbing" onPointerDown={(e) => { e.stopPropagation(); setDragMode("direction"); mapRef.current?.setPointerCapture(e.pointerId); updateSim("antennaDirection", norm360(screenToDir(e.clientX, e.clientY) + forwardBearing)); }} />
            <circle cx={sx(antenna.x) + Math.cos(degToRad(localAntennaDir - 90)) * 34} cy={sy(antenna.y) + Math.sin(degToRad(localAntennaDir - 90)) * 34} r="6" fill="#2563eb" pointerEvents="none" />
          </svg>
        </div>

        <div className="grid gap-5 rounded-3xl bg-zinc-50 border border-zinc-100 p-4 md:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <SliderRow label="Antenna bearing" value={antennaDirection} onChange={(v) => updateSim("antennaDirection", v)} min={0} max={359} />
            <SliderRow label="Beam spread" value={beamSpread} onChange={(v) => updateSim("beamSpread", v)} min={2} max={180} />
            <SliderRow label="Wall bounces" value={wallBounces} onChange={(v) => updateSim("wallBounces", v)} min={0} max={8} unit="" />
            <SliderRow label="Courtyard width" value={widthUnits} onChange={(v) => updateSim("widthUnits", v)} min={10} max={500} unit="m" />
            <SliderRow label="Courtyard depth" value={depthUnits} onChange={(v) => updateSim("depthUnits", v)} min={10} max={500} unit="m" />
            <div className="grid gap-3 grid-cols-2">
              <div className="space-y-2">
                <Label>Antenna X (m)</Label>
                <input type="number" min={0} max={widthUnits} step={0.1} value={Number(antenna.x.toFixed(1))} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) updateSim("antenna", { ...antenna, x: clamp(v, 0.1, widthUnits - 0.1) }); }} className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-950/10" />
              </div>
              <div className="space-y-2">
                <Label>Antenna Y (m)</Label>
                <input type="number" min={0} max={depthUnits} step={0.1} value={Number(antenna.y.toFixed(1))} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) updateSim("antenna", { ...antenna, y: clamp(v, 0.1, depthUnits - 0.1) }); }} className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-950/10" />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
            {[
              { label: "Building size", value: `${widthUnits.toFixed(1)} m \u00D7 ${depthUnits.toFixed(1)} m` },
              { label: "Antenna position", value: `X ${antenna.x.toFixed(1)} m \u00B7 Y ${antenna.y.toFixed(1)} m` },
              { label: "Exit bearing", value: main.didExit ? `${main.finalTrueBearing.toFixed(1)}\u00B0` : "\u2014", accent: isAligned },
              { label: "Path length", value: `${(main.pathDistanceUnits / 1000).toFixed(2)} km` },
              { label: "Reflections", value: String(main.reflectionsUsed) },
              { label: "Alignment error", value: main.didExit ? `${Math.abs(shortestDelta(main.finalTrueBearing, targetBearing)).toFixed(1)}\u00B0` : "\u2014" },
            ].map((m) => (
              <div key={m.label} className="rounded-3xl border border-zinc-100 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-zinc-500">{m.label}</p>
                <p className={`mt-1 text-lg font-semibold ${m.accent ? "text-emerald-700" : "text-zinc-950"}`}>{m.value}</p>
              </div>
            ))}
            <div className="rounded-3xl border border-zinc-100 bg-white p-4 shadow-sm text-sm text-zinc-600">
              <div className="flex items-start gap-3"><Move className="mt-0.5 h-4 w-4 shrink-0 text-[#bf8d8c]" /><p>Drag center blue dot to move antenna. Drag outer blue dot to change direction.</p></div>
            </div>
            <div className="rounded-3xl border border-zinc-100 bg-white p-4 shadow-sm text-sm text-zinc-600">
              <div className="flex items-start gap-3"><Waves className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" /><p>Open edges let the signal leave the building. Closed edges reflect it.</p></div>
            </div>
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-2 pt-2"><Button onClick={() => updateSim("resetMap")}>Reset map defaults</Button></div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [sim, setSim] = useState(DEFAULTS);
  const [useCompass, setUseCompass] = useState(false);
  const { heading, supported } = useDeviceHeading(useCompass);

  const updateSim = (key, val) => setSim(s => {
    if (key === "resetMap") return { ...s, antennaDirection: DEFAULTS.antennaDirection, beamSpread: DEFAULTS.beamSpread, wallBounces: DEFAULTS.wallBounces, widthUnits: DEFAULTS.widthUnits, depthUnits: DEFAULTS.depthUnits, antenna: DEFAULTS.antenna, surfaces: DEFAULTS.surfaces };
    const next = typeof val === "function" ? val(s[key]) : val;
    return { ...s, [key]: next };
  });

  useEffect(() => { if (useCompass && heading !== null) updateSim("forwardBearing", Math.round(heading)); }, [useCompass, heading]);
  useEffect(() => { updateSim("antenna", p => ({ x: clamp(p.x, 0.1, sim.widthUnits - 0.1), y: clamp(p.y, 0.1, sim.depthUnits - 0.1) })); }, [sim.widthUnits, sim.depthUnits]);

  return (
    <div className="min-h-screen bg-[#ececec] text-zinc-950 font-sans">
      <div className="mx-auto max-w-[1500px] p-4 md:p-6 xl:p-8">
        <div className="mb-6">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">RF Propagation {"\u00B7"} Ray Tracing</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-black md:text-4xl">Signal Bounce Simulator</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600 md:text-base">Configure true north and target node placement. Adjust the transmitter direction and test wall materials to simulate signal paths.</p>
        </div>
        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Compass sim={sim} updateSim={updateSim} useCompass={useCompass} setUseCompass={setUseCompass} heading={heading} supported={supported} />
          <MapView sim={sim} updateSim={updateSim} />
        </div>
      </div>
    </div>
  );
}
