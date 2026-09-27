import type { CategoryId } from "./types";

const STORAGE_KEY = "rlc-progress-v1";

export interface QuizRecord {
  best: number;
  attempts: number;
}

export interface ProgressState {
  version: 1;
  /** 已掌握的短语 id */
  completedIds: number[];
  /** 每个分类的测验成绩 */
  quiz: Partial<Record<CategoryId, QuizRecord>>;
  /**
   * 每个分类「最近一次测验」做错的短语 id。
   * 刻意是整批替换而不是累积：错题代表的是「你现在的薄弱点」，
   * 复习做对了就该从列表里消失，否则错题本会越滚越长、没人愿意看。
   */
  mistakes: Partial<Record<CategoryId, number[]>>;
  /** 连续学习天数 */
  streak: number;
  /** 最近一次学习的日期，YYYY-MM-DD（本地时区） */
  lastActive: string | null;
}

export const EMPTY_PROGRESS: ProgressState = {
  version: 1,
  completedIds: [],
  quiz: {},
  mistakes: {},
  streak: 0,
  lastActive: null,
};

function today(): string {
  const d = new Date();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/**
 * 本地存储里的数据可能来自旧版本、来自别的项目占用了同名 key、或被人为/扩展改坏。
 * 任何一项形状不对都必须在「读」这一步就挡掉：等到 render 阶段才炸，
 * 表现就是整页白屏，而且只有那部分用户能碰到 —— 最难查的一类线上事故。
 */
function sanitizeIds(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((n): n is number => typeof n === "number") : [];
}

function sanitizeQuiz(value: unknown): Partial<Record<CategoryId, QuizRecord>> {
  if (!value || typeof value !== "object") return {};
  const out: Partial<Record<CategoryId, QuizRecord>> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as Partial<QuizRecord>;
    if (typeof rec.best !== "number" || typeof rec.attempts !== "number") continue;
    out[key as CategoryId] = { best: rec.best, attempts: rec.attempts };
  }
  return out;
}

function sanitizeMistakes(value: unknown): Partial<Record<CategoryId, number[]>> {
  if (!value || typeof value !== "object") return {};
  const out: Partial<Record<CategoryId, number[]>> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(raw)) continue;
    out[key as CategoryId] = sanitizeIds(raw);
  }
  return out;
}

export function loadProgress(): ProgressState {
  if (typeof window === "undefined") return EMPTY_PROGRESS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<ProgressState> & { version?: unknown };
    if (!parsed || parsed.version !== 1) return EMPTY_PROGRESS;
    return {
      ...EMPTY_PROGRESS,
      completedIds: sanitizeIds(parsed.completedIds),
      quiz: sanitizeQuiz(parsed.quiz),
      mistakes: sanitizeMistakes(parsed.mistakes),
      streak: typeof parsed.streak === "number" ? parsed.streak : 0,
      lastActive: typeof parsed.lastActive === "string" ? parsed.lastActive : null,
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function saveProgress(state: ProgressState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 隐私模式下写入失败：静默降级，不打断学习
  }
}

/** 标记 / 取消标记一条短语为已掌握。 */
export function toggleCompleted(state: ProgressState, phraseId: number): ProgressState {
  const set = new Set(state.completedIds);
  if (set.has(phraseId)) set.delete(phraseId);
  else set.add(phraseId);
  return { ...state, completedIds: Array.from(set) };
}

/** 记录一次测验成绩：只保留最高分；同时整批替换该分类的错题集。 */
export function recordQuiz(
  state: ProgressState,
  category: CategoryId,
  score: number,
  total: number,
  wrongIds: number[] = []
): ProgressState {
  const prev = state.quiz[category];
  const quiz = {
    ...state.quiz,
    [category]: {
      best: Math.max(prev?.best ?? 0, Math.round((score / total) * 100)),
      attempts: (prev?.attempts ?? 0) + 1,
    },
  };
  return {
    ...state,
    quiz,
    mistakes: { ...state.mistakes, [category]: wrongIds },
  };
}

/** 只更新错题集（复习模式用：不覆盖主测验的最高分）。 */
export function recordMistakes(
  state: ProgressState,
  category: CategoryId,
  wrongIds: number[]
): ProgressState {
  return { ...state, mistakes: { ...state.mistakes, [category]: wrongIds } };
}

/** 每次打开学习页调用一次：维护连续学习天数。 */
export function touchStreak(state: ProgressState): ProgressState {
  const todayStr = today();
  if (state.lastActive === todayStr) return state;

  let streak = 1;
  if (state.lastActive && daysBetween(state.lastActive, todayStr) === 1) {
    streak = state.streak + 1;
  }
  return { ...state, streak, lastActive: todayStr };
}
