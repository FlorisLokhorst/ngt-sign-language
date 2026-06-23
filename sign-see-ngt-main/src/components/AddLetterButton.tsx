import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface AddLetterButtonProps {
  letter: string | null;
  onAdd: () => void;
  disabled?: boolean;
}

export function AddLetterButton({ letter, onAdd, disabled }: AddLetterButtonProps) {
  const displayLetter = letter && letter !== 'nothing' ? letter.toUpperCase() : null;
  
  return (
    <Button
      onClick={onAdd}
      disabled={disabled || !displayLetter}
      size="lg"
      className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground font-semibold"
    >
      <Plus className="w-5 h-5 mr-2" />
      {displayLetter 
        ? `Add "${displayLetter}" to Word` 
        : 'No letter detected'}
    </Button>
  );
}
