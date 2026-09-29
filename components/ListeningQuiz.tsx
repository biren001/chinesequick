"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AudioButton from "@/components/AudioButton";
import { audioForPhrase } from "@/lib/audio";
import { PHRASES } from "@/lib/phrases";
import { phrasePath, phraseSlug } from "@/lib/slug";

/**
 * 听力小测：播一句真实音频（复用站点 105 条 mp3，零新音频），
 * 从 4 个英文意思里选对的那一个。答完展示汉字 + 拼音 + 单句页链接。
 *
 * 产物随机只发生在挂载之后（首帧渲染固定为「开始」卡），避免 SSR/CSR 不一致。
 * 最高连对记录存 localStorage（rlc-quizbest-v1），读取侧白名单消毒。
 */

type Phrase = (typeof PHRASES)[number];
type Question = { answer: Phrase; options: Phrase[] };

const BEST_KEY = "rlc-quizbest-v1";

function loadBest(): number {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    const n = Number(raw);
    // 只收 0–9999 的整数，其余一律当没有记录
    return Number.isInteger(n) && n >= 0 && n <= 9999 ? n : 0;
  } catch {
    return 0;
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuestion(prevId?: number): Question {
  const pool = PHRASES.filter((p) => p.id !== prevId);
  const answer = pool[Math.floor(Math.random() * pool.length)];
  // 干扰项优先取同分类（更接近真实混淆），不够再从全库补
  const sameCat = shuffle(
    PHRASES.filter((p) => p.category === answer.category && p.id !== answer.id)
  );
  const rest = shuffle(
    PHRASES.filter((p) => p.category !== answer.category && p.english !== answer.english)
  );
  const distractors = [...sameCat, ...rest]
    .filter((p) => p.english !== answer.english)
    .slice(0, 3);
  return { answer, options: shuffle([answer, ...distractors]) };
}

export default function ListeningQuiz() {
  const [question, setQuestion] = useState<Question | null>(null);
  const [chosen, setChosen] = useState<Phrase | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0, streak: 0 });
  const [best, setBest] = useState(0);

  useEffect(() => {
    setBest(loadBest());
  }, []);

  const start = useCallback(() => {
    setQuestion(buildQuestion());
    setChosen(null);
  }, []);

  const choose = useCallback(
    (p: Phrase) => {
      if (chosen || !question) return;
      setChosen(p);
      const correct = p.id === question.answer.id;
      setScore((s) => {
        const streak = correct ? s.streak + 1 : 0;
        setBest((b) => {
          if (streak > b) {
            setBestStreak(streak);
            return streak;
          }
          return b;
        });
        return {
          right: s.right + (correct ? 1 : 0),
          total: s.total + 1,
          streak,
        };
      });
    },
    [chosen, question]
  );

  const next = useCallback(() => {
    if (!question) return;
    setQuestion(buildQuestion(question.answer.id));
    setChosen(null);
  }, [question]);

  const setBestStreak = (n: number) => {
    try {
      localStorage.setItem(BEST_KEY, String(n));
    } catch {
      // 存不进去就不存，本次会话内仍然生效
    }
  };

  if (!question) {
    return (
      <div className="mt-6 rounded-2xl border border-line bg-card p-6 text-center">
        <p className="text-base leading-relaxed text-muted">
          {PHRASES.length} phrases, real audio, four choices each. Tap start,
          listen, and pick the meaning you heard.
        </p>
        <button
          type="button"
          onClick={start}
          className="mt-4 inline-block w-full rounded-xl bg-accent px-5 py-3 text-base font-medium text-white transition hover:opacity-90 active:scale-[0.98]"
        >
          Start the quiz
        </button>
      </div>
    );
  }

  const correct = chosen && chosen.id === question.answer.id;

  return (
    <div className="mt-6 rounded-2xl border border-line bg-card p-5">
      <p className="text-center text-sm text-muted" aria-live="polite">
        {score.total === 0
          ? `Question 1 — best streak: ${best}`
          : `${score.right} of ${score.total} correct · streak ${score.streak} · best ${best}`}
      </p>

      <div className="mt-4 flex flex-col items-center gap-2">
        <AudioButton
          text={question.answer.chinese}
          src={audioForPhrase(question.answer)}
          label="Play the phrase"
          variant="accent"
          className="px-6 py-3 text-base"
        />
        <p className="text-xs text-muted">Tap as many times as you need</p>
      </div>

      <ul className="mt-4 space-y-2">
        {question.options.map((p) => {
          const isAnswer = p.id === question.answer.id;
          const state = !chosen
            ? "border-line bg-white"
            : isAnswer
              ? "border-success bg-success-soft"
              : p.id === chosen.id
                ? "border-danger bg-danger-soft"
                : "border-line bg-white opacity-50";
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => choose(p)}
                disabled={Boolean(chosen)}
                className={`w-full rounded-xl border px-4 py-3 text-left text-base text-ink transition active:scale-[0.99] ${state}`}
              >
                {p.english}
              </button>
            </li>
          );
        })}
      </ul>

      {chosen && (
        <div className="mt-4 rounded-xl bg-paper px-4 py-3" aria-live="polite">
          <p className="text-sm font-medium text-ink">
            {correct ? "Correct!" : "It was:"} {question.answer.chinese}
            <span className="ml-2 text-muted">{question.answer.pinyin}</span>
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <Link
              href={phrasePath(phraseSlug(question.answer))}
              className="text-sm text-accent underline underline-offset-4"
            >
              Learn this phrase
            </Link>
            <button
              type="button"
              onClick={next}
              className="rounded-xl bg-accent px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 active:scale-[0.98]"
            >
              Next question
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
