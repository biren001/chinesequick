"use client";

import { useCallback, useEffect, useState } from "react";
import AudioButton from "@/components/AudioButton";
import { audioForNumber } from "@/lib/audio";
import { NUMBERS, type NumberItem } from "@/lib/numbers";

/**
 * 数字听力小测：播一个数字/钱数词的真实音频（复用 chinese-numbers 的 24 条 mp3，
 * 零新音频），从 4 个「汉字 + 拼音」里选出听到的那一个。
 *
 * 与短语听力小测的分工：那边练「音 → 意思」，这边练「音 → 音」——
 * sì/shí、èr/liǎng、bǎi/qiān/wàn 这类声调与音节近似对，是讲价时听错价的根因。
 * 干扰项优先取同易混组，其次同 section。
 *
 * 产物随机只发生在挂载之后（首帧渲染固定为「开始」卡），避免 SSR/CSR 不一致。
 * 最高连对记录存 localStorage（rlc-numquizbest-v1），读取侧白名单消毒。
 */

type Question = { answer: NumberItem; options: NumberItem[] };

const BEST_KEY = "rlc-numquizbest-v1";

/** 声调/音节易混组：答案的干扰项优先从这里出。 */
const CONFUSABLE_GROUPS: string[][] = [
  ["四", "十", "七", "一"],
  ["二", "两"],
  ["十一", "十", "四"],
  ["一百", "一千", "一万"],
  ["块", "元", "角", "分"],
  ["零", "六"],
  ["半", "万"],
];

function loadBest(): number {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    const n = Number(raw);
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

function confusablesOf(zh: string): string[] {
  const out = new Set<string>();
  for (const g of CONFUSABLE_GROUPS) {
    if (g.includes(zh)) for (const z of g) out.add(z);
  }
  out.delete(zh);
  return Array.from(out);
}

function buildQuestion(prevZh?: string): Question {
  const pool = NUMBERS.filter((n) => n.zh !== prevZh);
  const answer = pool[Math.floor(Math.random() * pool.length)];
  const byZh = new Map(NUMBERS.map((n) => [n.zh, n]));
  // 1) 易混组 → 2) 同 section → 3) 全库，逐级补够 3 个
  const tiers: NumberItem[][] = [
    shuffle(
      confusablesOf(answer.zh)
        .map((z) => byZh.get(z))
        .filter((n): n is NumberItem => Boolean(n))
    ),
    shuffle(NUMBERS.filter((n) => n.section === answer.section && n.zh !== answer.zh)),
    shuffle(NUMBERS.filter((n) => n.zh !== answer.zh)),
  ];
  const picked: NumberItem[] = [];
  const seen = new Set<string>([answer.zh]);
  for (const tier of tiers) {
    for (const n of tier) {
      if (picked.length >= 3) break;
      if (seen.has(n.zh) || n.py === answer.py) continue;
      picked.push(n);
      seen.add(n.zh);
    }
    if (picked.length >= 3) break;
  }
  return { answer, options: shuffle([answer, ...picked]) };
}

export default function NumberQuiz() {
  const [question, setQuestion] = useState<Question | null>(null);
  const [chosen, setChosen] = useState<NumberItem | null>(null);
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
    (n: NumberItem) => {
      if (chosen || !question) return;
      setChosen(n);
      const correct = n.zh === question.answer.zh;
      setScore((s) => {
        const streak = correct ? s.streak + 1 : 0;
        setBest((b) => {
          if (streak > b) {
            try {
              localStorage.setItem(BEST_KEY, String(streak));
            } catch {
              // 存不进去就不存，本次会话内仍然生效
            }
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
    setQuestion(buildQuestion(question.answer.zh));
    setChosen(null);
  }, [question]);

  if (!question) {
    return (
      <div className="mt-6 rounded-2xl border border-line bg-card p-6 text-center">
        <p className="text-base leading-relaxed text-muted">
          24 number sounds, real audio, four choices each. Tap start, listen,
          and pick the number you heard — 四 and 十 included.
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

  const correct = chosen && chosen.zh === question.answer.zh;

  return (
    <div className="mt-6 rounded-2xl border border-line bg-card p-5">
      <p className="text-center text-sm text-muted" aria-live="polite">
        {score.total === 0
          ? `Question 1 — best streak: ${best}`
          : `${score.right} of ${score.total} correct · streak ${score.streak} · best ${best}`}
      </p>

      <div className="mt-4 flex flex-col items-center gap-2">
        <AudioButton
          text={question.answer.zh}
          src={audioForNumber(question.answer.zh)}
          label="Play the number"
          variant="accent"
          className="px-6 py-3 text-base"
        />
        <p className="text-xs text-muted">Tap as many times as you need</p>
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-2">
        {question.options.map((n) => {
          const isAnswer = n.zh === question.answer.zh;
          const state = !chosen
            ? "border-line bg-white"
            : isAnswer
              ? "border-success bg-success-soft"
              : n.zh === chosen.zh
                ? "border-danger bg-danger-soft"
                : "border-line bg-white opacity-50";
          return (
            <li key={n.zh}>
              <button
                type="button"
                onClick={() => choose(n)}
                disabled={Boolean(chosen)}
                className={`w-full rounded-xl border px-3 py-3 text-center transition active:scale-[0.99] ${state}`}
              >
                <span className="block text-2xl leading-tight font-medium text-ink">
                  {n.zh}
                </span>
                <span className="mt-0.5 block text-xs text-accent">{n.py}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {chosen && (
        <div className="mt-4 rounded-xl bg-paper px-4 py-3" aria-live="polite">
          <p className="text-sm font-medium text-ink">
            {correct ? "Correct!" : "It was:"} {question.answer.zh}
            <span className="ml-2 text-muted">{question.answer.py}</span>
            <span className="ml-2 text-muted">— {question.answer.en}</span>
          </p>
          <div className="mt-2 flex items-center justify-end gap-3">
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
