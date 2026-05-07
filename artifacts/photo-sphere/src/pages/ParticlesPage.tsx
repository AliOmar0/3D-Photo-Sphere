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

const PARTICLE_COUNT = 6000;

function targetForShape(shape: Shape): Float32Array {
  const arr = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    if (shape === "sphere") {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 1.8;
      arr[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    } else if (shape === "heart") {
      const t = Math.random() * Math.PI * 2;
      const x = 16 * Math.pow(Math.sin(t), 3);
      const y =
        13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t);
      const scale = 0.13;
      const jitter = 0.18;
      arr[i * 3 + 0] = x * scale + (Math.random() - 0.5) * jitter;
      arr[i * 3 + 1] = y * scale + (Math.random() - 0.5) * jitter;
      arr[i * 3 + 2] = (Math.random() - 0.5) * jitter;
    } else {
      arr[i * 3 + 0] = (Math.random() - 0.5) * 5;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 5;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 5;
    }
  }
  return arr;
}

export function ParticlesPage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayPipRef = useRef<HTMLCanvasElement>(null);

  const [shape, setShape] = useState<Shape>("heart");
  // Up to 2 hands tracked. Each: x,y in normalised coords + pinch + active.
  const handsRef = useRef([
    { x: 0, y: 0, pinch: false, active: false },
    { x: 0, y: 0, pinch: false, active: false },
  ]);
  const prevPinchRef = useRef([false, false]);

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
    camera.position.z = 4.4;

    // Particles
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
      const hue = 0.78 + Math.random() * 0.1;
      const c = new THREE.Color().setHSL(hue, 0.9, 0.55 + Math.random() * 0.2);
      colors[i * 3 + 0] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    // Cursor "orbs" — visible markers for each hand
    const cursorGeo = new THREE.SphereGeometry(0.18, 24, 24);
    const cursorMats = [
      new THREE.MeshBasicMaterial({
        color: 0xff66ff,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
      }),
      new THREE.MeshBasicMaterial({
        color: 0x66ffff,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
      }),
    ];
    const cursorMeshes = cursorMats.map((m) => {
      const mesh = new THREE.Mesh(cursorGeo, m);
      mesh.visible = false;
      scene.add(mesh);
      return mesh;
    });

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

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const targets = targetsRef.current;
      const pos = geo.attributes.position.array as Float32Array;
      const hs = handsRef.current;

      // Map each active hand into world coordinates.
      const handWorld: Array<{ x: number; y: number; pinch: boolean }> = [];
      for (let i = 0; i < 2; i++) {
        const h = hs[i];
        if (!h.active) {
          cursorMeshes[i].visible = false;
          continue;
        }
        const wx = (h.x - 0.5) * 5.5;
        const wy = -(h.y - 0.5) * 4.0;
        handWorld.push({ x: wx, y: wy, pinch: h.pinch });
        cursorMeshes[i].position.set(wx, wy, 0.4);
        cursorMeshes[i].visible = true;
        // pulse on pinch
        const s = h.pinch ? 1.4 + Math.sin(performance.now() / 80) * 0.25 : 1;
        cursorMeshes[i].scale.setScalar(s);
        (cursorMeshes[i].material as THREE.MeshBasicMaterial).opacity = h.pinch
          ? 0.85
          : 0.5;
      }

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const ix = i * 3;
        let tx = targets[ix + 0];
        let ty = targets[ix + 1];
        let tz = targets[ix + 2];

        // Apply force from each active hand.
        for (const hw of handWorld) {
          const dx = pos[ix + 0] - hw.x;
          const dy = pos[ix + 1] - hw.y;
          const dz = pos[ix + 2];
          const d2 = dx * dx + dy * dy + dz * dz + 0.05;
          // Bigger reach + stronger force than before.
          if (d2 < 6.5) {
            const sign = hw.pinch ? -1 : 1; // pinch attracts, open palm pushes
            // Inverse falloff with a soft floor — strong near, gentle far
            const mag = (3.2 / (d2 + 0.4)) * sign;
            tx += dx * mag;
            ty += dy * mag;
            tz += dz * mag * 0.5;
          }
        }

        // Spring + damping
        velocities[ix + 0] +=
          (tx - pos[ix + 0]) * 0.05 - velocities[ix + 0] * 0.18;
        velocities[ix + 1] +=
          (ty - pos[ix + 1]) * 0.05 - velocities[ix + 1] * 0.18;
        velocities[ix + 2] +=
          (tz - pos[ix + 2]) * 0.05 - velocities[ix + 2] * 0.18;
        pos[ix + 0] += velocities[ix + 0];
        pos[ix + 1] += velocities[ix + 1];
        pos[ix + 2] += velocities[ix + 2];
      }
      geo.attributes.position.needsUpdate = true;
      points.rotation.y += 0.0012;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      geo.dispose();
      mat.dispose();
      cursorGeo.dispose();
      cursorMats.forEach((m) => m.dispose());
      renderer.dispose();
      if (mount.contains(renderer.domElement))
        mount.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    sceneApiRef.current?.resetTargets(shape);
  }, [shape]);

  const onResults = (r: HandsResult) => {
    const pip = overlayPipRef.current;
    if (pip) {
      const ctx = pip.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, pip.width, pip.height);
    }
    const lms = r.multiHandLandmarks ?? [];
    for (let i = 0; i < 2; i++) {
      const h = handsRef.current[i];
      if (i >= lms.length) {
        h.active = false;
        prevPinchRef.current[i] = false;
        continue;
      }
      const lm = lms[i];
      h.x = mirrorX(lm[8].x);
      h.y = lm[8].y;
      h.pinch = isPinching(lm, 0.45, prevPinchRef.current[i]);
      prevPinchRef.current[i] = h.pinch;
      h.active = true;
    }
  };

  const { status, cameraReady } = useHandTracking({ videoRef, onResults });

  return (
    <ProjectShell
      title="Particle Sculptor"
      subtitle="Push the cloud with one or both hands"
      status={status}
      controls={
        <>
          <div style={{ fontWeight: 600, color: "rgba(220,140,255,0.95)" }}>
            Controls
          </div>
          <div>Open palm → blasts particles outward</div>
          <div>Pinch → pulls particles to your fingertip</div>
          <div>Use both hands for double the chaos</div>
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
