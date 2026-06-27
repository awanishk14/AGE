import { cn } from '@age/ui';

export default function HomePage() {
  return (
    <main className={cn('flex min-h-screen flex-col items-center justify-center gap-4 p-8')}>
      <h1 className="text-4xl font-bold">AGE</h1>
      <p className="text-lg text-neutral-500">
        Adaptive Growth Engine — scaffold ready. No features yet.
      </p>
    </main>
  );
}
