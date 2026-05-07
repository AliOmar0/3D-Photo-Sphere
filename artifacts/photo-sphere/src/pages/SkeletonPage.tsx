import { useEffect, useRef, useState } from "react";
import { ProjectShell } from "@/components/ProjectShell";
import {
  useHandTracking,
  HAND_CONNECTIONS,
  countExtendedFingers,
  isPinching,
  type HandsResult,
} from "@/hooks/useHandTracking";

interface Sparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  hue: number;
}

const RAINBOW_HUES = [0, 35, 70, 130, 190, 230, 280, 320];

export function SkeletonPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparklesRef = useRef<Sparkle[]>([]);
  const handsResultRef = useRef<HandsResult | null>(null);
  const fpsRef = useRef({ frames: 0, last: performance.now(), fps: 0 });
  const [stats, setStats] = useState({
    hands: 0,
    fps: 0,
    gesture: "—",
    spread: 0,
  });

  // render loop
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
        ctx.fillStyle = "rgba(3,3,16,0.4)";
        ctx.fillRect(0, 0, w, h);
      }

      const r = handsResultRef.current;
      ctx.save();
      // mirror so landmark x matches the visual
      ctx.translate(w, 0);
      ctx.scale(-1, 1);

      const handLms = r?.multiHandLandmarks ?? [];
      // Fire lightning between two hand wrists when present
      let spread = 0;
      if (handLms.length >= 2) {
        const w0 = handLms[0][0];
        const w1 = handLms[1][0];
        spread = Math.hypot(w0.x - w1.x, w0.y - w1.y);
        // beam
        const x0 = w0.x * w;
        const y0 = w0.y * h;
        const x1 = w1.x * w;
        const y1 = w1.y * h;
        const segs = 14;
        ctx.lineWidth = 4;
        ctx.shadowColor = "#7cf";
        ctx.shadowBlur = 20;
        ctx.strokeStyle = "rgba(140,220,255,0.9)";
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        for (let i = 1; i < segs; i++) {
          const t = i / segs;
          const px = x0 + (x1 - x0) * t + (Math.random() - 0.5) * 30;
          const py = y0 + (y1 - y0) * t + (Math.random() - 0.5) * 30;
          ctx.lineTo(px, py);
        }
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Skeleton per hand
      handLms.forEach((lms, hi) => {
        const baseHue = RAINBOW_HUES[hi % RAINBOW_HUES.length];
        // bones
        for (let ci = 0; ci < HAND_CONNECTIONS.length; ci++) {
          const [a, b] = HAND_CONNECTIONS[ci];
          const hue = (baseHue + ci * 18) % 360;
          ctx.strokeStyle = `hsl(${hue}, 100%, 65%)`;
          ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
          ctx.shadowBlur = 12;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(lms[a].x * w, lms[a].y * h);
          ctx.lineTo(lms[b].x * w, lms[b].y * h);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
        // joints
        for (let j = 0; j < lms.length; j++) {
          const hue = (baseHue + j * 12) % 360;
          ctx.fillStyle = `hsl(${hue}, 100%, 70%)`;
          ctx.beginPath();
          ctx.arc(
            lms[j].x * w,
            lms[j].y * h,
            j === 4 || j === 8 ? 7 : 4,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
        // emit sparkles from fingertips
        if (Math.random() < 0.5) {
          const tip = lms[8];
          sparklesRef.current.push({
            x: tip.x * w,
            y: tip.y * h,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2 - 1,
            life: 1,
            hue: (baseHue + Math.random() * 60) % 360,
          });
        }
      });

      // sparkles
      const next: Sparkle[] = [];
      for (const s of sparklesRef.current) {
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.05;
        s.life -= 0.02;
        if (s.life > 0) {
          ctx.fillStyle = `hsla(${s.hue}, 100%, 70%, ${s.life})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
          ctx.fill();
          next.push(s);
        }
      }
      sparklesRef.current = next.slice(-400);

      ctx.restore();

      // FPS counter
      fpsRef.current.frames++;
      const now = performance.now();
      if (now - fpsRef.current.last > 500) {
        fpsRef.current.fps = Math.round(
          (fpsRef.current.frames * 1000) / (now - fpsRef.current.last),
        );
        fpsRef.current.frames = 0;
        fpsRef.current.last = now;
        let gesture = "—";
        if (handLms.length > 0) {
          const open = countExtendedFingers(handLms[0]);
          const pinch = isPinching(handLms[0]);
          if (pinch) gesture = "PINCH";
          else if (open >= 4) gesture = "OPEN";
          else if (open <= 1) gesture = "FIST";
          else gesture = `${open} fingers`;
        }
        setStats({
          hands: handLms.length,
          fps: fpsRef.current.fps,
          gesture,
          spread: Math.round(spread * 100),
        });
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
      title="Neon Skeleton"
      subtitle="Show both hands and spread them apart"
      status={status}
      controls={
        <>
          <div style={{ fontWeight: 600, color: "rgba(255,180,120,0.95)" }}>
            Try this
          </div>
          <div>Show one or two hands to the camera</div>
          <div>Move your fingers — sparkles trail the fingertips</div>
          <div>Spread both hands apart → lightning beam connects them</div>
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

      {/* Stats panel */}
      <div
        data-ui
        style={{
          position: "absolute",
          top: 90,
          left: 20,
          background: "rgba(0,0,20,0.7)",
          border: "1px solid rgba(255,160,80,0.25)",
          borderRadius: 10,
          padding: "10px 14px",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: "rgba(255,200,150,0.95)",
          lineHeight: 1.7,
          letterSpacing: "0.06em",
          backdropFilter: "blur(8px)",
          zIndex: 30,
          minWidth: 160,
        }}
      >
        <div>HANDS DETECTED: {stats.hands}</div>
        <div>FPS:            {stats.fps}</div>
        <div>GESTURE:        {stats.gesture}</div>
        <div>SPREAD:         {stats.spread}%</div>
      </div>

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
          Allow camera access to enable the skeleton
        </div>
      )}
    </ProjectShell>
  );
}
