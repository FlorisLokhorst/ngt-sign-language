interface TopPrediction {
  letter: string;
  confidence: number;
}

interface TopPredictionsProps {
  predictions: TopPrediction[];
}

export function TopPredictions({ predictions }: TopPredictionsProps) {
  // Fill with empty predictions if less than 3
  const displayPredictions = [...predictions];
  while (displayPredictions.length < 3) {
    displayPredictions.push({ letter: '-', confidence: 0 });
  }

  return (
    <div className="bg-card rounded-lg p-6 shadow-md border border-border">
      <h2 className="text-lg font-semibold text-foreground mb-4">Top 3 Predictions</h2>
      <div className="grid grid-cols-3 gap-4">
        {displayPredictions.slice(0, 3).map((pred, index) => (
          <div
            key={index}
            className={`rounded-lg p-4 text-center transition-all ${
              index === 0 
                ? 'bg-primary text-primary-foreground shadow-lg scale-105' 
                : 'bg-secondary text-secondary-foreground'
            }`}
          >
            <div className={`text-2xl font-bold ${index === 0 ? '' : 'text-foreground'}`}>
              {pred.letter.toUpperCase()}
            </div>
            <div className={`text-sm ${index === 0 ? 'opacity-90' : 'text-muted-foreground'}`}>
              {pred.confidence > 0 ? `${(pred.confidence * 100).toFixed(1)}%` : '-'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
