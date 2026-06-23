import { forwardRef, useRef, useEffect, useState } from 'react';
import { Landmark, drawHandLandmarks } from '@/lib/handLandmarks';
import { cn } from '@/lib/utils';

interface WebcamPanelProps {
  isConnected: boolean;
  prediction: string | null;
  confidence: number | null;
  handDetected: boolean;
  landmarks: Landmark[] | null;
}

/**
 * Compute the offset and scale caused by object-contain so landmarks
 * align with the visible video inside the element.
 */
function getContainedRect(video: HTMLVideoElement) {
  const rect = video.getBoundingClientRect();
  const vw = video.videoWidth || rect.width;
  const vh = video.videoHeight || rect.height;

  const elementAspect = rect.width / rect.height;
  const videoAspect = vw / vh;

  let drawW: number, drawH: number, offsetX: number, offsetY: number;

  if (videoAspect > elementAspect) {
    // Video wider than element → letterbox top/bottom
    drawW = rect.width;
    drawH = rect.width / videoAspect;
    offsetX = 0;
    offsetY = (rect.height - drawH) / 2;
  } else {
    // Video taller than element → pillarbox left/right
    drawH = rect.height;
    drawW = rect.height * videoAspect;
    offsetX = (rect.width - drawW) / 2;
    offsetY = 0;
  }

  return { drawW, drawH, offsetX, offsetY, fullW: rect.width, fullH: rect.height };
}

export const WebcamPanel = forwardRef<HTMLVideoElement, WebcamPanelProps>(
  ({ isConnected, prediction, confidence, handDetected, landmarks }, ref) => {
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const landmarksRef = useRef<Landmark[] | null>(null);
    const handDetectedRef = useRef(false);
    const rafRef = useRef<number>(0);
    const [fps, setFps] = useState(0);
    const frameTimesRef = useRef<number[]>([]);

    // Keep refs in sync with latest props
    landmarksRef.current = landmarks;
    handDetectedRef.current = handDetected;

    // Measure actual FPS from landmark updates
    useEffect(() => {
      if (!landmarks) return;
      const now = performance.now();
      const times = frameTimesRef.current;
      times.push(now);
      // Keep only last second
      while (times.length > 0 && now - times[0] > 1000) {
        times.shift();
      }
      setFps(times.length);
    }, [landmarks]);

    // Render loop — draws landmarks at display refresh rate
    useEffect(() => {
      const canvas = overlayCanvasRef.current;
      const video = (ref as React.RefObject<HTMLVideoElement>)?.current;
      if (!canvas || !video) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      function draw() {
        const rect = video!.getBoundingClientRect();
        if (canvas!.width !== rect.width || canvas!.height !== rect.height) {
          canvas!.width = rect.width;
          canvas!.height = rect.height;
        }

        ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

        const lm = landmarksRef.current;
        if (handDetectedRef.current && lm && lm.length === 21) {
          const { drawW, drawH, offsetX, offsetY } = getContainedRect(video!);
          drawHandLandmarks(ctx!, lm, drawW, drawH, offsetX, offsetY);
        }

        rafRef.current = requestAnimationFrame(draw);
      }

      rafRef.current = requestAnimationFrame(draw);

      return () => {
        cancelAnimationFrame(rafRef.current);
      };
    }, [ref]);

    const showPrediction = prediction && prediction !== 'nothing';
    const confidencePercent = confidence ? Math.round(confidence * 100) : 0;

    return (
      <div className="relative rounded-xl overflow-hidden border-4 border-primary shadow-webcam bg-muted aspect-video">
        {/* Video element */}
        <video
          ref={ref}
          className="w-full h-full bg-muted object-contain"
          autoPlay
          playsInline
          muted
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Landmark overlay canvas */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Prediction overlay - top left */}
        {showPrediction && (
          <div className="absolute top-4 left-4 bg-overlay/80 text-overlay-foreground px-5 py-3 rounded-xl backdrop-blur-sm animate-fade-in">
            <div className="text-5xl font-bold tracking-tight">{prediction.toUpperCase()}</div>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex-1 h-2 bg-overlay-foreground/20 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all duration-300 rounded-full",
                    confidencePercent >= 70 ? "bg-success" : confidencePercent >= 50 ? "bg-warning" : "bg-destructive"
                  )}
                  style={{ width: `${confidencePercent}%` }}
                />
              </div>
              <span className="text-sm font-medium opacity-80 min-w-[3rem] text-right">
                {confidencePercent}%
              </span>
            </div>
          </div>
        )}

        {/* Hand detection indicator - bottom left */}
        <div className={cn(
          "absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm text-sm font-medium transition-colors",
          handDetected
            ? "bg-success/20 text-success"
            : "bg-overlay/60 text-overlay-foreground/70"
        )}>
          <div className={cn(
            "w-2.5 h-2.5 rounded-full",
            handDetected ? "bg-success animate-pulse-subtle" : "bg-muted-foreground"
          )} />
          {handDetected ? "Hand detected" : "No hand detected"}
        </div>

        {/* FPS counter - bottom right */}
        <div className="absolute bottom-4 right-4 px-2 py-1 bg-overlay/60 text-overlay-foreground/70 rounded text-xs font-mono backdrop-blur-sm">
          {fps} pred/s
        </div>

        {/* Connection status indicator - top right */}
        <div className={cn(
          "absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-sm",
          isConnected
            ? "bg-success/20 text-success"
            : "bg-destructive/20 text-destructive"
        )}>
          <div className={cn(
            "w-2.5 h-2.5 rounded-full",
            isConnected ? "bg-success animate-pulse-subtle" : "bg-destructive"
          )} />
          <span className="text-xs font-medium">
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>

        {/* No camera placeholder */}
        {!ref && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium">Starting camera...</p>
              <p className="text-sm">Please allow camera access</p>
            </div>
          </div>
        )}
      </div>
    );
  }
);

WebcamPanel.displayName = 'WebcamPanel';
