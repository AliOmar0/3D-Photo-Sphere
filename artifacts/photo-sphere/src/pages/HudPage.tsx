import { useEffect, useRef, useState } from "react";
import { ProjectShell } from "@/components/ProjectShell";
import {
  useHandTracking,
  countExtendedFingers,
  isPinching,
  pinchAmount,
  type HandsResult,
  type HandLandmark,
} from "@/hooks/useHandTracking";

export function HudPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handsResultRef = useRef<HandsResult | null>(null);
  const fpsRef = useRef({ frames: 0, last: performance.now(), fps: 0 });
  const [info, setInfo] = useState({ fps: 0, hands: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let tick = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      tick++;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.fillStyle = "#030310";
      ctx.fillRect(0, 0, w, h);

      // Mirrored video backdrop
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
        // Cool blue tint
        ctx.fillStyle = "rgba(2,12,28,0.55)";
        ctx.fillRect(0, 0, w, h);
      }

      drawCornerBrackets(ctx, w, h, "rgba(80,220,255,0.35)");

      const r = handsResultRef.current;
      const handLms = r?.multiHandLandmarks ?? [];

      // Mirror coordinate system to match the visible video
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);

      handLms.forEach((lms, i) => {
        drawPalmReticle(ctx, lms, w, h, tick, i);
      });

      ctx.restore();

      if (handLms.length === 0) {
        ctx.fillStyle = "rgba(80,220,255,0.55)";
        ctx.font = "12px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(
          "RAISE A HAND TO INITIALISE THE PALM HUD",
          w / 2,
          h / 2,
        );
        ctx.textAlign = "left";
      }

      // FPS readout
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
      subtitle="Tactical reticle locks onto each palm"
      status={`${status} · ${info.fps} FPS · ${info.hands} hand${info.hands === 1 ? "" : "s"}`}
      controls={
        <>
          <div style={{ fontWeight: 600, color: "rgba(80,220,255,0.95)" }}>
            How it works
          </div>
          <div>Show one or both palms to the camera</div>
          <div>Rotating reticle locks onto each palm centre</div>
          <div>Pinch → outer ring expands and pulses</div>
          <div>Live readouts orbit each hand</div>
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

/**
 * Iron-Man-style circular HUD reticle anchored to the palm of one hand.
 * - Outer rotating ring with tick marks
 * - Inner counter-rotating ring
 * - Crosshair through the palm centre
 * - Orbiting readouts: distance, gesture, hand id
 * - On pinch: outer ring expands and pulses
 */
function drawPalmReticle(
  ctx: CanvasRenderingContext2D,
  lms: HandLandmark[],
  w: number,
  h: number,
  tick: number,
  handIndex: number,
) {
  // Palm centre = average of wrist + index MCP + pinky MCP
  const cx = ((lms[0].x + lms[5].x + lms[17].x) / 3) * w;
  const cy = ((lms[0].y + lms[5].y + lms[17].y) / 3) * h;
  // Palm size from wrist→middle MCP distance
  const palmPx = Math.hypot(
    (lms[9].x - lms[0].x) * w,
    (lms[9].y - lms[0].y) * h,
  );
  const baseR = Math.max(60, palmPx * 1.0);

  const pinch = isPinching(lms);
  const pinchAmt = pinchAmount(lms);
  const open = countExtendedFingers(lms);
  const colour = handIndex === 0 ? "#5cf2ff" : "#a98cff";

  // Outer ring expands when pinching
  const outerR = baseR * (pinch ? 1.4 : 1.15) +
    (pinch ? Math.sin(tick / 4) * 6 : 0);
  const innerR = baseR * 0.55;

  ctx.save();
  ctx.shadowColor = colour;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1.5;

  // Outer rotating tick ring
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((tick / 200) * (handIndex === 0 ? 1 : -1));
  // ring
  ctx.beginPath();
  ctx.arc(0, 0, outerR, 0, Math.PI * 2);
  ctx.stroke();
  // 24 tick marks, every 6th one longer
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const long = i % 6 === 0;
    const r1 = outerR + 4;
    const r2 = outerR + (long ? 14 : 8);
    ctx.lineWidth = long ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    ctx.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
    ctx.stroke();
  }
  // 4 dashes inside the ring
  ctx.lineWidth = 1.5;
  for (let q = 0; q < 4; q++) {
    const a0 = q * (Math.PI / 2) - 0.25;
    const a1 = q * (Math.PI / 2) + 0.25;
    ctx.beginPath();
    ctx.arc(0, 0, outerR - 8, a0, a1);
    ctx.stroke();
  }
  ctx.restore();

  // Inner counter-rotating ring
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-(tick / 120) * (handIndex === 0 ? 1 : -1));
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, innerR, 0, Math.PI * 2);
  ctx.stroke();
  // arc segments
  for (let s = 0; s < 3; s++) {
    const a0 = (s / 3) * Math.PI * 2 + 0.2;
    const a1 = ((s + 1) / 3) * Math.PI * 2 - 0.2;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, innerR + 8, a0, a1);
    ctx.stroke();
  }
  ctx.restore();

  // Crosshair through palm centre
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(cx - outerR - 30, cy);
  ctx.lineTo(cx - innerR - 4, cy);
  ctx.moveTo(cx + innerR + 4, cy);
  ctx.lineTo(cx + outerR + 30, cy);
  ctx.moveTo(cx, cy - outerR - 30);
  ctx.lineTo(cx, cy - innerR - 4);
  ctx.moveTo(cx, cy + innerR + 4);
  ctx.lineTo(cx, cy + outerR + 30);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Centre dot
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Readout panel — top-right of the reticle, rendered upright
  // (We're inside a mirrored ctx, so flip text back so it reads normally.)
  const labelX = cx + outerR + 22;
  const labelY = cy - outerR + 12;
  ctx.save();
  ctx.translate(labelX, labelY);
  ctx.scale(-1, 1); // un-mirror text
  ctx.fillStyle = colour;
  ctx.font = "11px 'JetBrains Mono', monospace";
  ctx.textAlign = "left";
  ctx.shadowColor = colour;
  ctx.shadowBlur = 6;
  const lines = [
    `> PALM ${String(handIndex + 1).padStart(2, "0")}`,
    `> X:${cx.toFixed(0).padStart(4, " ")}  Y:${cy.toFixed(0).padStart(4, " ")}`,
    `> SIZE: ${baseR.toFixed(0)}px`,
    `> PINCH: ${(1 - Math.min(pinchAmt / 0.7, 1)).toFixed(2)}${pinch ? " ◉" : ""}`,
    `> OPEN: ${open}/5`,
  ];
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 0, i * 14);
  }
  ctx.restore();

  // Connecting elbow line from reticle to readout
  ctx.save();
  ctx.strokeStyle = colour;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + outerR * 0.7, cy - outerR * 0.7);
  ctx.lineTo(cx + outerR + 18, cy - outerR + 4);
  ctx.lineTo(cx + outerR + 110, cy - outerR + 4);
  ctx.stroke();
  ctx.restore();
}
