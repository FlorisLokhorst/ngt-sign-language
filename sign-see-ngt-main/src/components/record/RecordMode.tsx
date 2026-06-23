import { useState, useCallback, useEffect } from 'react';
import { Video, Check, AlertCircle, Camera, Sun, Hand, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { WebcamPanel } from '@/components/practice/WebcamPanel';
import { useWebcam } from '@/hooks/useWebcam';
import { NGT_ALPHABET, recordSample, getRecordingStats, RecordingStats } from '@/lib/api';
import { PredictionResult } from '@/types';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface RecordModeProps {
  isConnected: boolean;
  lastPrediction: PredictionResult | null;
  sendFrame: (base64Image: string) => void;
  connect: () => void;
  disconnect: () => void;
  onStatsUpdate?: (total: number) => void;
}

export function RecordMode({
  isConnected,
  lastPrediction,
  sendFrame,
  connect,
  disconnect,
  onStatsUpdate,
}: RecordModeProps) {
  const [selectedLetter, setSelectedLetter] = useState<string>('A');
  const [isRecording, setIsRecording] = useState(false);
  const [stats, setStats] = useState<RecordingStats | null>(null);
  const [recentRecordings, setRecentRecordings] = useState<Array<{
    letter: string;
    confidence: number;
    timestamp: string;
  }>>([]);

  const { videoRef, canvasRef, isActive, startWebcam, stopWebcam, captureFrame } = useWebcam();

  // Fetch initial stats
  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const data = await getRecordingStats();
      setStats(data);
      onStatsUpdate?.(data.total_samples);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  // Start webcam on mount
  useEffect(() => {
    startWebcam();
    connect();
  }, [startWebcam, connect]);

  // Send frames
  useEffect(() => {
    if (!isActive || !isConnected) return;

    const intervalId = setInterval(() => {
      const frame = captureFrame();
      if (frame) sendFrame(frame);
    }, 200);

    return () => clearInterval(intervalId);
  }, [isActive, isConnected, captureFrame, sendFrame]);

  // Get confidence color
  const getConfidenceColor = (confidence: number | null) => {
    if (!confidence) return 'border-muted';
    if (confidence >= 0.85) return 'border-success';
    if (confidence >= 0.7) return 'border-warning';
    return 'border-destructive';
  };

  // Handle recording
  const handleRecord = async () => {
    if (!lastPrediction || !lastPrediction.hand_detected) {
      toast({
        title: "Cannot record",
        description: "Please show your hand to the camera first",
        variant: "destructive",
      });
      return;
    }

    if (lastPrediction.confidence < 0.5) {
      toast({
        title: "Low confidence",
        description: "Please try to form the sign more clearly",
        variant: "destructive",
      });
      return;
    }

    setIsRecording(true);

    try {
      const frame = captureFrame();
      if (!frame) throw new Error('Failed to capture frame');

      await recordSample(
        frame,
        selectedLetter,
        lastPrediction.confidence,
        lastPrediction.landmarks ?? null
      );

      // Update recent recordings
      setRecentRecordings(prev => [
        {
          letter: selectedLetter,
          confidence: lastPrediction.confidence,
          timestamp: new Date().toISOString(),
        },
        ...prev.slice(0, 4),
      ]);

      // Refresh stats
      await fetchStats();

      toast({
        title: "Sample recorded!",
        description: `Added sample for letter "${selectedLetter}"`,
      });
    } catch (error) {
      toast({
        title: "Recording failed",
        description: "Could not save the sample. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRecording(false);
    }
  };

  const currentConfidence = lastPrediction?.confidence ?? 0;
  const confidencePercent = Math.round(currentConfidence * 100);
  const canRecord = lastPrediction?.hand_detected && currentConfidence >= 0.5;

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Purpose message */}
      <div className="max-w-4xl mx-auto mb-6">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Video className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Help improve the model!</h2>
              <p className="text-sm text-muted-foreground">
                Record your sign language samples to contribute to the training dataset.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Webcam */}
        <div className="space-y-4">
          <div className={cn(
            "rounded-xl transition-all",
            getConfidenceColor(lastPrediction?.confidence ?? null),
            "border-4"
          )}>
            <WebcamPanel
              ref={videoRef}
              isConnected={isConnected}
              prediction={lastPrediction?.prediction ?? null}
              confidence={lastPrediction?.confidence ?? null}
              handDetected={lastPrediction?.hand_detected ?? false}
              landmarks={lastPrediction?.landmarks ?? null}
            />
          </div>
          <canvas ref={canvasRef} className="hidden" />

          {/* Tips */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recording Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4 text-warning" />
                  <span>Good lighting</span>
                </div>
                <div className="flex items-center gap-2">
                  <Hand className="w-4 h-4 text-primary" />
                  <span>Hand in frame</span>
                </div>
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-muted-foreground" />
                  <span>Try different angles</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>Wait for high confidence</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Recording controls */}
        <div className="space-y-4">
          {/* Letter selector */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Select Letter to Record</CardTitle>
              <CardDescription>
                Choose which letter you're signing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {NGT_ALPHABET.map(letter => (
                  <button
                    key={letter}
                    onClick={() => setSelectedLetter(letter)}
                    className={cn(
                      "w-10 h-10 rounded-lg font-bold text-lg transition-all",
                      selectedLetter === letter
                        ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                        : "bg-muted hover:bg-muted/80"
                    )}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Current confidence */}
          <Card>
            <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Current Confidence</span>
                <span className={cn(
                  "text-lg font-bold",
                  confidencePercent >= 85 ? "text-success" :
                  confidencePercent >= 70 ? "text-warning" : "text-destructive"
                )}>
                  {confidencePercent}%
                </span>
              </div>
              <Progress 
                value={confidencePercent} 
                className={cn(
                  "h-3",
                  confidencePercent >= 85 ? "[&>div]:bg-success" :
                  confidencePercent >= 70 ? "[&>div]:bg-warning" : "[&>div]:bg-destructive"
                )}
              />
              <p className="text-xs text-muted-foreground mt-2">
                {confidencePercent >= 85 ? "Great! Ready to record" :
                 confidencePercent >= 70 ? "Good, but could be better" :
                 "Try to form the sign more clearly"}
              </p>
            </CardContent>
          </Card>

          {/* Record button */}
          <Button
            size="lg"
            className="w-full h-16 text-xl"
            onClick={handleRecord}
            disabled={!canRecord || isRecording}
          >
            {isRecording ? (
              <>Recording...</>
            ) : (
              <>
                <Video className="w-6 h-6 mr-3" />
                Record Sample for "{selectedLetter}"
              </>
            )}
          </Button>

          {/* Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Recording Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-primary">
                    {stats?.samples_per_letter?.[selectedLetter] ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">For "{selectedLetter}"</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">
                    {stats?.total_samples ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Total samples</p>
                </div>
              </div>

              {/* Recent recordings */}
              {recentRecordings.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Recent</p>
                  <div className="flex gap-2">
                    {recentRecordings.map((rec, idx) => (
                      <div
                        key={idx}
                        className="w-12 h-12 rounded-lg bg-success/10 flex flex-col items-center justify-center"
                      >
                        <span className="font-bold text-success">{rec.letter}</span>
                        <span className="text-xs text-muted-foreground">
                          {Math.round(rec.confidence * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
