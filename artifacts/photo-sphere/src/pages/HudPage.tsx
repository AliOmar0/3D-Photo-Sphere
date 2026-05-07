import { useEffect, useRef, useState } from "react";
import { ProjectShell } from "@/components/ProjectShell";
import {
  useHandTracking,
  countExtendedFingers,
  type HandsResult,
} from "@/hooks/useHandTracking";

const HUD_LINES = [
  "INIT NEURAL BRIDGE …",
  "LINKING HAND VECTORS",
  "GESTURE STREAM ONLINE",
  "QUANTUM MESH SYNC",
  "SCANNING ENVIRONMENT",
  "TRACKING 21 LANDMARKS",
  "AUGMENT LAYER ACTIVE",
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export function HudPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handsResultRef = useRef<HandsResult | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const tickRef = useRef(0);
  const fpsRef = useRef({ frames: 0, last: performance.now(), fps: 0 });
  const [info, setInfo] = useState({ fps: 0, hands: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      tickRef.current++;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.fillStyle = "#030310";
      ctx.fillRect(0, 0, w, h);

      // mirrored video backdrop
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
        ctx.fillStyle = "rgba(3,8,20,0.45)";
        ctx.fillRect(0, 0, w, h);
      }

      // Edge framing — subtle scanlines + corner brackets
      drawCornerBrackets(ctx, w, h, "rgba(80,220,255,0.5)");

      const r = handsResultRef.current;
      const handLms = r?.multiHandLandmarks ?? [];

      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);

      if (handLms.length >= 2) {
        // Anchor between two hand index fingertips
        const a = handLms[0][8];
        const b = handLms[1][8];
        const ax = a.x * w;
        const ay = a.y * h;
        const bx = b.x * w;
        const by = b.y * h;
        drawHud(ctx, ax, ay, bx, by, particlesRef.current, tickRef.current);
        // Anchor brackets at each hand
        drawHandBracket(ctx, handLms[0], w, h, "#5cf2ff");
        drawHandBracket(ctx, handLms[1], w, h, "#5cf2ff");
      } else if (handLms.length === 1) {
        // single hand — small "awaiting second hand" pip near the index tip
        const tip = handLms[0][8];
        drawHandBracket(ctx, handLms[0], w, h, "#5cf2ff");
        ctx.fillStyle = "rgba(80,220,255,0.95)";
        ctx.font = "11px 'JetBrains Mono', monospace";
        ctx.fillText("AWAITING SECOND HAND", tip.x * w + 16, tip.y * h);
      } else {
        // no hands — central prompt
        ctx.fillStyle = "rgba(80,220,255,0.6)";
        ctx.font = "13px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("RAISE BOTH HANDS TO ACTIVATE HUD", w / 2, h / 2);
        ctx.textAlign = "left";
      }

      ctx.restore();

      // FPS
      fpsRef.current.frames++;
      const now = performance.now();
      if (now - fpsRef.current.last > 500) {
        fpsRef.current.fps = Math.round(
          (fpsRef.current.frames * 1000) / (now - fpsRef.current.last),
        );
        fpsRef.current.frames = 0;
        fpsRef.current.last = now;
        setInfo({ fps: fpsRef.current.fps, hands: handLms.length });
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const onResults = (r: HandsResult) => {
    handsResultRef.current = r;
  };
  const { status, cameraReady } = useHandTracking({ videoRef, onResults });

  return (
    <ProjectShell
      title="Floating HUD"
      subtitle="A sci-fi panel anchored between your hands"
      status={`${status} · ${info.fps} FPS · ${info.hands} hand${info.hands === 1 ? "" : "s"}`}
      controls={
        <>
          <div style={{ fontWeight: 600, color: "rgba(80,220,255,0.95)" }}>
            How it works
          </div>
          <div>Hold both hands open in front of the camera</div>
          <div>HUD anchors and stretches between your fingertips</div>
          <div>Move your hands together / apart to resize it</div>
        </>
      }
    >
      <video
        ref={videoRef}
        muted
        playsInline
        style={{ display: "none" }}
      />
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
      {!cameraReady && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(120,140,180,0.7)",
            fontSize: 14,
          }}
        >
          Allow camera access to power up the HUD
        </div>
      )}
    </ProjectShell>
  );
}

