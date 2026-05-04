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

### 3D Photo Sphere (`artifacts/photo-sphere`)
- **Preview path**: `/`
- **Stack**: React + Vite + Three.js + MediaPipe Hands
- **Description**: Interactive 3D photo dump in a sphere with webcam-based hand tracking
- **Features**:
  - Two view modes (toggleable): **Sphere** (fibonacci-lattice photo sphere) and **Tunnel** (images fly toward camera)
  - 64 default photos via Lorem Picsum + user upload (`+ Add your photos` button using object URLs)
  - MediaPipe Hands for real-time hand gesture detection
  - Sphere mode: right pinch + up/down = zoom, left pinch + drag = rotate, openness = auto-spin speed
  - Tunnel mode: openness = travel speed, left pinch + drag = steer, right pinch = base speed
  - Mouse drag / scroll / touch fallback
  - Starfield background (warp effect in tunnel mode)
- **Note**: Requires WebGL — works in a full browser tab. Replit's embedded preview iframe doesn't support WebGL.
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
