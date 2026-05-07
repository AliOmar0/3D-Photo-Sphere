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
}

export function useHandTracking({
  videoRef,
  onResults,
  maxNumHands = 2,
  modelComplexity = 1,
  enabled = true,
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

    const hands = new Hands({
      locateFile: (file: string) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`,
    });
    hands.setOptions({
      maxNumHands,
      modelComplexity,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5,
    });
    hands.onResults((r: HandsResult) => onResultsRef.current(r));

    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } })
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
  }, [videoRef, maxNumHands, modelComplexity, enabled]);

  return { status, cameraReady };
}

// Helpers shared across projects
export function dist2D(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function isPinching(lm: HandLandmark[], threshold = 0.07): boolean {
  return dist2D(lm[4], lm[8]) < threshold;
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
