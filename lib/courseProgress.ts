/**
 * 7 天课的进度：只记「哪几天已完成」，不做短语级打勾。
 *
 * 为什么按天而不是按短语：课程的承诺是"每天 15 条、20 分钟"，完成单位是"天"。
 * 短语级的掌握已经有 rlc-progress-v1（分类页的 ✓ + 测验）在管，两边职责别混。
 *
 * 读取侧消毒沿用 lib/progress.ts 的铁律：localStorage 形状不对在读取处挡掉，
 * 绝不让坏数据流到 render（那类 bug 的表现是整页白屏、只有部分用户能碰到）。
 */

const STORAGE_KEY = "rlc-course-v1";
export const COURSE_TOTAL_DAYS = 7;

export interface CourseProgress {
  version: 1;
  /** 已完成的"天"，1 起 */
  doneDays: number[];
}

export const EMPTY_COURSE_PROGRESS: CourseProgress = { version: 1, doneDays: [] };

function sanitizeDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const set = new Set<number>();
  for (const n of value) {
    if (typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= COURSE_TOTAL_DAYS) {
      set.add(n);
    }
  }
  return Array.from(set).sort((a, b) => a - b);
}

export function loadCourseProgress(): CourseProgress {
  if (typeof window === "undefined") return EMPTY_COURSE_PROGRESS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_COURSE_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<CourseProgress> & { version?: unknown };
    if (!parsed || parsed.version !== 1) return EMPTY_COURSE_PROGRESS;
    return { version: 1, doneDays: sanitizeDays(parsed.doneDays) };
  } catch {
    return EMPTY_COURSE_PROGRESS;
  }
}

export function saveCourseProgress(state: CourseProgress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, doneDays: sanitizeDays(state.doneDays) })
    );
  } catch {
    // 隐私模式下写入失败：静默降级，进度只是不记，不影响浏览
  }
}

/** 把某天标记为完成（幂等），返回新状态。 */
export function markDayDone(state: CourseProgress, day: number): CourseProgress {
  if (day < 1 || day > COURSE_TOTAL_DAYS) return state;
  if (state.doneDays.includes(day)) return state;
  return { version: 1, doneDays: sanitizeDays([...state.doneDays, day]) };
}

/**
 * 当前该学哪天：第一个没完成的天；全完成就回到 Day 1（复习循环）。
 * 这个定义让「继续」按钮永远是同一个语义：接着往下学。
 */
export function currentCourseDay(doneDays: number[]): number {
  for (let d = 1; d <= COURSE_TOTAL_DAYS; d++) {
    if (!doneDays.includes(d)) return d;
  }
  return 1;
}
