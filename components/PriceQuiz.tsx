"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { registerStopper, stopOthers } from "@/lib/audioBus";
import { audioForNumber } from "@/lib/audio";
import { NUMBERS, type NumberItem } from "@/lib/numbers";

/**
 * 价格听力小测：播一条「整句报价」——把数字表的词音频按顺序连起来
 * （三十五块五 = sān + shí + wǔ + kuài + wǔ + jiǎo），零新音频。
 *
 * 与数字小测的分工：那边练「单音 → 音」（sì/shí 逐个辨），这边练
 * 「一串音 → 钱数」——卖家回 多少钱 的时候给的就是一串，不会替你拆开。
 *
 * 报价范围刻意控制在 ¥1–¥99（可带五角）：一百以上要用「三百五」这类
 * 「百位 + 省略说法」，数字表里只有 yībǎi 没有单独的 bǎi，组合不出来，
 * 宁可不出也不放半真的音频序列。
 *
 * 产物随机只发生在挂载之后（首帧渲染固定为「开始」卡），避免 SSR/CSR 不一致。
 * 最高连对记录存 localStorage（rlc-pricequizbest-v1），读取侧白名单消毒。
 */

const BEST_KEY = "rlc-pricequizbest-v1";
/** 序列里两个词之间的间隔：太密会粘成一个音节，太长会失去「一句话」的感觉。 */
const CLIP_GAP = 320;
/** 单个词音频最多等多久（网络卡住时不能永远停在「正在播放」）。 */
const CLIP_TIMEOUT = 6000;

type Price = {
  /** 整数部分（块），1–99 */
  int: number;
  /** 是否带五角 */
  jiao: boolean;
  /** 音频序列：数字表里的 zh 词，按口语顺序 */
  parts: string[];
  /** 展示用：¥35.50 */
  num: string;
  /** 汉字：三十五块五 */
  zh: string;
  /** 拼音：sān shí wǔ kuài wǔ jiǎo */
  py: string;
};

/** 数字表的 zh → 词条映射（拿 py 和音频路径）。 */
const BY_ZH = new Map<string, NumberItem>(NUMBERS.map((n) => [n.zh, n]));

const DIGITS = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

/**
 * 1–99 的整数部分拆成数字表里的词。
 * 口语规则：10 = 十（不是一十）；11–19 = 十+X；单独的 2 = 两（两块，
 * 不是二块）；20 = 二十；21–99 = 十位+十+个位。
 */
function intParts(n: number): string[] {
  if (n < 1 || n > 99) throw new Error("price int out of range: " + n);
  if (n === 10) return ["十"];
  if (n === 2) return ["两"];
  if (n < 10) return [DIGITS[n - 1]];
  if (n < 20) return ["十", DIGITS[n - 11]];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  const parts = [DIGITS[tens - 1], "十"];
  if (ones > 0) parts.push(DIGITS[ones - 1]);
  return parts;
}

function buildPrice(int: number, jiao: boolean): Price {
  const parts = [...intParts(int), "块"];
  if (jiao) parts.push("五", "角");
  // 显示格式：.5 的报价就是 X.5，不是 X.50 —— 和 sellers 口里的一致
  const num = jiao ? `${int}.5` : `${int}`;
  const zh = parts.join("");
  const py = parts.map((w) => BY_ZH.get(w)?.py ?? w).join(" ");
  return { int, jiao, parts, num, zh, py };
}

function randomPrice(prev?: Price): Price {
  for (let i = 0; i < 50; i++) {
    const int = 1 + Math.floor(Math.random() * 99);
    const jiao = Math.random() < 0.4;
    if (prev && prev.int === int && prev.jiao === jiao) continue;
    return buildPrice(int, jiao);
  }
  return buildPrice(prev && prev.int < 99 ? prev.int + 1 : 42, false);
}

/**
 * 干扰项：从「真实会听错的维度」里变换——十位/个位互换（35↔53）、
 * 三↔四（sān/sì，声调近）、加/去五角（35↔35.5）、±1。
 * 每个干扰项都走同一个 buildPrice，保证汉字、拼音、音频序列全部真实自洽。
 */
