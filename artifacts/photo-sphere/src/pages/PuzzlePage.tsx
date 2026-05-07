import { useEffect, useRef, useState } from "react";
import { ProjectShell, CameraPip } from "@/components/ProjectShell";
import {
  useHandTracking,
  isPinching,
  mirrorX,
  type HandsResult,
  type HandLandmark,
} from "@/hooks/useHandTracking";

const GRID = 3;
const PIECE_COUNT = GRID * GRID;
const SETUP_HOLD_FRAMES = 24; // ~0.8s at 30fps

type Phase = "setup" | "play" | "solved";

interface Piece {
  id: number;
  x: number;
  y: number; // current centre, normalised
  placed: boolean;
}

interface SlotRect {
  x: number;
  y: number;
  size: number;
}

interface CapturedRect {
  // normalised across the canvas
  x: number;
  y: number;
  w: number;
  h: number;
}

function pinchPoint(lm: HandLandmark[]): { x: number; y: number } {
  // midpoint of thumb-tip + index-tip, mirrored x to match visible video
  return {
    x: mirrorX((lm[4].x + lm[8].x) / 2),
    y: (lm[4].y + lm[8].y) / 2,
  };
}

function computeBoard(canvasW: number, canvasH: number, rect: CapturedRect) {
  // Board occupies the centre of the screen, sized from the captured aspect ratio
  const aspect = (rect.w * canvasW) / Math.max(rect.h * canvasH, 1);
  const maxSize = Math.min(canvasW, canvasH) * 0.6;
  let bw: number;
  let bh: number;
  if (aspect >= 1) {
    bw = maxSize;
    bh = maxSize / aspect;
  } else {
    bh = maxSize;
    bw = maxSize * aspect;
  }
  const boardX = (canvasW - bw) / 2;
  const boardY = (canvasH - bh) / 2;
  return {
    bw,
    bh,
    boardX,
    boardY,
    tileW: bw / GRID,
    tileH: bh / GRID,
  };
}

function slotForPiece(
  id: number,
  canvasW: number,
  canvasH: number,
  rect: CapturedRect,
): SlotRect {
  const { boardX, boardY, tileW, tileH } = computeBoard(canvasW, canvasH, rect);
  const r = Math.floor(id / GRID);
  const c = id % GRID;
  return {
    x: boardX + c * tileW + tileW / 2,
    y: boardY + r * tileH + tileH / 2,
    size: Math.min(tileW, tileH),
  };
}

