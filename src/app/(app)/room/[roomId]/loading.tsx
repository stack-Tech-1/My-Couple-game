const lines = ["Shuffling the deck…", "Setting up the board…", "Warming the dice…", "Finding your seats…"];

export default function Loading() {
  const line = lines[Math.floor(Date.now() / 1000) % lines.length];
  return (
    <div className="flex min-h-[50dvh] items-center justify-center" role="status">
      <p className="display animate-pulse text-[1.6rem] text-fg">{line}</p>
    </div>
  );
}