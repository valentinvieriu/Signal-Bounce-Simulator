import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Crosshair, MapPinned, Upload, X } from "lucide-react";

import {
  getGeolocationErrorMessage,
  getGeolocationSupportState,
  getPendingGeolocationMessage,
} from "../lib/geolocation";
import { extractNodeLogs, getGeoMetrics, normalizeGeoLocation } from "../lib/simulation";
import { Button, InfoCard, NumberField } from "./ui";

const MotionDiv = motion.div;

const STEPS = ["Your location", "Import log", "Pick a reading"];

function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${i <= current ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-400"}`}>
            {i + 1}
          </div>
          <span className={`text-xs ${i <= current ? "text-zinc-900" : "text-zinc-400"}`}>{label}</span>
          {i < STEPS.length - 1 && <div className="mx-1 h-px w-4 bg-zinc-200" />}
        </div>
      ))}
    </div>
  );
}

function StepLocation({ userLocation, onLocationSet }) {
  const [fields, setFields] = useState({ latitude: "", longitude: "" });
  const [status, setStatus] = useState("Use GPS or enter coordinates manually.");
  const pendingGpsHintRef = useRef(null);

  const clearPendingGpsHint = () => {
    if (pendingGpsHintRef.current !== null) {
      window.clearTimeout(pendingGpsHintRef.current);
      pendingGpsHintRef.current = null;
    }
  };

  useEffect(() => () => clearPendingGpsHint(), []);

  const requestGps = () => {
    const supportState = getGeolocationSupportState();
    if (!supportState.available) {
      setStatus(supportState.message);
      return;
    }

    clearPendingGpsHint();
    setStatus("Requesting your current location…");
    pendingGpsHintRef.current = window.setTimeout(() => {
      setStatus(getPendingGeolocationMessage());
      pendingGpsHintRef.current = null;
    }, 1500);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearPendingGpsHint();
        const normalized = normalizeGeoLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          source: "device",
          label: "My location",
        });

        if (!normalized) {
          setStatus("Location was returned, but could not be parsed.");
          return;
        }

        setFields({ latitude: normalized.latitude, longitude: normalized.longitude });
        onLocationSet(normalized);
        setStatus(`GPS location set (±${Math.round(normalized.accuracy ?? 0)} m).`);
      },
      (error) => {
        clearPendingGpsHint();
        setStatus(getGeolocationErrorMessage(error));
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 },
    );
  };

  const applyManual = () => {
    if (fields.latitude === "" || fields.longitude === "") {
      setStatus("Enter both latitude and longitude.");
      return;
    }
    const normalized = normalizeGeoLocation({
      latitude: Number(fields.latitude),
      longitude: Number(fields.longitude),
      source: "manual",
      label: "Manual location",
    });

    if (!normalized) {
      setStatus("Enter a valid latitude and longitude.");
      return;
    }

    onLocationSet(normalized);
    setStatus(`Location set to ${normalized.latitude}, ${normalized.longitude}.`);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">Where are you right now? We need this to calculate bearing and distance to the imported node.</p>

      <Button onClick={requestGps} className="gap-2">
        <Crosshair className="h-4 w-4" />
        Use my location
      </Button>

      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <NumberField
          label="Latitude"
          value={fields.latitude}
          step={0.000001}
          onChange={(e) => setFields((f) => ({ ...f, latitude: e.target.value }))}
        />
        <NumberField
          label="Longitude"
          value={fields.longitude}
          step={0.000001}
          onChange={(e) => setFields((f) => ({ ...f, longitude: e.target.value }))}
        />
        <Button className="self-end" variant="secondary" onClick={applyManual}>Set</Button>
      </div>

      <InfoCard icon={MapPinned}>{status}</InfoCard>

      {userLocation && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          Ready: {userLocation.latitude}, {userLocation.longitude}
        </div>
      )}
    </div>
  );
}

function StepImport({ onNodesFound }) {
  const fileInputRef = useRef(null);
  const [logText, setLogText] = useState("");
  const [status, setStatus] = useState("Upload a CSV file or paste node log rows below.");

  const handleImport = (text) => {
    const nodes = extractNodeLogs(text);
    if (!nodes.length) {
      setStatus("No valid node rows found. Check the format and try again.");
      return;
    }
    setStatus(`Found ${nodes.length} node${nodes.length === 1 ? "" : "s"}.`);
    onNodesFound(nodes);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">Upload or paste a CSV-style log containing node coordinates.</p>

      <div className="flex gap-2">
        <Button onClick={() => fileInputRef.current?.click()} variant="secondary" className="gap-2">
          <Upload className="h-4 w-4" />
          Upload file
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.csv"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const text = await file.text();
            setLogText(text);
            handleImport(text);
            e.target.value = "";
          }}
        />
      </div>

      <textarea
        value={logText}
        onChange={(e) => setLogText(e.target.value)}
        placeholder="Paste node logs here…"
        className="min-h-32 w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-950/10"
      />

      <Button onClick={() => handleImport(logText)}>Import</Button>

      <p className="text-xs text-zinc-500">{status}</p>
    </div>
  );
}

function StepPickNode({ nodes, onPick }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">Multiple readings found. Pick the one you want to use as the target node.</p>
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            onClick={() => onPick(node)}
            className="flex w-full items-center justify-between rounded-2xl border border-zinc-100 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50"
          >
            <div>
              <p className="text-sm font-semibold text-zinc-950">{node.name}</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {node.latitude.toFixed(6)}, {node.longitude.toFixed(6)} · {node.timestamp}
              </p>
            </div>
            <span className="text-xs font-medium text-zinc-400">Select</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function NodeImportWizard({ open, onClose, onComplete }) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && <WizardContent onClose={onClose} onComplete={onComplete} />}
    </AnimatePresence>
  );
}

function WizardContent({ onClose, onComplete }) {
  const [step, setStep] = useState(0);
  const [userLocation, setUserLocation] = useState(null);
  const [parsedNodes, setParsedNodes] = useState([]);

  const completeWithNode = (node) => {
    const metrics = getGeoMetrics(userLocation, node);
    if (metrics) {
      onComplete(
        Math.round(metrics.bearing * 10) / 10,
        Math.round(metrics.distanceKm * 1000) / 1000,
      );
    }
  };

  const handleNodesFound = (nodes) => {
    setParsedNodes(nodes);
    if (nodes.length === 1) {
      completeWithNode(nodes[0]);
    } else {
      setStep(2);
    }
  };

  return (
    <MotionDiv
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <MotionDiv
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <MotionDiv
        className="relative z-10 w-full max-w-lg rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-xl md:p-8"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ type: "spring", damping: 26, stiffness: 300 }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-zinc-950">Import node location</h2>
            <div className="mt-3">
              <StepIndicator current={step} />
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === 0 && (
          <StepLocation userLocation={userLocation} onLocationSet={setUserLocation} />
        )}
        {step === 1 && (
          <StepImport onNodesFound={handleNodesFound} />
        )}
        {step === 2 && (
          <StepPickNode nodes={parsedNodes} onPick={completeWithNode} />
        )}

        <div className="mt-6 flex justify-between">
          {step > 0 ? (
            <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>Back</Button>
          ) : (
            <div />
          )}
          {step === 0 && (
            <Button onClick={() => setStep(1)} disabled={!userLocation}>
              Next
            </Button>
          )}
        </div>
      </MotionDiv>
    </MotionDiv>
  );
}
