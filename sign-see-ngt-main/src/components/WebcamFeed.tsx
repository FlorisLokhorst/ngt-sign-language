import { forwardRef } from 'react';

interface WebcamFeedProps {
  isConnected: boolean;
  prediction: string | null;
  confidence: number | null;
}

export const WebcamFeed = forwardRef<HTMLVideoElement, WebcamFeedProps>(
  ({ isConnected, prediction, confidence }, ref) => {
    return (
      <div className="relative inline-block rounded-lg overflow-hidden border-4 border-primary shadow-webcam">
        {/* Video element */}
        <video
          ref={ref}
          className="w-full max-w-[640px] h-auto bg-muted"
          autoPlay
          playsInline
          muted
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Prediction overlay - top left */}
        {prediction && prediction !== 'nothing' && (
          <div className="absolute top-4 left-4 bg-overlay/70 text-overlay-foreground px-4 py-2 rounded-lg backdrop-blur-sm animate-fade-in">
            <div className="text-4xl font-bold">{prediction.toUpperCase()}</div>
            {confidence !== null && (
              <div className="text-sm opacity-80">
                {(confidence * 100).toFixed(1)}% confidence
              </div>
            )}
          </div>
        )}

        {/* Connection status indicator - top right */}
        <div className="absolute top-4 right-4 flex items-center gap-2 bg-overlay/70 text-overlay-foreground px-3 py-1.5 rounded-full backdrop-blur-sm">
          <div
            className={`w-3 h-3 rounded-full ${
              isConnected ? 'bg-success animate-pulse-subtle' : 'bg-destructive'
            }`}
          />
          <span className="text-xs font-medium">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
    );
  }
);

WebcamFeed.displayName = 'WebcamFeed';
