import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Hands } from "@mediapipe/hands";

// 60+ default photos via Lorem Picsum
const DEFAULT_PHOTOS: string[] = Array.from({ length: 64 }, (_, i) => {
  const id = (i * 17 + 11) % 250 + 10;
  return `https://picsum.photos/id/${id}/400/300`;
});

type ViewMode = "sphere" | "tunnel";

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

function dist2D(a: { x: number; y: number }, b: { x: number; y: number }): number {
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

interface SceneController {
  applyDrag: (dx: number, dy: number) => void;
  applyZoom: (delta: number) => void;
  setAutoSpeed: (s: number) => void;
  dispose: () => void;
}

function buildSphereScene(
  mount: HTMLDivElement,
  photos: string[]
): SceneController & { renderer: THREE.WebGLRenderer; canvas: HTMLCanvasElement } {
  const renderer = new THREE.WebGLRenderer({ antialias: true, failIfMajorPerformanceCaveat: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x030310);
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  // Stars
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

  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 8;

  const photoGroup = new THREE.Group();
  scene.add(photoGroup);

  const SPHERE_RADIUS = Math.max(4.5, Math.cbrt(photos.length) * 1.4);
  const positions = fibonacciSphere(photos.length, SPHERE_RADIUS);
  const loader = new THREE.TextureLoader();
  loader.crossOrigin = "anonymous";

  photos.forEach((url, i) => {
    const geo = new THREE.PlaneGeometry(1.2, 0.9);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x111122,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(positions[i]);
    mesh.lookAt(new THREE.Vector3(0, 0, 0));
    mesh.rotateY(Math.PI);

    loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        mat.map = texture;
        mat.color.set(0xffffff);
        mat.opacity = 1;
        mat.needsUpdate = true;
      },
      undefined,
      () => {
        // image failed: keep dim placeholder
      }
    );

    const frameMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.25,
    });
    const frameGeo = new THREE.EdgesGeometry(geo);
    mesh.add(new THREE.LineSegments(frameGeo, frameMat));

    photoGroup.add(mesh);
  });

  let autoSpeed = 0.002;
  let leftDragging = false;

  const onResize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", onResize);

  let raf = 0;
  const render = () => {
    raf = requestAnimationFrame(render);
    if (!leftDragging) photoGroup.rotation.y += autoSpeed;
    stars.rotation.y += 0.00008;
    renderer.render(scene, camera);
  };
  render();

  return {
    renderer,
    canvas: renderer.domElement,
    applyDrag: (dx, dy) => {
      leftDragging = true;
      photoGroup.rotation.y += dx * 3.5;
      photoGroup.rotation.x += dy * 3.5;
      // Reset drag flag shortly after
      setTimeout(() => { leftDragging = false; }, 100);
    },
    applyZoom: (delta) => {
      camera.position.z = Math.max(2.5, Math.min(16, camera.position.z + delta));
    },
    setAutoSpeed: (s) => { autoSpeed = s; },
    dispose: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      starGeo.dispose();
      (stars.material as THREE.Material).dispose();
      photoGroup.traverse((o: THREE.Object3D) => {
        const obj = o as THREE.Mesh;
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) {
            const mm = m as THREE.MeshBasicMaterial;
            if (mm.map) mm.map.dispose();
            mm.dispose();
          }
        }
      });
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    },
  };
}

