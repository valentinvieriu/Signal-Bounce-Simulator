# Graded Alignment Proposal

## Goal

Replace the current binary "aligned / not aligned" outcome with a progressive capture model that reacts as the antenna approaches the target corridor.

## Proposed calculation

### 1. Use the escaped main ray as the reference direction

- Keep tracing the center ray exactly as today.
- If that ray exits the courtyard, compute the signed angular error to the target:
  - `signedError = shortestDelta(main.finalTrueBearing, targetBearing)`
  - `error = abs(signedError)`

### 2. Split alignment into three zones

- **Lock zone**: very small error, where we consider the beam truly on target.
- **Cone body**: still inside the antenna cone, but not yet tightly centered.
- **Feather / fringe zone**: a soft region just outside the cone where the UI starts showing convergence instead of a hard miss.

Suggested thresholds:

- `halfSpread = beamSpread / 2`
- `lockThreshold = clamp(halfSpread * 0.18, 2, 8)`
- `featherThreshold = halfSpread + max(4, halfSpread * 0.35)`

### 3. Produce a continuous score

Use eased transitions instead of abrupt cutoffs:

- `coneScore = 1 - smoothstep(lockThreshold, halfSpread, error)`
- `approachScore = 1 - smoothstep(halfSpread, featherThreshold, error)`
- `score = coneScore * 0.75 + approachScore * 0.25`

This gives us:

- `score = 1` near the centerline.
- A controlled falloff across the cone.
- A non-zero response just outside the cone, so users feel they are "starting to align."

### 4. Convert score to states

- **Locked**: `error <= lockThreshold`
- **Inside cone**: `lockThreshold < error <= halfSpread`
- **Entering cone**: `halfSpread < error <= featherThreshold`
- **Outside cone**: `error > featherThreshold`

## Proposed visualization

### Compass

- Draw three target-centered arcs:
  - **Lock core** in green.
  - **Cone body** in cyan/blue.
  - **Feather edge** in amber.
- Keep the sweep between target and antenna, but:
  - increase thickness as the score rises,
  - shift color toward green as the beam converges,
  - report a percentage so alignment reads as progressive instead of binary.

### Courtyard map

- Fill the left/right boundary rays as a translucent cone.
- Add extra interior guide rays that appear when score rises.
- Narrow those guide rays as score increases so they visually become more parallel and more focused around the antenna centerline.
- Keep the final center ray visually strongest.

## Why this is a good fit

- It respects the existing antenna angle model.
- It preserves the physical idea of a beam spread while adding a realistic "capture" behavior.
- It gives operators earlier feedback before they hit perfect lock.
- It creates room for future tuning without changing the core ray tracer.
