# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

### Hand-Tracking Playground (`artifacts/photo-sphere`)
- **Preview path**: `/`
- **Stack**: React + Vite + Three.js + MediaPipe Hands + wouter (hash router)
- **Description**: Hub of six small camera/MediaPipe Hands experiments. The original 3D Photo Sphere is now the first project in the hub, accessed at `/#/sphere`.
- **Routing**: Uses wouter `Router` with `useHashLocation` from `wouter/use-hash-location` so direct navigation works under GitHub Pages (no 404s on refresh).
- **Shared building blocks**:
  - `src/hooks/useHandTracking.ts` — webcam + MediaPipe lifecycle, `dist2D`, `isPinching`, `countExtendedFingers`, `mirrorX`, `HAND_CONNECTIONS`.
  - `src/components/ProjectShell.tsx` — back-to-hub button, title bar, status pill, controls panel, camera PIP.
  - `src/pages/Hub.tsx` — landing grid of six tiles with thumbnails (jpgs in `public/thumbs/` extracted from reference reels).
- **Projects**:
  1. `/sphere` — 3D Photo Sphere (the original): fibonacci-lattice sphere ↔ tunnel mode, hand-controlled zoom/rotate/spin, photo upload, starfield.
  2. `/puzzle` — Live 3×3 sliding-tile puzzle of the user's webcam feed; pinch to grab a tile and drag into the empty slot, click fallback.
  3. `/particles` — Three.js particle cloud (4500 points) that morphs between heart, sphere, and free-form; fingertip pulls/pushes particles (open hand pushes, pinch attracts).
  4. `/draw` — Canvas2D neon air-draw; pinch to paint glowing strokes, side palette of seven colors (also pickable by pinching in the right edge), clear by holding two open hands.
  5. `/skeleton` — Rainbow MediaPipe skeleton over the camera, sparkle particles trailing fingertips, lightning beam between two wrists when both hands present, FPS/gesture/spread stats panel.
  6. `/hud` — Cyan sci-fi HUD anchored to the line between two index fingertips, with scrolling status text on the left and a particle-emitter pane on the right; corner brackets follow each hand.
- **Note**: All projects need WebGL and webcam — works in a full browser tab. Replit's preview iframe blocks both, so use the GitHub Pages URL or open in a new tab.
- **GitHub Pages deploy**: `.github/workflows/deploy.yml` builds the artifact with `BASE_PATH=/3D-Photo-Sphere/` and publishes to GitHub Pages on every push to `main`. Repo Settings → Pages → Source must be set to "GitHub Actions". Live URL: `https://aliomar0.github.io/3D-Photo-Sphere/`.

## Git author

Local `.git/config` is set to `user.name = "Ali Omar"` / `user.email = "alidawood098@gmail.com"` so future commits use this identity. A history-rewritten bundle (all past commits re-authored as Ali Omar) is stored at `.local/rewritten-history.bundle`; see `.local/REWRITE_AUTHOR_INSTRUCTIONS.md` for the one-time push to apply it to GitHub.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