function buildTunnelScene(
  mount: HTMLDivElement,
  photos: string[]
): SceneController & { renderer: THREE.WebGLRenderer; canvas: HTMLCanvasElement } {
  const renderer = new THREE.WebGLRenderer({ antialias: true, failIfMajorPerformanceCaveat: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x030310);
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  // Stars - dense for warp effect
  const starPositions = new Float32Array(9000);
  for (let i = 0; i < 3000; i++) {
    starPositions[i * 3 + 0] = (Math.random() - 0.5) * 80;
    starPositions[i * 3 + 1] = (Math.random() - 0.5) * 80;
    starPositions[i * 3 + 2] = -Math.random() * 200;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: 0xccccee, size: 0.06 })
  );
  scene.add(stars);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 0;

  const photoGroup = new THREE.Group();
  scene.add(photoGroup);

  const Z_FAR = -120;
  const Z_NEAR = 6;
  const SPREAD_X = 10;
  const SPREAD_Y = 6;

  const loader = new THREE.TextureLoader();
  loader.crossOrigin = "anonymous";

  // We instantiate one mesh per photo, repeated to fill the tunnel
  // Total instances = max(photos.length * 3, 90)
  const totalInstances = Math.max(photos.length * 3, 90);
  const meshes: THREE.Mesh[] = [];
  const placePhoto = (mesh: THREE.Mesh, initial: boolean) => {
    mesh.position.x = (Math.random() - 0.5) * 2 * SPREAD_X;
    mesh.position.y = (Math.random() - 0.5) * 2 * SPREAD_Y;
    if (initial) {
      mesh.position.z = Z_FAR + Math.random() * (Z_NEAR - Z_FAR);
    } else {
      mesh.position.z = Z_FAR + Math.random() * 8;
    }
    // Slight random rotation around z for variety
    mesh.rotation.z = (Math.random() - 0.5) * 0.4;
  };

  // Pre-load textures (one per unique photo)
  const textures: THREE.Texture[] = photos.map((url) => {
    const tex = loader.load(url, () => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
    });
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });

  for (let i = 0; i < totalInstances; i++) {
    const photoIdx = i % photos.length;
    // Random size variation
    const scale = 0.7 + Math.random() * 1.3;
    const geo = new THREE.PlaneGeometry(1.6 * scale, 1.2 * scale);
    const mat = new THREE.MeshBasicMaterial({
      map: textures[photoIdx],
      side: THREE.DoubleSide,
      transparent: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    placePhoto(mesh, true);

    const frameGeo = new THREE.EdgesGeometry(geo);
    const frameMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.2,
    });
    mesh.add(new THREE.LineSegments(frameGeo, frameMat));

    photoGroup.add(mesh);
    meshes.push(mesh);
  }

  let travelSpeed = 0.15; // base speed
  let speedMultiplier = 1; // openness-driven
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  const onResize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener("resize", onResize);

  let raf = 0;
  const render = () => {
    raf = requestAnimationFrame(render);
    const speed = travelSpeed * speedMultiplier;
    for (const mesh of meshes) {
      mesh.position.z += speed;
      // Fade based on distance from camera
      const mat = mesh.material as THREE.MeshBasicMaterial;
      const d = camera.position.z - mesh.position.z;
      if (d > 60) mat.opacity = Math.max(0, Math.min(1, (90 - d) / 30));
      else mat.opacity = Math.max(0, Math.min(1, (d - 0.5) / 4));
      // Recycle when past camera
      if (mesh.position.z > Z_NEAR) {
        placePhoto(mesh, false);
      }
    }
    // Apply drag offset to camera (steering)
    camera.position.x += (dragOffsetX - camera.position.x) * 0.1;
    camera.position.y += (dragOffsetY - camera.position.y) * 0.1;
    camera.lookAt(dragOffsetX * 0.5, dragOffsetY * 0.5, -10);
    // Stars too
    const starsArr = stars.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < starsArr.length; i += 3) {
      starsArr[i + 2] += speed * 0.7;
      if (starsArr[i + 2] > camera.position.z) {
        starsArr[i + 2] = Z_FAR * 1.5;
      }
    }
    stars.geometry.attributes.position.needsUpdate = true;
    renderer.render(scene, camera);
  };
  render();

  return {
    renderer,
    canvas: renderer.domElement,
    applyDrag: (dx, dy) => {
      dragOffsetX = Math.max(-3, Math.min(3, dragOffsetX + dx * 8));
      dragOffsetY = Math.max(-2, Math.min(2, dragOffsetY - dy * 8));
    },
    applyZoom: (delta) => {
      // Zoom = adjust travel speed manually
      travelSpeed = Math.max(0.02, Math.min(1.2, travelSpeed - delta * 0.05));
    },
    setAutoSpeed: (s) => {
      // s ranges 0..0.012; map to multiplier 0.2..6
      speedMultiplier = 0.2 + (s / 0.012) * 5.8;
    },
    dispose: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      starGeo.dispose();
      (stars.material as THREE.Material).dispose();
      for (const tex of textures) tex.dispose();
      photoGroup.traverse((o: THREE.Object3D) => {
        const obj = o as THREE.Mesh;
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) (m as THREE.Material).dispose();
        }
      });
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    },
  };
}

interface GestureInfo {
  left: string;
  right: string;
}

