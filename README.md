# 3D Photo Sphere

An interactive 3D photo gallery inspired by an Instagram reel — your photos float on the surface of a Three.js sphere that you can spin, zoom into, and even fly through with your hands using webcam-based hand tracking.

**Live demo:** https://aliomar0.github.io/3D-Photo-Sphere/

> Heads up: WebGL and webcam access are required, so open the live demo in a real browser tab — Replit's embedded preview iframe doesn't support WebGL.

## Features

- **3D photo sphere** built with Three.js + React Three Fiber — photos are evenly distributed across the surface using a Fibonacci spiral
- **Hand tracking** with MediaPipe — control the experience with gestures from your webcam
- **Two viewing modes**
  - *Orbit mode* — rotate and zoom around the sphere
    - Open palm = rotate, pinch = zoom
  - *Tunnel mode* — fly through the photos
    - Hand openness = travel speed, left pinch + drag = steer, right pinch = base speed
- **Mouse / touch fallback** — drag to rotate, scroll to zoom, works without a webcam
- **Upload your own photos** — drop in any images and they're instantly placed on the sphere
- **Animated starfield background** with a warp effect in tunnel mode

## Tech stack

- React + Vite + TypeScript
- Three.js / React Three Fiber / drei
- MediaPipe Hands for webcam gesture recognition
- Tailwind CSS
- Deployed to GitHub Pages via GitHub Actions

## Local development

```bash
pnpm install
pnpm --filter @workspace/photo-sphere run dev
```

Then open the dev URL in a normal browser tab.

## Author

Built by **Ali Omar** ([@AliOmar0](https://github.com/AliOmar0)).
