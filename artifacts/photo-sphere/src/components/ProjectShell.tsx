import type { ReactNode } from "react";
import { Link } from "wouter";

interface ProjectShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  controls?: ReactNode;
  status?: string;
}

export function ProjectShell({
  title,
  subtitle,
  children,
  controls,
  status,
}: ProjectShellProps) {
  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        background: "#030310",
        overflow: "hidden",
        fontFamily: "'Inter', system-ui, sans-serif",
        color: "#d0dff5",
      }}
    >
      {children}

      {/* Top-left back button + title */}
      <div
        data-ui
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          display: "flex",
          alignItems: "center",
          gap: 14,
          zIndex: 50,
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "rgba(0,0,20,0.65)",
            border: "1px solid rgba(80,140,255,0.3)",
            color: "rgba(180,210,255,0.95)",
            padding: "8px 14px",
            borderRadius: 10,
            fontSize: 12,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            textDecoration: "none",
            backdropFilter: "blur(8px)",
            cursor: "pointer",
          }}
        >
          ← Playground
        </Link>
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(140,200,255,0.95)",
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 11,
                color: "rgba(150,170,210,0.75)",
                marginTop: 2,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {/* Status pill (top-right) */}
      {status && (
        <div
          data-ui
          style={{
            position: "absolute",
            top: 24,
            right: 24,
            color: "rgba(180,210,255,0.8)",
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            background: "rgba(0,0,20,0.55)",
            padding: "6px 14px",
            borderRadius: 20,
            border: "1px solid rgba(80,140,255,0.25)",
            backdropFilter: "blur(8px)",
            zIndex: 50,
          }}
        >
          {status}
        </div>
      )}

      {/* Controls (bottom-left) */}
      {controls && (
        <div
          data-ui
          style={{
            position: "absolute",
            bottom: 20,
            left: 20,
            background: "rgba(0,0,20,0.65)",
            border: "1px solid rgba(80,140,255,0.25)",
            borderRadius: 14,
            padding: "14px 18px",
            backdropFilter: "blur(8px)",
            color: "rgba(160,190,230,0.85)",
            fontSize: 12,
            lineHeight: 1.9,
            maxWidth: 320,
            zIndex: 50,
          }}
        >
          {controls}
        </div>
      )}
    </div>
  );
}

export function CameraPip({
  videoRef,
  overlayRef,
  ready,
  label = "CAMERA",
  hidden = false,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  overlayRef?: React.RefObject<HTMLCanvasElement | null>;
  ready: boolean;
  label?: string;
  hidden?: boolean;
}) {
  return (
    <div
      data-ui
      style={{
        position: "absolute",
        bottom: 20,
        right: 20,
        width: 200,
        height: 150,
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid rgba(80,150,255,0.3)",
        background: "#000",
        boxShadow: "0 0 24px rgba(60,100,255,0.15)",
        zIndex: 50,
        display: hidden ? "none" : "block",
      }}
    >
      {!ready && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(120,140,180,0.7)",
            fontSize: 11,
            textAlign: "center",
            padding: 12,
          }}
        >
          Allow camera access
        </div>
      )}
      <video
        ref={videoRef}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scaleX(-1)",
        }}
        muted
        playsInline
      />
      {overlayRef && (
        <canvas
          ref={overlayRef}
          width={640}
          height={480}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            transform: "scaleX(-1)",
            pointerEvents: "none",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          bottom: 4,
          left: 0,
          right: 0,
          textAlign: "center",
          fontSize: 9,
          color: "rgba(100,160,255,0.6)",
          letterSpacing: "0.12em",
        }}
      >
        {label}
      </div>
    </div>
  );
}
