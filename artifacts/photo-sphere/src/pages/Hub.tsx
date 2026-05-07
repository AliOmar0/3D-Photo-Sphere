import { Link } from "wouter";

interface ProjectCard {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  thumb: string;
  accent: string;
}

const PROJECTS: ProjectCard[] = [
  {
    slug: "/sphere",
    title: "3D Photo Sphere",
    tagline: "Spin a galaxy of photos with your hand",
    description:
      "Photos floating on a 3D sphere. Open palm spins it, pinch to drag and zoom. Tunnel mode lets you fly through them.",
    thumb: `${import.meta.env.BASE_URL}thumbs/sphere.svg`,
    accent: "rgba(120,180,255,0.45)",
  },
  {
    slug: "/puzzle",
    title: "Live Puzzle",
    tagline: "Solve a puzzle of your own face",
    description:
      "Your live camera feed sliced into a sliding-tile puzzle. Pinch a tile and drag it into the empty slot.",
    thumb: `${import.meta.env.BASE_URL}thumbs/puzzle.jpg`,
    accent: "rgba(180,255,180,0.45)",
  },
  {
    slug: "/particles",
    title: "Particle Sculptor",
    tagline: "Push thousands of particles around",
    description:
      "A cloud of particles attracted to your fingertip. Toggle between heart, sphere, and free-form to morph the cloud.",
    thumb: `${import.meta.env.BASE_URL}thumbs/particles.jpg`,
    accent: "rgba(220,140,255,0.45)",
  },
  {
    slug: "/draw",
    title: "Air Draw",
    tagline: "Paint glowing ink in the air",
    description:
      "Pinch your fingers to draw neon strokes over your webcam. Pick a color from the side palette and clear with two open hands.",
    thumb: `${import.meta.env.BASE_URL}thumbs/draw.jpg`,
    accent: "rgba(120,255,230,0.5)",
  },
  {
    slug: "/skeleton",
    title: "Neon Skeleton",
    tagline: "X-ray vision for your hands",
    description:
      "Glowing rainbow skeletons render over your hands with sparkle particles. Spread your hands apart to fire a lightning beam between them.",
    thumb: `${import.meta.env.BASE_URL}thumbs/skeleton.jpg`,
    accent: "rgba(255,180,120,0.5)",
  },
  {
    slug: "/hud",
    title: "Floating HUD",
    tagline: "Tony Stark interface in your hands",
    description:
      "A cyan tactical HUD that follows the line between your two hands. Reads out FPS, hand metrics, and a live data stream.",
    thumb: `${import.meta.env.BASE_URL}thumbs/hud.jpg`,
    accent: "rgba(80,220,255,0.5)",
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
                  aspectRatio: "16 / 9",
                  background: "#000",
                  overflow: "hidden",
                }}
              >
                <img
                  src={p.thumb}
                  alt={p.title}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                  loading="lazy"
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: `linear-gradient(180deg, transparent 50%, rgba(3,3,16,0.95) 100%)`,
                  }}
                />
              </div>
              <div style={{ padding: "18px 22px 22px" }}>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: p.accent.replace("0.45", "0.95").replace("0.5", "0.95"),
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
