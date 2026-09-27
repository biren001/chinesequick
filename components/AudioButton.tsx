"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { registerStopper, stopOthers } from "@/lib/audioBus";

interface AudioButtonProps {
  /** 要读的文本。有音频文件时仅用于无障碍标签；没有文件时作为实时合成的输入。 */
  text: string;
  /** 静态音频文件路径 —— 这是主路径，不依赖设备是否装了中文语音。 */
  src?: string | null;
  /** 没有文件、退回实时合成时的语速：1 = 正常，0.6 = 慢速。 */
  rate?: number;
  /** 省略则只显示图标（用于逐词表这类紧凑位置）。 */
  label?: string;
  variant?: "accent" | "plain" | "ghost";
  className?: string;
  /**
   * 一次点击自动连播几遍（默认 1 = 点一次播一遍）。
   *
   * 为什么要有它：学发音时最常做的动作是「同一个词听好几遍」，一次点击只出一遍
   * 就得反复点 —— 卡片上听 5 次要点 5 下。> 1 时按钮会显示 ×N，播放中显示进度，
   * 再点一下立刻中止；**不会无限循环**，不用怕忘了关。
   */
  repeats?: number;
}

/** 连播时两遍之间的喘息。太密会连成一片，太长会以为已经播完了。 */
const REPEAT_GAP = 650;
/** 一遍最多等多久 —— 网络卡住时不能让按钮永远停在「正在播放」。 */
const CLIP_TIMEOUT = 6000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function SpeakerIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <rect x="7" y="7" width="10" height="10" rx="1.6" />
    </svg>
  );
}

/**
 * 找一个真的存在的中文音色。
 *
 * 以前这里只判断 `"speechSynthesis" in window` —— 那只说明浏览器有这套 API，
 * 不代表设备装了中文语音。结果是：设备没有中文音色时按钮照样可点，点下去静默无声。
 * Safari/macOS 根本不列 zh-CN，Chrome/Windows 需要用户自己装语言包。
 */
function findChineseVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => /^zh[-_]?CN/i.test(v.lang)) ??
    voices.find((v) => /^zh/i.test(v.lang)) ??
    null
  );
}

