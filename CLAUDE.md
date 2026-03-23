# CLAUDE.md

## Project overview

Signal Bounce Simulator - an interactive RF propagation ray-tracing tool. Single-page React app that visualises how a wireless signal bounces off walls inside a building courtyard before escaping toward a target node.

## Tech stack

- React 19 + Vite 8 (JSX, no TypeScript)
- Tailwind CSS 4 (via `@tailwindcss/vite` plugin)
- Framer Motion for animations
- Lucide React for icons
- ESLint with React hooks and refresh plugins

## Project structure

```
src/
  App.jsx                    # Root component, device heading hook, state management
  main.jsx                   # React entry point
  index.css                  # Tailwind import
  lib/
    simulation.js            # Ray tracer, scoring, alignment, findBestBearing, geo utilities
  components/
    Compass.jsx              # Compass view with alignment feedback
    MapView.jsx              # Courtyard map view with beam visualization
    NodeImportWizard.jsx     # CSV node import and geo-solve
    ui.jsx                   # Shared UI primitives (Button, Badge, SliderRow, etc.)
public/
  favicon.svg                # App favicon
index.html                   # HTML shell
```

## Commands

- `npm run dev` - Start dev server
- `npm run build` - Production build
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Architecture notes

- Core logic split into `src/lib/simulation.js` (ray tracing, scoring, utilities) and UI components in `src/components/`
- `App.jsx` contains root state (`useState(DEFAULTS)`), device heading hook, and view orchestration

### RF propagation model (868 MHz LoRa)
- `LORA` constant: TX power 14 dBm, sensitivity -137 dBm (SF12), 868 MHz frequency
- `WALL_MATERIALS`: six material types (open, glass, drywall, brick, concrete, metal) each with `penDb` (penetration loss) and `refDb` (reflection loss) in dB based on ITU-R P.1238 / measured studies
- `traceRay` tracks signal power in dBm: applies FSPL per segment, reflection loss per bounce, and records `exitOpportunities` at every wall hit with transmitted power (power - penDb)
- Rays terminate when power drops below receiver sensitivity (-137 dBm)
- At each wall hit, BOTH transmission (exit opportunity) and reflection happen — the ray continues bouncing while exit opportunities are collected

### Scoring and optimization
- `findBestExitOpportunity` scores exits by: 60% received power + 40% alignment to target bearing
- `findBestBearing(sim)` sweeps 0-359° and picks the bearing with strongest combined score across all exit opportunities
- `getSimulationTelemetry` uses the same scoring for real-time alignment feedback
- Compass supports device orientation API on mobile (iOS `webkitCompassHeading`)

## Maintenance

- Keep this CLAUDE.md up to date when important architectural changes are made or new key features are added