export function PhotoSphereApp() {
  const mountRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<string[]>(DEFAULT_PHOTOS);
  const uploadedUrlsRef = useRef<string[]>([]);
  const [mode, setMode] = useState<ViewMode>("sphere");
  const [status, setStatus] = useState("Loading hand tracking model...");
  const [gestureInfo, setGestureInfo] = useState<GestureInfo>({ left: "", right: "" });
  const [cameraReady, setCameraReady] = useState(false);
  const [webglError, setWebglError] = useState(false);

  // Build / rebuild Three.js scene when mode or photos change
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let controller: ReturnType<typeof buildSphereScene> | null = null;
    try {
      controller =
        mode === "sphere" ? buildSphereScene(mount, photos) : buildTunnelScene(mount, photos);
    } catch {
      setWebglError(true);
      return;
    }
    sceneRef.current = controller;

    return () => {
      controller?.dispose();
      sceneRef.current = null;
    };
  }, [mode, photos]);

  // MediaPipe Hands setup (runs once)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Gesture state across frames
    const gs = {
      leftPinching: false,
      leftLastX: 0,
      leftLastY: 0,
      rightPinching: false,
      rightPinchLastY: 0,
      leftOpenness: 0,
      rightOpenness: 0,
    };

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
        [0, 1],[1, 2],[2, 3],[3, 4],[0, 5],[5, 6],[6, 7],[7, 8],
        [0, 9],[9, 10],[10, 11],[11, 12],[0, 13],[13, 14],[14, 15],[15, 16],
        [0, 17],[17, 18],[18, 19],[19, 20],[5, 9],[9, 13],[13, 17],
      ];
      for (const lms of results.multiHandLandmarks) {
        ctx.strokeStyle = "rgba(80,190,255,0.65)";
        ctx.lineWidth = 1.5;
        for (const [a, b] of conns) {
          ctx.beginPath();
          ctx.moveTo(lms[a].x * cvs.width, lms[a].y * cvs.height);
          ctx.lineTo(lms[b].x * cvs.width, lms[b].y * cvs.height);
          ctx.stroke();
        }
        for (let j = 0; j < lms.length; j++) {
          const lm = lms[j];
          ctx.fillStyle = j === 4 || j === 8 ? "rgba(255,255,80,0.95)" : "rgba(80,190,255,0.8)";
          ctx.beginPath();
          ctx.arc(lm.x * cvs.width, lm.y * cvs.height, j === 4 || j === 8 ? 4 : 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    hands.onResults((results: any) => {
      drawLandmarks(results);
      const sc = sceneRef.current;
      const handsArr = results.multiHandLandmarks;
      if (!sc || !handsArr || handsArr.length === 0) {
        // Reset all gesture state when no hands detected so we don't carry stale values
        gs.leftPinching = false;
        gs.rightPinching = false;
        gs.leftOpenness = 0;
        gs.rightOpenness = 0;
        sc?.setAutoSpeed(0);
        setGestureInfo({ left: "", right: "" });
        return;
      }

      // Track which hands appeared this frame so we can clear those that vanished
      let sawLeft = false;
      let sawRight = false;

      const leftInfo = { pinching: false, openness: 0, detected: false };
      const rightInfo = { pinching: false, openness: 0, detected: false };

      for (let i = 0; i < handsArr.length; i++) {
        const lm = handsArr[i];
        const isUserRight = lm[0].x < 0.5;
        const thumbTip = lm[4];
        const indexTip = lm[8];
        const isPinching = dist2D(thumbTip, indexTip) < 0.07;
        const openness = countExtendedFingers(lm) / 5;

        if (isUserRight) {
          sawRight = true;
          rightInfo.detected = true;
          rightInfo.pinching = isPinching;
          rightInfo.openness = openness;
          if (isPinching && !gs.rightPinching) gs.rightPinchLastY = indexTip.y;
          if (isPinching && gs.rightPinching) {
            const dy = indexTip.y - gs.rightPinchLastY;
            sc.applyZoom(dy * 12);
            gs.rightPinchLastY = indexTip.y;
          }
          gs.rightPinching = isPinching;
          gs.rightOpenness = openness;
        } else {
          sawLeft = true;
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
            sc.applyDrag(dx, dy);
            gs.leftLastX = indexTip.x;
            gs.leftLastY = indexTip.y;
          }
          gs.leftPinching = isPinching;
          gs.leftOpenness = openness;
        }
      }

      // Clear state for any hand that vanished this frame so it doesn't carry over
      if (!sawLeft) { gs.leftPinching = false; gs.leftOpenness = 0; }
      if (!sawRight) { gs.rightPinching = false; gs.rightOpenness = 0; }

      // Compute speed from currently-detected hands only (avoid stale values)
      const detectedNow = (sawLeft ? 1 : 0) + (sawRight ? 1 : 0);
      const sumOpen = (sawLeft ? gs.leftOpenness : 0) + (sawRight ? gs.rightOpenness : 0);
      const avg = detectedNow > 0 ? sumOpen / detectedNow : 0;
      sc.setAutoSpeed(avg * 0.012);

      setGestureInfo({
        left: leftInfo.detected
          ? leftInfo.pinching ? "Rotating / steering" : `${Math.round(leftInfo.openness * 100)}% open`
          : "",
        right: rightInfo.detected
          ? rightInfo.pinching ? "Zoom / speed" : `${Math.round(rightInfo.openness * 100)}% open`
          : "",
      });
    });

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
            try { await hands.send({ image: video }); } catch (_) {}
            processing = false;
          }
        };
        sendFrame();
      })
      .catch(() => setStatus("Camera unavailable — use mouse / touch"));

    // Mouse fallback applies to whichever scene is active
    let mouseDown = false;
    let prevMX = 0, prevMY = 0;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-ui]")) return;
      mouseDown = true;
      prevMX = e.clientX;
      prevMY = e.clientY;
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!mouseDown) return;
      const dx = (e.clientX - prevMX) / window.innerWidth;
      const dy = (e.clientY - prevMY) / window.innerHeight;
      sceneRef.current?.applyDrag(dx, dy);
      prevMX = e.clientX;
      prevMY = e.clientY;
    };
    const onMouseUp = () => { mouseDown = false; };
    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-ui]")) return;
      sceneRef.current?.applyZoom(e.deltaY * 0.01);
    };
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("wheel", onWheel);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("wheel", onWheel);
      if (video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      }
      try { hands.close(); } catch (_) {}
    };
  }, []);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      newUrls.push(URL.createObjectURL(files[i]));
    }
    if (newUrls.length) {
      uploadedUrlsRef.current.push(...newUrls);
      setPhotos((prev) => [...prev, ...newUrls]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleReset = () => {
    for (const url of uploadedUrlsRef.current) URL.revokeObjectURL(url);
    uploadedUrlsRef.current = [];
    setPhotos(DEFAULT_PHOTOS);
  };

  // Revoke any outstanding object URLs on unmount
  useEffect(() => {
    return () => {
      for (const url of uploadedUrlsRef.current) URL.revokeObjectURL(url);
      uploadedUrlsRef.current = [];
    };
  }, []);

  const photoCount = useMemo(() => photos.length, [photos]);

  if (webglError) {
    return (
      <div style={{
        width: "100vw", height: "100vh", background: "#030310",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: "'Inter', system-ui, sans-serif",
        color: "rgba(160,190,240,0.85)", textAlign: "center", padding: 32, gap: 16,
      }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🌐</div>
        <div style={{ fontSize: 22, fontWeight: 600, color: "rgba(180,215,255,0.95)" }}>
          WebGL not available in this preview
        </div>
        <div style={{ fontSize: 14, maxWidth: 440, lineHeight: 1.7, color: "rgba(140,165,210,0.75)" }}>
          This 3D experience requires WebGL, which isn't supported in the embedded preview.
          Open the app in a full browser tab.
        </div>
        <a href={window.location.href} target="_blank" rel="noreferrer" style={{
          marginTop: 12, padding: "10px 28px",
          background: "rgba(60,120,255,0.25)", border: "1px solid rgba(80,150,255,0.4)",
          borderRadius: 10, color: "rgba(140,200,255,0.9)", fontSize: 14, textDecoration: "none",
        }}>Open in new tab →</a>
      </div>
    );
  }

  return (
    <div style={{
      position: "relative", width: "100vw", height: "100vh",
      background: "#030310", overflow: "hidden",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />

      {/* Status pill */}
      <div data-ui style={{
        position: "absolute", top: 24, left: "50%", transform: "translateX(-50%)",
        color: "rgba(180,210,255,0.85)", fontSize: 12, letterSpacing: "0.12em",
        textTransform: "uppercase", background: "rgba(0,0,20,0.55)",
        padding: "6px 18px", borderRadius: 20,
        border: "1px solid rgba(80,140,255,0.25)", backdropFilter: "blur(8px)",
        whiteSpace: "nowrap",
      }}>
        {status} · {photoCount} photos
      </div>

      {/* Mode toggle */}
      <div data-ui style={{
        position: "absolute", top: 70, left: "50%", transform: "translateX(-50%)",
        display: "flex", gap: 4, background: "rgba(0,0,20,0.6)",
        padding: 4, borderRadius: 12, border: "1px solid rgba(60,100,200,0.25)",
        backdropFilter: "blur(8px)",
      }}>
        {(["sphere", "tunnel"] as ViewMode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)} style={{
            background: mode === m ? "rgba(80,150,255,0.35)" : "transparent",
            color: mode === m ? "rgba(220,235,255,0.95)" : "rgba(150,170,210,0.7)",
            border: "none", padding: "6px 18px", borderRadius: 9,
            fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase",
            cursor: "pointer", fontWeight: 500,
          }}>
            {m === "sphere" ? "Sphere" : "Tunnel"}
          </button>
        ))}
      </div>

      {/* Controls legend */}
      <div data-ui style={{
        position: "absolute", top: 24, left: 24,
        color: "rgba(160,190,230,0.75)", fontSize: 12, lineHeight: 2,
        background: "rgba(0,0,20,0.6)", padding: "14px 18px", borderRadius: 14,
        border: "1px solid rgba(60,100,200,0.2)", backdropFilter: "blur(8px)",
        maxWidth: 280,
      }}>
        <div style={{ fontWeight: 600, color: "rgba(100,180,255,0.95)", marginBottom: 6, fontSize: 13 }}>
          {mode === "sphere" ? "Sphere mode" : "Tunnel mode"}
        </div>
        {mode === "sphere" ? (
          <>
            <div>Right pinch + up/down → Zoom</div>
            <div>Left pinch + drag → Rotate sphere</div>
            <div>Open palm → spin faster · Fist → slower</div>
          </>
        ) : (
          <>
            <div>Open palm → fly faster · Fist → slow</div>
            <div>Left pinch + drag → Steer</div>
            <div>Right pinch + up/down → Base speed</div>
          </>
        )}
        <div style={{ marginTop: 8, color: "rgba(120,130,150,0.7)", fontSize: 11 }}>
          Or use mouse drag / scroll
        </div>
      </div>

      {/* Upload button */}
      <div data-ui style={{
        position: "absolute", bottom: 24, left: 24,
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        <button onClick={() => fileInputRef.current?.click()} style={{
          background: "rgba(60,120,255,0.25)",
          border: "1px solid rgba(80,150,255,0.4)",
          color: "rgba(200,225,255,0.95)",
          padding: "10px 20px", borderRadius: 10, fontSize: 13,
          cursor: "pointer", fontWeight: 500, letterSpacing: "0.04em",
          backdropFilter: "blur(8px)",
        }}>
          + Add your photos
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleUpload}
          style={{ display: "none" }}
        />
        {photos.length > DEFAULT_PHOTOS.length && (
          <button onClick={handleReset} style={{
            background: "rgba(255,80,100,0.15)",
            border: "1px solid rgba(255,100,120,0.3)",
            color: "rgba(255,180,190,0.85)",
            padding: "6px 14px", borderRadius: 8, fontSize: 11,
            cursor: "pointer", letterSpacing: "0.04em",
            backdropFilter: "blur(8px)",
          }}>
            Reset to defaults
          </button>
        )}
        {(gestureInfo.left || gestureInfo.right) && (
          <div style={{
            color: "rgba(100,210,255,0.85)", fontSize: 11, lineHeight: 1.7,
            background: "rgba(0,0,20,0.65)", padding: "8px 14px", borderRadius: 10,
            border: "1px solid rgba(60,150,255,0.2)", backdropFilter: "blur(8px)",
          }}>
            {gestureInfo.left && <div>L: {gestureInfo.left}</div>}
            {gestureInfo.right && <div>R: {gestureInfo.right}</div>}
          </div>
        )}
      </div>

      {/* Camera preview */}
      <div data-ui style={{
        position: "absolute", bottom: 24, right: 24,
        width: 220, height: 165, borderRadius: 14,
        overflow: "hidden", border: "1px solid rgba(80,150,255,0.3)",
        background: "#000", boxShadow: "0 0 24px rgba(60,100,255,0.15)",
      }}>
        {!cameraReady && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "rgba(120,140,180,0.7)", fontSize: 11, textAlign: "center", padding: 12,
          }}>
            Allow camera access to enable hand tracking
          </div>
        )}
        <video
          ref={videoRef}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", transform: "scaleX(-1)",
          }}
          muted playsInline
        />
        <canvas
          ref={overlayCanvasRef}
          width={640} height={480}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            transform: "scaleX(-1)",
          }}
        />
        <div style={{
          position: "absolute", bottom: 4, left: 0, right: 0,
          textAlign: "center", fontSize: 10,
          color: "rgba(100,160,255,0.6)", letterSpacing: "0.06em",
        }}>
          HAND TRACKING
        </div>
      </div>
    </div>
  );
}