function distractorsOf(answer: Price): Price[] {
  const out: Price[] = [];
  const seen = new Set<string>([answer.zh]);
  const push = (int: number, jiao: boolean) => {
    if (int < 1 || int > 99) return;
    const p = buildPrice(int, jiao);
    if (seen.has(p.zh)) return;
    seen.add(p.zh);
    out.push(p);
  };

  const { int, jiao } = answer;
  const tens = Math.floor(int / 10);
  const ones = int % 10;
  // 1) 十位个位互换（两位数才有效；25 互换后 52 同样合法）
  if (int >= 10 && ones > 0 && tens !== ones) push(ones * 10 + tens, jiao);
  // 2) 近音换位：三↔四（sān/sì 只差声调）、一↔二、一↔七（yī/qī）
  const swap = (n: number) => (n === 3 ? 4 : n === 4 ? 3 : n === 1 ? 2 : n === 2 ? 1 : n === 7 ? 1 : n);
  if (int >= 10) push(swap(tens) * 10 + ones, jiao);
  if (ones > 0) push(tens * 10 + swap(ones), jiao);
  // 3) 加/去五角
  push(int, !jiao);
  // 4) ±1（1 和 99 边界会被 push 的范围 guard 挡掉）
  push(int + 1, jiao);
  push(int - 1, jiao);
  // 5) 兜底随机
  let guard = 0;
  while (out.length < 3 && guard++ < 30) {
    const r = randomPrice(answer);
    if (!seen.has(r.zh)) {
      seen.add(r.zh);
      out.push(r);
    }
  }
  return out.slice(0, 3);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function loadBest(): number {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 && n <= 9999 ? n : 0;
  } catch {
    return 0;
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function PriceQuiz() {
  const [question, setQuestion] = useState<{ answer: Price; options: Price[] } | null>(null);
  const [chosen, setChosen] = useState<Price | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0, streak: 0 });
  const [best, setBest] = useState(0);
  const [playing, setPlaying] = useState(false);

  const elRef = useRef<HTMLAudioElement | null>(null);
  const runRef = useRef(0);
  const pendingRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setBest(loadBest());
  }, []);

  const stop = useCallback(() => {
    runRef.current += 1;
    pendingRef.current?.();
    const el = elRef.current;
    if (el) {
      try {
        el.pause();
      } catch {
        // 还没加载完时 pause 可能抛错，忽略
      }
    }
    setPlaying(false);
  }, []);

  /** 序列播放：数字表的词音频按口语顺序连成一句报价。 */
  const playSeq = useCallback(async (parts: string[]) => {
    const id = ++runRef.current;
    stopOthers(stop);
    const el = elRef.current ?? (elRef.current = new Audio());
    el.preload = "auto";
    setPlaying(true);

    for (const [i, word] of parts.entries()) {
      if (id !== runRef.current) return;
      const src = audioForNumber(word);
      if (!src) continue; // 缺词就跳过，不让整句哑掉
      const ok = await new Promise<boolean>((resolve) => {
        let settled = false;
        const timer = window.setTimeout(() => finish(false), CLIP_TIMEOUT);
        function finish(v: boolean) {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          el.removeEventListener("ended", onEnded);
          el.removeEventListener("error", onError);
          if (pendingRef.current === abort) pendingRef.current = null;
          resolve(v);
        }
        function onEnded() {
          finish(true);
        }
        function onError() {
          finish(false);
        }
        function abort() {
          finish(false);
        }
        pendingRef.current = abort;
        el.addEventListener("ended", onEnded);
        el.addEventListener("error", onError);
        el.src = src;
        if (el.readyState > 0) {
          try {
            el.currentTime = 0;
          } catch {
            // 换源瞬间元数据失效会抛，忽略
          }
        }
        void el.play().catch(onError);
      });
      if (id !== runRef.current) return;
      void ok; // 单词播不出来不中断整句：下一遍点播放还能再试
      if (i < parts.length - 1) await sleep(CLIP_GAP);
    }

    if (id !== runRef.current) return;
    setPlaying(false);
  }, [stop]);

  useEffect(() => registerStopper(stop), [stop]);
  useEffect(
    () => () => {
      runRef.current += 1;
      pendingRef.current?.();
      const el = elRef.current;
      if (el) {
        try {
          el.pause();
        } catch {
          // 卸载时忽略
        }
      }
    },
    []
  );

  const start = useCallback(() => {
    const answer = randomPrice();
    setQuestion({ answer, options: shuffle([answer, ...distractorsOf(answer)]) });
    setChosen(null);
    void playSeq(answer.parts);
  }, [playSeq]);

  const choose = useCallback(
    (p: Price) => {
      if (chosen || !question) return;
      setChosen(p);
      const correct = p.zh === question.answer.zh;
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
        return { right: s.right + (correct ? 1 : 0), total: s.total + 1, streak };
      });
    },
    [chosen, question]
  );

  const next = useCallback(() => {
    if (!question) return;
    const answer = randomPrice(question.answer);
    setQuestion({ answer, options: shuffle([answer, ...distractorsOf(answer)]) });
    setChosen(null);
    void playSeq(answer.parts);
  }, [question, playSeq]);

  if (!question) {
    return (
      <div className="mt-6 rounded-2xl border border-line bg-card p-6 text-center">
        <p className="text-base leading-relaxed text-muted">
          Real prices, spoken the way sellers say them — all the words from one
          to ninety-nine with 块 and 角, played back to back. Hear the price,
          pick what you heard.
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
        <button
          type="button"
          onClick={() => (playing ? stop() : playSeq(question.answer.parts))}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-base font-medium text-white transition hover:opacity-90 active:scale-[0.98]"
          aria-pressed={playing}
        >
          {playing ? "Stop" : "▶ Play the price"}
        </button>
        <p className="text-xs text-muted">Tap as many times as you need</p>
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-2">
        {question.options.map((p) => {
          const isAnswer = p.zh === question.answer.zh;
          const state = !chosen
            ? "border-line bg-white"
            : isAnswer
              ? "border-success bg-success-soft"
              : p.zh === chosen.zh
                ? "border-danger bg-danger-soft"
                : "border-line bg-white opacity-50";
          return (
            <li key={p.zh}>
              <button
                type="button"
                onClick={() => choose(p)}
                disabled={Boolean(chosen)}
                className={`w-full rounded-xl border px-3 py-3 text-center transition active:scale-[0.99] ${state}`}
              >
                <span className="block text-xl leading-tight font-medium tabular-nums text-ink">
                  ¥{p.num}
                </span>
                <span className="mt-0.5 block text-sm text-ink">{p.zh}</span>
                <span className="mt-0.5 block text-xs text-accent">{p.py}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {chosen && (
        <div className="mt-4 rounded-xl bg-paper px-4 py-3" aria-live="polite">
          <p className="text-sm font-medium text-ink">
            {correct ? "Correct!" : "It was:"} ¥{question.answer.num}
            <span className="ml-2">{question.answer.zh}</span>
            <span className="ml-2 text-muted">{question.answer.py}</span>
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
