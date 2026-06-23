// Shared types for the application

import { Landmark } from '@/lib/handLandmarks';

export type AppMode = 'practice' | 'speedrun' | 'record';

export interface PredictionResult {
  prediction: string;
  confidence: number;
  top_3: Array<{
    letter: string;
    confidence: number;
  }>;
  hand_detected?: boolean;
  landmarks?: Landmark[];
  // Smoothed prediction (stable across frames)
  stable_prediction?: string | null;
  stable_confidence?: number;
  // Sentence building
  current_word?: string;
  sentence?: string;
  committed_letter?: string | null;
  // Abbreviation expansion
  abbreviation?: string | null;
  // Dictionary suggestions
  suggestions?: string[];
}

export interface SpeedrunState {
  status: 'idle' | 'countdown' | 'running' | 'finished';
  sessionId: string | null;
  targetLetters: string[];
  completedLetters: string[];
  currentLetterIndex: number;
  startTime: number | null;
  endTime: number | null;
  skippedLetters: string[];
}

export interface RecordingState {
  selectedLetter: string;
  isRecording: boolean;
  lastRecordedAt: number | null;
  recentRecordings: Array<{
    letter: string;
    confidence: number;
    timestamp: string;
  }>;
}

export interface PracticeStats {
  lettersToday: number;
  accuracyPercent: number;
  timeSpentMinutes: number;
}
