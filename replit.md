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
  - 24 photos distributed on a sphere using fibonacci lattice (Three.js)
  - MediaPipe Hands for real-time hand gesture detection
  - Right hand pinch + move up/down → zoom in/out
  - Left hand pinch + drag → rotate sphere
  - Fist vs open palm → controls auto-rotation speed
  - Mouse drag / scroll / touch fallback for non-webcam use
  - Starfield background
- **Note**: Requires WebGL — works in a full browser tab. Replit's embedded preview iframe doesn't support WebGL.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
