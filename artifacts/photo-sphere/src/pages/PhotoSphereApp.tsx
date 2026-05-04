import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Hands } from "@mediapipe/hands";

const PHOTOS = [
  "https://picsum.photos/id/10/400/300",
  "https://picsum.photos/id/20/400/300",
  "https://picsum.photos/id/30/400/300",
  "https://picsum.photos/id/40/400/300",
  "https://picsum.photos/id/50/400/300",
  "https://picsum.photos/id/60/400/300",
  "https://picsum.photos/id/70/400/300",
  "https://picsum.photos/id/80/400/300",
  "https://picsum.photos/id/100/400/300",
  "https://picsum.photos/id/110/400/300",
  "https://picsum.photos/id/120/400/300",
  "https://picsum.photos/id/130/400/300",
  "https://picsum.photos/id/140/400/300",
  "https://picsum.photos/id/150/400/300",
  "https://picsum.photos/id/160/400/300",
  "https://picsum.photos/id/170/400/300",
  "https://picsum.photos/id/180/400/300",
  "https://picsum.photos/id/190/400/300",
  "https://picsum.photos/id/200/400/300",
  "https://picsum.photos/id/210/400/300",
  "https://picsum.photos/id/220/400/300",
  "https://picsum.photos/id/230/400/300",
  "https://picsum.photos/id/240/400/300",
  "https://picsum.photos/id/250/400/300",
];

function fibonacciSphere(n: number, radius: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  for (let i = 0; i < n; i++) {
    const theta = Math.acos(1 - (2 * (i + 0.5)) / n);
    const phi = (2 * Math.PI * i) / goldenRatio;
    points.push(
      new THREE.Vector3(
        radius * Math.sin(theta) * Math.cos(phi),
        radius * Math.cos(theta),
        radius * Math.sin(theta) * Math.sin(phi)
      )
    );
  }
  return points;
}

