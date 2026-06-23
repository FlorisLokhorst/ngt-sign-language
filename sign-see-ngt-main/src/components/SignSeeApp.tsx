import { useState, useCallback } from 'react';
import { RibbonBar } from '@/components/ribbon/RibbonBar';
import { PracticeMode } from '@/components/practice/PracticeMode';
import { SpeedrunMode } from '@/components/speedrun/SpeedrunMode';
import { RecordMode } from '@/components/record/RecordMode';
import { useWebSocket } from '@/hooks/useWebSocket';
import { AppMode } from '@/types';

const WEBSOCKET_URL = 'ws://localhost:8000/ws/predict';

export function SignSeeApp() {
  const [currentMode, setCurrentMode] = useState<AppMode>('practice');
  const [totalRecordings, setTotalRecordings] = useState(0);

  const { isConnected, error: wsError, sendFrame, connect, disconnect, lastPrediction } = useWebSocket({
    url: WEBSOCKET_URL,
  });

  const handleModeChange = useCallback((mode: AppMode) => {
    setCurrentMode(mode);
  }, []);

  const handleStatsUpdate = useCallback((total: number) => {
    setTotalRecordings(total);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <RibbonBar
        currentMode={currentMode}
        onModeChange={handleModeChange}
        isConnected={isConnected}
        totalRecordings={totalRecordings}
      />

      <main className="flex-1">
        {currentMode === 'practice' && (
          <PracticeMode
            isConnected={isConnected}
            wsError={wsError}
            lastPrediction={lastPrediction}
            sendFrame={sendFrame}
            connect={connect}
            disconnect={disconnect}
          />
        )}

        {currentMode === 'speedrun' && (
          <SpeedrunMode
            isConnected={isConnected}
            lastPrediction={lastPrediction}
            sendFrame={sendFrame}
            connect={connect}
            disconnect={disconnect}
          />
        )}

        {currentMode === 'record' && (
          <RecordMode
            isConnected={isConnected}
            lastPrediction={lastPrediction}
            sendFrame={sendFrame}
            connect={connect}
            disconnect={disconnect}
            onStatsUpdate={handleStatsUpdate}
          />
        )}
      </main>
    </div>
  );
}
