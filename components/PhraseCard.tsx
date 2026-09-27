"use client";

import { useState } from "react";
import AudioButton from "./AudioButton";
import SaveButton from "./SaveButton";
import { audioForPhrase, slowAudioForPhrase } from "@/lib/audio";
import { EVENTS, track } from "@/lib/analytics";
import type { Phrase } from "@/lib/types";

interface PhraseCardProps {
  phrase: Phrase;
  index?: number;
  completed?: boolean;
  onToggleComplete?: (id: number) => void;
}

export default function PhraseCard({
  phrase,
  index,
  completed = false,
  onToggleComplete,
}: PhraseCardProps) {
  const [showPinyin, setShowPinyin] = useState(true);

  function handleToggle() {
    if (!onToggleComplete) return;
    if (!completed) track(EVENTS.phraseCompleted, { phrase_id: phrase.id, category: phrase.category });
    onToggleComplete(phrase.id);
  }

  return (
    <article
      className={`rounded-2xl border bg-card p-5 transition ${
        completed ? "border-success bg-success-soft" : "border-line"
      }`}
    >
      <div>
        {typeof index === "number" && (
          <span className="text-xs font-medium text-muted">{index}.</span>
        )}
        <p className="mt-1 text-[26px] leading-snug font-medium text-ink">
          {phrase.chinese}
        </p>
        {showPinyin ? (
          <p className="mt-1 text-base text-accent">{phrase.pinyin}</p>
        ) : (
          <p className="mt-1 text-base tracking-widest text-line" aria-hidden="true">
            • • • • •
          </p>
        )}
        <p className="mt-2 text-sm text-muted">{phrase.english}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <AudioButton
          text={phrase.chinese}
          src={audioForPhrase(phrase)}
          label="Listen"
          variant="accent"
          repeats={3}
        />
        <AudioButton
          text={phrase.chinese}
          src={slowAudioForPhrase(phrase)}
          rate={0.6}
          label="Slow"
        />
        <button
          type="button"
          onClick={() => setShowPinyin((v) => !v)}
          aria-pressed={!showPinyin}
          className="inline-flex items-center justify-center rounded-xl border border-line bg-card px-3 py-2 text-sm font-medium text-ink transition hover:border-accent hover:text-accent active:scale-[0.98]"
        >
          {showPinyin ? "Hide Pinyin" : "Show Pinyin"}
        </button>
        <SaveButton phraseId={phrase.id} />
      </div>

      {onToggleComplete && (
        <button
          type="button"
          onClick={handleToggle}
          aria-pressed={completed}
          className={`mt-2 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition active:scale-[0.98] ${
            completed
              ? "border-success bg-success text-white"
              : "border-line bg-card text-ink hover:border-success hover:text-success"
          }`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12.5l5 5L20 6.5" />
          </svg>
          {completed ? "Learned" : "Got it"}
        </button>
      )}
    </article>
  );
}
