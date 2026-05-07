import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ProjectShell, CameraPip } from "@/components/ProjectShell";
import {
  useHandTracking,
  mirrorX,
  isPinching,
  type HandsResult,
} from "@/hooks/useHandTracking";

type Shape = "heart" | "sphere" | "free";

const PARTICLE_COUNT = 4500;

function targetForShape(shape: Shape): Float32Array {
  const arr = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    if (shape === "sphere") {
      // uniform on sphere, radius 1.6
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 1.6;
      arr[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    } else if (shape === "heart") {
      // parametric heart curve, slight random thickness
      const t = Math.random() * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y =
        13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t);
      const scale = 0.11;
      const jitter = 0.18;
      arr[i * 3 + 0] = x * scale + (Math.random() - 0.5) * jitter;
      arr[i * 3 + 1] = y * scale + (Math.random() - 0.5) * jitter;
      arr[i * 3 + 2] = (Math.random() - 0.5) * jitter;
    } else {
      // free: random cloud
      arr[i * 3 + 0] = (Math.random() - 0.5) * 4;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 4;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
  }
  return arr;
}

export function ParticlesPage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayPipRef = useRef<HTMLCanvasElement>(null);

  const [shape, setShape] = useState<Shape>("heart");
  const handPosRef = useRef({ x: 0, y: 0, active: false, pinch: false });

  // Three.js setup
  const targetsRef = useRef<Float32Array>(targetForShape("heart"));
  const sceneApiRef = useRef<{ resetTargets: (s: Shape) => void } | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x030310);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    camera.position.z = 4.2;

    // Particle geometry
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
      // pink/purple gradient
      const hue = 0.78 + Math.random() * 0.08;
      const c = new THREE.Color().setHSL(hue, 0.9, 0.55 + Math.random() * 0.2);
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.045,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    sceneApiRef.current = {
      resetTargets: (s: Shape) => {
        targetsRef.current = targetForShape(s);
      },
    };

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    const tmp = new THREE.Vector3();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const targets = targetsRef.current;
      const pos = geo.attributes.position.array as Float32Array;
      const hp = handPosRef.current;
      // Hand position in world coords (rough): map [0..1] to [-2.4..2.4]
      const handX = hp.active ? (hp.x - 0.5) * 4.8 : 0;
      const handY = hp.active ? -(hp.y - 0.5) * 3.6 : 0;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const ix = i * 3;
        // attract toward target
        let tx = targets[ix + 0];
        let ty = targets[ix + 1];
        let tz = targets[ix + 2];

        if (hp.active) {
          // hand pulls/pushes nearby particles
          const dx = pos[ix + 0] - handX;
          const dy = pos[ix + 1] - handY;
          const dz = pos[ix + 2];
          const d2 = dx * dx + dy * dy + dz * dz + 0.05;
          if (d2 < 1.4) {
            const force = hp.pinch ? -0.5 : 0.6; // pinch attracts, open pushes
            const f = force / d2;
            tx += dx * f * 0.4;
            ty += dy * f * 0.4;
            tz += dz * f * 0.4;
          }
        }

        velocities[ix + 0] +=
          (tx - pos[ix + 0]) * 0.025 - velocities[ix + 0] * 0.12;
        velocities[ix + 1] +=
          (ty - pos[ix + 1]) * 0.025 - velocities[ix + 1] * 0.12;
        velocities[ix + 2] +=
          (tz - pos[ix + 2]) * 0.025 - velocities[ix + 2] * 0.12;
        pos[ix + 0] += velocities[ix + 0];
        pos[ix + 1] += velocities[ix + 1];
        pos[ix + 2] += velocities[ix + 2];
      }
      geo.attributes.position.needsUpdate = true;
      points.rotation.y += 0.0015;
      tmp.set(0, 0, 0);
      camera.lookAt(tmp);
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      geo.dispose();
      mat.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement))
        mount.removeChild(renderer.domElement);
    };
  }, []);

  // when the user changes shape, recompute targets
  useEffect(() => {
    sceneApiRef.current?.resetTargets(shape);
  }, [shape]);

  const onResults = (r: HandsResult) => {
    const pip = overlayPipRef.current;
    if (pip) {
      const ctx = pip.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, pip.width, pip.height);
    }
    if (!r.multiHandLandmarks || r.multiHandLandmarks.length === 0) {
      handPosRef.current.active = false;
      return;
    }
    const lm = r.multiHandLandmarks[0];
    handPosRef.current.x = mirrorX(lm[8].x);
    handPosRef.current.y = lm[8].y;
    handPosRef.current.active = true;
    handPosRef.current.pinch = isPinching(lm);
  };

  const { status, cameraReady } = useHandTracking({ videoRef, onResults });

  return (
    <ProjectShell
      title="Particle Sculptor"
      subtitle="Move your hand to sculpt the cloud"
      status={status}
      controls={
        <>
          <div style={{ fontWeight: 600, color: "rgba(220,140,255,0.95)" }}>
            Controls
          </div>
          <div>Open hand → push particles outward</div>
          <div>Pinch → attract particles to fingertip</div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {(["heart", "sphere", "free"] as Shape[]).map((s) => (
              <button
                key={s}
                onClick={() => setShape(s)}
                style={{
                  background:
                    shape === s
                      ? "rgba(220,140,255,0.3)"
                      : "rgba(80,80,150,0.15)",
                  border:
                    shape === s
                      ? "1px solid rgba(220,140,255,0.6)"
                      : "1px solid rgba(120,120,180,0.25)",
                  color: "rgba(225,210,255,0.95)",
                  padding: "5px 12px",
                  borderRadius: 8,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  cursor: "pointer",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </>
      }
    >
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />
      <CameraPip
        videoRef={videoRef}
        overlayRef={overlayPipRef}
        ready={cameraReady}
      />
    </ProjectShell>
  );
}
