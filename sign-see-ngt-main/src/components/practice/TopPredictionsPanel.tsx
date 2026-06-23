import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface TopPredictionsPanelProps {
  predictions: Array<{ letter: string; confidence: number }>;
}

export function TopPredictionsPanel({ predictions }: TopPredictionsPanelProps) {
  const getRankStyle = (index: number) => {
    switch (index) {
      case 0:
        return { 
          bg: 'bg-success/10', 
          border: 'border-success/30',
          text: 'text-success',
          progress: 'bg-success'
        };
      case 1:
        return { 
          bg: 'bg-warning/10', 
          border: 'border-warning/30',
          text: 'text-warning',
          progress: 'bg-warning'
        };
      default:
        return { 
          bg: 'bg-muted', 
          border: 'border-border',
          text: 'text-muted-foreground',
          progress: 'bg-muted-foreground'
        };
    }
  };

  // Fill with empty slots if less than 3 predictions
  const displayPredictions = [...predictions];
  while (displayPredictions.length < 3) {
    displayPredictions.push({ letter: '-', confidence: 0 });
  }

  return (
    <Card className="transition-shadow hover:shadow-card-hover">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Top Predictions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {displayPredictions.slice(0, 3).map((pred, index) => {
            const style = getRankStyle(index);
            const confidencePercent = Math.round(pred.confidence * 100);
            const isValid = pred.letter !== '-' && pred.letter !== 'nothing';
            
            return (
              <div
                key={index}
                className={cn(
                  "relative p-4 rounded-lg border-2 text-center transition-all",
                  style.bg,
                  style.border,
                  isValid && "hover:scale-105"
                )}
              >
                <div className="absolute top-1 left-2 text-xs font-semibold opacity-50">
                  #{index + 1}
                </div>
                <div className={cn("text-3xl font-bold mb-2", isValid ? style.text : "text-muted-foreground")}>
                  {isValid ? pred.letter.toUpperCase() : '-'}
                </div>
                <div className="space-y-1">
                  <div className="h-1.5 bg-background/50 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full transition-all duration-300 rounded-full", style.progress)}
                      style={{ width: `${confidencePercent}%` }}
                    />
                  </div>
                  <div className="text-xs font-medium opacity-70">
                    {isValid ? `${confidencePercent}%` : '-'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
