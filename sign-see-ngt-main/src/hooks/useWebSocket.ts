import { useState, useCallback, useRef, useEffect } from 'react';
import { Landmark } from '@/lib/handLandmarks';

export interface PredictionResult {
  prediction: string;
  confidence: number;
  top_3: Array<{
    letter: string;
    confidence: number;
  }>;
  hand_detected?: boolean;
  landmarks?: Landmark[];
  stable_prediction?: string | null;
  stable_confidence?: number;
  current_word?: string;
  sentence?: string;
  committed_letter?: string | null;
  abbreviation?: string | null;
  suggestions?: string[];
}

interface UseWebSocketOptions {
  url: string;
  onPrediction?: (result: PredictionResult) => void;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  error: string | null;
  sendFrame: (base64Image: string) => void;
  connect: () => void;
  disconnect: () => void;
  lastPrediction: PredictionResult | null;
}

export function useWebSocket({ url, onPrediction }: UseWebSocketOptions): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPrediction, setLastPrediction] = useState<PredictionResult | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      setError(null);
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
      };

      wsRef.current.onerror = () => {
        setError('WebSocket connection failed. Make sure the backend server is running.');
        setIsConnected(false);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data: PredictionResult = JSON.parse(event.data);
          // Ensure hand_detected has a default value
          if (data.hand_detected === undefined) {
            data.hand_detected = true; // Assume hand detected if we got a prediction
          }
          setLastPrediction(data);
          onPrediction?.(data);
        } catch {
          console.error('Failed to parse prediction:', event.data);
        }
      };
    } catch {
      setError('Failed to create WebSocket connection');
      setIsConnected(false);
    }
  }, [url, onPrediction]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendFrame = useCallback((base64Image: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ image: base64Image }));
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    error,
    sendFrame,
    connect,
    disconnect,
    lastPrediction,
  };
}
