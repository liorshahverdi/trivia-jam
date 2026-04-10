import { useState, useEffect } from 'react';

interface TimerProps {
  seconds: number;
  onComplete?: () => void;
}

export default function Timer({ seconds, onComplete }: TimerProps) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          onComplete?.();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [seconds, onComplete]);

  const pct = (remaining / seconds) * 100;
  const color = remaining <= 5 ? 'bg-jam-red' : remaining <= 10 ? 'bg-jam-yellow' : 'bg-jam-green';

  return (
    <div className="w-full">
      <div className="flex justify-between mb-1">
        <span className="text-sm text-white/60">Time</span>
        <span className={`text-lg font-bold ${remaining <= 5 ? 'text-jam-red animate-pulse' : ''}`}>
          {remaining}s
        </span>
      </div>
      <div className="w-full bg-white/10 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all duration-1000 ease-linear`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