function drawCornerBrackets(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  const s = 28;
  const m = 24;
  const corners = [
    [m, m, 1, 1],
    [w - m, m, -1, 1],
    [m, h - m, 1, -1],
    [w - m, h - m, -1, -1],
  ];
  for (const [x, y, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * dy);
    ctx.lineTo(x, y);
    ctx.lineTo(x + s * dx, y);
    ctx.stroke();
  }
}

function drawHandBracket(
  ctx: CanvasRenderingContext2D,
  lms: Array<{ x: number; y: number }>,
  w: number,
  h: number,
  color: string,
) {
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (const p of lms) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const x = minX * w - 8;
  const y = minY * h - 8;
  const ww = (maxX - minX) * w + 16;
  const hh = (maxY - minY) * h + 16;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  const s = 14;
  // four corners
  const corners = [
    [x, y, 1, 1],
    [x + ww, y, -1, 1],
    [x, y + hh, 1, -1],
    [x + ww, y + hh, -1, -1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * dy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + s * dx, cy);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
}

function drawHud(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  particles: Particle[],
  tick: number,
) {
  // Compute the line + a perpendicular axis
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 40) return;
  const cx = (ax + bx) / 2;
  const cy = (ay + by) / 2;
  const angle = Math.atan2(dy, dx);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);

  const w = Math.min(Math.max(len * 0.8, 200), 700);
  const h = Math.max(w * 0.22, 80);
  const x = -w / 2;
  const y = -h / 2;

  // Panel background
  ctx.fillStyle = "rgba(5,20,40,0.78)";
  ctx.strokeStyle = "rgba(80,220,255,0.85)";
  ctx.lineWidth = 1.5;
  ctx.shadowColor = "#5cf2ff";
  ctx.shadowBlur = 14;
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Inner divider
  ctx.strokeStyle = "rgba(80,220,255,0.4)";
  ctx.beginPath();
  const dividerX = x + w * 0.42;
  ctx.moveTo(dividerX, y + 8);
  ctx.lineTo(dividerX, y + h - 8);
  ctx.stroke();

  // LEFT: scrolling text lines (drawn with counter-rotation so text reads upright)
  ctx.save();
  // text orientation: keep readable when hands tilt by counter-rotating only mildly
  ctx.fillStyle = "rgba(160,240,255,0.9)";
  ctx.font = "10px 'JetBrains Mono', monospace";
  const lh = 13;
  const visible = Math.floor((h - 18) / lh);
  for (let i = 0; i < visible; i++) {
    const idx = (Math.floor(tick / 30) + i) % HUD_LINES.length;
    const alpha = 0.4 + (i / visible) * 0.55;
    ctx.fillStyle = `rgba(160,240,255,${alpha})`;
    ctx.fillText(`> ${HUD_LINES[idx]}`, x + 10, y + 16 + i * lh);
  }
  ctx.restore();

  // RIGHT: spawning particles inside the panel right half
  const px = dividerX + 8;
  const py = y + 8;
  const pw = w - (dividerX - x) - 16;
  const ph = h - 16;

  // Border for particle area
  ctx.strokeStyle = "rgba(80,220,255,0.25)";
  ctx.strokeRect(px, py, pw, ph);

  // emit particles
  for (let i = 0; i < 3; i++) {
    particles.push({
      x: px + Math.random() * pw,
      y: py + ph - 2,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -1 - Math.random() * 1.5,
      life: 1,
    });
  }
  // update + draw
  const next: Particle[] = [];
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy *= 0.97;
    p.life -= 0.02;
    if (p.life > 0 && p.x > px && p.x < px + pw && p.y > py) {
      ctx.fillStyle = `hsla(${190 + Math.random() * 40}, 100%, 70%, ${p.life})`;
      ctx.fillRect(p.x, p.y, 2, 2);
      next.push(p);
    }
  }
  particles.length = 0;
  for (const p of next.slice(-220)) particles.push(p);

  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