export default function AudioButton({
  text,
  src = null,
  rate = 1,
  label,
  variant = "plain",
  className = "",
  repeats = 1,
}: AudioButtonProps) {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [voiceChecked, setVoiceChecked] = useState(false);
  const [playing, setPlaying] = useState(false);
  /** 当前播到第几遍（1 起），只在连播时有意义，用来在按钮上显示进度。 */
  const [pass, setPass] = useState(0);

  const elRef = useRef<HTMLAudioElement | null>(null);
  /** 每次启动 +1；连播循环里每一步都拿它跟自己那份比对，对不上就说明已被取消。 */
  const runRef = useRef(0);
  /**
   * 当前这一遍「怎么提前结束」。stop() 里直接调它 —— 比等 ended / 等超时更快，
   * 也避免 pause() 之后那个 promise 一直挂到 6 秒超时才被回收。
   */
  const pendingRef = useRef<(() => void) | null>(null);

  const total = Math.max(1, Math.floor(repeats));

  // 合成语音的可用性是异步出来的：Chrome/Safari 首次 getVoices() 都可能是空数组
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setVoiceChecked(true);
      return;
    }
    const sync = () => {
      setVoice(findChineseVoice());
      setVoiceChecked(true);
    };
    sync();
    window.speechSynthesis.addEventListener("voiceschanged", sync);
    const timer = window.setTimeout(sync, 1200);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", sync);
      window.clearTimeout(timer);
    };
  }, []);

  /** 实时合成一遍，播完（或报错、或超时）才 resolve。 */
  const speakOnce = useCallback(
    () =>
      new Promise<void>((resolve) => {
        if (typeof window === "undefined" || !("speechSynthesis" in window)) {
          resolve();
          return;
        }
        const synth = window.speechSynthesis;
        const utter = new SpeechSynthesisUtterance(text);
        if (voice) {
          utter.voice = voice;
          utter.lang = voice.lang;
        } else {
          utter.lang = "zh-CN";
        }
        utter.rate = rate;

        let settled = false;
        let timer = 0;
        function finish() {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          utter.removeEventListener("end", finish);
          utter.removeEventListener("error", finish);
          if (pendingRef.current === abort) pendingRef.current = null;
          resolve();
        }
        function abort() {
          finish();
        }
        timer = window.setTimeout(finish, CLIP_TIMEOUT);
        pendingRef.current = abort;
        utter.addEventListener("end", finish);
        utter.addEventListener("error", finish);
        synth.speak(utter);
      }),
    [text, rate, voice]
  );

  /** 放一遍静态音频，resolve(true) = 正常播完，resolve(false) = 放不出来（该退回合成）。 */
  const playClip = useCallback(
    (el: HTMLAudioElement, url: string) =>
      new Promise<boolean>((resolve) => {
        let settled = false;
        let timer = 0;
        function finish(ok: boolean) {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          el.removeEventListener("ended", onEnded);
          el.removeEventListener("error", onError);
          if (pendingRef.current === abort) pendingRef.current = null;
          resolve(ok);
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

        timer = window.setTimeout(abort, CLIP_TIMEOUT);
        pendingRef.current = abort;
        el.addEventListener("ended", onEnded);
        el.addEventListener("error", onError);
        el.src = url;
        /**
         * 必须手动回到开头。同一个元素连播时 src 没变，浏览器不会重新加载，
         * 而上一遍结束时 currentTime 就停在末尾 —— 直接 play() 会一秒播完或者干脆不响。
         * readyState 为 0 说明这次是真的换了源，加载完自然从 0 开始，不用插手。
         */
        if (el.readyState > 0) {
          try {
            el.currentTime = 0;
          } catch {
            // 元数据刚失效的瞬间会抛，忽略即可
          }
        }
        void el.play().catch(onError);
      }),
    []
  );

  const run = useCallback(
    async (from: number) => {
      const id = ++runRef.current;
      const el = elRef.current ?? (elRef.current = new Audio());
      el.preload = "auto";
      setPlaying(true);

      for (let n = from; n <= total; n++) {
        if (id !== runRef.current) return;
        setPass(n);

        if (src) {
          const ok = await playClip(el, src);
          /**
           * 关键：先查 id 再决定要不要退回合成。
           *
           * 主动 pause() 一个尚未 resolve 的 play() 会让它带着 AbortError 拒绝，
           * 而那一刻播放器已经交给别的按钮了 —— 若在这里退回 TTS，
           * 刚被停掉的那条会重新出声，按钮也卡在「正在播放」。
           * 这个 bug 只在真实网络下出现（本地 localhost 太快，play() 早就 resolve 了）。
           */
          if (id !== runRef.current) return;
          if (!ok && voice) await speakOnce();
        } else if (voice) {
          // 没有 mp3（变体、回话、逐词）—— 走浏览器实时合成
          await speakOnce();
        }

        if (id !== runRef.current) return;
        if (n < total) await sleep(REPEAT_GAP);
      }

      if (id !== runRef.current) return;
      setPlaying(false);
      setPass(0);
    },
    [total, src, voice, playClip, speakOnce]
  );

  const stop = useCallback(() => {
    runRef.current += 1;
    pendingRef.current?.();
    const el = elRef.current;
    if (el) {
      try {
        el.pause();
      } catch {
        // 元素还没加载完时 pause 可能抛错，忽略
      }
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setPlaying(false);
    setPass(0);
  }, []);

  // 全站同一时刻只让一个播放器出声：注册自己，并在开播前把别人停掉。
  // 只靠一个模块级的「当前元素」是不够的 —— 被 pause() 的那个按钮收不到 ended，
  // 状态会一直停在「正在播放」，页面上亮着一排停止图标。
  useEffect(() => registerStopper(stop), [stop]);

  // 组件自己被卸载（搜索结果换了一批、路由切走）时也要收声，否则卡片没了还在响。
  useEffect(
    () => () => {
      runRef.current += 1;
      pendingRef.current?.();
      const el = elRef.current;
      if (el) {
        try {
          el.pause();
        } catch {
          // 还没加载完就卸载，忽略
        }
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    },
    []
  );

  const play = useCallback(() => {
    if (playing) {
      stop();
      return;
    }

    stopOthers(stop);
    // 清掉可能在队列里排着的合成语音，否则连播时会和上一遍叠在一起
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    void run(1);
  }, [playing, run, stop]);

  // 有文件就一定可用；没文件时必须确认存在中文音色
  const usable = Boolean(src) || (voiceChecked && Boolean(voice));
  const disabled = !usable;

  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition active:scale-[0.98] disabled:opacity-40";
  const pad = label ? "px-3 py-2" : "p-2";
  const skin =
    variant === "accent"
      ? "bg-accent text-white hover:opacity-90"
      : variant === "ghost"
        ? "text-muted hover:text-accent"
        : "border border-line bg-card text-ink hover:border-accent hover:text-accent";
  const ring = playing ? " ring-2 ring-accent/30" : "";

  const title = disabled
    ? "Audio files unavailable and this device has no Chinese voice"
    : playing
      ? "Stop"
      : total > 1
        ? `${label ?? "Play"} — plays ${total} times, tap again to stop`
        : (label ?? `Play ${text}`);

  return (
    <button
      type="button"
      onClick={play}
      disabled={disabled}
      aria-label={label ?? `Play ${text}`}
      aria-pressed={playing}
      title={title}
      className={`${base} ${pad} ${skin}${ring} ${className}`}
    >
      {playing ? <StopIcon /> : <SpeakerIcon />}
      {/*
        播放中把可见文字换成 Stop。图标变方块对看惯了的人够了，但「点了会停还是接着播」
        必须一眼能看懂 —— 连播三遍时用户随时可能想中止。
        aria-label 刻意不动（保持 "Listen"）：_dev/verify-saved.js 等脚本按它找按钮。
      */}
      {label ? (playing ? "Stop" : label) : null}
      {total > 1 && (
        <span
          aria-hidden="true"
          className="text-[10px] leading-none font-semibold tabular-nums opacity-70"
        >
          {playing ? `${pass}/${total}` : `×${total}`}
        </span>
      )}
    </button>
  );
}
