import { useEffect, useCallback, useState, useRef } from 'react';
import { useWebcam } from '@/hooks/useWebcam';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Header } from './Header';
import { WebcamFeed } from './WebcamFeed';
import { DetectedWord } from './DetectedWord';
import { TopPredictions } from './TopPredictions';
import { AddLetterButton } from './AddLetterButton';
import { Instructions } from './Instructions';
import { ErrorAlert } from './ErrorAlert';
import { Button } from '@/components/ui/button';
import { Video, VideoOff } from 'lucide-react';

const WEBSOCKET_URL = 'ws://localhost:8000/ws/predict';
const FRAME_INTERVAL = 200; // 5 frames per second
const AUTO_ADD_CONFIDENCE_THRESHOLD = 0.7;

export function FingerspellingPractice() {
  const [word, setWord] = useState('');
  const [topPredictions, setTopPredictions] = useState<Array<{ letter: string; confidence: number }>>([]);
  const lastAddedRef = useRef<string>('');
  const addCooldownRef = useRef<boolean>(false);

  const { videoRef, canvasRef, isActive, error: webcamError, startWebcam, stopWebcam, captureFrame } = useWebcam();

  const handlePrediction = useCallback((result: { prediction: string; confidence: number; top_3: Array<{ letter: string; confidence: number }> }) => {
    setTopPredictions(result.top_3);

    // Auto-add logic with cooldown to prevent rapid additions
    if (
      result.confidence >= AUTO_ADD_CONFIDENCE_THRESHOLD &&
      result.prediction !== 'nothing' &&
      !addCooldownRef.current &&
      result.prediction !== lastAddedRef.current
    ) {
      if (result.prediction === 'space') {
        setWord(prev => prev + ' ');
        lastAddedRef.current = 'space';
      } else if (result.prediction === 'del') {
        setWord(prev => prev.slice(0, -1));
        lastAddedRef.current = 'del';
      } else {
        setWord(prev => prev + result.prediction.toUpperCase());
        lastAddedRef.current = result.prediction;
      }

      // Set cooldown to prevent rapid additions
      addCooldownRef.current = true;
      setTimeout(() => {
        addCooldownRef.current = false;
        lastAddedRef.current = '';
      }, 1000);
    }
  }, []);

  const { isConnected, error: wsError, sendFrame, connect, disconnect, lastPrediction } = useWebSocket({
    url: WEBSOCKET_URL,
    onPrediction: handlePrediction,
  });

  // Start webcam and connect to WebSocket on mount
  useEffect(() => {
    startWebcam();
    connect();
  }, [startWebcam, connect]);

  // Send frames at regular intervals
  useEffect(() => {
    if (!isActive || !isConnected) return;

    const intervalId = setInterval(() => {
      const frame = captureFrame();
      if (frame) {
        sendFrame(frame);
      }
    }, FRAME_INTERVAL);

    return () => clearInterval(intervalId);
  }, [isActive, isConnected, captureFrame, sendFrame]);

  const handleManualAdd = useCallback(() => {
    if (lastPrediction && lastPrediction.prediction !== 'nothing') {
      if (lastPrediction.prediction === 'space') {
        setWord(prev => prev + ' ');
      } else if (lastPrediction.prediction === 'del') {
        setWord(prev => prev.slice(0, -1));
      } else {
        setWord(prev => prev + lastPrediction.prediction.toUpperCase());
      }
    }
  }, [lastPrediction]);

  const handleClear = useCallback(() => {
    setWord('');
  }, []);

  const toggleWebcam = useCallback(() => {
    if (isActive) {
      stopWebcam();
      disconnect();
    } else {
      startWebcam();
      connect();
    }
  }, [isActive, startWebcam, stopWebcam, connect, disconnect]);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Error alerts */}
        <div className="max-w-3xl mx-auto space-y-4 mb-6">
          {webcamError && <ErrorAlert title="Camera Error" message={webcamError} />}
          {wsError && <ErrorAlert title="Connection Error" message={wsError} />}
        </div>

        {/* Main content */}
        <div className="flex flex-col items-center gap-6">
          {/* Webcam section */}
          <div className="flex flex-col items-center gap-4">
            <WebcamFeed
              ref={videoRef}
              isConnected={isConnected}
              prediction={lastPrediction?.prediction ?? null}
              confidence={lastPrediction?.confidence ?? null}
            />
            
            {/* Hidden canvas for frame capture */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Webcam toggle button */}
            <Button
              variant={isActive ? 'destructive' : 'default'}
              onClick={toggleWebcam}
              className="flex items-center gap-2"
            >
              {isActive ? (
                <>
                  <VideoOff className="w-4 h-4" />
                  Stop Camera
                </>
              ) : (
                <>
                  <Video className="w-4 h-4" />
                  Start Camera
                </>
              )}
            </Button>
          </div>

          {/* Controls section */}
          <div className="w-full max-w-3xl space-y-6">
            {/* Detected word */}
            <DetectedWord word={word} onClear={handleClear} />

            {/* Top predictions */}
            <TopPredictions predictions={topPredictions} />

            {/* Manual add button */}
            <AddLetterButton
              letter={lastPrediction?.prediction ?? null}
              onAdd={handleManualAdd}
              disabled={!isConnected || !lastPrediction}
            />

            {/* Instructions */}
            <Instructions />
          </div>
        </div>
      </main>
    </div>
  );
}
