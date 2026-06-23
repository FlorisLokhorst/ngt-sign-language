import { useCallback, useRef, useEffect, useState } from 'react';
import { WebcamPanel } from './WebcamPanel';
import { DetectedWordPanel } from './DetectedWordPanel';
import { TopPredictionsPanel } from './TopPredictionsPanel';
import { QuickActionsPanel } from './QuickActionsPanel';
import { StatsPanel } from './StatsPanel';
import { InstructionsAccordion } from './InstructionsAccordion';
import { ErrorAlert } from '@/components/ErrorAlert';
import { useWebcam } from '@/hooks/useWebcam';
import { PredictionResult, PracticeStats } from '@/types';
import { clearSequence, acceptSuggestion } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const FRAME_INTERVAL = 100;

interface PracticeModeProps {
  isConnected: boolean;
  wsError: string | null;
  lastPrediction: PredictionResult | null;
  sendFrame: (base64Image: string) => void;
  connect: () => void;
  disconnect: () => void;
}

export function PracticeMode({
  isConnected,
  wsError,
  lastPrediction,
  sendFrame,
  connect,
  disconnect,
}: PracticeModeProps) {
  const [stats, setStats] = useState<PracticeStats>({
    lettersToday: 0,
    accuracyPercent: 0,
    timeSpentMinutes: 0,
  });
  const [abbreviationFlash, setAbbreviationFlash] = useState<string | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const prevCommittedRef = useRef<string | null>(null);

  const { videoRef, canvasRef, isActive, error: webcamError, startWebcam, stopWebcam, captureFrame } = useWebcam();

  // Update time spent every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const minutesElapsed = Math.floor((Date.now() - startTimeRef.current) / 60000);
      setStats(prev => ({ ...prev, timeSpentMinutes: minutesElapsed }));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Track committed letters for stats + abbreviation flash
  useEffect(() => {
    if (!lastPrediction) return;
    const committed = lastPrediction.committed_letter;
    if (committed && committed !== prevCommittedRef.current) {
      prevCommittedRef.current = committed;
      setStats(prev => ({ ...prev, lettersToday: prev.lettersToday + 1 }));
    } else if (!committed) {
      prevCommittedRef.current = null;
    }
    if (lastPrediction.abbreviation) {
      setAbbreviationFlash(lastPrediction.abbreviation);
      setTimeout(() => setAbbreviationFlash(null), 3000);
    }
  }, [lastPrediction]);

  // Start webcam and connect on mount
  useEffect(() => {
    startWebcam();
    connect();
  }, [startWebcam, connect]);

  // Send frames at regular intervals
  useEffect(() => {
    if (!isActive || !isConnected) return;
    const intervalId = setInterval(() => {
      const frame = captureFrame();
      if (frame) sendFrame(frame);
    }, FRAME_INTERVAL);
    return () => clearInterval(intervalId);
  }, [isActive, isConnected, captureFrame, sendFrame]);

  const handleClear = useCallback(async () => {
    try {
      await clearSequence();
    } catch (e) {
      console.error('Failed to clear sequence', e);
    }
  }, []);

  const handleAcceptSuggestion = useCallback(async (word: string) => {
    try {
      await acceptSuggestion(word);
    } catch (e) {
      console.error('Failed to accept suggestion', e);
    }
  }, []);

  const toggleWebcam = useCallback(() => {
    if (isActive) { stopWebcam(); disconnect(); }
    else { startWebcam(); connect(); }
  }, [isActive, startWebcam, stopWebcam, connect, disconnect]);

  // Extract sentence building data from prediction
  const sentence = lastPrediction?.sentence ?? '';
  const currentWord = lastPrediction?.current_word ?? '';
  const suggestions = lastPrediction?.suggestions ?? [];
  const displayText = sentence ? `${sentence} ${currentWord}` : currentWord;

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Error alerts */}
      <div className="max-w-5xl mx-auto space-y-3 mb-6">
        {webcamError && <ErrorAlert title="Camera Error" message={webcamError} />}
        {wsError && <ErrorAlert title="Connection Error" message={wsError} />}
      </div>

      {/* Abbreviation flash banner */}
      {abbreviationFlash && (
        <div className="max-w-6xl mx-auto mb-4">
          <div className="bg-primary text-primary-foreground rounded-xl px-6 py-3 text-center text-lg font-semibold animate-pulse">
            {abbreviationFlash}
          </div>
        </div>
      )}

      {/* Main two-column layout */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column - Webcam (60%) */}
        <div className="lg:col-span-3 space-y-4">
          <WebcamPanel
            ref={videoRef}
            isConnected={isConnected}
            prediction={lastPrediction?.stable_prediction || lastPrediction?.prediction || null}
            confidence={lastPrediction?.stable_confidence || lastPrediction?.confidence || null}
            handDetected={lastPrediction?.hand_detected ?? false}
            landmarks={lastPrediction?.landmarks ?? null}
          />

          {/* Hidden canvas for frame capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Instructions accordion */}
          <InstructionsAccordion />
        </div>

        {/* Right Column - Controls (40%) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Sentence building panel */}
          <Card className="transition-shadow hover:shadow-card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Sentence Builder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Current word being typed */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Current word</span>
                <span className="text-2xl font-bold tracking-widest text-primary">
                  {currentWord || <span className="text-muted-foreground text-base">signing...</span>}
                </span>
              </div>

              {/* Completed sentence */}
              {sentence && (
                <div className="border-t pt-3">
                  <span className="text-xs text-muted-foreground">Sentence</span>
                  <p className="text-lg font-medium mt-1">{sentence}</p>
                </div>
              )}

              {/* Dictionary suggestions */}
              {suggestions.length > 0 && (
                <div className="border-t pt-3">
                  <span className="text-xs text-muted-foreground mb-2 block">Suggestions</span>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((word) => (
                      <Button
                        key={word}
                        variant="outline"
                        size="sm"
                        className="text-sm font-medium"
                        onClick={() => handleAcceptSuggestion(word)}
                      >
                        {word.toLowerCase()}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <DetectedWordPanel word={displayText} onClear={handleClear} />

          <TopPredictionsPanel predictions={lastPrediction?.top_3 ?? []} />

          <QuickActionsPanel
            currentLetter={lastPrediction?.stable_prediction || lastPrediction?.prediction || null}
            onAddLetter={() => {}}
            onClearAll={handleClear}
            isWebcamActive={isActive}
            onToggleWebcam={toggleWebcam}
            disabled={!isConnected || !lastPrediction}
          />

          <StatsPanel stats={stats} />
        </div>
      </div>
    </div>
  );
}
