# Signal Bounce Simulator

An interactive RF propagation ray-tracing tool that visualises how a wireless signal bounces off walls inside a building before escaping toward a target node.

Built with React, Vite, Tailwind CSS, and Framer Motion.

## Features

- **Compass view** - set true north, target bearing, and antenna direction by dragging handles or using device compass
- **Courtyard map** - 2D top-down ray tracer with configurable building dimensions, antenna position, beam spread, and wall bounce limit
- **Wall materials** - toggle each wall between reflect and pass-through
- **Live feedback** - exit bearing, alignment error, path length, and reflection count update in real time

## Getting started

```bash
npm install
npm run dev
```

## Tech stack

- [React 19](https://react.dev)
- [Vite 8](https://vite.dev)
- [Tailwind CSS 4](https://tailwindcss.com)
- [Framer Motion](https://motion.dev)
- [Lucide React](https://lucide.dev)

## License

MIT
