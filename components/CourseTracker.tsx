"use client";

import { useEffect, useState } from "react";
import {
  COURSE_TOTAL_DAYS,
  currentCourseDay,
  loadCourseProgress,
  markDayDone,
  saveCourseProgress,
} from "@/lib/courseProgress";

/**
 * 课程的三个本地进度交互（全部 SSR 渲染为 null，挂载后才有内容 → 无 hydration 风险）：
 *
 *  - CourseResume：顶部「继续学」卡片。解决"第二天回来要从头翻"的主诉 ——
 *    进度存 localStorage（rlc-course-v1），浏览器被系统回收、重开、换浏览器都还在。
 *  - CourseDayNav：Day 1–7 快捷跳转。点一下展开并滚到那天，不用手划长页。
 *  - DayOpener / MarkDayDone：挂在天面板内部。挂载时把「当前该学的那天」自动展开；
 *    学完点「完成」写入进度并自动展开下一天。
 *
 * 数据不在这里 import（lib/course 会把 105 条短语 + 深化内容拽进客户端包），
 * 需要的标题全部由服务端组件用 props 传进来。
 */

function openDayPanel(day: number): boolean {
  const el = document.getElementById(`course-day-${day}`);
  if (el instanceof HTMLDetailsElement) {
    el.open = true;
    return true;
  }
  return false;
}

function scrollToDay(day: number): void {
  const el = document.getElementById(`course-day-${day}`);
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function CourseResume({ titles }: { titles: string[] }) {
  const [day, setDay] = useState<number | null>(null);
  const [doneCount, setDoneCount] = useState(0);

  useEffect(() => {
    const p = loadCourseProgress();
    setDoneCount(p.doneDays.length);
    setDay(currentCourseDay(p.doneDays));
  }, []);

  if (day === null) return null;

  if (doneCount >= COURSE_TOTAL_DAYS) {
    return (
      <div className="mb-6 rounded-2xl border border-accent bg-accent-soft p-5">
        <p className="text-base font-medium text-ink">
          All 7 days complete 🎉
        </p>
        <p className="mt-1 text-sm text-muted">
          The course loops back to Day 1 for revision — say the phrases out loud this time.
        </p>
      </div>
    );
  }

  const title = titles[day - 1] ?? "";

  return (
    <div className="mb-6 rounded-2xl border border-accent bg-accent-soft p-5">
      <p className="text-xs font-medium tracking-wide text-accent uppercase">
        Your progress · {doneCount}/{COURSE_TOTAL_DAYS} days
      </p>
      <p className="mt-1 text-base font-medium text-ink">
        Up next: Day {day} — {title}
      </p>
      <button
        type="button"
        onClick={() => {
          openDayPanel(day);
          scrollToDay(day);
        }}
        className="mt-3 inline-block w-full rounded-xl bg-accent px-5 py-3 text-base font-medium text-white transition hover:opacity-90 active:scale-[0.98]"
      >
        Continue with Day {day}
      </button>
    </div>
  );
}

export function CourseDayNav({ names }: { names: string[] }) {
  const [current, setCurrent] = useState<number | null>(null);

  useEffect(() => {
    setCurrent(currentCourseDay(loadCourseProgress().doneDays));
  }, []);

  return (
    <nav aria-label="Course days" className="mb-6 flex flex-wrap gap-2">
      {names.map((name, i) => {
        const day = i + 1;
        const isCurrent = current === day;
        return (
          <button
            key={day}
            type="button"
            onClick={() => {
              openDayPanel(day);
              scrollToDay(day);
            }}
            aria-current={isCurrent ? "true" : undefined}
            className={
              "rounded-full border px-3 py-1.5 text-xs font-medium transition " +
              (isCurrent
                ? "border-accent bg-accent text-white"
                : "border-line bg-card text-ink hover:border-accent hover:text-accent")
            }
          >
            Day {day} · {name}
          </button>
        );
      })}
    </nav>
  );
}

/** 挂载时：如果这天正是「当前该学的天」，自动展开面板。 */
export function DayOpener({ day }: { day: number }) {
  useEffect(() => {
    if (currentCourseDay(loadCourseProgress().doneDays) === day) {
      openDayPanel(day);
    }
  }, [day]);
  return null;
}

/** 「学完这天」按钮：写进度 → 显示完成态 → 自动展开下一天。 */
export function MarkDayDone({ day }: { day: number }) {
  const [done, setDone] = useState<boolean | null>(null);

  useEffect(() => {
    setDone(loadCourseProgress().doneDays.includes(day));
  }, [day]);

  if (done === null) return null;

  if (done) {
    return (
      <p className="mt-3 text-sm font-medium text-accent">
        Day {day} complete ✓
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        saveCourseProgress(markDayDone(loadCourseProgress(), day));
        setDone(true);
        const next = day + 1;
        if (next <= COURSE_TOTAL_DAYS) {
          openDayPanel(next);
          scrollToDay(next);
        }
      }}
      className="mt-3 rounded-full border border-line bg-card px-4 py-2 text-sm font-medium text-ink transition hover:border-accent hover:text-accent active:scale-[0.98]"
    >
      Mark Day {day} as done
    </button>
  );
}
