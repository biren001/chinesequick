"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { EVENTS, track } from "@/lib/analytics";
import type { Phrase } from "@/lib/types";

const QUESTION_COUNT = 5;

interface Option {
  id: number;
  label: string;
}

interface Question {
  prompt: string;
  options: Option[];
  answerId: number;
  answer: Phrase;
}

/** 固定种子随机：服务端和客户端算出同一套题，不会 hydration mismatch。 */
function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildQuestions(phrases: Phrase[], distractorSource: Phrase[]): Question[] {
  const random = mulberry32(phrases.reduce((sum, p) => sum + p.id, 7));
  const picked = shuffled(phrases, random).slice(0, QUESTION_COUNT);

  return picked.map((phrase, i) => {
    const distractors = shuffled(
      distractorSource.filter((p) => p.id !== phrase.id),
      random
    ).slice(0, 2);

    // 偶数题：英文 -> 选中文；奇数题：中文 -> 选英文
    const zhToEn = i % 2 === 1;
    const options = shuffled(
      [
        { id: phrase.id, label: zhToEn ? phrase.english : phrase.chinese },
        ...distractors.map((d) => ({
          id: d.id,
          label: zhToEn ? d.english : d.chinese,
        })),
      ],
      random
    );

    return {
      prompt: zhToEn
        ? `What does "${phrase.chinese}" mean?`
        : `How do you say "${phrase.english}" in Chinese?`,
      options,
      answerId: phrase.id,
      answer: phrase,
    };
  });
}

interface QuizProps {
  phrases: Phrase[];
  /** 出题只用 phrases，但干扰项从这个更大的池子里取（复习模式：只考错题，干扰项仍来自全类） */
  distractorPool?: Phrase[];
  /** 用于结果页文案与埋点，如 "Restaurant" */
  categoryLabel?: string;
  onFinish?: (score: number, total: number, wrongIds: number[]) => void;
  /** 覆盖结果页的说明文案（复习模式用，避免出现「今天学了 N 条」的错误暗示） */
  resultNote?: string;
}

export default function Quiz({
  phrases,
  distractorPool,
  categoryLabel,
  onFinish,
  resultNote,
}: QuizProps) {
  const questions = useMemo(
    () => buildQuestions(phrases, distractorPool ?? phrases),
    [phrases, distractorPool]
  );

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [wrongIds, setWrongIds] = useState<number[]>([]);
  const [finished, setFinished] = useState(false);
  const startedRef = useRef(false);

  function restart() {
    setIndex(0);
    setSelected(null);
    setScore(0);
    setWrongIds([]);
    setFinished(false);
    startedRef.current = false;
  }

  function choose(id: number) {
    if (selected !== null) return;
    if (!startedRef.current) {
      startedRef.current = true;
      track(EVENTS.quizStarted, { category: categoryLabel });
    }
    setSelected(id);
    if (id === questions[index].answerId) {
      setScore((s) => s + 1);
    } else {
      setWrongIds((prev) => [...prev, questions[index].answerId]);
    }
  }

  function next() {
    if (index + 1 >= questions.length) {
      setFinished(true);
      onFinish?.(score, questions.length, wrongIds);
      track(EVENTS.quizCompleted, {
        category: categoryLabel,
        score,
        total: questions.length,
      });
      track(EVENTS.quizScore, {
        category: categoryLabel,
        score,
        total: questions.length,
        percent: Math.round((score / questions.length) * 100),
      });
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
  }

  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <section className="rounded-2xl border border-success bg-success-soft p-6 text-center">
        <p className="text-3xl" aria-hidden="true">
          {pct === 100 ? "🏆" : "🎉"}
        </p>
        <p className="mt-2 text-lg font-semibold text-ink">
          {pct === 100 ? "Perfect!" : "Nice!"}
        </p>
        <p className="mt-1 text-4xl font-semibold text-ink">
          {score} / {questions.length}
        </p>
        <p className="mt-2 text-sm text-muted">
          {resultNote ?? `You learned ${phrases.length} useful Chinese phrases today.`}
        </p>
        {wrongIds.length > 0 && (
          <p className="mt-1 text-sm text-muted">
            {wrongIds.length} to review — the review list is just below.
          </p>
        )}
        <button
          type="button"
          onClick={restart}
          className="mt-5 w-full rounded-xl bg-accent px-5 py-3 text-base font-medium text-white transition hover:opacity-90 active:scale-[0.98]"
        >
          Practice again
        </button>
        <Link
          href="/"
          className="mt-2 block w-full rounded-xl border border-line bg-card px-5 py-3 text-base font-medium text-ink transition hover:border-accent hover:text-accent active:scale-[0.98]"
        >
          Learn another category
        </Link>
      </section>
    );
  }

  const question = questions[index];
  const answered = selected !== null;
  const isCorrect = selected === question.answerId;

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <div className="mb-3 flex items-center justify-between text-sm text-muted">
        <span>
          Question {index + 1} of {questions.length}
        </span>
        <span>Score {score}</span>
      </div>

      <h3 className="text-lg font-medium text-ink">{question.prompt}</h3>

      <div className="mt-4 space-y-2">
        {question.options.map((option) => {
          let skin = "border-line bg-card text-ink hover:border-accent";
          if (answered) {
            if (option.id === question.answerId) {
              skin = "border-success bg-success-soft text-ink";
            } else if (option.id === selected) {
              skin = "border-danger bg-danger-soft text-ink";
            } else {
              skin = "border-line bg-card text-muted";
            }
          }

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => choose(option.id)}
              disabled={answered}
              className={`w-full rounded-xl border px-4 py-3 text-left text-base transition ${skin}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {answered && (
        <div
          className={`mt-4 rounded-xl px-4 py-3 text-sm ${
            isCorrect ? "bg-success-soft" : "bg-danger-soft"
          }`}
        >
          {isCorrect ? (
            <p className="font-medium text-success">✓ Correct!</p>
          ) : (
            <>
              <p className="font-medium text-danger">Not quite.</p>
              <p className="mt-1 text-muted">The answer is:</p>
            </>
          )}
          <p className="mt-1 text-base font-medium text-ink">
            {question.answer.chinese}
          </p>
          <p className="text-sm text-accent">{question.answer.pinyin}</p>
          <p className="text-sm text-muted">{question.answer.english}</p>
        </div>
      )}

      <button
        type="button"
        onClick={next}
        disabled={!answered}
        className="mt-4 w-full rounded-xl bg-ink px-5 py-3 text-base font-medium text-white transition hover:opacity-90 active:scale-[0.98] disabled:opacity-30"
      >
        {index + 1 >= questions.length ? "See result" : "Next →"}
      </button>
    </section>
  );
}
