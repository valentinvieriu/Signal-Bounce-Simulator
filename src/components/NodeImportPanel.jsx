import { useMemo, useRef, useState } from "react";
import { Crosshair, MapPinned, Upload } from "lucide-react";

import { getGeoMetrics } from "../lib/simulation";
import { Button, InfoCard, NumberField } from "./ui";

function NodeCard({ node, isActive, onSelect, onUpdate, onRemove, metrics }) {
  return (
    <div className={`rounded-2xl border p-3 shadow-sm transition-colors ${isActive ? "border-sky-200 bg-sky-50" : "border-zinc-100 bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <button type="button" onClick={onSelect} className="text-left text-sm font-semibold text-zinc-950 underline-offset-2 hover:underline">
            {node.name}
          </button>
          <p className="mt-1 text-xs text-zinc-500">
            Seq {node.seqNo || "—"} · {node.timestamp || "Unknown time"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onSelect} variant={isActive ? "default" : "secondary"} className="h-8 rounded-xl px-3 text-xs">
            {isActive ? "Selected" : "Use"}
          </Button>
          <Button onClick={onRemove} variant="secondary" className="h-8 rounded-xl px-3 text-xs">
            Remove
          </Button>
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <NumberField
          label="Latitude"
          value={node.latitude}
          step={0.000001}
          onChange={(event) => onUpdate({ latitude: Number(event.target.value) || 0 })}
        />
        <NumberField
          label="Longitude"
          value={node.longitude}
          step={0.000001}
          onChange={(event) => onUpdate({ longitude: Number(event.target.value) || 0 })}
        />
      </div>
      <div className="mt-3 grid gap-2 text-xs text-zinc-600 sm:grid-cols-2">
        <div className="rounded-xl bg-zinc-50 px-3 py-2">Alt: {node.altitude ?? "—"} m</div>
        <div className="rounded-xl bg-zinc-50 px-3 py-2">SNR: {node.snr ?? "—"} dB</div>
        <div className="rounded-xl bg-zinc-50 px-3 py-2">Sats: {node.sats ?? "—"}</div>
        <div className="rounded-xl bg-zinc-50 px-3 py-2">
          {metrics ? `${metrics.distanceKm.toFixed(3)} km · ${metrics.bearing.toFixed(1)}°` : "Waiting for reference location"}
        </div>
      </div>
    </div>
  );
}

export default function NodeImportPanel({
  importedNodes,
  activeNodeId,
  activeNodeMetrics,
  referenceLocation,
  locationStatus,
  requestCurrentLocation,
  onImportText,
  onSelectNode,
  onUpdateNode,
  onRemoveNode,
  onUpdateReferenceLocation,
}) {
  const fileInputRef = useRef(null);
  const [logText, setLogText] = useState("");
  const [importStatus, setImportStatus] = useState("Import CSV-style logs or paste them below to create editable node entries.");
  const [manualLocation, setManualLocation] = useState({ latitude: "", longitude: "" });

  const displayedManualLocation = {
    latitude: manualLocation.latitude === "" ? (referenceLocation?.latitude ?? "") : manualLocation.latitude,
    longitude: manualLocation.longitude === "" ? (referenceLocation?.longitude ?? "") : manualLocation.longitude,
  };

  const nodeMetricsMap = useMemo(
    () => Object.fromEntries(importedNodes.map((node) => [node.id, getGeoMetrics(referenceLocation, node)])),
    [importedNodes, referenceLocation],
  );

  const handleLogImport = (inputText) => {
    const result = onImportText(inputText);
    setImportStatus(result.message);
    if (result.imported > 0) {
      setLogText("");
    }
  };

  return (
    <div className="rounded-[2rem] border border-zinc-200 bg-white/90 p-6 shadow-sm md:p-7">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-zinc-950">Node log import</h3>
            <p className="mt-1 text-sm text-zinc-500">Import static logs, pick a node, and automatically solve its bearing and distance from your current position.</p>
          </div>
          <Button onClick={() => fileInputRef.current?.click()} variant="secondary" className="gap-2">
            <Upload className="h-4 w-4" />
            Upload log
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.csv"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) {
              return;
            }
            const text = await file.text();
            handleLogImport(text);
            event.target.value = "";
          }}
        />

        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <textarea
            value={logText}
            onChange={(event) => setLogText(event.target.value)}
            placeholder="Paste one or more node logs here…"
            className="min-h-32 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-950/10"
          />
          <div className="flex flex-col gap-2 md:w-44">
            <Button onClick={() => handleLogImport(logText)}>Import pasted logs</Button>
            <Button onClick={() => setLogText("")} variant="secondary">Clear</Button>
          </div>
        </div>

        <p className="text-xs text-zinc-500">{importStatus}</p>
        {activeNodeMetrics && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
            Active node solved from your reference point: {activeNodeMetrics.distanceKm.toFixed(3)} km away at {activeNodeMetrics.bearing.toFixed(1)}°.
          </div>
        )}

        <div className="grid gap-4 rounded-3xl border border-zinc-100 bg-zinc-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-zinc-950">Reference location</h4>
              <p className="mt-1 text-xs text-zinc-500">Works on phones through GPS and on desktop through the browser geolocation prompt.</p>
            </div>
            <Button onClick={requestCurrentLocation} className="gap-2">
              <Crosshair className="h-4 w-4" />
              Use my location
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              label="Latitude"
              value={displayedManualLocation.latitude}
              step={0.000001}
              onChange={(event) => setManualLocation((current) => ({ ...current, latitude: event.target.value }))}
            />
            <NumberField
              label="Longitude"
              value={displayedManualLocation.longitude}
              step={0.000001}
              onChange={(event) => setManualLocation((current) => ({ ...current, longitude: event.target.value }))}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => onUpdateReferenceLocation({
                latitude: Number(displayedManualLocation.latitude),
                longitude: Number(displayedManualLocation.longitude),
                source: "manual",
                label: "Manual location",
              }, "Manual reference location saved.")}
            >
              Save manual location
            </Button>
            {referenceLocation && (
              <div className="rounded-2xl bg-white px-4 py-2 text-xs text-zinc-600 shadow-sm">
                {referenceLocation.latitude}, {referenceLocation.longitude}
              </div>
            )}
          </div>
          <InfoCard icon={MapPinned}>{locationStatus}</InfoCard>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-zinc-950">Imported nodes</h4>
            <span className="text-xs text-zinc-500">{importedNodes.length} total</span>
          </div>
          {importedNodes.length ? (
            <div className="space-y-3">
              {importedNodes.map((node) => (
                <NodeCard
                  key={node.id}
                  node={node}
                  isActive={node.id === activeNodeId}
                  onSelect={() => onSelectNode(node.id)}
                  onUpdate={(updates) => onUpdateNode(node.id, updates)}
                  onRemove={() => onRemoveNode(node.id)}
                  metrics={nodeMetricsMap[node.id]}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
              No nodes imported yet. Upload a log file or paste the sample rows to create editable node positions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
