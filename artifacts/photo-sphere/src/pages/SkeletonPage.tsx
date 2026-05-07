import { useEffect, useRef, useState } from "react";
import { ProjectShell } from "@/components/ProjectShell";
import {
  useHandTracking,
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

const RAINBOW_HUES = [195, 320];
// MediaPipe fingertip landmark indices: thumb, index, middle, ring, pinky
const FINGERTIPS = [4, 8, 12, 16, 20] as const;

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

  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let tickN = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      tickN++;
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
        ctx.fillStyle = "rgba(3,3,16,0.45)";
        ctx.fillRect(0, 0, w, h);
      }

      const r = handsResultRef.current;
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);

      const handLms = r?.multiHandLandmarks ?? [];

      // Pre-compute the screen-space fingertip positions for each hand.
      const handTips = handLms.map((lms) =>
        FINGERTIPS.map((i) => ({ x: lms[i].x * w, y: lms[i].y * h })),
      );

      // Cross-hand connections: link matching fingertips across the two hands.
      let spread = 0;
      if (handTips.length >= 2) {
        const a = handTips[0];
        const b = handTips[1];
        const palm0 = handLms[0][0];
        const palm1 = handLms[1][0];
        spread = Math.hypot(palm0.x - palm1.x, palm0.y - palm1.y);

        for (let i = 0; i < 5; i++) {
          const hue = (190 + i * 30) % 360;
          ctx.strokeStyle = `hsla(${hue}, 100%, 70%, 0.85)`;
          ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
          ctx.shadowBlur = 14;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(a[i].x, a[i].y);
          ctx.lineTo(b[i].x, b[i].y);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      }

      // Per-hand: connect the 5 fingertips into a closed polygon — a glowing
      // pentagon — instead of drawing the hand bone skeleton.
      handTips.forEach((tips, hi) => {
        const baseHue = RAINBOW_HUES[hi % RAINBOW_HUES.length];

        // Polygon outline
        ctx.shadowColor = `hsl(${baseHue}, 100%, 65%)`;
        ctx.shadowBlur = 18;
        ctx.lineWidth = 3.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        for (let i = 0; i < tips.length; i++) {
          const p = tips[i];
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        // Animated rainbow-ish stroke
        const grad = ctx.createLinearGradient(
          tips[0].x,
          tips[0].y,
          tips[2].x,
          tips[2].y,
        );
        grad.addColorStop(0, `hsl(${baseHue}, 100%, 70%)`);
        grad.addColorStop(0.5, `hsl(${(baseHue + 60) % 360}, 100%, 70%)`);
        grad.addColorStop(1, `hsl(${(baseHue + 120) % 360}, 100%, 70%)`);
        ctx.strokeStyle = grad;
        ctx.stroke();

        // Inner web: connect each tip to every other tip with a faint line
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
        for (let i = 0; i < tips.length; i++) {
          for (let j = i + 1; j < tips.length; j++) {
            ctx.strokeStyle = `hsla(${(baseHue + i * 25) % 360}, 100%, 70%, 0.18)`;
            ctx.beginPath();
            ctx.moveTo(tips[i].x, tips[i].y);
            ctx.lineTo(tips[j].x, tips[j].y);
            ctx.stroke();
          }
        }

        // Big glowing dot at each fingertip
        for (let i = 0; i < tips.length; i++) {
          const p = tips[i];
          const hue = (baseHue + i * 25) % 360;
          // soft halo
          const radial = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 28);
          radial.addColorStop(0, `hsla(${hue}, 100%, 75%, 0.95)`);
          radial.addColorStop(0.4, `hsla(${hue}, 100%, 60%, 0.4)`);
          radial.addColorStop(1, `hsla(${hue}, 100%, 60%, 0)`);
          ctx.fillStyle = radial;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 28, 0, Math.PI * 2);
          ctx.fill();
          // bright core
          ctx.fillStyle = `hsl(${hue}, 100%, 90%)`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fill();

          // emit sparkle
          if (Math.random() < 0.35) {
            sparklesRef.current.push({
              x: p.x,
              y: p.y,
              vx: (Math.random() - 0.5) * 2.4,
              vy: (Math.random() - 0.5) * 2 - 0.8,
              life: 1,
              hue: (hue + Math.random() * 40) % 360,
            });
          }
        }
      });

      // Sparkles
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
      sparklesRef.current = next.slice(-500);

      ctx.restore();

      // FPS / stats panel update
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
      void tickN;
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
      subtitle="Glowing lines connect your fingertips"
      status={status}
      controls={
        <>
          <div style={{ fontWeight: 600, color: "rgba(255,180,120,0.95)" }}>
            Try this
          </div>
          <div>Show one hand: a glowing pentagon links your 5 fingertips</div>
          <div>Show two hands: matching fingers wire together</div>
          <div>Wiggle your fingers — sparkles fly off each tip</div>
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
          Allow camera access to see the fingertip web
        </div>
      )}
    </ProjectShell>
  );
}
