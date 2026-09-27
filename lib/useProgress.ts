"use client";

import { useCallback, useEffect, useState } from "react";
import {
  EMPTY_PROGRESS,
  loadProgress,
  recordMistakes,
  recordQuiz,
  saveProgress,
  toggleCompleted,
  touchStreak,
  type ProgressState,
} from "./progress";
import type { CategoryId } from "./types";

/**
 * 唯一的学习进度入口。
 * 首渲染返回空进度（避免 SSR / 客户端不一致），挂载后再从本地存储读取。
 */
export function useProgress() {
  const [progress, setProgress] = useState<ProgressState>(EMPTY_PROGRESS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const next = touchStreak(loadProgress());
    if (next !== null) {
      setProgress(next);
      if (next.lastActive !== null) saveProgress(next);
    }
    setLoaded(true);
  }, []);

  const update = useCallback((fn: (s: ProgressState) => ProgressState) => {
    setProgress((prev) => {
      const next = fn(prev);
      saveProgress(next);
      return next;
    });
  }, []);

  const togglePhrase = useCallback(
    (phraseId: number) => update((s) => toggleCompleted(s, phraseId)),
    [update]
  );

  const saveQuizScore = useCallback(
    (category: CategoryId, score: number, total: number, wrongIds: number[] = []) =>
      update((s) => recordQuiz(s, category, score, total, wrongIds)),
    [update]
  );

  const saveMistakes = useCallback(
    (category: CategoryId, wrongIds: number[]) =>
      update((s) => recordMistakes(s, category, wrongIds)),
    [update]
  );

  const isCompleted = useCallback(
    (phraseId: number) => progress.completedIds.includes(phraseId),
    [progress.completedIds]
  );

  return { progress, loaded, togglePhrase, saveQuizScore, saveMistakes, isCompleted };
}
