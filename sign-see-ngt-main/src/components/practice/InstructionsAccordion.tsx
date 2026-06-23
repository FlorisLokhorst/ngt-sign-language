import { useState } from 'react';
import { Hand, Camera, Eye, Plus, Trash, Space, Lightbulb, X } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { NGT_ALPHABET } from '@/lib/api';

const instructions = [
  { icon: Camera, text: 'Allow camera access when prompted' },
  { icon: Hand, text: 'Position your hand in front of the camera' },
  { icon: Eye, text: 'Form letters using Dutch Sign Language' },
  { icon: Eye, text: 'Watch real-time predictions appear' },
  { icon: Plus, text: 'Click "Add to Word" to build words' },
  { icon: Trash, text: 'Use "del" sign to remove last letter' },
  { icon: Space, text: 'Use "space" sign to add spaces' },
];

export function InstructionsAccordion() {
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="instructions" className="border rounded-lg bg-card">
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-primary" />
            <span className="font-medium">How to Use</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-4">
            {/* Instruction steps */}
            <ol className="space-y-2">
              {instructions.map((step, index) => (
                <li key={index} className="flex items-center gap-3 text-sm">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    {index + 1}
                  </div>
                  <step.icon className="w-4 h-4 text-muted-foreground" />
                  <span>{step.text}</span>
                </li>
              ))}
            </ol>

            {/* Letter reference grid */}
            <div className="pt-4 border-t">
              <p className="text-sm font-medium mb-2">NGT Alphabet Reference</p>
              <div className="flex flex-wrap gap-1.5">
                {NGT_ALPHABET.map((letter) => (
                  <button
                    key={letter}
                    onClick={() => setSelectedLetter(selectedLetter === letter ? null : letter)}
                    className={`w-8 h-8 flex items-center justify-center rounded text-sm font-bold transition-colors cursor-pointer ${
                      selectedLetter === letter
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-primary/20'
                    }`}
                    title={`Show sign for letter ${letter}`}
                  >
                    {letter}
                  </button>
                ))}
              </div>

              {/* Reference image popup */}
              {selectedLetter && (
                <div className="mt-3 relative rounded-lg border bg-muted p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold">Sign for "{selectedLetter}"</span>
                    <button
                      onClick={() => setSelectedLetter(null)}
                      className="p-1 rounded hover:bg-background transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <img
                    src={`/signs/${selectedLetter}.png`}
                    alt={`NGT sign for letter ${selectedLetter}`}
                    className="w-full max-w-[200px] mx-auto rounded-md"
                  />
                </div>
              )}
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
