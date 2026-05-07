import { useEffect, useRef, useState } from "react";
import { ProjectShell } from "@/components/ProjectShell";
import {
  useHandTracking,
  isPinching,
  mirrorX,
  countExtendedFingers,
  type HandsResult,
} from "@/hooks/useHandTracking";

const COLORS = [
  "#3ee7ff", // cyan
  "#ff5cf2", // pink
  "#7cffb8", // green
  "#ffe45c", // yellow
  "#ff8a3e", // orange
  "#a78cff", // violet
  "#ffffff", // white
];

interface Stroke {
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
}

export function DrawPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const colorRef = useRef<string>(COLORS[0]);
  const [color, setColor] = useState<string>(COLORS[0]);

  const stateRef = useRef({
    pinching: false,
    bothOpenFrames: 0,
    fingerX: 0,
    fingerY: 0,
    showFinger: false,
  });

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  function clearAll() {
    strokesRef.current = [];
    currentStrokeRef.current = null;
  }

  // Render loop: video as background + strokes overlay
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

      // Mirrored video as backdrop
      if (video.readyState === 4 && video.videoWidth > 0) {
        ctx.save();
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        // letterbox cover
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        const scale = Math.max(w / vw, h / vh);
        const dw = vw * scale;
        const dh = vh * scale;
        ctx.globalAlpha = 0.75;
        ctx.drawImage(video, (w - dw) / 2, (h - dh) / 2, dw, dh);
        ctx.globalAlpha = 1;
        ctx.restore();
        // dark vignette
        ctx.fillStyle = "rgba(3,3,16,0.35)";
        ctx.fillRect(0, 0, w, h);
      }

      // Draw all strokes
      const all = [...strokesRef.current];
      if (currentStrokeRef.current) all.push(currentStrokeRef.current);
      for (const s of all) {
        if (s.points.length < 2) continue;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        // Glow
        ctx.shadowColor = s.color;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.moveTo(s.points[0].x * w, s.points[0].y * h);
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i].x * w, s.points[i].y * h);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Fingertip cursor
      if (stateRef.current.showFinger) {
        const x = stateRef.current.fingerX * w;
        const y = stateRef.current.fingerY * h;
        ctx.beginPath();
        ctx.arc(x, y, stateRef.current.pinching ? 8 : 12, 0, Math.PI * 2);
        ctx.strokeStyle = colorRef.current;
        ctx.lineWidth = 2;
        ctx.stroke();
        if (stateRef.current.pinching) {
          ctx.fillStyle = colorRef.current;
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  const onResults = (r: HandsResult) => {
    if (!r.multiHandLandmarks || r.multiHandLandmarks.length === 0) {
      stateRef.current.showFinger = false;
      // commit current stroke
      if (currentStrokeRef.current) {
        strokesRef.current.push(currentStrokeRef.current);
        currentStrokeRef.current = null;
      }
      stateRef.current.pinching = false;
      stateRef.current.bothOpenFrames = 0;
      return;
    }

    // Two open hands ⇒ clear after ~10 frames
    if (r.multiHandLandmarks.length >= 2) {
      const o1 = countExtendedFingers(r.multiHandLandmarks[0]);
      const o2 = countExtendedFingers(r.multiHandLandmarks[1]);
      if (o1 >= 4 && o2 >= 4) {
        stateRef.current.bothOpenFrames++;
        if (stateRef.current.bothOpenFrames > 10) {
          clearAll();
          stateRef.current.bothOpenFrames = 0;
        }
      } else {
        stateRef.current.bothOpenFrames = 0;
      }
    } else {
      stateRef.current.bothOpenFrames = 0;
    }

    // Use first hand as the drawing hand; index fingertip
    const lm = r.multiHandLandmarks[0];
    const px = mirrorX(lm[8].x);
    const py = lm[8].y;
    // Hysteresis pinch: easier to keep drawing than to start a new stroke.
    const pinching = isPinching(lm, 0.45, stateRef.current.pinching);
    stateRef.current.fingerX = px;
    stateRef.current.fingerY = py;
    stateRef.current.showFinger = true;

    // Detect color picking: fingertip in the right palette zone
    const inPaletteX = px > 0.92;
    if (inPaletteX) {
      const slot = Math.floor(py * COLORS.length);
      const idx = Math.max(0, Math.min(COLORS.length - 1, slot));
      if (pinching && colorRef.current !== COLORS[idx]) {
        setColor(COLORS[idx]);
      }
    }

    if (pinching && !inPaletteX) {
      if (!stateRef.current.pinching) {
        // start a new stroke
        currentStrokeRef.current = {
          color: colorRef.current,
          width: 6,
          points: [{ x: px, y: py }],
        };
      } else if (currentStrokeRef.current) {
        currentStrokeRef.current.points.push({ x: px, y: py });
      }
    } else {
      if (currentStrokeRef.current) {
        strokesRef.current.push(currentStrokeRef.current);
        currentStrokeRef.current = null;
      }
    }
    stateRef.current.pinching = pinching;
  };

  const { status, cameraReady } = useHandTracking({ videoRef, onResults });

  return (
    <ProjectShell
      title="Air Draw"
      subtitle="Pinch to draw · two open hands to clear"
      status={status}
      controls={
        <>
          <div style={{ fontWeight: 600, color: "rgba(120,255,230,0.95)" }}>
            How to draw
          </div>
          <div>Pinch index + thumb → draw a glowing stroke</div>
          <div>Pinch in the colour palette → switch colour</div>
          <div>Hold both hands open → clear the canvas</div>
          <button
            onClick={clearAll}
            style={{
              marginTop: 8,
              background: "rgba(80,200,200,0.2)",
              border: "1px solid rgba(120,255,230,0.4)",
              color: "rgba(200,255,245,0.95)",
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        </>
      }
    >
      {/* hidden video for hand tracking */}
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

      {/* Color palette on the right */}
      <div
        data-ui
        style={{
          position: "absolute",
          right: 20,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          background: "rgba(0,0,20,0.55)",
          padding: 10,
          borderRadius: 14,
          border: "1px solid rgba(80,140,255,0.25)",
          backdropFilter: "blur(8px)",
          zIndex: 30,
        }}
      >
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              background: c,
              border:
                color === c
                  ? "2px solid #fff"
                  : "2px solid rgba(255,255,255,0.15)",
              boxShadow: color === c ? `0 0 12px ${c}` : "none",
              cursor: "pointer",
            }}
            aria-label={`Pick color ${c}`}
          />
        ))}
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
          Allow camera access to start drawing
        </div>
      )}
    </ProjectShell>
  );
}
