import { useState, useCallback, useEffect, useRef } from 'react';
import { Play, Trophy, Clock, Check, X, SkipForward, XCircle, Share2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { WebcamPanel } from '@/components/practice/WebcamPanel';
import { useWebcam } from '@/hooks/useWebcam';
import { NGT_ALPHABET, NGT_VOWELS, startSpeedrun, completeLetter } from '@/lib/api';
import { PredictionResult, SpeedrunState } from '@/types';
import { cn } from '@/lib/utils';

const CONFIDENCE_THRESHOLD = 0.7;

type SpeedrunMode = 'alphabet' | 'vowels' | 'custom';

interface SpeedrunModeProps {
  isConnected: boolean;
  lastPrediction: PredictionResult | null;
  sendFrame: (base64Image: string) => void;
  connect: () => void;
  disconnect: () => void;
}

export function SpeedrunMode({
  isConnected,
  lastPrediction,
  sendFrame,
  connect,
  disconnect,
}: SpeedrunModeProps) {
  const [state, setState] = useState<SpeedrunState>({
    status: 'idle',
    sessionId: null,
    targetLetters: NGT_ALPHABET,
    completedLetters: [],
    currentLetterIndex: 0,
    startTime: null,
    endTime: null,
    skippedLetters: [],
  });

  const [mode, setMode] = useState<SpeedrunMode>('alphabet');
  const [customLetters, setCustomLetters] = useState<string[]>([...NGT_ALPHABET]);
  const [countdown, setCountdown] = useState(3);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const { videoRef, canvasRef, isActive, startWebcam, stopWebcam, captureFrame } = useWebcam();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Get target letters based on mode
  const getTargetLetters = useCallback(() => {
    switch (mode) {
      case 'alphabet':
        return [...NGT_ALPHABET];
      case 'vowels':
        return [...NGT_VOWELS];
      case 'custom':
        return customLetters.filter(l => l);
      default:
        return [...NGT_ALPHABET];
    }
  }, [mode, customLetters]);

  // Start countdown
  const handleStart = useCallback(async () => {
    const letters = getTargetLetters();
    if (letters.length === 0) return;

    setState(prev => ({ ...prev, status: 'countdown', targetLetters: letters }));
    setCountdown(3);

    // Start webcam and connect - AWAIT the webcam to ensure it starts
    await startWebcam();
    connect();

    // Countdown timer
    let count = 3;
    const countdownInterval = setInterval(() => {
      count--;
      setCountdown(count);
      if (count <= 0) {
        clearInterval(countdownInterval);
        startChallenge(letters);
      }
    }, 1000);
  }, [getTargetLetters, startWebcam, connect]);

  // Actually start the challenge
  const startChallenge = async (letters: string[]) => {
    try {
      const session = await startSpeedrun(letters, mode);
      setState(prev => ({
        ...prev,
        status: 'running',
        sessionId: session.session_id,
        targetLetters: letters,
        completedLetters: [],
        currentLetterIndex: 0,
        startTime: Date.now(),
        endTime: null,
        skippedLetters: [],
      }));
      setElapsedTime(0);

      // Re-attach webcam stream after video element remounts
      setTimeout(() => {
        startWebcam();
      }, 100);

      // Start elapsed time timer
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 10);
      }, 10);
    } catch (error) {
      console.error('Failed to start speedrun:', error);
      setState(prev => ({ ...prev, status: 'idle' }));
    }
  };

  // Check for letter completion
  useEffect(() => {
    if (state.status !== 'running' || !lastPrediction) return;

    const currentTarget = state.targetLetters[state.currentLetterIndex];
    const prediction = lastPrediction.prediction.toUpperCase();

    if (
      prediction === currentTarget &&
      lastPrediction.confidence >= CONFIDENCE_THRESHOLD
    ) {
      handleLetterComplete(currentTarget);
    }
  }, [lastPrediction, state.status, state.currentLetterIndex, state.targetLetters]);

  // Handle letter completion
  const handleLetterComplete = async (letter: string) => {
    if (state.sessionId) {
      try {
        await completeLetter(state.sessionId, letter);
      } catch (error) {
        console.error('Failed to record completion:', error);
      }
    }

    const newCompleted = [...state.completedLetters, letter];
    const newIndex = state.currentLetterIndex + 1;

    if (newIndex >= state.targetLetters.length) {
      // Challenge complete!
      if (timerRef.current) clearInterval(timerRef.current);
      setState(prev => ({
        ...prev,
        completedLetters: newCompleted,
        currentLetterIndex: newIndex,
        status: 'finished',
        endTime: Date.now(),
      }));
    } else {
      setState(prev => ({
        ...prev,
        completedLetters: newCompleted,
        currentLetterIndex: newIndex,
      }));
    }
  };

  // Skip current letter
  const handleSkip = () => {
    const currentLetter = state.targetLetters[state.currentLetterIndex];
    const newSkipped = [...state.skippedLetters, currentLetter];
    const newIndex = state.currentLetterIndex + 1;

    if (newIndex >= state.targetLetters.length) {
      if (timerRef.current) clearInterval(timerRef.current);
      setState(prev => ({
        ...prev,
        skippedLetters: newSkipped,
        currentLetterIndex: newIndex,
        status: 'finished',
        endTime: Date.now(),
      }));
    } else {
      setState(prev => ({
        ...prev,
        skippedLetters: newSkipped,
        currentLetterIndex: newIndex,
      }));
    }
  };

  // End challenge early
  const handleEnd = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    stopWebcam();
    disconnect();
    setState(prev => ({
      ...prev,
      status: 'finished',
      endTime: Date.now(),
    }));
  };

  // Reset to start screen
  const handleReset = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    stopWebcam();
    disconnect();
    setState({
      status: 'idle',
      sessionId: null,
      targetLetters: NGT_ALPHABET,
      completedLetters: [],
      currentLetterIndex: 0,
      startTime: null,
      endTime: null,
      skippedLetters: [],
    });
    setElapsedTime(0);
  };

  // Send frames
  useEffect(() => {
    if (state.status !== 'running' || !isActive || !isConnected) return;

    const intervalId = setInterval(() => {
      const frame = captureFrame();
      if (frame) sendFrame(frame);
    }, 200);

    return () => clearInterval(intervalId);
  }, [state.status, isActive, isConnected, captureFrame, sendFrame]);

  // Format time
  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const hundredths = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
  };

  // Toggle custom letter
  const toggleCustomLetter = (letter: string) => {
    setCustomLetters(prev => 
      prev.includes(letter) 
        ? prev.filter(l => l !== letter)
        : [...prev, letter]
    );
  };

  // Render based on status
  if (state.status === 'idle') {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Card className="text-center">
          <CardHeader className="pb-2">
            <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Trophy className="w-10 h-10 text-primary" />
            </div>
            <CardTitle className="text-3xl">Alphabet Challenge</CardTitle>
            <CardDescription className="text-lg">
              Sign all letters as fast as possible!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Mode selection */}
            <div className="flex flex-wrap justify-center gap-2">
              {[
                { id: 'alphabet' as SpeedrunMode, label: 'Full Alphabet', count: NGT_ALPHABET.length },
                { id: 'vowels' as SpeedrunMode, label: 'Vowels Only', count: NGT_VOWELS.length },
                { id: 'custom' as SpeedrunMode, label: 'Custom', count: customLetters.length },
              ].map(opt => (
                <Button
                  key={opt.id}
                  variant={mode === opt.id ? 'default' : 'outline'}
                  onClick={() => setMode(opt.id)}
                  className="min-w-[140px]"
                >
                  {opt.label} ({opt.count})
                </Button>
              ))}
            </div>

            {/* Custom letter selector */}
            {mode === 'custom' && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-3">Select letters to practice:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {NGT_ALPHABET.map(letter => (
                    <button
                      key={letter}
                      onClick={() => toggleCustomLetter(letter)}
                      className={cn(
                        "w-10 h-10 rounded-lg font-bold text-lg transition-all",
                        customLetters.includes(letter)
                          ? "bg-primary text-primary-foreground"
                          : "bg-background border border-border hover:border-primary"
                      )}
                    >
                      {letter}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Start button */}
            <Button
              size="lg"
              className="h-16 px-12 text-xl"
              onClick={handleStart}
              disabled={mode === 'custom' && customLetters.length === 0}
            >
              <Play className="w-6 h-6 mr-3" />
              Start Challenge
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.status === 'countdown') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="relative">
          {/* Webcam (hidden behind countdown overlay) */}
          <div className="max-w-4xl mx-auto">
            <WebcamPanel
              ref={videoRef}
              isConnected={isConnected}
              prediction={null}
              confidence={null}
              handDetected={false}
              landmarks={null}
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Countdown overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="text-center">
              <div className="text-9xl font-bold text-primary animate-pulse">{countdown}</div>
              <p className="text-2xl text-muted-foreground mt-4">Get ready!</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.status === 'finished') {
    const totalLetters = state.targetLetters.length;
    const completed = state.completedLetters.length;
    const skipped = state.skippedLetters.length;
    const accuracy = Math.round((completed / totalLetters) * 100);

    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="text-center overflow-hidden">
          <div className="bg-gradient-primary text-primary-foreground py-8">
            <Trophy className="w-16 h-16 mx-auto mb-4" />
            <h2 className="text-3xl font-bold">Challenge Complete!</h2>
          </div>
          <CardContent className="py-8 space-y-6">
            {/* Time */}
            <div>
              <div className="text-5xl font-mono font-bold text-primary">
                {formatTime(elapsedTime)}
              </div>
              <p className="text-muted-foreground">Total Time</p>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-success/10 rounded-lg">
                <div className="text-3xl font-bold text-success">{completed}</div>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-3xl font-bold">{skipped}</div>
                <p className="text-sm text-muted-foreground">Skipped</p>
              </div>
              <div className="p-4 bg-primary/10 rounded-lg">
                <div className="text-3xl font-bold text-primary">{accuracy}%</div>
                <p className="text-sm text-muted-foreground">Accuracy</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={handleReset} size="lg">
                <RotateCcw className="w-5 h-5 mr-2" />
                Try Again
              </Button>
              <Button variant="outline" size="lg">
                <Share2 className="w-5 h-5 mr-2" />
                Share Result
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Running state
  const currentLetter = state.targetLetters[state.currentLetterIndex];
  const progress = (state.currentLetterIndex / state.targetLetters.length) * 100;

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="max-w-5xl mx-auto">
        {/* Timer and progress */}
        <div className="text-center mb-6">
          <div className="text-5xl font-mono font-bold text-primary mb-2">
            {formatTime(elapsedTime)}
          </div>
          <div className="flex items-center gap-4 max-w-md mx-auto">
            <Progress value={progress} className="flex-1 h-3" />
            <span className="text-sm font-medium text-muted-foreground">
              {state.currentLetterIndex}/{state.targetLetters.length}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Webcam */}
          <div className="lg:col-span-2">
            <WebcamPanel
              ref={videoRef}
              isConnected={isConnected}
              prediction={lastPrediction?.prediction ?? null}
              confidence={lastPrediction?.confidence ?? null}
              handDetected={lastPrediction?.hand_detected ?? false}
              landmarks={lastPrediction?.landmarks ?? null}
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Controls */}
            <div className="flex justify-center gap-3 mt-4">
              <Button variant="outline" onClick={handleSkip}>
                <SkipForward className="w-4 h-4 mr-2" />
                Skip Letter
              </Button>
              <Button variant="destructive" onClick={handleEnd}>
                <XCircle className="w-4 h-4 mr-2" />
                End Challenge
              </Button>
            </div>
          </div>

          {/* Right: Target and checklist */}
          <div className="space-y-4">
            {/* Current target */}
            <Card className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-2">Sign this letter:</p>
              <div className="text-8xl font-bold text-primary animate-pulse">
                {currentLetter}
              </div>
            </Card>

            {/* Letter checklist */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {state.targetLetters.map((letter, idx) => {
                    const isCompleted = state.completedLetters.includes(letter);
                    const isSkipped = state.skippedLetters.includes(letter);
                    const isCurrent = idx === state.currentLetterIndex;

                    return (
                      <div
                        key={letter}
                        className={cn(
                          "w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm transition-all",
                          isCompleted && "bg-success text-success-foreground",
                          isSkipped && "bg-muted text-muted-foreground line-through",
                          isCurrent && "bg-primary text-primary-foreground animate-pulse ring-2 ring-primary ring-offset-2",
                          !isCompleted && !isSkipped && !isCurrent && "bg-muted/50 text-muted-foreground"
                        )}
                      >
                        {isCompleted ? <Check className="w-4 h-4" /> : letter}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
