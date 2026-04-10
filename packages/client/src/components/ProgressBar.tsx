interface ProgressBarProps {
  current: number;
  total: number;
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
  const pct = ((current + 1) / total) * 100;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-white/60">
        {current + 1}/{total}
      </span>
      <div className="flex-1 bg-white/10 rounded-full h-1.5">
        <div
          className="bg-jam-purple h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
