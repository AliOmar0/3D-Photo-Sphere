import { useEffect, useRef, useState } from "react";
import { ProjectShell, CameraPip } from "@/components/ProjectShell";
import {
  useHandTracking,
  isPinching,
  mirrorX,
  dist2D,
  type HandsResult,
} from "@/hooks/useHandTracking";

const GRID = 3;
const PIECE_COUNT = GRID * GRID;
// A nice photo with a fixed seed so the puzzle is the same every reload
const PUZZLE_IMAGE = "https://picsum.photos/seed/puzzle-2026/800/800";

interface Piece {
  id: number;
  // current screen position of the piece centre, in normalized [0..1] coords
  x: number;
  y: number;
  // whether snapped to its correct slot
  placed: boolean;
}

interface SlotRect {
  // canvas-pixel coords + tile size
  x: number;
  y: number;
  size: number;
}

function computeBoard(canvasW: number, canvasH: number) {
  const size = Math.min(canvasW, canvasH) * 0.62;
  const boardX = (canvasW - size) / 2;
  const boardY = (canvasH - size) / 2;
  const tileSize = size / GRID;
  return { size, boardX, boardY, tileSize };
}

function slotForPieceId(
  id: number,
  canvasW: number,
  canvasH: number,
): SlotRect {
  const { boardX, boardY, tileSize } = computeBoard(canvasW, canvasH);
  const r = Math.floor(id / GRID);
  const c = id % GRID;
  return {
    x: boardX + c * tileSize + tileSize / 2,
    y: boardY + r * tileSize + tileSize / 2,
    size: tileSize,
  };
}

function scatterPieces(canvasW: number, canvasH: number): Piece[] {
  // Scatter pieces along the top + sides + bottom margins, outside the board.
  const { boardX, boardY, size } = computeBoard(canvasW, canvasH);
  const margin = 80;
  const positions: Array<{ x: number; y: number }> = [];
  const tries = 80;
  while (positions.length < PIECE_COUNT) {
    let placed = false;
    for (let t = 0; t < tries && !placed; t++) {
      const x = margin + Math.random() * (canvasW - margin * 2);
      const y = margin + Math.random() * (canvasH - margin * 2);
      // reject if inside the board area
      if (
        x > boardX - margin &&
        x < boardX + size + margin &&
        y > boardY - margin &&
        y < boardY + size + margin
      ) {
        continue;
      }
      // reject if too close to an existing piece
      let ok = true;
      for (const p of positions) {
        if (Math.hypot(p.x - x, p.y - y) < 110) {
          ok = false;
          break;
        }
      }
      if (ok) {
        positions.push({ x, y });
        placed = true;
      }
    }
    if (!placed) {
      // fallback: place against bottom edge
      positions.push({
        x: margin + Math.random() * (canvasW - margin * 2),
        y: canvasH - margin,
      });
    }
  }
  // assign ids in shuffled order so the spatial layout doesn't leak the answer
  const ids = Array.from({ length: PIECE_COUNT }, (_, i) => i);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return positions.map((p, i) => ({
    id: ids[i],
    x: p.x / canvasW,
    y: p.y / canvasH,
    placed: false,
  }));
}

