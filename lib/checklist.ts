/**
 * 行前清单的勾选状态 —— 和收藏一样：纯本地、零后端、零账号。
 *
 * 存的是「已勾选的 item id」，不是整份清单内容：内容和状态分开，
 * 以后改文案、加项目都不会让老用户的进度错位。
 *
 * 读取处顺手做形状校验 + 过滤掉不认识的 id（内容删过项之后，
 * 老用户的 localStorage 里会留下孤儿 id，不能让它漏到渲染阶段）。
 */
import { CHECKLIST_ITEMS } from "./checklistItems";

const STORAGE_KEY = "rlc-checklist-v1";

const KNOWN = new Set(CHECKLIST_ITEMS.map((i) => i.id));

/** SSR / hydration 阶段用的恒定空快照。必须是稳定引用，否则会无限重渲染。 */
const SERVER_SNAPSHOT: readonly string[] = Object.freeze([]);

let snapshot: readonly string[] = SERVER_SNAPSHOT;
let hydrated = false;
let storageBound = false;
const listeners = new Set<() => void>();

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { version?: number; done?: unknown };
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.done)) return [];
    return parsed.done.filter((s): s is string => typeof s === "string" && KNOWN.has(s));
  } catch {
    // 隐私模式 / 数据损坏：当成空进度，绝不抛错打断浏览
    return [];
  }
}

function write(done: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, done }));
  } catch {
    // 写不进去就只在内存里生效，功能不崩
  }
}

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  snapshot = read();
}

/** 另一个标签页勾了清单时同步过来。 */
function bindStorage(): void {
  if (storageBound || typeof window === "undefined") return;
  storageBound = true;
  window.addEventListener("storage", (event) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    snapshot = read();
    listeners.forEach((l) => l());
  });
}

export function getChecklistSnapshot(): readonly string[] {
  hydrate();
  return snapshot;
}

export function getChecklistServerSnapshot(): readonly string[] {
  return SERVER_SNAPSHOT;
}

export function subscribeChecklist(listener: () => void): () => void {
  hydrate();
  bindStorage();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 勾选 / 取消一项，返回新的已完成列表。 */
export function toggleChecklistItem(id: string): readonly string[] {
  hydrate();
  const set = new Set(snapshot);
  if (set.has(id)) set.delete(id);
  else set.add(id);
  const next = Array.from(set).sort();
  snapshot = next;
  write(next);
  listeners.forEach((l) => l());
  return next;
}

/** 全部清空（「Start over」按钮）。 */
export function resetChecklist(): readonly string[] {
  hydrate();
  snapshot = [];
  write([]);
  listeners.forEach((l) => l());
  return snapshot;
}
