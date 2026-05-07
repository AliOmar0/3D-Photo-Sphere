# Hand-Tracking Playground

A hub of six small browser experiments built on **MediaPipe Hands**, **Three.js**, and your webcam. Pick a project, allow camera access, and start gesturing.

**Live demo:** https://aliomar0.github.io/3D-Photo-Sphere/

> Heads up: WebGL and webcam access are required, so open the live demo in a real browser tab — Replit's embedded preview iframe doesn't support WebGL.

## The six projects

All projects mount under hash routes so direct deep links work on GitHub Pages.

| Route | Project | What it does |
| --- | --- | --- |
| `#/sphere` | **3D Photo Sphere** | Photos float on a Fibonacci-distributed sphere. Open palm spins it, pinch to drag and zoom. Tunnel mode lets you fly through them. |
| `#/puzzle` | **Live Puzzle** | Your live camera feed sliced into a 3×3 sliding-tile puzzle. Pinch a tile and drag it into the empty slot. |
| `#/particles` | **Particle Sculptor** | A cloud of 4 500 Three.js particles you can morph between heart, sphere, and free-form. Pinch attracts particles to your fingertip; open hand pushes them away. |
| `#/draw` | **Air Draw** | Pinch your fingers to draw glowing neon strokes over your webcam. Pick a colour from the side palette; clear the canvas by holding both hands open. |
| `#/skeleton` | **Neon Skeleton** | A rainbow MediaPipe skeleton renders over your hands with sparkle particles trailing your fingertips. Spread both hands apart to fire a lightning beam between them. |
| `#/hud` | **Floating HUD** | A cyan tactical HUD anchored to the line between your two index fingertips, with scrolling status text, a live particle stream, and corner brackets that follow each hand. |

## Tech stack

- React + Vite + TypeScript
- wouter (hash router) for GitHub-Pages-friendly routing
- Three.js / React Three Fiber / drei (sphere + particles)
- MediaPipe Hands for webcam gesture recognition
- Canvas2D for the puzzle, draw, skeleton, and HUD projects
- Tailwind CSS
- Deployed to GitHub Pages via GitHub Actions

Shared building blocks live in `artifacts/photo-sphere/src/`:

- `hooks/useHandTracking.ts` — webcam + MediaPipe lifecycle and gesture helpers
- `components/ProjectShell.tsx` — back-to-hub button, title bar, status pill, controls panel, camera PIP
- `pages/Hub.tsx` — the landing grid

## Local development

```bash
pnpm install
pnpm --filter @workspace/photo-sphere run dev
```

Then open the dev URL in a normal browser tab.

## Author

Built by **Ali Omar** ([@AliOmar0](https://github.com/AliOmar0)).
