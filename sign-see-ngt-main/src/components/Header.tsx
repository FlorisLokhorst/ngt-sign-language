import { Hand } from 'lucide-react';

export function Header() {
  return (
    <header className="bg-gradient-header py-8 px-4 text-primary-foreground">
      <div className="container mx-auto text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <Hand className="w-10 h-10" />
          <h1 className="text-3xl md:text-4xl font-bold">
            Dutch Sign Language (NGT) Fingerspelling Practice
          </h1>
        </div>
        <p className="text-lg opacity-90">
          Practice fingerspelling and get real-time feedback
        </p>
      </div>
    </header>
  );
}
