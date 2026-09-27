interface ProgressBarProps {
  value: number;
  total: number;
  label?: string;
}

export default function ProgressBar({ value, total, label }: ProgressBarProps) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-ink">{label ?? "Progress"}</span>
        <span className="text-sm text-muted">
          {value} / {total}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={total}
        className="h-2.5 w-full overflow-hidden rounded-full bg-line"
      >
        <div
          className="h-full rounded-full bg-success transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
