import { Hand, Target, Timer, Video, Wifi, WifiOff, Settings, HelpCircle, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppMode } from '@/types';

interface RibbonBarProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  isConnected: boolean;
  totalRecordings: number;
}

const modes: { id: AppMode; label: string; icon: React.ReactNode }[] = [
  { id: 'practice', label: 'Practice', icon: <Target className="w-4 h-4" /> },
  { id: 'speedrun', label: 'Speedrun', icon: <Timer className="w-4 h-4" /> },
  { id: 'record', label: 'Record', icon: <Video className="w-4 h-4" /> },
];

export function RibbonBar({ currentMode, onModeChange, isConnected, totalRecordings }: RibbonBarProps) {
  return (
    <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Left Section - Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground">
              <Hand className="w-6 h-6" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-foreground leading-tight">SignSee NGT</h1>
              <p className="text-xs text-muted-foreground leading-tight">Dutch Sign Language Practice</p>
            </div>
          </div>

          {/* Center Section - Mode Tabs */}
          <nav className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {modes.map((mode) => (
              <button
                key={mode.id}
                onClick={() => onModeChange(mode.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
                  currentMode === mode.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
                aria-label={`Switch to ${mode.label} mode`}
              >
                {mode.icon}
                <span className="hidden md:inline">{mode.label}</span>
              </button>
            ))}
          </nav>

          {/* Right Section - Status & Controls */}
          <div className="flex items-center gap-3">
            {/* Recording Stats Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-sm">
              <Database className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="font-medium">{totalRecordings}</span>
              <span className="text-muted-foreground">samples</span>
            </div>

            {/* Connection Status */}
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium",
              isConnected 
                ? "bg-success/10 text-success" 
                : "bg-destructive/10 text-destructive"
            )}>
              {isConnected ? (
                <>
                  <Wifi className="w-4 h-4" />
                  <span className="hidden lg:inline">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4" />
                  <span className="hidden lg:inline">Disconnected</span>
                </>
              )}
            </div>

            {/* Settings & Help */}
            <div className="flex items-center gap-1">
              <button 
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                aria-label="Settings"
              >
                <Settings className="w-5 h-5 text-muted-foreground" />
              </button>
              <button 
                className="p-2 rounded-lg hover:bg-muted transition-colors"
                aria-label="Help"
              >
                <HelpCircle className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
