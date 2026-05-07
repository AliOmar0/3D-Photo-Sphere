import { useEffect, useRef, useState } from "react";
import { ProjectShell, CameraPip } from "@/components/ProjectShell";
import {
  useHandTracking,
  isPinching,
  mirrorX,
  type HandsResult,
} from "@/hooks/useHandTracking";

const GRID = 3;

interface Tile {
  // index of the slot it currently occupies (0..GRID*GRID-1)
  slot: number;
  // original tile id = which piece of the image it is
  id: number;
}

function shuffle(n: number): number[] {
  // Generate a solvable shuffle by doing N random adjacent swaps from solved
  const order = Array.from({ length: n }, (_, i) => i);
  let emptyIdx = n - 1;
  for (let i = 0; i < 80; i++) {
    const neighbors: number[] = [];
    const r = Math.floor(emptyIdx / GRID);
    const c = emptyIdx % GRID;
    if (r > 0) neighbors.push(emptyIdx - GRID);
    if (r < GRID - 1) neighbors.push(emptyIdx + GRID);
    if (c > 0) neighbors.push(emptyIdx - 1);
    if (c < GRID - 1) neighbors.push(emptyIdx + 1);
    const swap = neighbors[Math.floor(Math.random() * neighbors.length)];
    [order[emptyIdx], order[swap]] = [order[swap], order[emptyIdx]];
    emptyIdx = swap;
  }
  return order;
}

