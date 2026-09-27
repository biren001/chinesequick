"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AudioButton from "./AudioButton";
import PhraseCard from "./PhraseCard";
import PlayAll from "./PlayAll";
import ProgressBar from "./ProgressBar";
import Quiz from "./Quiz";
import SaveButton from "./SaveButton";
import { audioForPhrase } from "@/lib/audio";
import { EVENTS, track } from "@/lib/analytics";
import { useProgress } from "@/lib/useProgress";
import { useSaved } from "@/lib/useSaved";
import type { Category, Phrase } from "@/lib/types";

interface CategoryLearnerProps {
  category: Category;
  phrases: Phrase[];
}

export default function CategoryLearner({ category, phrases }: CategoryLearnerProps) {
  const { progress, loaded, togglePhrase, saveQuizScore, saveMistakes, isCompleted } =
    useProgress();
  const { count: savedCount } = useSaved();
  /** 复习模式：用错题单独跑一轮测验，而不是把错题混进主测验里 */
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    track(EVENTS.categorySelected, { category: category.id });
  }, [category.id]);

  const doneCount = phrases.filter((p) => progress.completedIds.includes(p.id)).length;
  const quizRecord = progress.quiz[category.id];

  const reviewPhrases = useMemo<Phrase[]>(() => {
    const ids = progress.mistakes[category.id] ?? [];
    if (!ids.length) return [];
    const byId = new Map(phrases.map((p) => [p.id, p] as const));
    return ids.map((id) => byId.get(id)).filter((p): p is Phrase => Boolean(p));
  }, [progress.mistakes, category.id, phrases]);

  return (
    <div className="space-y-8">
      <div className="sticky top-0 z-10 -mx-5 border-b border-line bg-paper/95 px-5 py-3 backdrop-blur">
        <ProgressBar
          value={doneCount}
          total={phrases.length}
          label={`${category.name} Chinese`}
        />
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
          <span>
            Streak:{" "}
            <strong className="font-medium text-ink">
              {loaded ? progress.streak : 0} day{progress.streak === 1 ? "" : "s"}
            </strong>
          </span>
          {quizRecord && (
            <span>
              Best quiz:{" "}
              <strong className="font-medium text-ink">{quizRecord.best}%</strong>
            </span>
          )}
          {savedCount > 0 && (
            <Link href="/saved" className="underline underline-offset-4 hover:text-ink">
              ♡ {savedCount} saved
            </Link>
          )}
        </div>
      </div>

      <PlayAll phrases={phrases} />

      <section>
        <h2 className="mb-3 text-lg font-medium text-ink">
          {phrases.length} phrases
        </h2>
        <div className="space-y-3">
          {phrases.map((phrase, i) => (
            <PhraseCard
              key={phrase.id}
              phrase={phrase}
              index={i + 1}
              completed={isCompleted(phrase.id)}
              onToggleComplete={togglePhrase}
            />
          ))}
        </div>
      </section>

      {reviewPhrases.length > 0 && !reviewing && (
        <section className="rounded-2xl border border-accent bg-accent-soft p-5">
          <h2 className="text-lg font-medium text-ink">
            Review {reviewPhrases.length} phrase{reviewPhrases.length === 1 ? "" : "s"} you missed
          </h2>
          <p className="mt-1 text-sm text-muted">
            From your last quiz here. Clearing these is the fastest progress you can make — get them
            right and the list disappears.
          </p>
          <ul className="mt-4 space-y-3">
            {reviewPhrases.map((phrase) => (
              <li key={phrase.id} className="rounded-xl border border-line bg-card p-4">
                <p className="text-xl leading-snug font-medium text-ink">{phrase.chinese}</p>
                <p className="text-sm text-accent">{phrase.pinyin}</p>
                <p className="text-sm text-muted">{phrase.english}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <AudioButton
                    text={phrase.chinese}
                    src={audioForPhrase(phrase)}
                    label="Listen"
                    variant="accent"
                    repeats={3}
                  />
                  <SaveButton phraseId={phrase.id} />
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setReviewing(true)}
            className="mt-4 w-full rounded-xl bg-accent px-5 py-3 text-base font-medium text-white transition hover:opacity-90 active:scale-[0.98]"
          >
            Practise these {reviewPhrases.length}
          </button>
        </section>
      )}

      {reviewing ? (
        <section>
          <h2 className="text-lg font-medium text-ink">Review quiz</h2>
          <p className="mt-1 mb-3 text-sm text-muted">
            Only the phrases you missed. Answer them all and you&apos;re clear.
          </p>
          <Quiz
            phrases={reviewPhrases}
            distractorPool={phrases}
            categoryLabel={`${category.name} review`}
            resultNote="Anything you still miss stays on the review list."
            onFinish={(score, total, wrongIds) => saveMistakes(category.id, wrongIds)}
          />
          <button
            type="button"
            onClick={() => setReviewing(false)}
            className="mt-3 w-full rounded-xl border border-line bg-card px-5 py-3 text-base font-medium text-ink transition hover:border-accent hover:text-accent active:scale-[0.98]"
          >
            Back to the full list
          </button>
        </section>
      ) : (
        <section>
          <h2 className="text-lg font-medium text-ink">
            You&apos;ve learned {doneCount} of {phrases.length} phrases.
          </h2>
          <p className="mt-1 flex items-center gap-2 text-base font-medium text-accent">
            <span aria-hidden="true">🔥</span> Quick Quiz
            <span className="text-sm font-normal text-muted">· 5 questions</span>
          </p>
          <p className="mt-1 mb-3 text-sm text-muted">
            See how much sticks before you move on.
          </p>
          <Quiz
            phrases={phrases}
            categoryLabel={category.name}
            onFinish={(score, total, wrongIds) => saveQuizScore(category.id, score, total, wrongIds)}
          />
        </section>
      )}

      <div className="pb-4 text-center">
        <Link href="/" className="text-sm text-muted underline underline-offset-4">
          Back to all categories
        </Link>
      </div>
    </div>
  );
}
