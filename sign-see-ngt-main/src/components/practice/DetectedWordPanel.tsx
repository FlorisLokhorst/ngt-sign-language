import { Trash2, Copy, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

interface DetectedWordPanelProps {
  word: string;
  onClear: () => void;
}

export function DetectedWordPanel({ word, onClear }: DetectedWordPanelProps) {
  const handleCopy = async () => {
    if (!word.trim()) return;
    try {
      await navigator.clipboard.writeText(word);
      toast({
        title: "Copied!",
        description: "Word copied to clipboard",
      });
    } catch {
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleDownload = () => {
    if (!word.trim()) return;
    const blob = new Blob([word], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `signed-text-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Downloaded!",
      description: "Text saved to file",
    });
  };

  return (
    <Card className="transition-shadow hover:shadow-card-hover">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Detected Word</CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopy}
              disabled={!word.trim()}
              aria-label="Copy word"
              className="h-8 w-8"
            >
              <Copy className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownload}
              disabled={!word.trim()}
              aria-label="Download word"
              className="h-8 w-8"
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClear}
              disabled={!word}
              aria-label="Clear word"
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="min-h-[80px] p-4 bg-muted rounded-lg flex items-center">
          {word ? (
            <p className="text-3xl font-bold tracking-wide break-all">{word}</p>
          ) : (
            <p className="text-muted-foreground text-lg italic">Start signing...</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
