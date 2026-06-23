import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface DetectedWordProps {
  word: string;
  onClear: () => void;
}

export function DetectedWord({ word, onClear }: DetectedWordProps) {
  return (
    <div className="bg-card rounded-lg p-6 shadow-md border border-border">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-foreground">Detected Word</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          className="flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Clear
        </Button>
      </div>
      <div className="min-h-[60px] flex items-center justify-center bg-secondary rounded-md p-4">
        {word ? (
          <p className="text-3xl md:text-4xl font-bold text-primary tracking-wide">
            {word}
          </p>
        ) : (
          <p className="text-muted-foreground text-lg italic">Start signing...</p>
        )}
      </div>
    </div>
  );
}
