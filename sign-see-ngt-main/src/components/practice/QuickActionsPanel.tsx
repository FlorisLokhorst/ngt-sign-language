import { Plus, Trash2, Video, VideoOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface QuickActionsPanelProps {
  currentLetter: string | null;
  onAddLetter: () => void;
  onClearAll: () => void;
  isWebcamActive: boolean;
  onToggleWebcam: () => void;
  disabled?: boolean;
}

export function QuickActionsPanel({
  currentLetter,
  onAddLetter,
  onClearAll,
  isWebcamActive,
  onToggleWebcam,
  disabled = false,
}: QuickActionsPanelProps) {
  const canAdd = currentLetter && currentLetter !== 'nothing' && !disabled;
  const displayLetter = currentLetter === 'space' ? '␣' : currentLetter === 'del' ? '⌫' : currentLetter?.toUpperCase();

  return (
    <Card className="transition-shadow hover:shadow-card-hover">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          onClick={onAddLetter}
          disabled={!canAdd}
          className="w-full h-12 text-base"
          size="lg"
        >
          <Plus className="w-5 h-5 mr-2" />
          {canAdd ? `Add "${displayLetter}" to Word` : 'Show a letter to add'}
        </Button>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={onClearAll}
            className="h-10"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </Button>

          <Button
            variant={isWebcamActive ? 'destructive' : 'default'}
            onClick={onToggleWebcam}
            className="h-10"
          >
            {isWebcamActive ? (
              <>
                <VideoOff className="w-4 h-4 mr-2" />
                Stop
              </>
            ) : (
              <>
                <Video className="w-4 h-4 mr-2" />
                Start
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
