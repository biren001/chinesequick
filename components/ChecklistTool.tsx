"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EVENTS, track } from "@/lib/analytics";
import {
  CHECKLIST_LAST_CHECKED,
  CHECKLIST_STAGES,
  CHECKLIST_TOTAL,
  checklistItem,
  checklistTopic,
} from "@/lib/checklistItems";
import { useChecklist } from "@/lib/useChecklist";

/**
 * 行前清单工具。
 *
 * 刻意做成「可勾选 + 本地保存」而不是一篇文章：文章读完就走，
 * 清单是出发前会反复回来的东西 —— 这也是这个站目前最缺的回访理由。
 *
 * 按「什么时候做」分阶段展示：用户打开这一页真正想知道的是「现在该干哪件」，
 * 而不是「一共有哪些事」。主题降级成每条上的小标签。
 */
export default function ChecklistTool() {
  const { count, toggle, reset, isDone } = useChecklist();
  // useSyncExternalStore 在 hydration 阶段给的是空快照；
  // 不等挂载就画进度条，会让本来勾过的用户看到 0/16 闪一下。
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const shown = mounted ? count : 0;
  const complete = shown === CHECKLIST_TOTAL;
  const pct = Math.round((shown / CHECKLIST_TOTAL) * 100);

  function handleToggle(id: string, checked: boolean) {
    const next = checked ? shown + 1 : shown - 1;
    track(EVENTS.checklistToggled, { item: id, done: checked, count: next });
    if (next === CHECKLIST_TOTAL) track(EVENTS.checklistCompleted, { total: CHECKLIST_TOTAL });
    toggle(id);
  }

  return (
    <div className="space-y-8">
      <div className="sticky top-0 z-10 -mx-5 border-b border-line bg-paper/95 px-5 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-ink" data-checklist-progress>
            {shown} / {CHECKLIST_TOTAL} done
          </p>
          {mounted && count > 0 && (
            <button
              type="button"
              onClick={reset}
              className="text-xs text-muted underline underline-offset-4 hover:text-ink"
            >
              Start over
            </button>
          )}
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* 把「会变的事实」的时效说清楚：签证、入境、支付通道都不是我们可以
          长期担保的，与其让用户当成权威，不如给出核对日期和官方入口。 */}
      <p className="rounded-xl bg-accent-soft px-4 py-3 text-xs text-muted">
        Entry rules, payment apps and mobile data change often. The items marked with a link were
        last checked on <span className="text-ink">{CHECKLIST_LAST_CHECKED}</span> — confirm with
        the official source before you rely on them.
      </p>

      {complete && (
        <div className="rounded-2xl border border-success bg-success-soft p-5">
          <p className="text-base font-medium text-ink">🎉 You&apos;re ready for China.</p>
          <p className="mt-1.5 text-sm text-muted">
            All {CHECKLIST_TOTAL} done. One last thing, and it&apos;s the fun one — put the phrases
            you&apos;ll actually use in one place so you can play them on the plane.
          </p>
          <Link
            href="/saved"
            className="mt-4 inline-block rounded-xl bg-accent px-5 py-3 text-base font-medium text-white transition hover:opacity-90 active:scale-[0.98]"
          >
            Build my trip phrase list
          </Link>
        </div>
      )}

      {CHECKLIST_STAGES.map((stage) => (
        <section key={stage.id} className="scroll-mt-24" id={stage.id}>
          <header>
            <p className="text-xs font-medium tracking-wide text-accent uppercase">
              {stage.when}
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-base font-medium text-ink">
              <span aria-hidden="true">{stage.emoji}</span> {stage.title}
              <span className="text-sm font-normal text-muted">{stage.itemIds.length}</span>
            </h2>
            <p className="mt-1.5 text-sm text-muted">{stage.blurb}</p>
          </header>

          <ul className="mt-4 space-y-3">
            {stage.itemIds.map((id) => {
              const item = checklistItem(id);
              if (!item) return null;
              const topic = checklistTopic(item.topic);
              const checked = mounted && isDone(item.id);
              const inputId = `chk-${item.id}`;
              return (
                <li
                  key={item.id}
                  className={`rounded-2xl border p-4 transition ${
                    checked ? "border-success bg-success-soft" : "border-line bg-card"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => handleToggle(item.id, e.target.checked)}
                      style={{ accentColor: "var(--color-accent)" }}
                      className="mt-1 h-5 w-5 shrink-0 cursor-pointer"
                    />
                    <div className="min-w-0 flex-1">
                      {topic && (
                        <p className="mb-0.5 text-xs font-medium text-muted">
                          <span aria-hidden="true">{topic.emoji}</span> {topic.label}
                        </p>
                      )}
                      <label
                        htmlFor={inputId}
                        className={`block cursor-pointer text-base leading-snug font-medium ${
                          checked ? "text-muted line-through" : "text-ink"
                        }`}
                      >
                        {item.title}
                      </label>
                      <p className="mt-1.5 text-sm text-muted">{item.why}</p>
                      {item.source && (
                        <a
                          href={item.source.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1.5 block text-xs text-muted underline underline-offset-4 hover:text-ink"
                        >
                          {item.source.label} ↗
                        </a>
                      )}
                      {item.href && item.linkLabel && (
                        <Link
                          href={item.href}
                          className="mt-2 inline-block text-sm text-accent underline-offset-4 hover:underline"
                        >
                          {item.linkLabel} →
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <p className="pb-2 text-center text-xs text-muted">
        Your ticks are stored on this device only — no account, nothing uploaded.
      </p>
    </div>
  );
}
