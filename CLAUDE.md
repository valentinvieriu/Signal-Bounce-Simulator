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
  App.jsx        # All application logic: ray tracer, compass, map view, UI components
  main.jsx       # React entry point
  index.css      # Tailwind import
public/
  favicon.svg    # App favicon
index.html       # HTML shell
```

## Commands

- `npm run dev` - Start dev server
- `npm run build` - Production build
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

## Architecture notes

- Everything lives in a single `App.jsx` file: math utilities, ray tracing (`traceRay`), custom hooks (`useDeviceHeading`), UI components, and the two main views (Compass, MapView)
- State is managed with a single `useState(DEFAULTS)` in the root `App` component
- The ray tracer supports configurable wall materials (reflect/pass), beam spread with left/right edge rays, and up to 8 wall bounces
- Compass supports device orientation API on mobile (iOS `webkitCompassHeading`)
