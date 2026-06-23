import { Camera, Hand, Eye, Plus, ArrowLeft, Space } from 'lucide-react';

const steps = [
  {
    icon: Camera,
    text: 'Allow camera access when prompted',
  },
  {
    icon: Hand,
    text: 'Position your hand clearly in front of the camera',
  },
  {
    icon: Hand,
    text: 'Form letters using Dutch Sign Language (NGT) fingerspelling',
  },
  {
    icon: Eye,
    text: 'Watch real-time predictions appear on the webcam overlay',
  },
  {
    icon: Plus,
    text: 'Click "Add to Word" to manually add letters, or let high-confidence predictions add automatically',
  },
  {
    icon: ArrowLeft,
    text: 'Use the "del" sign to remove the last letter',
  },
  {
    icon: Space,
    text: 'Use the "space" sign to add a space between words',
  },
];

export function Instructions() {
  return (
    <div className="bg-card rounded-lg p-6 shadow-md border border-border">
      <h2 className="text-lg font-semibold text-foreground mb-4">How to Use</h2>
      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li key={index} className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
              {index + 1}
            </span>
            <div className="flex items-center gap-2 pt-0.5">
              <step.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-foreground">{step.text}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
