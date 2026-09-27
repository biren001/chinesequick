/**
 * 收藏（♡ Save）—— 纯本地、零后端。
 *
 * 和「Got it」是两件事：
 *   Got it  = 我学会了（学习进度）
 *   Save    = 我待会要用（个人工具箱）
 * 旅行者的真实需求是后者，所以两者分开存，互不影响。
 *
 * 实现为一个模块级外部 store + useSyncExternalStore：
 * 同一页面上任意多个爱心按钮共享同一份快照，从 /saved/ 页移除后列表立刻更新，
 * 不需要把状态一层层往下传 props。
 */

const STORAGE_KEY = "rlc-saved-v1";

/** SSR / hydration 阶段用的恒定空快照。必须是稳定引用，否则会无限重渲染。 */
const SERVER_SNAPSHOT: readonly number[] = Object.freeze([]);

let snapshot: readonly number[] = SERVER_SNAPSHOT;
let hydrated = false;
let storageBound = false;
const listeners = new Set<() => void>();

function read(): number[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { version?: number; ids?: unknown };
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.ids)) return [];
    return parsed.ids.filter((n): n is number => typeof n === "number");
  } catch {
    // 隐私模式 / 数据损坏：当成空收藏，绝不抛错打断浏览
    return [];
  }
}

function write(ids: number[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ids }));
  } catch {
    // 写不进去就只在内存里生效，功能不崩
  }
}

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  snapshot = read();
}

/** 另一个标签页改了收藏时同步过来。 */
function bindStorage(): void {
  if (storageBound || typeof window === "undefined") return;
  storageBound = true;
  window.addEventListener("storage", (event) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    snapshot = read();
    listeners.forEach((l) => l());
  });
}

export function getSavedSnapshot(): readonly number[] {
  hydrate();
  return snapshot;
}

export function getSavedServerSnapshot(): readonly number[] {
  return SERVER_SNAPSHOT;
}

export function subscribeSaved(listener: () => void): () => void {
  hydrate();
  bindStorage();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 切换收藏状态，返回新的收藏列表（按 id 排序，保证顺序稳定）。 */
export function toggleSaved(id: number): readonly number[] {
  hydrate();
  const set = new Set(snapshot);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  const next = Array.from(set).sort((a, b) => a - b);
  snapshot = next;
  write(next);
  listeners.forEach((l) => l());
  return next;
}
