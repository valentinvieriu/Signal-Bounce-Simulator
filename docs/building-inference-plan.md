# Nearby 3D Building Inference Plan

## Goal
Infer the simulator shell from mapped buildings near the user so operators can start without manually drawing walls.

## What is implemented now (MVP)
1. Added a new **"Infer shell from nearby 3D buildings"** action in the map panel.
2. Reads browser geolocation and queries Overpass for nearby `building=*` footprints.
3. Chooses the nearest building footprint, estimates width/depth in meters, and applies those dimensions to the simulation shell.
4. Sets all four walls to `concrete` by default and keeps the existing RF solver unchanged.
5. Shows inference status, selected building ID, and provenance in UI.

## Why this approach
- Uses publicly available geometry immediately (no custom CAD dependency).
- Keeps simulation architecture stable: only geometry input changes.
- Creates a bridge to future true-3D/mesh sources without rewriting ray-loss logic today.

## Phase roadmap

### Phase 1 — Footprint ingestion (current)
- Source: OpenStreetMap building footprints via Overpass.
- Output: axis-aligned shell dimensions + default materials.
- Validation: local unit tests for inference math and candidate selection.

### Phase 2 — Better building selection
- Rank candidates by geolocation uncertainty radius and heading cone.
- Prefer polygons that contain the user point when available.
- Add manual “choose inferred building” list when multiple candidates score similarly.

### Phase 3 — 3D-aware material priors
- Map OSM tags (`building:material`, `building:levels`, facade hints) into wall material priors.
- Estimate likely façade in front of the user from device orientation and set front-wall material separately.

### Phase 4 — True 3D geometry sources
- Optional Cesium / deck.gl ingestion path for 3D Tiles meshes.
- Preprocess mesh to 2D wall segments for RF model compatibility, while retaining height metadata for advanced loss.
- Add confidence score for inferred geometry quality.

### Phase 5 — AR fusion (short-range wall in front)
- Fuse map prior with AR depth/scene geometry (ARCore/ARKit) for near-field wall confirmation.
- Use AR only for final wall-in-front disambiguation, not whole-building reconstruction.

## Known constraints
- GPS accuracy alone is insufficient for precise short-range wall detection.
- OSM coverage and tag quality vary by location.
- Current simulator assumes rectangular shell geometry; irregular footprints are reduced to bounding dimensions.
