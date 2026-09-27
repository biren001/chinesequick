"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  getSavedServerSnapshot,
  getSavedSnapshot,
  subscribeSaved,
  toggleSaved,
} from "./saved";

/**
 * 收藏的唯一入口。
 *
 * 用 useSyncExternalStore 而不是 useState + useEffect：
 * 同页多个爱心按钮共享同一份快照，点任一个其余立刻跟着变；
 * hydration 阶段用服务端快照（空），挂载后自动切到本地真实数据，不会有 mismatch 警告。
 */
export function useSaved() {
  const savedIds = useSyncExternalStore(
    subscribeSaved,
    getSavedSnapshot,
    getSavedServerSnapshot
  );

  const toggle = useCallback((id: number) => {
    toggleSaved(id);
  }, []);

  const isSaved = useCallback((id: number) => savedIds.includes(id), [savedIds]);

  return { savedIds, count: savedIds.length, toggle, isSaved };
}
