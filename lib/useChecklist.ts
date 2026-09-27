"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  getChecklistServerSnapshot,
  getChecklistSnapshot,
  resetChecklist,
  subscribeChecklist,
  toggleChecklistItem,
} from "./checklist";

/**
 * 行前清单状态的唯一入口。与 useSaved 同一套做法：
 * useSyncExternalStore + 服务端空快照，hydration 干净、跨组件共享。
 */
export function useChecklist() {
  const done = useSyncExternalStore(
    subscribeChecklist,
    getChecklistSnapshot,
    getChecklistServerSnapshot
  );

  const toggle = useCallback((id: string) => {
    toggleChecklistItem(id);
  }, []);

  const reset = useCallback(() => {
    resetChecklist();
  }, []);

  const isDone = useCallback((id: string) => done.includes(id), [done]);

  return { done, count: done.length, toggle, reset, isDone };
}
