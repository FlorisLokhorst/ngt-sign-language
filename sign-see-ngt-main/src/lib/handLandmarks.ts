// Hand landmark connections for MediaPipe hand model

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

// Connection pairs for drawing hand skeleton
export const HAND_CONNECTIONS: [number, number][] = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index finger
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle finger
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring finger
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky finger
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm connections
  [5, 9], [9, 13], [13, 17]
];

// Fingertip indices for special styling
export const FINGERTIP_INDICES = [4, 8, 12, 16, 20];

export const drawHandLandmarks = (
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  width: number,
  height: number,
  offsetX: number = 0,
  offsetY: number = 0,
): void => {
  if (!landmarks || landmarks.length !== 21) return;

  // Draw connections first (behind points)
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.6)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';

  HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
    const start = landmarks[startIdx];
    const end = landmarks[endIdx];

    if (start && end) {
      ctx.beginPath();
      ctx.moveTo(offsetX + start.x * width, offsetY + start.y * height);
      ctx.lineTo(offsetX + end.x * width, offsetY + end.y * height);
      ctx.stroke();
    }
  });

  // Draw points
  landmarks.forEach((point, index) => {
    const x = offsetX + point.x * width;
    const y = offsetY + point.y * height;

    const isFingertip = FINGERTIP_INDICES.includes(index);
    const radius = isFingertip ? 6 : 4;

    // Draw outer circle (primary blue)
    ctx.fillStyle = '#3B82F6';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();

    // Draw inner circle (white)
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(x, y, radius - 1.5, 0, 2 * Math.PI);
    ctx.fill();
  });
};
