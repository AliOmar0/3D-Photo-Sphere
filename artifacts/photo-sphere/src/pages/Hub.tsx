import { Link } from "wouter";

interface ProjectCard {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  accent: string;
  // CSS gradient string for the cover
  cover: string;
  glyph: string;
}

const PROJECTS: ProjectCard[] = [
  {
    slug: "/sphere",
    title: "3D Photo Sphere",
    tagline: "Spin a galaxy of photos with your hand",
    description:
      "Photos floating on a 3D sphere. Open palm spins it, pinch to drag and zoom. Tunnel mode lets you fly through them.",
    accent: "rgba(120,180,255,0.95)",
    cover:
      "radial-gradient(ellipse at 50% 40%, rgba(70,120,220,0.55) 0%, rgba(20,30,80,0.9) 50%, #06081e 100%)",
    glyph: "◉",
  },
  {
    slug: "/puzzle",
    title: "Jigsaw Puzzle",
    tagline: "Pinch and place puzzle pieces in mid-air",
    description:
      "Form a frame with your thumb and index, pinch on a piece to grab it, drag it to the right slot, and release to snap it home.",
    accent: "rgba(150,255,180,0.95)",
    cover:
      "linear-gradient(135deg, rgba(40,160,90,0.45) 0%, rgba(15,40,30,0.9) 100%)",
    glyph: "▦",
  },
  {
    slug: "/particles",
    title: "Particle Sculptor",
    tagline: "Push thousands of particles around",
    description:
      "A cloud of particles attracted to your fingertip. Toggle between heart, sphere, and free-form to morph the cloud.",
    accent: "rgba(220,140,255,0.95)",
    cover:
      "radial-gradient(circle at 50% 50%, rgba(180,80,220,0.55) 0%, rgba(40,15,70,0.9) 60%, #0a0418 100%)",
    glyph: "✦",
  },
  {
    slug: "/draw",
    title: "Air Draw",
    tagline: "Paint glowing ink in the air",
    description:
      "Pinch your fingers to draw neon strokes over your webcam. Pick a color from the side palette and clear with two open hands.",
    accent: "rgba(120,255,230,0.95)",
    cover:
      "linear-gradient(135deg, rgba(40,180,180,0.5) 0%, rgba(15,30,55,0.9) 100%)",
    glyph: "✎",
  },
  {
    slug: "/skeleton",
    title: "Neon Skeleton",
    tagline: "X-ray vision for your hands",
    description:
      "Glowing rainbow skeletons render over your hands with sparkle particles. Spread your hands apart to fire a lightning beam between them.",
    accent: "rgba(255,180,120,0.95)",
    cover:
      "linear-gradient(135deg, rgba(220,80,40,0.4) 0%, rgba(180,40,140,0.4) 50%, rgba(40,20,60,0.9) 100%)",
    glyph: "✋",
  },
  {
    slug: "/hud",
    title: "Floating HUD",
    tagline: "Tony Stark interface in your hands",
    description:
      "A cyan tactical HUD that follows the line between your two hands. Reads out FPS, hand metrics, and a live data stream.",
    accent: "rgba(80,220,255,0.95)",
    cover:
      "linear-gradient(135deg, rgba(40,140,210,0.5) 0%, rgba(10,25,55,0.95) 100%)",
    glyph: "◧",
  },
];

export function Hub() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background:
          "radial-gradient(ellipse at top, #0a1235 0%, #030310 60%) #030310",
        overflowY: "auto",
        fontFamily: "'Inter', system-ui, sans-serif",
        color: "#d0dff5",
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "64px 32px 80px",
        }}
      >
        <header style={{ marginBottom: 56, textAlign: "center" }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.4em",
              textTransform: "uppercase",
              color: "rgba(140,180,255,0.7)",
              marginBottom: 14,
            }}
          >
            CAMERA · GESTURES · WEBGL
          </div>
          <h1
            style={{
              fontSize: "clamp(36px, 6vw, 64px)",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              marginBottom: 18,
              background:
                "linear-gradient(180deg, #e8f0ff 0%, #8fb0e8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Hand-Tracking Playground
          </h1>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.6,
              maxWidth: 580,
              margin: "0 auto",
              color: "rgba(170,195,235,0.75)",
            }}
          >
            Six small experiments built on MediaPipe Hands, Three.js, and your
            webcam. Pick one, allow camera access, and start gesturing. Best in
            a full browser tab — Replit's preview iframe blocks WebGL.
          </p>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 20,
          }}
        >
          {PROJECTS.map((p) => (
            <Link
              key={p.slug}
              href={p.slug}
              style={{
                textDecoration: "none",
                color: "inherit",
                display: "block",
                background: "rgba(15,20,45,0.6)",
                border: "1px solid rgba(80,120,200,0.2)",
                borderRadius: 18,
                overflow: "hidden",
                transition:
                  "transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget;
                el.style.transform = "translateY(-4px)";
                el.style.borderColor = p.accent;
                el.style.boxShadow = `0 12px 32px -8px ${p.accent}`;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget;
                el.style.transform = "translateY(0)";
                el.style.borderColor = "rgba(80,120,200,0.2)";
                el.style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  position: "relative",
                  height: 110,
                  background: p.cover,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    fontSize: 56,
                    color: p.accent,
                    opacity: 0.85,
                    textShadow: `0 0 24px ${p.accent}`,
                    fontFamily: "'Inter', system-ui, sans-serif",
                    lineHeight: 1,
                  }}
                >
                  {p.glyph}
                </div>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(180deg, transparent 60%, rgba(3,3,16,0.6) 100%)",
                  }}
                />
              </div>
              <div style={{ padding: "18px 22px 22px" }}>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: p.accent,
                    marginBottom: 6,
                  }}
                >
                  {p.tagline}
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    letterSpacing: "-0.01em",
                    marginBottom: 8,
                    color: "rgba(225,235,255,0.95)",
                  }}
                >
                  {p.title}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    lineHeight: 1.55,
                    color: "rgba(160,180,215,0.75)",
                  }}
                >
                  {p.description}
                </div>
              </div>
            </Link>
          ))}
        </div>

        <footer
          style={{
            marginTop: 64,
            textAlign: "center",
            fontSize: 12,
            color: "rgba(120,140,180,0.55)",
          }}
        >
          Built by Ali Omar ·{" "}
          <a
            href="https://github.com/AliOmar0/3D-Photo-Sphere"
            target="_blank"
            rel="noreferrer"
            style={{ color: "rgba(140,200,255,0.85)" }}
          >
            github.com/AliOmar0/3D-Photo-Sphere
          </a>
        </footer>
      </div>
    </div>
  );
}
