"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { audioForPhrase } from "@/lib/audio";
import { registerStopper, stopOthers } from "@/lib/audioBus";
import { EVENTS, track } from "@/lib/analytics";
import type { Phrase } from "@/lib/types";

type Mode = "zh" | "zh-en" | "repeat";

const MODES: { id: Mode; label: string }[] = [
  { id: "zh", label: "Chinese only" },
  { id: "zh-en", label: "Chinese + English" },
  { id: "repeat", label: "Repeat after me" },
];

const HINT: Record<Mode, string> = {
  zh: "Back-to-back Chinese — good once the phrases are familiar.",
  "zh-en": "Hear the Chinese, then read the meaning before the next one starts.",
  repeat:
    "Hear it once, say it out loud in the gap, hear it again, then on to the next.",
};

/**
 * 两句之间留多久。音频本身只有 0.6–0.9 秒（生成时做过去静音 + 响度归一），
 * 连播的节奏完全靠这里的间隔撑起来 —— 别往小改。
 */
const GAP: Record<Mode, number> = { zh: 1100, "zh-en": 2600, repeat: 2800 };
const REPEAT_TAIL = 700;
/** 单条音频最多等多久。网络卡住时不能让整条流水线永远停在那一句上。 */
const CLIP_TIMEOUT = 6000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface PlayAllProps {
  phrases: Phrase[];
  /** 卡片标题，默认「Listen to all N」 */
  title?: string;
  className?: string;
}

/**
 * 连续朗读：把一组短语按顺序自动播下去。
 *
 * 单句的 Listen / Slow 解决「这句怎么说」，连播解决「这组话过一遍」——
 * 后者才是真的在路上会用的形态（开车、排队、飞机上）。
 */
export default function PlayAll({ phrases, title, className = "" }: PlayAllProps) {
  const [mode, setMode] = useState<Mode>("zh");
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(-1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** 每次启动 +1；循环里每一步都拿它跟自己那份比对，对不上就说明已被取消。 */
  const runRef = useRef(0);
  const modeRef = useRef<Mode>(mode);
  modeRef.current = mode;

  const playClip = useCallback(
    (el: HTMLAudioElement, src: string) =>
      new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          el.removeEventListener("ended", finish);
          el.removeEventListener("error", finish);
          resolve();
        };
        const timer = window.setTimeout(finish, CLIP_TIMEOUT);
        el.addEventListener("ended", finish, { once: true });
        el.addEventListener("error", finish, { once: true });
        el.src = src;
        void el.play().catch(finish);
      }),
    []
  );

  const run = useCallback(
    async (from: number) => {
      const el = audioRef.current ?? (audioRef.current = new Audio());
      el.preload = "auto";
      const id = ++runRef.current;
      setPlaying(true);
      track(EVENTS.playAllStarted, {
        count: phrases.length,
        mode: modeRef.current,
        from,
      });

      for (let i = from; i < phrases.length; i++) {
        if (id !== runRef.current) return;
        const src = audioForPhrase(phrases[i]);
        if (!src) continue; // 没有音频文件就跳过，别把整条流水线卡住
        setIndex(i);
        await playClip(el, src);
        if (id !== runRef.current) return;

        if (modeRef.current === "repeat") {
          await sleep(GAP.repeat);
          if (id !== runRef.current) return;
          await playClip(el, src);
          if (id !== runRef.current) return;
          await sleep(REPEAT_TAIL);
        } else {
          await sleep(GAP[modeRef.current]);
        }
      }

      if (id !== runRef.current) return;
      setPlaying(false);
      setIndex(-1);
    },
    [phrases, playClip]
  );

  const stop = useCallback(() => {
    runRef.current += 1;
    const el = audioRef.current;
    if (el) {
      try {
        el.pause();
      } catch {
        // 元素还没加载完时 pause 可能抛错，忽略
      }
    }
    setPlaying(false);
    setIndex(-1);
  }, []);

  // 与单句播放器互斥：谁先播谁独占，另一个自动停
  useEffect(() => registerStopper(stop), [stop]);
  // 离开页面时必须停：否则用户翻到别的页面还在响
  useEffect(() => {
    return () => stop();
  }, [stop]);

  function chooseMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    modeRef.current = next;
    // 播放中切模式：从当前这句按新节奏重来，不打断「听到哪儿了」
    if (playing) void run(index >= 0 ? index : 0);
  }

  function toggle() {
    if (playing) {
      stop();
      return;
    }
    stopOthers(stop);
    void run(0);
  }

  const current = index >= 0 ? phrases[index] : null;

  return (
    <section className={`rounded-2xl border border-line bg-card p-5 ${className}`}>
      <h2 className="text-base font-medium text-ink">
        <span aria-hidden="true">🔊</span> {title ?? `Listen to all ${phrases.length}`}
      </h2>
      <p className="mt-1 text-sm text-muted">
        Hands-free playback — good for a taxi, a queue, or the plane.
      </p>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Playback mode">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => chooseMode(m.id)}
            aria-pressed={mode === m.id}
            className={`rounded-xl border px-3 py-2 text-sm font-medium transition active:scale-[0.98] ${
              mode === m.id
                ? "border-accent bg-accent-soft text-accent"
                : "border-line bg-card text-ink hover:border-accent hover:text-accent"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">{HINT[mode]}</p>

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Stop playback" : `Play all ${phrases.length} phrases`}
        aria-pressed={playing}
        className="mt-4 w-full rounded-xl bg-accent px-5 py-3 text-base font-medium text-white transition hover:opacity-90 active:scale-[0.98]"
      >
        {playing ? `■ Stop (${index + 1}/${phrases.length})` : `▶ Play all ${phrases.length}`}
      </button>

      {current && (
        <div className="mt-4 rounded-xl border border-line bg-paper p-4">
          <p className="text-xs text-muted">
            Now playing · {index + 1} / {phrases.length}
          </p>
          <p className="mt-2 text-xl leading-snug font-medium text-ink">{current.chinese}</p>
          <p className="text-sm text-accent">{current.pinyin}</p>
          <p className="mt-1 text-sm text-muted">{current.english}</p>
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${((index + 1) / phrases.length) * 100}%` }}
            />
          </div>
        </div>
      )}
    </section>
  );
}
