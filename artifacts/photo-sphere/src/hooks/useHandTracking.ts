import { useEffect, useRef, useState } from "react";
import { Hands } from "@mediapipe/hands";

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface HandsResult {
  multiHandLandmarks?: HandLandmark[][];
  multiHandedness?: Array<{ label: "Left" | "Right"; score: number }>;
}

interface UseHandTrackingOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onResults: (results: HandsResult) => void;
  maxNumHands?: number;
  modelComplexity?: 0 | 1;
  enabled?: boolean;
  /** Smooth landmarks with a One Euro filter. Default true. */
  smooth?: boolean;
}

/**
 * One Euro Filter — Casiez et al. 2012.
 * A simple low-lag low-jitter filter for noisy real-time signals.
 * Tuned defaults are good for hand-landmark coordinates in [0..1].
 */
class OneEuroFilter {
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev: number | null = null;

  constructor(
    private minCutoff: number,
    private beta: number,
    private dCutoff: number,
  ) {}

  private alpha(cutoff: number, dt: number) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  filter(x: number, t: number): number {
    if (this.tPrev === null || this.xPrev === null) {
      this.tPrev = t;
      this.xPrev = x;
      return x;
    }
    const dt = Math.max(t - this.tPrev, 1e-3);
    const dx = (x - this.xPrev) / dt;
    const aD = this.alpha(this.dCutoff, dt);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = this.alpha(cutoff, dt);
    const xHat = a * x + (1 - a) * this.xPrev;
    this.xPrev = xHat;
    this.dxPrev = dxHat;
    this.tPrev = t;
    return xHat;
  }

  reset() {
    this.xPrev = null;
    this.tPrev = null;
    this.dxPrev = 0;
  }
}

class HandSmoother {
  private filters: OneEuroFilter[][] = [];
  constructor(numLandmarks = 21, minCutoff = 1.0, beta = 0.025) {
    for (let i = 0; i < numLandmarks; i++) {
      this.filters.push([
        new OneEuroFilter(minCutoff, beta, 1.0),
        new OneEuroFilter(minCutoff, beta, 1.0),
        new OneEuroFilter(minCutoff, beta, 1.0),
      ]);
    }
  }
  apply(lms: HandLandmark[], t: number): HandLandmark[] {
    return lms.map((p, i) => ({
      x: this.filters[i][0].filter(p.x, t),
      y: this.filters[i][1].filter(p.y, t),
      z: this.filters[i][2].filter(p.z, t),
    }));
  }
  reset() {
    for (const row of this.filters) for (const f of row) f.reset();
  }
}

export function useHandTracking({
  videoRef,
  onResults,
  maxNumHands = 2,
  modelComplexity = 1,
  enabled = true,
  smooth = true,
}: UseHandTrackingOptions) {
  const [status, setStatus] = useState("Loading hand tracking…");
  const [cameraReady, setCameraReady] = useState(false);
  const onResultsRef = useRef(onResults);
  onResultsRef.current = onResults;

  useEffect(() => {
    if (!enabled) return;
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let rafId = 0;
    let processing = false;
    let stream: MediaStream | null = null;
    const smoothers: HandSmoother[] = smooth
      ? Array.from({ length: maxNumHands }, () => new HandSmoother())
      : [];

    const hands = new Hands({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`,
    });
    hands.setOptions({
      maxNumHands,
      modelComplexity,
      // Higher confidence to reduce phantom hands; lower tracking confidence
      // so we keep tracking through brief occlusions.
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.4,
    });
    hands.onResults((r: HandsResult) => {
      if (smooth && r.multiHandLandmarks && r.multiHandLandmarks.length > 0) {
        const t = performance.now() / 1000;
        const smoothed = r.multiHandLandmarks.map((lms, i) => {
          const sm = smoothers[i] ?? new HandSmoother();
          return sm.apply(lms, t);
        });
        onResultsRef.current({ ...r, multiHandLandmarks: smoothed });
      } else {
        if (smooth) for (const s of smoothers) s.reset();
        onResultsRef.current(r);
      }
    });

    navigator.mediaDevices
      .getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
          frameRate: { ideal: 30 },
        },
      })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        video.srcObject = s;
        video.play().catch(() => {});
        setCameraReady(true);
        setStatus("Hand tracking active");
        const sendFrame = async () => {
          rafId = requestAnimationFrame(sendFrame);
          if (!processing && video.readyState === 4) {
            processing = true;
            try {
              await hands.send({ image: video });
            } catch {
              // swallow
            }
            processing = false;
          }
        };
        sendFrame();
      })
      .catch(() => setStatus("Camera unavailable"));

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      try {
        hands.close();
      } catch {
        /* ignore */
      }
    };
  }, [videoRef, maxNumHands, modelComplexity, enabled, smooth]);

  return { status, cameraReady };
}

// Helpers shared across projects
export function dist2D(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Pinch detection with hysteresis — once pinched, requires the fingers to
 * move further apart to release. Avoids flicker at the threshold.
 *
 * Pass `prev` (the previous frame's pinch state) to get hysteresis;
 * or omit it for a stateless single-threshold check.
 */
export function isPinching(
  lm: HandLandmark[],
  threshold = 0.07,
  prev: boolean = false,
): boolean {
  // hand-size-normalised distance: tip-of-index ↔ tip-of-thumb,
  // divided by the length of the index finger so it's roughly scale invariant.
  const indexLen = dist2D(lm[5], lm[8]) || 0.1;
  const d = dist2D(lm[4], lm[8]) / indexLen;
  // hysteresis: lower threshold to grab, higher to release
  if (prev) return d < threshold * 1.5;
  return d < threshold;
}

/**
 * Returns the pinch-distance ratio (small = fingers closed, large = open).
 * Useful for visual feedback / non-binary controls.
 */
export function pinchAmount(lm: HandLandmark[]): number {
  const indexLen = dist2D(lm[5], lm[8]) || 0.1;
  return dist2D(lm[4], lm[8]) / indexLen;
}

export function countExtendedFingers(lm: HandLandmark[]): number {
  let count = 0;
  const pairs: [number, number][] = [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ];
  for (const [tip, pip] of pairs) {
    if (lm[tip].y < lm[pip].y) count++;
  }
  if (dist2D(lm[4], lm[0]) > dist2D(lm[3], lm[0]) * 1.2) count++;
  return count;
}

// MediaPipe gives mirrored x (front-camera mirror). Use this when the canvas
// also flips horizontally so coordinates feel natural.
export function mirrorX(x: number): number {
  return 1 - x;
}

export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];