function scatterPieces(
  canvasW: number,
  canvasH: number,
  rect: CapturedRect,
): Piece[] {
  const { boardX, boardY, bw, bh } = computeBoard(canvasW, canvasH, rect);
  const margin = 70;
  const positions: Array<{ x: number; y: number }> = [];
  while (positions.length < PIECE_COUNT) {
    let placed = false;
    for (let t = 0; t < 80 && !placed; t++) {
      const x = margin + Math.random() * (canvasW - margin * 2);
      const y = margin + Math.random() * (canvasH - margin * 2);
      if (
        x > boardX - margin &&
        x < boardX + bw + margin &&
        y > boardY - margin &&
        y < boardY + bh + margin
      )
        continue;
      let ok = true;
      for (const p of positions) {
        if (Math.hypot(p.x - x, p.y - y) < 100) {
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
      positions.push({
        x: margin + Math.random() * (canvasW - margin * 2),
        y: canvasH - margin,
      });
    }
  }
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

  const [phase, setPhase] = useState<Phase>("setup");
  const [moves, setMoves] = useState(0);

  // Captured puzzle area (in normalised canvas coords) and the captured pixels.
  const capturedRectRef = useRef<CapturedRect | null>(null);
  const capturedImgRef = useRef<HTMLCanvasElement | null>(null);

  // Setup-phase state
  const setupRef = useRef<{
    leftPinch: { x: number; y: number } | null;
    rightPinch: { x: number; y: number } | null;
    holdFrames: number;
  }>({ leftPinch: null, rightPinch: null, holdFrames: 0 });

  // Play-phase state
  const piecesRef = useRef<Piece[]>([]);
  const grabbedRef = useRef<number | null>(null);
  const cursorRef = useRef({
    x: 0.5,
    y: 0.5,
    visible: false,
    pinching: false,
  });
  const prevPinchRef = useRef([false, false]);

  const phaseRef = useRef<Phase>("setup");
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  function resetToSetup() {
    capturedRectRef.current = null;
    capturedImgRef.current = null;
    piecesRef.current = [];
    grabbedRef.current = null;
    setupRef.current = {
      leftPinch: null,
      rightPinch: null,
      holdFrames: 0,
    };
    setMoves(0);
    setPhase("setup");
  }

  // Capture the rectangle currently spanning the two pinch points.
  function captureRegion(p1: { x: number; y: number }, p2: { x: number; y: number }) {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.readyState !== 4 || video.videoWidth === 0)
      return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const x = Math.max(0, Math.min(p1.x, p2.x));
    const y = Math.max(0, Math.min(p1.y, p2.y));
    const rw = Math.min(1, Math.abs(p2.x - p1.x));
    const rh = Math.min(1, Math.abs(p2.y - p1.y));
    if (rw < 0.08 || rh < 0.08) return; // too small

    // Map normalised canvas rect to source video coords.
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = Math.max(w / vw, h / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const offX = (w - dw) / 2;
    const offY = (h - dh) / 2;
    // Canvas pixels of the rect
    const cx = x * w;
    const cy = y * h;
    const cw = rw * w;
    const ch = rh * h;
    // Convert canvas pixels to video pixels (account for mirrored video).
    const sx = (w - (cx + cw) - offX) / scale; // mirror flip
    const sy = (cy - offY) / scale;
    const sw = cw / scale;
    const sh = ch / scale;

    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(sw));
    out.height = Math.max(1, Math.round(sh));
    const octx = out.getContext("2d");
    if (!octx) return;
    // Draw mirrored so the captured image matches what the user saw.
    octx.translate(out.width, 0);
    octx.scale(-1, 1);
    try {
      octx.drawImage(video, sx, sy, sw, sh, 0, 0, out.width, out.height);
    } catch {
      return;
    }

    capturedImgRef.current = out;
    capturedRectRef.current = { x, y, w: rw, h: rh };
    piecesRef.current = scatterPieces(w, h, capturedRectRef.current);
    setMoves(0);
    setPhase("play");
  }

  // Render loop
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

      const ph = phaseRef.current;
      if (ph === "setup") {
        // Show the live mirrored webcam, dimmed.
        if (video.readyState === 4 && video.videoWidth > 0) {
          ctx.save();
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          const scale = Math.max(w / vw, h / vh);
          const dw = vw * scale;
          const dh = vh * scale;
          ctx.globalAlpha = 0.85;
          ctx.drawImage(video, (w - dw) / 2, (h - dh) / 2, dw, dh);
          ctx.globalAlpha = 1;
          ctx.restore();
        }
        ctx.fillStyle = "rgba(3,3,16,0.45)";
        ctx.fillRect(0, 0, w, h);

        // Setup overlay: show the rectangle being framed
        const s = setupRef.current;
        if (s.leftPinch && s.rightPinch) {
          const x1 = s.leftPinch.x * w;
          const y1 = s.leftPinch.y * h;
          const x2 = s.rightPinch.x * w;
          const y2 = s.rightPinch.y * h;
          const rx = Math.min(x1, x2);
          const ry = Math.min(y1, y2);
          const rw = Math.abs(x2 - x1);
          const rh = Math.abs(y2 - y1);
          // Glow rect
          ctx.strokeStyle = "rgba(140,255,200,0.95)";
          ctx.shadowColor = "rgba(140,255,200,0.9)";
          ctx.shadowBlur = 18;
          ctx.lineWidth = 3;
          ctx.strokeRect(rx, ry, rw, rh);
          ctx.shadowBlur = 0;
          // Hold progress bar at the bottom of the rect
          const pct = Math.min(1, s.holdFrames / SETUP_HOLD_FRAMES);
          ctx.fillStyle = "rgba(140,255,200,0.85)";
          ctx.fillRect(rx, ry + rh + 6, rw * pct, 5);
          ctx.fillStyle = "rgba(140,255,200,0.2)";
          ctx.fillRect(rx + rw * pct, ry + rh + 6, rw * (1 - pct), 5);
          // Pinch dots at the corners
          for (const p of [s.leftPinch, s.rightPinch]) {
            ctx.fillStyle = "rgba(140,255,200,0.95)";
            ctx.beginPath();
            ctx.arc(p.x * w, p.y * h, 9, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          // Helpful hints
          ctx.fillStyle = "rgba(180,220,255,0.9)";
          ctx.font = "16px 'Inter', sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(
            "Pinch BOTH hands to frame an area, then hold",
            w / 2,
            h / 2,
          );
          // Visual hand hints
          if (s.leftPinch) drawPinchHint(ctx, s.leftPinch.x * w, s.leftPinch.y * h);
          if (s.rightPinch) drawPinchHint(ctx, s.rightPinch.x * w, s.rightPinch.y * h);
          ctx.textAlign = "left";
        }
        return;
      }

      // PLAY / SOLVED phase
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

      const rect = capturedRectRef.current;
      const img = capturedImgRef.current;
      if (!rect || !img) return;

      const board = computeBoard(w, h, rect);
      // Board outline + faint preview
      ctx.strokeStyle = "rgba(140,255,200,0.4)";
      ctx.lineWidth = 2;
      ctx.strokeRect(board.boardX - 4, board.boardY - 4, board.bw + 8, board.bh + 8);
      ctx.globalAlpha = 0.1;
      ctx.drawImage(img, board.boardX, board.boardY, board.bw, board.bh);
      ctx.globalAlpha = 1;
      // Slot grid lines
      ctx.strokeStyle = "rgba(140,255,200,0.15)";
      ctx.lineWidth = 1;
      for (let i = 1; i < GRID; i++) {
        ctx.beginPath();
        ctx.moveTo(board.boardX + i * board.tileW, board.boardY);
        ctx.lineTo(board.boardX + i * board.tileW, board.boardY + board.bh);
        ctx.moveTo(board.boardX, board.boardY + i * board.tileH);
        ctx.lineTo(board.boardX + board.bw, board.boardY + i * board.tileH);
        ctx.stroke();
      }

      const cur = cursorRef.current;
      const cursorPxX = cur.x * w;
      const cursorPxY = cur.y * h;
      const grabbed = grabbedRef.current;

      // Hover detection
      let hoverId: number | null = null;
      if (cur.visible && grabbed === null && phaseRef.current === "play") {
        let best = -1;
        let bestD = 90;
        for (const p of piecesRef.current) {
          if (p.placed) continue;
          const d = Math.hypot(p.x * w - cursorPxX, p.y * h - cursorPxY);
          if (d < bestD) {
            bestD = d;
            best = p.id;
          }
        }
        hoverId = best === -1 ? null : best;
      }

      if (grabbed !== null) {
        const piece = piecesRef.current.find((p) => p.id === grabbed);
        if (piece) {
          piece.x = cur.x;
          piece.y = cur.y;
        }
      }

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
          img,
          board.tileW,
          board.tileH,
          w,
          h,
          piece.id === hoverId,
          piece.id === grabbed,
        );
      }

      // Cursor
      if (cur.visible && phaseRef.current === "play") {
        if (cur.pinching) {
          ctx.fillStyle = "rgba(140,255,200,0.95)";
          ctx.shadowColor = "rgba(140,255,200,0.8)";
          ctx.shadowBlur = 16;
          ctx.beginPath();
          ctx.arc(cursorPxX, cursorPxY, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          ctx.beginPath();
          ctx.arc(cursorPxX, cursorPxY, 16, 0, Math.PI * 2);
          ctx.strokeStyle = hoverId !== null
            ? "rgba(160,255,200,0.95)"
            : "rgba(180,220,255,0.5)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      if (phaseRef.current === "solved") {
        ctx.fillStyle = "rgba(0,15,5,0.55)";
        ctx.fillRect(board.boardX - 4, board.boardY - 4, board.bw + 8, board.bh + 8);
        ctx.fillStyle = "rgba(160,255,200,0.95)";
        ctx.font = "600 36px 'Inter', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("✓ Solved!", w / 2, h / 2 + 12);
        ctx.textAlign = "left";
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  // Drop / snap logic
  function tryDropAt(pieceId: number, cxNorm: number, cyNorm: number) {
    const canvas = canvasRef.current;
    const rect = capturedRectRef.current;
    if (!canvas || !rect) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const slot = slotForPiece(pieceId, w, h, rect);
    const cursorPxX = cxNorm * w;
    const cursorPxY = cyNorm * h;
    const piece = piecesRef.current.find((p) => p.id === pieceId);
    if (!piece) return;
    const dist = Math.hypot(cursorPxX - slot.x, cursorPxY - slot.y);
    if (dist < slot.size * 0.55) {
      piece.x = slot.x / w;
      piece.y = slot.y / h;
      piece.placed = true;
      if (piecesRef.current.every((p) => p.placed)) setPhase("solved");
    }
  }

  // Hand tracking
  const onResults = (r: HandsResult) => {
    const pip = overlayPipRef.current;
    if (pip) {
      const ctx = pip.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, pip.width, pip.height);
    }

    const lms = r.multiHandLandmarks ?? [];
    if (phaseRef.current === "setup") {
      // Need both hands to define the rect
      if (lms.length < 2) {
        setupRef.current.leftPinch = null;
        setupRef.current.rightPinch = null;
        setupRef.current.holdFrames = 0;
        prevPinchRef.current = [false, false];
        // Show single-hand pinch dot anyway, for feedback
        if (lms.length === 1) {
          const p1 = isPinching(lms[0], 0.45, prevPinchRef.current[0]);
          prevPinchRef.current[0] = p1;
          if (p1) {
            const pt = pinchPoint(lms[0]);
            // Just use it as the "left" preview
            setupRef.current.leftPinch = pt;
          }
        }
        return;
      }
      // Two hands present. Pinch each independently with hysteresis.
      const p0 = isPinching(lms[0], 0.45, prevPinchRef.current[0]);
      const p1 = isPinching(lms[1], 0.45, prevPinchRef.current[1]);
      prevPinchRef.current = [p0, p1];
      if (!p0 || !p1) {
        setupRef.current.leftPinch = null;
        setupRef.current.rightPinch = null;
        setupRef.current.holdFrames = 0;
        return;
      }
      // Order hands by x: leftmost on screen vs rightmost.
      const a = pinchPoint(lms[0]);
      const b = pinchPoint(lms[1]);
      const left = a.x < b.x ? a : b;
      const right = a.x < b.x ? b : a;
      setupRef.current.leftPinch = left;
      setupRef.current.rightPinch = right;
      setupRef.current.holdFrames++;
      if (setupRef.current.holdFrames >= SETUP_HOLD_FRAMES) {
        captureRegion(left, right);
        setupRef.current.holdFrames = 0;
      }
      return;
    }

    // PLAY phase
    if (lms.length === 0) {
      cursorRef.current.visible = false;
      cursorRef.current.pinching = false;
      prevPinchRef.current[0] = false;
      if (grabbedRef.current !== null) {
        tryDropAt(grabbedRef.current, cursorRef.current.x, cursorRef.current.y);
        grabbedRef.current = null;
      }
      return;
    }
    const lm = lms[0];
    const pt = pinchPoint(lm);
    cursorRef.current.x = pt.x;
    cursorRef.current.y = pt.y;
    cursorRef.current.visible = true;
    const wasPinching = prevPinchRef.current[0];
    const pinching = isPinching(lm, 0.45, wasPinching);
    cursorRef.current.pinching = pinching;

    if (pinching && !wasPinching) {
      const canvas = canvasRef.current;
      if (canvas) {
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        let best = -1;
        let bestD = 110;
        for (const p of piecesRef.current) {
          if (p.placed) continue;
          const d = Math.hypot(p.x * w - pt.x * w, p.y * h - pt.y * h);
          if (d < bestD) {
            bestD = d;
            best = p.id;
          }
        }
        if (best !== -1) grabbedRef.current = best;
      }
    } else if (!pinching && wasPinching) {
      if (grabbedRef.current !== null) {
        tryDropAt(grabbedRef.current, pt.x, pt.y);
        grabbedRef.current = null;
        setMoves((m) => m + 1);
      }
    }
    prevPinchRef.current[0] = pinching;
  };

  const { status, cameraReady } = useHandTracking({ videoRef, onResults });

  return (
    <ProjectShell
      title="Jigsaw Puzzle"
      subtitle={
        phase === "setup"
          ? "Pinch with both hands to frame an area, then hold"
          : "Pinch a piece, drag, release on the matching slot"
      }
      status={`${status} · ${phase}${phase === "play" ? ` · ${moves} drops` : ""}`}
      controls={
        <>
          <div style={{ fontWeight: 600, color: "rgba(160,255,200,0.95)" }}>
            How to play
          </div>
          {phase === "setup" ? (
            <>
              <div>1. Stand back so both hands are in frame</div>
              <div>2. Pinch with each hand to mark two corners</div>
              <div>3. Hold the pinch — the area inside becomes the puzzle</div>
            </>
          ) : (
            <>
              <div>Pinch on a piece to grab it</div>
              <div>Drag it onto the matching slot</div>
              <div>Release — it snaps into place</div>
              <button
                onClick={resetToSetup}
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
                Capture a new area
              </button>
            </>
          )}
        </>
      }
    >
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
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

function drawPinchHint(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
) {
  ctx.fillStyle = "rgba(140,255,200,0.85)";
  ctx.shadowColor = "rgba(140,255,200,0.8)";
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawPiece(
  ctx: CanvasRenderingContext2D,
  piece: Piece,
  img: HTMLCanvasElement,
  tileW: number,
  tileH: number,
  canvasW: number,
  canvasH: number,
  hovered: boolean,
  grabbed: boolean,
) {
  const cx = piece.x * canvasW;
  const cy = piece.y * canvasH;
  const x = cx - tileW / 2;
  const y = cy - tileH / 2;

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

  const sr = Math.floor(piece.id / GRID);
  const sc = piece.id % GRID;
  const sw = img.width / GRID;
  const sh = img.height / GRID;
  ctx.drawImage(img, sc * sw, sr * sh, sw, sh, x, y, tileW, tileH);

  ctx.shadowBlur = 0;
  ctx.lineWidth = grabbed ? 3 : hovered ? 2 : 1.5;
  ctx.strokeStyle = grabbed
    ? "rgba(160,255,200,0.95)"
    : piece.placed
    ? "rgba(120,200,255,0.5)"
    : hovered
    ? "rgba(180,230,255,0.85)"
    : "rgba(255,255,255,0.25)";
  ctx.strokeRect(x + 0.5, y + 0.5, tileW - 1, tileH - 1);
  ctx.restore();
}
