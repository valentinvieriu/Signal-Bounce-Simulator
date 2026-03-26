export function Label({ children, className = "" }) {
  return <label className={`text-sm font-medium text-zinc-700 ${className}`}>{children}</label>;
}

export function Badge({ children, className = "" }) {
  return (
    <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className}`}>
      {children}
    </div>
  );
}

export function Button({ children, variant = "default", className = "", disabled = false, type = "button", ...props }) {
  const variantClassName =
    variant === "default"
      ? "bg-zinc-900 text-zinc-50 hover:bg-zinc-900/90"
      : "bg-zinc-100 text-zinc-900 hover:bg-zinc-100/80";

  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex h-10 items-center justify-center rounded-2xl px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-zinc-950 disabled:cursor-not-allowed disabled:opacity-50 ${variantClassName} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Switch({ checked, onCheckedChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors ${checked ? "bg-zinc-900" : "bg-zinc-200"}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? "translate-x-5" : "translate-x-1"}`}
      />
    </button>
  );
}

export function SliderRow({ label, value, onChange, min, max, step = 1, unit = "°", note, disabled = false }) {
  return (
    <div className={`space-y-2 ${disabled ? "pointer-events-none opacity-50 grayscale" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <span className="text-xs font-medium tabular-nums text-zinc-500">
          {Math.round(value)}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value) || min)}
        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 accent-zinc-900 outline-none"
      />
      {note && <p className="text-xs text-zinc-500">{note}</p>}
    </div>
  );
}

export function NumberField({ label, value, onChange, min, max, step = 1 }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        className="h-11 w-full rounded-2xl border border-zinc-200 bg-white px-4 text-sm text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-950/10"
      />
    </div>
  );
}

export function WallMaterialSelect({ value, onChange, materials, className = "" }) {
  const current = materials[value] ?? materials.concrete;
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`cursor-pointer rounded-2xl border border-zinc-200 bg-white/95 px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm outline-none transition-colors hover:bg-zinc-50 focus:ring-2 focus:ring-zinc-950/10 ${className}`}
      style={{ borderLeftColor: current.color, borderLeftWidth: 3 }}
    >
      {Object.entries(materials).map(([key, mat]) => (
        <option key={key} value={key}>{mat.label}</option>
      ))}
    </select>
  );
}

export function StatCard({ label, value, accent = false }) {
  return (
    <div className="rounded-3xl border border-zinc-100 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${accent ? "text-emerald-700" : "text-zinc-950"}`}>{value}</p>
    </div>
  );
}

export function InfoCard({ icon, iconClassName = "text-zinc-500", children }) {
  const IconComponent = icon;

  return (
    <div className="rounded-3xl border border-zinc-100 bg-white p-4 shadow-sm text-sm text-zinc-600">
      <div className="flex items-start gap-3">
        <IconComponent className={`mt-0.5 h-4 w-4 shrink-0 ${iconClassName}`} />
        <p>{children}</p>
      </div>
    </div>
  );
}
