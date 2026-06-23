import { BarChart3, Target, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PracticeStats } from '@/types';

interface StatsPanelProps {
  stats: PracticeStats;
}

export function StatsPanel({ stats }: StatsPanelProps) {
  return (
    <Card className="transition-shadow hover:shadow-card-hover">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Today's Stats
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-primary">{stats.lettersToday}</div>
            <div className="text-xs text-muted-foreground">Letters</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-success">{stats.accuracyPercent}%</div>
            <div className="text-xs text-muted-foreground">Accuracy</div>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="text-2xl font-bold text-accent">{stats.timeSpentMinutes}m</div>
            <div className="text-xs text-muted-foreground">Time</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