export function PuzzlePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayPipRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [imageLoaded, setImageLoaded] = useState(false);
  const [solved, setSolved] = useState(false);
  const [moves, setMoves] = useState(0);

  const piecesRef = useRef<Piece[]>([]);
  const grabbedRef = useRef<number | null>(null);
  const cursorRef = useRef({
    x: 0.5,
    y: 0.5,
    tx: 0.5,
    ty: 0.5,
    ix: 0.5,
    iy: 0.5,
    visible: false,
    pinching: false,
  });
  const prevPinchRef = useRef(false);

  // Load reference image once
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.onerror = () => {
      // fallback: still mark loaded so the game can run with placeholder fills
      setImageLoaded(true);
    };
    img.src = PUZZLE_IMAGE;
  }, []);

  function reset() {
    const c = canvasRef.current;
    if (!c) return;
    piecesRef.current = scatterPieces(c.clientWidth, c.clientHeight);
    grabbedRef.current = null;
    setSolved(false);
    setMoves(0);
  }

  // Initialise pieces once the image is loaded and the canvas is sized
  useEffect(() => {
    if (!imageLoaded) return;
    const c = canvasRef.current;
    if (!c) return;
    if (piecesRef.current.length === 0) {
      piecesRef.current = scatterPieces(c.clientWidth, c.clientHeight);
    }
  }, [imageLoaded]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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
        // re-scatter on first sizing if pieces aren't placed yet
        if (piecesRef.current.length === 0 && imageLoaded) {
          piecesRef.current = scatterPieces(w, h);
        }
      }

      // background
      const grad = ctx.createRadialGradient(
        w / 2,
        h / 2,
        0,
        w / 2,
        h / 2,
        Math.max(w, h) / 1.2,
      );
      grad.addColorStop(0, "#0a1830");
      grad.addColorStop(1, "#03030c");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const { boardX, boardY, size, tileSize } = computeBoard(w, h);

      // Board outline + slot grid
      ctx.strokeStyle = "rgba(120,200,255,0.35)";
      ctx.lineWidth = 2;
      ctx.strokeRect(boardX - 4, boardY - 4, size + 8, size + 8);
      ctx.strokeStyle = "rgba(120,200,255,0.12)";
      ctx.lineWidth = 1;
      for (let i = 1; i < GRID; i++) {
        ctx.beginPath();
        ctx.moveTo(boardX + i * tileSize, boardY);
        ctx.lineTo(boardX + i * tileSize, boardY + size);
        ctx.moveTo(boardX, boardY + i * tileSize);
        ctx.lineTo(boardX + size, boardY + i * tileSize);
        ctx.stroke();
      }
      // Faint preview of the full image inside the board
      if (imageRef.current) {
        ctx.globalAlpha = 0.08;
        ctx.drawImage(imageRef.current, boardX, boardY, size, size);
        ctx.globalAlpha = 1;
      }

      // Smooth the cursor toward the target a bit (extra UI smoothing)
      const cur = cursorRef.current;
      cur.x += (cur.tx - cur.x) * 0.6;
      cur.y += (cur.ty - cur.y) * 0.6;

      const cursorPxX = cur.x * w;
      const cursorPxY = cur.y * h;
      const grabbed = grabbedRef.current;

      // Highlight which piece would be grabbed
      let hoverId: number | null = null;
      if (cur.visible && grabbed === null && !solved) {
        let best = -1;
        let bestD = 90; // px
        for (const p of piecesRef.current) {
          if (p.placed) continue;
          const px = p.x * w;
          const py = p.y * h;
          const d = Math.hypot(px - cursorPxX, py - cursorPxY);
          if (d < bestD) {
            bestD = d;
            best = p.id;
          }
        }
        hoverId = best === -1 ? null : best;
      }

      // While grabbed, the piece follows the cursor
      if (grabbed !== null) {
        const piece = piecesRef.current.find((p) => p.id === grabbed);
        if (piece) {
          piece.x = cur.x;
          piece.y = cur.y;
        }
      }

      // Draw all pieces (placed first, then floating, then the grabbed one on top)
      const ordered = [...piecesRef.current].sort((a, b) => {
        if (a.placed && !b.placed) return -1;
        if (!a.placed && b.placed) return 1;
        if (a.id === grabbed) return 1;
        if (b.id === grabbed) return -1;
        return 0;
      });
      for (const piece of ordered) {
        drawPiece(
          ctx,
          piece,
          imageRef.current,
          tileSize,
          w,
          h,
          piece.id === hoverId,
          piece.id === grabbed,
        );
      }

      // Draw the cursor / frame
      if (cur.visible) {
        if (cur.pinching) {
          // Pinched cursor: small filled cyan dot
          ctx.fillStyle = "rgba(140,255,200,0.95)";
          ctx.shadowColor = "rgba(140,255,200,0.8)";
          ctx.shadowBlur = 16;
          ctx.beginPath();
          ctx.arc(cursorPxX, cursorPxY, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          // Frame mode: draw an L between thumb tip and index tip
          const ix = cur.ix * w;
          const iy = cur.iy * h;
          const tx = cur.tx * w;
          const ty = cur.ty * h;
          ctx.strokeStyle = hoverId !== null
            ? "rgba(160,255,200,0.9)"
            : "rgba(120,200,255,0.85)";
          ctx.shadowColor = ctx.strokeStyle;
          ctx.shadowBlur = 10;
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          // Two perpendicular strokes meeting at the cursor centre
          ctx.beginPath();
          ctx.moveTo(ix, iy);
          ctx.lineTo(cursorPxX, cursorPxY);
          ctx.lineTo(tx, ty);
          ctx.stroke();
          ctx.shadowBlur = 0;
          // Small target ring
          ctx.beginPath();
          ctx.arc(cursorPxX, cursorPxY, 16, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(180,220,255,0.4)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Solved overlay
      if (solved) {
        ctx.fillStyle = "rgba(0,15,5,0.55)";
        ctx.fillRect(boardX - 4, boardY - 4, size + 8, size + 8);
        ctx.fillStyle = "rgba(160,255,200,0.95)";
        ctx.font = "600 36px 'Inter', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("✓ Solved!", w / 2, h / 2 + 12);
        ctx.textAlign = "left";
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [imageLoaded, solved]);

  // Hand tracking
  const onResults = (r: HandsResult) => {
    // Clear PIP overlay (we don't render landmarks there)
    const pip = overlayPipRef.current;
    if (pip) {
      const ctx = pip.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, pip.width, pip.height);
    }

    const cur = cursorRef.current;
    if (!r.multiHandLandmarks || r.multiHandLandmarks.length === 0) {
      cur.visible = false;
      cur.pinching = false;
      prevPinchRef.current = false;
      // Drop any grabbed piece
      if (grabbedRef.current !== null) {
        tryDropAt(grabbedRef.current, cur.x, cur.y);
        grabbedRef.current = null;
      }
      return;
    }
    const lm = r.multiHandLandmarks[0];
    const idxX = mirrorX(lm[8].x);
    const idxY = lm[8].y;
    const thX = mirrorX(lm[4].x);
    const thY = lm[4].y;
    const cx = (idxX + thX) / 2;
    const cy = (idxY + thY) / 2;
    cur.tx = cx;
    cur.ty = cy;
    cur.ix = idxX;
    cur.iy = idxY;
    cur.visible = true;

    const wasPinching = prevPinchRef.current;
    const pinching = isPinching(lm, 0.45, wasPinching);
    cur.pinching = pinching;

    if (pinching && !wasPinching) {
      // GRAB: pick the closest unplaced piece within range
      const canvas = canvasRef.current;
      if (canvas) {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        const cursorPxX = cx * w;
        const cursorPxY = cy * h;
        let best = -1;
        let bestD = 110;
        for (const p of piecesRef.current) {
          if (p.placed) continue;
          const d = Math.hypot(p.x * w - cursorPxX, p.y * h - cursorPxY);
          if (d < bestD) {
            bestD = d;
            best = p.id;
          }
        }
        if (best !== -1) grabbedRef.current = best;
      }
    } else if (!pinching && wasPinching) {
      // RELEASE: try to snap
      if (grabbedRef.current !== null) {
        tryDropAt(grabbedRef.current, cx, cy);
        grabbedRef.current = null;
        setMoves((m) => m + 1);
      }
    }
    prevPinchRef.current = pinching;
  };

  function tryDropAt(pieceId: number, cxNorm: number, cyNorm: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const slot = slotForPieceId(pieceId, w, h);
    const cursorPxX = cxNorm * w;
    const cursorPxY = cyNorm * h;
    const piece = piecesRef.current.find((p) => p.id === pieceId);
    if (!piece) return;
    const dx = cursorPxX - slot.x;
    const dy = cursorPxY - slot.y;
    const dist = Math.hypot(dx, dy);
    const tolerance = slot.size * 0.5;
    if (dist < tolerance) {
      piece.x = slot.x / w;
      piece.y = slot.y / h;
      piece.placed = true;
      // Check solved
      if (piecesRef.current.every((p) => p.placed)) {
        setSolved(true);
      }
    }
  }

  const { status, cameraReady } = useHandTracking({ videoRef, onResults });

  // Mouse fallback: click-and-drag pieces
  const mouseStateRef = useRef<{
    grabbed: number | null;
    last: { x: number; y: number } | null;
  }>({ grabbed: null, last: null });

  function getMouseNorm(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }
  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const { x, y } = getMouseNorm(e);
    const canvas = canvasRef.current!;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    let best = -1;
    let bestD = 90;
    for (const p of piecesRef.current) {
      if (p.placed) continue;
      const d = Math.hypot(p.x * w - x * w, p.y * h - y * h);
      if (d < bestD) {
        bestD = d;
        best = p.id;
      }
    }
    if (best !== -1) {
      mouseStateRef.current.grabbed = best;
      mouseStateRef.current.last = { x, y };
    }
  }
  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (mouseStateRef.current.grabbed === null) return;
    const { x, y } = getMouseNorm(e);
    const piece = piecesRef.current.find(
      (p) => p.id === mouseStateRef.current.grabbed,
    );
    if (piece) {
      piece.x = x;
      piece.y = y;
    }
  }
  function onMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (mouseStateRef.current.grabbed === null) return;
    const { x, y } = getMouseNorm(e);
    tryDropAt(mouseStateRef.current.grabbed, x, y);
    mouseStateRef.current.grabbed = null;
    setMoves((m) => m + 1);
  }

  return (
    <ProjectShell
      title="Jigsaw Puzzle"
      subtitle="Frame a piece · pinch to grab · release on the right slot"
      status={`${status} · ${moves} drops${solved ? " · solved" : ""}`}
      controls={
        <>
          <div style={{ fontWeight: 600, color: "rgba(160,255,200,0.95)" }}>
            How to play
          </div>
          <div>1. Spread thumb + index to form a frame</div>
          <div>2. Move the frame over a piece</div>
          <div>3. Pinch fingers together to grab it</div>
          <div>4. Drag to the matching slot, then release</div>
          <div style={{ marginTop: 4, color: "rgba(140,160,200,0.7)" }}>
            Mouse fallback: click and drag pieces
          </div>
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
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => {
          mouseStateRef.current.grabbed = null;
        }}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          cursor: mouseStateRef.current.grabbed !== null ? "grabbing" : "grab",
        }}
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