export function PuzzlePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayPipRef = useRef<HTMLCanvasElement>(null);

  // Tile state lives in a ref so the render loop can read it without re-renders
  const tilesRef = useRef<Tile[]>([]);
  const emptySlotRef = useRef<number>(GRID * GRID - 1);
  const grabbedTileRef = useRef<number | null>(null); // tile id currently grabbed
  const [solved, setSolved] = useState(false);
  const [moves, setMoves] = useState(0);

  // initialize tiles
  useEffect(() => {
    const order = shuffle(GRID * GRID);
    const empty = order.indexOf(GRID * GRID - 1);
    const tiles: Tile[] = [];
    for (let slot = 0; slot < order.length; slot++) {
      const id = order[slot];
      if (id === GRID * GRID - 1) continue; // empty
      tiles.push({ slot, id });
    }
    tilesRef.current = tiles;
    emptySlotRef.current = empty;
    setSolved(false);
    setMoves(0);
  }, []);

  function reset() {
    const order = shuffle(GRID * GRID);
    const empty = order.indexOf(GRID * GRID - 1);
    const tiles: Tile[] = [];
    for (let slot = 0; slot < order.length; slot++) {
      const id = order[slot];
      if (id === GRID * GRID - 1) continue;
      tiles.push({ slot, id });
    }
    tilesRef.current = tiles;
    emptySlotRef.current = empty;
    grabbedTileRef.current = null;
    setSolved(false);
    setMoves(0);
  }

  function checkSolved() {
    const t = tilesRef.current;
    for (const tile of t) {
      if (tile.slot !== tile.id) return false;
    }
    return true;
  }

  function tryMoveTile(tileId: number) {
    const t = tilesRef.current;
    const tile = t.find((tt) => tt.id === tileId);
    if (!tile) return;
    const empty = emptySlotRef.current;
    const r1 = Math.floor(tile.slot / GRID);
    const c1 = tile.slot % GRID;
    const r2 = Math.floor(empty / GRID);
    const c2 = empty % GRID;
    const adjacent =
      (r1 === r2 && Math.abs(c1 - c2) === 1) ||
      (c1 === c2 && Math.abs(r1 - r2) === 1);
    if (!adjacent) return;
    const oldSlot = tile.slot;
    tile.slot = empty;
    emptySlotRef.current = oldSlot;
    setMoves((m) => m + 1);
    if (checkSolved()) setSolved(true);
  }

  // Render loop draws video tiles into the main canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.fillStyle = "#030310";
      ctx.fillRect(0, 0, w, h);

      if (video.readyState !== 4) return;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vw === 0 || vh === 0) return;

      // Compute the puzzle area: square in the centre, 70% of min dim
      const size = Math.min(w, h) * 0.78;
      const ox = (w - size) / 2;
      const oy = (h - size) / 2;
      const tileSize = size / GRID;

      // Source rect: take the centred square from the video
      const sCrop = Math.min(vw, vh);
      const sx0 = (vw - sCrop) / 2;
      const sy0 = (vh - sCrop) / 2;
      const sTile = sCrop / GRID;

      // Frame around the puzzle
      ctx.strokeStyle = "rgba(80,140,255,0.5)";
      ctx.lineWidth = 2;
      ctx.strokeRect(ox - 4, oy - 4, size + 8, size + 8);

      // Mirror so the user sees themselves naturally
      ctx.save();
      ctx.translate(ox + size, oy);
      ctx.scale(-1, 1);

      for (const tile of tilesRef.current) {
        const r = Math.floor(tile.slot / GRID);
        const c = tile.slot % GRID;
        const sr = Math.floor(tile.id / GRID);
        const sc = tile.id % GRID;
        ctx.drawImage(
          video,
          sx0 + sc * sTile,
          sy0 + sr * sTile,
          sTile,
          sTile,
          c * tileSize,
          r * tileSize,
          tileSize,
          tileSize,
        );
        // grid lines
        ctx.strokeStyle = "rgba(0,0,0,0.4)";
        ctx.lineWidth = 1;
        ctx.strokeRect(c * tileSize, r * tileSize, tileSize, tileSize);
      }

      // Highlight grabbed tile
      const grabbed = grabbedTileRef.current;
      if (grabbed !== null) {
        const tile = tilesRef.current.find((t) => t.id === grabbed);
        if (tile) {
          const r = Math.floor(tile.slot / GRID);
          const c = tile.slot % GRID;
          ctx.strokeStyle = "rgba(120,255,180,0.95)";
          ctx.lineWidth = 4;
          ctx.strokeRect(
            c * tileSize + 2,
            r * tileSize + 2,
            tileSize - 4,
            tileSize - 4,
          );
        }
      }

      // Highlight empty slot
      const er = Math.floor(emptySlotRef.current / GRID);
      const ec = emptySlotRef.current % GRID;
      ctx.fillStyle = "rgba(0,0,30,0.85)";
      ctx.fillRect(ec * tileSize, er * tileSize, tileSize, tileSize);
      ctx.strokeStyle = "rgba(120,200,255,0.4)";
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(
        ec * tileSize + 4,
        er * tileSize + 4,
        tileSize - 8,
        tileSize - 8,
      );
      ctx.setLineDash([]);

      ctx.restore();

      if (solved) {
        ctx.fillStyle = "rgba(0,0,30,0.6)";
        ctx.fillRect(ox, oy, size, size);
        ctx.fillStyle = "rgba(160,255,200,0.95)";
        ctx.font = "600 32px 'Inter', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("✓ Solved!", w / 2, h / 2);
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [solved]);

  // Hand tracking — convert pinch + position into grab/drop events
  const stateRef = useRef({ wasPinching: false, lastTouchedSlot: -1 });

  const onResults = (r: HandsResult) => {
    // overlay PIP draw is optional — keep it simple, no skeleton drawn here
    const pip = overlayPipRef.current;
    if (pip) {
      const ctx = pip.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, pip.width, pip.height);
    }

    if (!r.multiHandLandmarks || r.multiHandLandmarks.length === 0) {
      stateRef.current.wasPinching = false;
      grabbedTileRef.current = null;
      return;
    }
    // Use first detected hand
    const lm = r.multiHandLandmarks[0];
    const pinching = isPinching(lm);
    // Tip of index finger, in canvas-coord space (mirrored x)
    const px = mirrorX(lm[8].x);
    const py = lm[8].y;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const size = Math.min(w, h) * 0.78;
    const ox = (w - size) / 2;
    const oy = (h - size) / 2;
    const tileSize = size / GRID;

    const cx = px * w;
    const cy = py * h;
    const inX = cx - ox;
    const inY = cy - oy;
    if (inX < 0 || inY < 0 || inX > size || inY > size) {
      // outside puzzle; if released here, drop
      if (!pinching && stateRef.current.wasPinching) {
        grabbedTileRef.current = null;
      }
      stateRef.current.wasPinching = pinching;
      return;
    }
    const c = Math.floor(inX / tileSize);
    const rr = Math.floor(inY / tileSize);
    const slot = rr * GRID + c;

    if (pinching && !stateRef.current.wasPinching) {
      // pinch start — grab the tile under the finger if any
      const tile = tilesRef.current.find((t) => t.slot === slot);
      if (tile) {
        grabbedTileRef.current = tile.id;
        stateRef.current.lastTouchedSlot = slot;
      }
    } else if (pinching && grabbedTileRef.current !== null) {
      // pinch held — if the finger moves to the empty slot adjacent to this tile, swap
      if (slot === emptySlotRef.current) {
        tryMoveTile(grabbedTileRef.current);
        // after swap, the tile follows the finger (still grabbed)
      }
    } else if (!pinching && stateRef.current.wasPinching) {
      grabbedTileRef.current = null;
    }
    stateRef.current.wasPinching = pinching;
  };

  const { status, cameraReady } = useHandTracking({ videoRef, onResults });

  // Mouse fallback: click adjacent tile to slide it into the empty slot
  function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    // Mirror x because the puzzle is mirrored
    const mx = rect.right - e.clientX;
    const my = e.clientY - rect.top;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const size = Math.min(w, h) * 0.78;
    const ox = (w - size) / 2;
    const oy = (h - size) / 2;
    const tileSize = size / GRID;
    const inX = mx - ox;
    const inY = my - oy;
    if (inX < 0 || inY < 0 || inX > size || inY > size) return;
    const c = Math.floor(inX / tileSize);
    const r = Math.floor(inY / tileSize);
    const slot = r * GRID + c;
    const tile = tilesRef.current.find((t) => t.slot === slot);
    if (tile) tryMoveTile(tile.id);
  }

  return (
    <ProjectShell
      title="Live Puzzle"
      subtitle="Pinch to grab · drag to the empty slot"
      status={`${status} · ${moves} moves${solved ? " · solved" : ""}`}
      controls={
        <>
          <div style={{ fontWeight: 600, color: "rgba(160,255,200,0.95)" }}>
            How to play
          </div>
          <div>Pinch index + thumb on a tile to grab it</div>
          <div>Drag the pinch into the empty slot to swap</div>
          <div>Or click tiles with the mouse</div>
          <button
            onClick={reset}
            style={{
              marginTop: 8,
              background: "rgba(80,200,140,0.2)",
              border: "1px solid rgba(120,255,180,0.4)",
              color: "rgba(200,255,220,0.95)",
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Shuffle
          </button>
        </>
      }
    >
      <canvas
        ref={canvasRef}
        onClick={onCanvasClick}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
      <CameraPip
        videoRef={videoRef}
        overlayRef={overlayPipRef}
        ready={cameraReady}
        label="HAND TRACKING"
      />
    </ProjectShell>
  );
}
