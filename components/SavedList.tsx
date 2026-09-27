"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AudioButton from "./AudioButton";
import PlayAll from "./PlayAll";
import SaveButton from "./SaveButton";
import { audioForPhrase, slowAudioForPhrase } from "@/lib/audio";
import { CATEGORIES, getCategory } from "@/lib/categories";
import { getPhraseById } from "@/lib/phrases";
import { phrasePath, phraseSlug } from "@/lib/slug";
import { useSaved } from "@/lib/useSaved";
import type { Phrase } from "@/lib/types";

const CATEGORY_ORDER = new Map(CATEGORIES.map((c, i) => [c.id, i] as const));

export default function SavedList() {
  const { savedIds } = useSaved();
  // useSyncExternalStore 在 hydration 阶段给的是空快照，
  // 不等挂载就渲染会把「你还没收藏」闪给已经有收藏的用户看。
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const phrases = useMemo<Phrase[]>(
    () =>
      savedIds
        .map((id) => getPhraseById(id))
        .filter((p): p is Phrase => Boolean(p))
        .sort(
          (a, b) =>
            (CATEGORY_ORDER.get(a.category) ?? 99) - (CATEGORY_ORDER.get(b.category) ?? 99) ||
            a.id - b.id
        ),
    [savedIds]
  );

  if (!mounted) {
    return (
      <p className="rounded-2xl border border-line bg-card p-5 text-sm text-muted">
        Loading your saved phrases…
      </p>
    );
  }

  if (!phrases.length) {
    return (
      <div className="rounded-2xl border border-line bg-card p-6 text-center">
        <p className="text-base font-medium text-ink">No saved phrases yet.</p>
        <p className="mt-2 text-sm text-muted">
          Tap the heart on any phrase to keep it here. Your list stays on this device —
          nothing is uploaded.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-xl bg-accent px-5 py-3 text-base font-medium text-white transition hover:opacity-90 active:scale-[0.98]"
        >
          Browse phrases by situation
        </Link>
      </div>
    );
  }

  const firstCategory = getCategory(phrases[0].category);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        {phrases.length} phrase{phrases.length === 1 ? "" : "s"}, stored on this device only.
      </p>

      {phrases.length > 1 && (
        <PlayAll phrases={phrases} title={`Listen to your ${phrases.length} saved phrases`} />
      )}

      <ol className="space-y-3">
        {phrases.map((phrase) => {
          const category = getCategory(phrase.category);
          return (
            <li key={phrase.id} className="rounded-2xl border border-line bg-card p-5">
              {category && (
                <p className="text-xs font-medium text-muted">
                  <span aria-hidden="true">{category.emoji}</span> {category.name}
                </p>
              )}
              <p className="mt-1 text-[26px] leading-snug font-medium text-ink">
                {phrase.chinese}
              </p>
              <p className="mt-1 text-base text-accent">{phrase.pinyin}</p>
              <p className="mt-2 text-sm text-muted">{phrase.english}</p>
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
                <SaveButton phraseId={phrase.id} withLabel />
                <Link
                  href={phrasePath(phraseSlug(phrase))}
                  className="inline-flex items-center rounded-xl border border-line px-3 py-2 text-sm font-medium text-ink transition hover:border-accent hover:text-accent"
                >
                  Details
                </Link>
              </div>
            </li>
          );
        })}
      </ol>

      {firstCategory && (
        <div className="rounded-2xl bg-accent-soft p-5 text-center">
          <p className="text-base font-medium text-ink">Practice what you saved</p>
          <Link
            href={`/learn/${firstCategory.id}`}
            className="mt-3 inline-block w-full rounded-xl bg-accent px-5 py-3 text-base font-medium text-white transition hover:opacity-90 active:scale-[0.98]"
          >
            Start learning {firstCategory.name}
          </Link>
        </div>
      )}
    </div>
  );
}