function drawPiece(
  ctx: CanvasRenderingContext2D,
  piece: Piece,
  img: HTMLImageElement | null,
  tileSize: number,
  canvasW: number,
  canvasH: number,
  hovered: boolean,
  grabbed: boolean,
) {
  const cx = piece.x * canvasW;
  const cy = piece.y * canvasH;
  const half = tileSize / 2;
  const x = cx - half;
  const y = cy - half;

  ctx.save();
  if (grabbed) {
    ctx.shadowColor = "rgba(140,255,200,0.9)";
    ctx.shadowBlur = 24;
  } else if (piece.placed) {
    ctx.shadowColor = "rgba(120,200,255,0.4)";
    ctx.shadowBlur = 8;
  } else if (hovered) {
    ctx.shadowColor = "rgba(160,220,255,0.7)";
    ctx.shadowBlur = 18;
  } else {
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 10;
  }

  if (img) {
    const sr = Math.floor(piece.id / GRID);
    const sc = piece.id % GRID;
    const sw = img.width / GRID;
    const sh = img.height / GRID;
    ctx.drawImage(
      img,
      sc * sw,
      sr * sh,
      sw,
      sh,
      x,
      y,
      tileSize,
      tileSize,
    );
  } else {
    // placeholder rectangle keyed by id
    ctx.fillStyle = `hsl(${(piece.id * 41) % 360}, 60%, 55%)`;
    ctx.fillRect(x, y, tileSize, tileSize);
  }

  // Border
  ctx.shadowBlur = 0;
  ctx.lineWidth = grabbed ? 3 : hovered ? 2 : 1.5;
  ctx.strokeStyle = grabbed
    ? "rgba(160,255,200,0.95)"
    : piece.placed
    ? "rgba(120,200,255,0.5)"
    : hovered
    ? "rgba(180,230,255,0.85)"
    : "rgba(255,255,255,0.25)";
  ctx.strokeRect(x + 0.5, y + 0.5, tileSize - 1, tileSize - 1);
  ctx.restore();
}