function dist2D(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function countExtendedFingers(lm: Array<{ x: number; y: number; z: number }>): number {
  let count = 0;
  const pairs: [number, number][] = [[8, 6], [12, 10], [16, 14], [20, 18]];
  for (const [tip, pip] of pairs) {
    if (lm[tip].y < lm[pip].y) count++;
  }
  if (dist2D(lm[4], lm[0]) > dist2D(lm[3], lm[0]) * 1.2) count++;
  return count;
}

interface GestureInfo {
  left: string;
  right: string;
}

export function PhotoSphereApp() {
  const mountRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Loading hand tracking model...");
  const [gestureInfo, setGestureInfo] = useState<GestureInfo>({
    left: "",
    right: "",
  });
  const [cameraReady, setCameraReady] = useState(false);
  const [webglError, setWebglError] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    const video = videoRef.current;
    if (!mount || !video) return;

    // ── Three.js Scene ──────────────────────────────────────────────
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, failIfMajorPerformanceCaveat: false });
    } catch (e) {
      setWebglError(true);
      return;
    }
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x030310);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    // Starfield
    const starPositions = new Float32Array(6000);
    for (let i = 0; i < 2000; i++) {
      starPositions[i * 3 + 0] = (Math.random() - 0.5) * 150;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 150;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 150;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xaaaacc, size: 0.04 })
    );
    scene.add(stars);

    // Ambient glow sphere (subtle)
    const glowGeo = new THREE.SphereGeometry(3.8, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x1122aa,
      transparent: true,
      opacity: 0.05,
      side: THREE.BackSide,
    });
    scene.add(new THREE.Mesh(glowGeo, glowMat));

    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 7;

    // Photo group
    const photoGroup = new THREE.Group();
    scene.add(photoGroup);

    const SPHERE_RADIUS = 4.5;
    const positions = fibonacciSphere(PHOTOS.length, SPHERE_RADIUS);
    const loader = new THREE.TextureLoader();

    PHOTOS.forEach((url, i) => {
      const texture = loader.load(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      const geo = new THREE.PlaneGeometry(1.4, 1.0);
      const mat = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(positions[i]);
      mesh.lookAt(new THREE.Vector3(0, 0, 0));
      mesh.rotateY(Math.PI);

      // Fade in when texture loads
      texture.addEventListener("update", () => {
        mat.opacity = 1;
        mat.needsUpdate = true;
      });
      loader.load(url, () => {
        mat.opacity = 1;
        mat.needsUpdate = true;
      });

      // White border frame
      const frameMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.25,
      });
      const frameGeo = new THREE.EdgesGeometry(geo);
      const frame = new THREE.LineSegments(frameGeo, frameMat);
      mesh.add(frame);

      photoGroup.add(mesh);
    });

    // ── Gesture State ───────────────────────────────────────────────
    const gs = {
      leftPinching: false,
      leftLastX: 0,
      leftLastY: 0,
      rightPinching: false,
      rightPinchLastY: 0,
      leftOpenness: 0,
      rightOpenness: 0,
      autoSpeed: 0.002,
    };

    // ── MediaPipe Hands ─────────────────────────────────────────────
    const hands = new Hands({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`,
    });

    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5,
    });

    function drawLandmarks(results: any) {
      const cvs = overlayCanvasRef.current;
      if (!cvs) return;
      const ctx = cvs.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      if (!results.multiHandLandmarks) return;

      const conns: [number, number][] = [
        [0, 1],[1, 2],[2, 3],[3, 4],
        [0, 5],[5, 6],[6, 7],[7, 8],
        [0, 9],[9, 10],[10, 11],[11, 12],
        [0, 13],[13, 14],[14, 15],[15, 16],
        [0, 17],[17, 18],[18, 19],[19, 20],
        [5, 9],[9, 13],[13, 17],
      ];

      for (const landmarks of results.multiHandLandmarks) {
        ctx.strokeStyle = "rgba(80,190,255,0.65)";
        ctx.lineWidth = 1.5;
        for (const [a, b] of conns) {
          ctx.beginPath();
          ctx.moveTo(landmarks[a].x * cvs.width, landmarks[a].y * cvs.height);
          ctx.lineTo(landmarks[b].x * cvs.width, landmarks[b].y * cvs.height);
          ctx.stroke();
        }
        for (let j = 0; j < landmarks.length; j++) {
          const lm = landmarks[j];
          ctx.fillStyle = j === 4 || j === 8 ? "rgba(255,255,80,0.95)" : "rgba(80,190,255,0.8)";
          ctx.beginPath();
          ctx.arc(lm.x * cvs.width, lm.y * cvs.height, j === 4 || j === 8 ? 4 : 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    hands.onResults((results: any) => {
      drawLandmarks(results);
      if (!results.multiHandLandmarks) return;

      const leftInfo = { pinching: false, openness: 0, detected: false };
      const rightInfo = { pinching: false, openness: 0, detected: false };

      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const lm = results.multiHandLandmarks[i];
        // image-space left (wrist x < 0.5) = user's right hand
        const isUserRight = lm[0].x < 0.5;
        const thumbTip = lm[4];
        const indexTip = lm[8];
        const pinchDist = dist2D(thumbTip, indexTip);
        const isPinching = pinchDist < 0.07;
        const openness = countExtendedFingers(lm) / 5;

        if (isUserRight) {
          rightInfo.detected = true;
          rightInfo.pinching = isPinching;
          rightInfo.openness = openness;
          if (isPinching && !gs.rightPinching) {
            gs.rightPinchLastY = indexTip.y;
          }
          if (isPinching && gs.rightPinching) {
            const dy = indexTip.y - gs.rightPinchLastY;
            camera.position.z = Math.max(2.5, Math.min(14, camera.position.z + dy * 10));
            gs.rightPinchLastY = indexTip.y;
          }
          gs.rightPinching = isPinching;
          gs.rightOpenness = rightInfo.openness;
        } else {
          leftInfo.detected = true;
          leftInfo.pinching = isPinching;
          leftInfo.openness = openness;
          if (isPinching && !gs.leftPinching) {
            gs.leftLastX = indexTip.x;
            gs.leftLastY = indexTip.y;
          }
          if (isPinching && gs.leftPinching) {
            const dx = indexTip.x - gs.leftLastX;
            const dy = indexTip.y - gs.leftLastY;
            photoGroup.rotation.y += dx * 3.5;
            photoGroup.rotation.x += dy * 3.5;
            gs.leftLastX = indexTip.x;
            gs.leftLastY = indexTip.y;
          }
          gs.leftPinching = isPinching;
          gs.leftOpenness = leftInfo.openness;
        }
      }

      // Auto-rotate speed driven by average hand openness
      const detected = results.multiHandLandmarks.length;
      if (detected > 0) {
        const avg = detected === 2
          ? (gs.leftOpenness + gs.rightOpenness) / 2
          : gs.leftOpenness + gs.rightOpenness;
        gs.autoSpeed = avg * 0.012;
      }

      setGestureInfo({
        left: leftInfo.detected
          ? leftInfo.pinching
            ? "Rotating"
            : `${Math.round(leftInfo.openness * 100)}% open`
          : "",
        right: rightInfo.detected
          ? rightInfo.pinching
            ? "Zooming"
            : `${Math.round(rightInfo.openness * 100)}% open`
          : "",
      });
    });

    // ── Camera / frame loop ─────────────────────────────────────────
    let rafId = 0;
    let processing = false;

    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } })
      .then((stream) => {
        video.srcObject = stream;
        video.play();
        setCameraReady(true);
        setStatus("Hand tracking active");

        const sendFrame = async () => {
          rafId = requestAnimationFrame(sendFrame);
          if (!processing && video.readyState === 4) {
            processing = true;
            try {
              await hands.send({ image: video });
            } catch (_) {
              /* ignore */
            }
            processing = false;
          }
        };
        sendFrame();
      })
      .catch(() => {
        setStatus("Camera unavailable — use mouse / touch");
      });

    // ── Mouse fallback ──────────────────────────────────────────────
    let mouseDown = false;
    let prevMX = 0;
    let prevMY = 0;
    const onMouseDown = (e: MouseEvent) => {
      mouseDown = true;
      prevMX = e.clientX;
      prevMY = e.clientY;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!mouseDown) return;
      photoGroup.rotation.y += ((e.clientX - prevMX) / window.innerWidth) * 3;
      photoGroup.rotation.x += ((e.clientY - prevMY) / window.innerHeight) * 3;
      prevMX = e.clientX;
      prevMY = e.clientY;
    };
    const onMouseUp = () => { mouseDown = false; };
    const onWheel = (e: WheelEvent) => {
      camera.position.z = Math.max(2.5, Math.min(14, camera.position.z + e.deltaY * 0.01));
    };

    renderer.domElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    renderer.domElement.addEventListener("wheel", onWheel);

    // ── Touch fallback ──────────────────────────────────────────────
    let prevTX = 0;
    let prevTY = 0;
    let prevTDist = 0;
    renderer.domElement.addEventListener("touchstart", (e: TouchEvent) => {
      if (e.touches.length === 1) {
        prevTX = e.touches[0].clientX;
        prevTY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        prevTDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    });
    renderer.domElement.addEventListener(
      "touchmove",
      (e: TouchEvent) => {
        e.preventDefault();
        if (e.touches.length === 1) {
          photoGroup.rotation.y += ((e.touches[0].clientX - prevTX) / window.innerWidth) * 3;
          photoGroup.rotation.x += ((e.touches[0].clientY - prevTY) / window.innerHeight) * 3;
          prevTX = e.touches[0].clientX;
          prevTY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
          const d = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          camera.position.z = Math.max(2.5, Math.min(14, camera.position.z + (prevTDist - d) * 0.03));
          prevTDist = d;
        }
      },
      { passive: false }
    );

    // ── Resize ──────────────────────────────────────────────────────
    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    // ── Render loop ─────────────────────────────────────────────────
    let renderRaf = 0;
    const render = () => {
      renderRaf = requestAnimationFrame(render);
      if (!gs.leftPinching) {
        photoGroup.rotation.y += gs.autoSpeed;
      }
      stars.rotation.y += 0.00008;
      renderer.render(scene, camera);
    };
    render();

    return () => {
      cancelAnimationFrame(rafId);
      cancelAnimationFrame(renderRaf);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      if (video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  if (webglError) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          background: "#030310",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Inter', system-ui, sans-serif",
          color: "rgba(160,190,240,0.85)",
          textAlign: "center",
          padding: 32,
          gap: 16,
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 8 }}>🌐</div>
        <div style={{ fontSize: 22, fontWeight: 600, color: "rgba(180,215,255,0.95)" }}>
          WebGL not available in this preview
        </div>
        <div style={{ fontSize: 14, maxWidth: 440, lineHeight: 1.7, color: "rgba(140,165,210,0.75)" }}>
          This 3D experience requires WebGL, which isn't supported in the embedded preview.
          Open the app in a full browser tab to see the photo sphere with hand tracking.
        </div>
        <a
          href={window.location.href}
          target="_blank"
          rel="noreferrer"
          style={{
            marginTop: 12,
            padding: "10px 28px",
            background: "rgba(60,120,255,0.25)",
            border: "1px solid rgba(80,150,255,0.4)",
            borderRadius: 10,
            color: "rgba(140,200,255,0.9)",
            fontSize: 14,
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          Open in new tab →
        </a>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        background: "#030310",
        overflow: "hidden",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Three.js canvas mount */}
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 24,
          left: "50%",
          transform: "translateX(-50%)",
          color: "rgba(180,210,255,0.85)",
          fontSize: 13,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          background: "rgba(0,0,20,0.55)",
          padding: "6px 20px",
          borderRadius: 20,
          border: "1px solid rgba(80,140,255,0.25)",
          backdropFilter: "blur(8px)",
          whiteSpace: "nowrap",
        }}
      >
        {status}
      </div>

      {/* Controls legend */}
      <div
        style={{
          position: "absolute",
          top: 24,
          left: 24,
          color: "rgba(160,190,230,0.75)",
          fontSize: 12,
          lineHeight: 2,
          background: "rgba(0,0,20,0.6)",
          padding: "14px 18px",
          borderRadius: 14,
          border: "1px solid rgba(60,100,200,0.2)",
          backdropFilter: "blur(8px)",
        }}
      >
        <div style={{ fontWeight: 600, color: "rgba(100,180,255,0.95)", marginBottom: 6, fontSize: 13 }}>
          Controls
        </div>
        <div>Right pinch + move up/down &mdash; Zoom</div>
        <div>Left pinch + drag &mdash; Rotate sphere</div>
        <div>Fist &rarr; slow spin &nbsp; Open palm &rarr; fast spin</div>
        <div style={{ marginTop: 8, color: "rgba(120,130,150,0.7)", fontSize: 11 }}>
          Also: drag to rotate &nbsp;|&nbsp; scroll to zoom
        </div>
      </div>

      {/* Gesture feedback */}
      {(gestureInfo.left || gestureInfo.right) && (
        <div
          style={{
            position: "absolute",
            bottom: 200,
            left: 24,
            color: "rgba(100,210,255,0.9)",
            fontSize: 12,
            lineHeight: 1.9,
            background: "rgba(0,0,20,0.65)",
            padding: "10px 16px",
            borderRadius: 12,
            border: "1px solid rgba(60,150,255,0.2)",
            backdropFilter: "blur(8px)",
          }}
        >
          {gestureInfo.left && <div>Left hand: {gestureInfo.left}</div>}
          {gestureInfo.right && <div>Right hand: {gestureInfo.right}</div>}
        </div>
      )}

      {/* Camera preview */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          right: 24,
          width: 240,
          height: 180,
          borderRadius: 14,
          overflow: "hidden",
          border: "1px solid rgba(80,150,255,0.3)",
          background: "#000",
          boxShadow: "0 0 24px rgba(60,100,255,0.15)",
        }}
      >
        {!cameraReady && (
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
            Allow camera access to enable hand tracking
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
        <canvas
          ref={overlayCanvasRef}
          width={640}
          height={480}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            transform: "scaleX(-1)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 6,
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: 10,
            color: "rgba(100,160,255,0.6)",
            letterSpacing: "0.06em",
          }}
        >
          HAND TRACKING
        </div>
      </div>
    </div>
  );
}
