"use client";

import { EVENTS, track } from "@/lib/analytics";
import { useSaved } from "@/lib/useSaved";

interface SaveButtonProps {
  phraseId: number;
  /** 显示 "Save" / "Saved" 文案；不显示则是纯图标按钮 */
  withLabel?: boolean;
  className?: string;
}

/**
 * 收藏按钮。自包含（自己读 store），所以可以直接塞进任何卡片，
 * 不需要从页面层往下传 props。
 */
export default function SaveButton({
  phraseId,
  withLabel = false,
  className = "",
}: SaveButtonProps) {
  const { isSaved, toggle } = useSaved();
  const saved = isSaved(phraseId);

  function handleClick() {
    track(EVENTS.phraseSaved, {
      phrase_id: phraseId,
      saved: !saved,
    });
    toggle(phraseId);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved phrases" : "Save this phrase"}
      title={saved ? "Saved — tap to remove" : "Save for later"}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition active:scale-[0.98] ${
        saved
          ? "border-accent bg-accent-soft text-accent"
          : "border-line bg-card text-ink hover:border-accent hover:text-accent"
      } ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.68L12 21.35z" />
      </svg>
      {withLabel && <span>{saved ? "Saved" : "Save"}</span>}
    </button>
  );
}
