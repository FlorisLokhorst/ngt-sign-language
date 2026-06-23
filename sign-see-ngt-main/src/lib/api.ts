// API utilities for backend integration

const API_BASE = 'http://localhost:8000';

export interface SpeedrunSession {
  session_id: string;
  target_letters: string[];
  completed_letters: string[];
  start_time: string;
  status: 'active' | 'completed';
}

export interface RecordingStats {
  total_samples: number;
  samples_per_letter: Record<string, number>;
}

export interface RecordSampleResponse {
  success: boolean;
  sample_id?: string;
  message?: string;
}

// Speedrun API
export const startSpeedrun = async (targetLetters: string[], mode: string = 'alphabet'): Promise<SpeedrunSession> => {
  const res = await fetch(`${API_BASE}/api/speedrun/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target_letters: targetLetters,
      mode
    })
  });
  if (!res.ok) throw new Error('Failed to start speedrun');
  return await res.json();
};

export const completeLetter = async (sessionId: string, letter: string): Promise<SpeedrunSession> => {
  const res = await fetch(`${API_BASE}/api/speedrun/${sessionId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ letter })
  });
  if (!res.ok) throw new Error('Failed to complete letter');
  return await res.json();
};

export const getSpeedrunStatus = async (sessionId: string): Promise<SpeedrunSession> => {
  const res = await fetch(`${API_BASE}/api/speedrun/${sessionId}`);
  if (!res.ok) throw new Error('Failed to get speedrun status');
  return await res.json();
};

// Recording API
export const recordSample = async (
  imageData: string,
  letter: string,
  confidence: number,
  landmarks: Array<{ x: number; y: number; z: number }> | null
): Promise<RecordSampleResponse> => {
  const res = await fetch(`${API_BASE}/api/record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: imageData,
      letter,
      confidence,
      landmarks,
      hand_detected: !!landmarks,
      metadata: { timestamp: new Date().toISOString() }
    })
  });
  if (!res.ok) throw new Error('Failed to record sample');
  return await res.json();
};

export const getRecordingStats = async (): Promise<RecordingStats> => {
  const res = await fetch(`${API_BASE}/api/recording-stats`);
  if (!res.ok) throw new Error('Failed to get recording stats');
  return await res.json();
};

// Sequence / sentence building API
export const clearSequence = async (): Promise<{ success: boolean }> => {
  const res = await fetch(`${API_BASE}/api/sequence/clear`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to clear sequence');
  return await res.json();
};

export const acceptSuggestion = async (
  word: string
): Promise<{ success: boolean; sentence: string; current_word: string }> => {
  const res = await fetch(`${API_BASE}/api/sequence/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word }),
  });
  if (!res.ok) throw new Error('Failed to accept suggestion');
  return await res.json();
};

// Dutch Sign Language alphabet (23 letters - no J, X, Z as they require motion)
export const NGT_ALPHABET = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'Y'
];

export const NGT_VOWELS = ['A', 'E', 'I', 'O', 'U'];
