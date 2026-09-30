import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { CATEGORIES } from "@/lib/categories";
import { CHECKLIST_TOTAL } from "@/lib/checklistItems";
import { getCategoriesWithCount, PHRASES } from "@/lib/phrases";
import { SCENARIOS } from "@/lib/scenarios";
import { urlOf, organizationSchema, websiteSchema } from "@/lib/jsonld";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { BUILD_SHA, buildDateLabel } from "@/lib/build";
import StartLearning from "@/components/StartLearning";
import PhraseSearch from "@/components/PhraseSearch";
import { ResumeCard } from "@/components/LastPlace";

export const metadata: Metadata = {
  alternates: { canonical: urlOf("/") },
};

export default function HomePage() {
  const categories = getCategoriesWithCount();

  return (
    <main className="mx-auto max-w-md px-5 pb-16">
      <JsonLd schema={[websiteSchema(), organizationSchema()]} />

      <section className="pt-14 pb-10 text-center">
        <h1 className="text-4xl leading-tight font-semibold tracking-tight text-ink">
          Learn Chinese for everyday life in China.
        </h1>
        <p className="mt-3 text-lg text-muted">
          Your helper for getting around China — phrases, audio and trip prep.
        </p>

        <StartLearning />

        <p className="mt-3 text-sm text-muted">
          {PHRASES.length} useful phrases · no sign-up · works offline
        </p>

        {/* 版本号：第一屏就能看见，不用滚到页脚、不用查源码，就能确认看到的是哪一份构建。 */}
        {buildDateLabel() && (
          <p className="mt-1.5 text-xs text-muted">
            {`Updated ${buildDateLabel()} · build ${BUILD_SHA}`}
          </p>
        )}

        <PhraseSearch />
      </section>

      {/* 「接着上次看」：浏览器被系统回收/重开 App 后，从这里一键回到上次停留的页面 */}
      <ResumeCard />

      <section className="rounded-2xl border border-accent bg-accent-soft p-5">
        <p className="text-sm font-medium tracking-wide text-accent uppercase">Going to China?</p>
        <h2 className="mt-1 text-lg font-medium text-ink">Get ready before you fly</h2>
        <p className="mt-1.5 text-sm text-muted">
          {CHECKLIST_TOTAL} things to sort out before the trip — passport and entry rules, payments,
          data, and the Chinese you&apos;ll actually need. Tick them off as you go.
        </p>
        <Link
          href="/china-travel-checklist"
          className="mt-4 inline-block w-full rounded-xl bg-accent px-5 py-3 text-center text-base font-medium text-white transition hover:opacity-90 active:scale-[0.98]"
        >
          Start the China travel checklist
        </Link>
        <p className="mt-2.5 text-sm text-muted">
          Sorting out data too?{" "}
          <Link
            href="/getting-online-in-china"
            className="text-accent underline underline-offset-4"
          >
            How to get online in China
          </Link>
        </p>
      </section>

      <section className="mt-8 rounded-2xl border border-line bg-card p-5">
        <h2 className="text-base font-medium text-ink">Learn Chinese in 7 days</h2>
        <p className="mt-1.5 text-sm text-muted">
          A free course: about 15 phrases a day with audio, ordered the way a trip unfolds — from hello
          and thank you to taxis, hotels and emergencies.
        </p>
        <Link
          href="/7-day-chinese-course"
          className="mt-4 inline-block w-full rounded-xl bg-accent px-5 py-3 text-center text-base font-medium text-white transition hover:opacity-90 active:scale-[0.98]"
        >
          Start the free 7-day course
        </Link>
        <p className="mt-2.5 text-sm text-muted">
          Prefer testing yourself?{" "}
          <Link
            href="/listening-quiz"
            className="text-accent underline underline-offset-4"
          >
            Take the listening quiz
          </Link>{" "}
          or drill the numbers you will hear at markets:{" "}
          <Link
            href="/numbers-quiz"
            className="text-accent underline underline-offset-4"
          >
            numbers listening quiz
          </Link>
        </p>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium tracking-wide text-muted uppercase">
          Pick a situation
        </h2>
        <div className="space-y-3">
          {categories.map((category) => (
            <div key={category.id}>
              <Link
                href={`/learn/${category.id}`}
                className="flex items-center gap-4 rounded-2xl border border-line bg-card px-5 py-4 transition hover:border-accent active:scale-[0.99]"
              >
                <span className="text-3xl" aria-hidden="true">
                  {category.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-medium text-ink">
                    {category.name}
                  </span>
                  <span className="block text-sm text-muted">{category.blurb}</span>
                </span>
                <span className="shrink-0 text-sm text-muted">{category.count}</span>
              </Link>
              {/* 配套指南页的入口。卡片本身已经是链接，所以只能放在外层 —— 链接不能嵌套。 */}
              {category.guide && (
                <Link
                  href={category.guide.href}
                  className="mt-2 ml-2 inline-block text-sm text-accent underline-offset-4 hover:underline"
                >
                  {category.guide.label} →
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-line bg-card p-5">
        <h2 className="text-base font-medium text-ink">
          Do it in order, start to finish
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          {SCENARIOS.length} situations walked through step by step — what you
          say, and what you&apos;ll hear back.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {SCENARIOS.map((s) => (
            <li key={s.slug}>
              <Link
                className="text-accent underline-offset-4 hover:underline"
                href={`/scenarios/${s.slug}`}
              >
                {s.emoji} {s.name}
              </Link>
            </li>
          ))}
        </ul>
        <Link
          className="mt-4 inline-block text-sm text-muted underline underline-offset-4"
          href="/scenarios"
        >
          All {SCENARIOS.length} situation guides
        </Link>
      </section>

      <section className="mt-12">
        <h2 className="text-base font-medium text-ink">{`Why ${SITE_NAME}?`}</h2>
        <ul className="mt-3 space-y-2.5 text-sm text-muted">
          <li className="flex items-center gap-3">
            <span aria-hidden="true">🔊</span>
            Hear real pronunciation
          </li>
          <li className="flex items-center gap-3">
            <span aria-hidden="true">📖</span>
            Chinese + pinyin + English
          </li>
          <li className="flex items-center gap-3">
            <span aria-hidden="true">⚡</span>
            Real situations, not textbook lessons
          </li>
        </ul>
      </section>

      <section className="mt-10 rounded-2xl border border-line bg-card p-5">
        <h2 className="text-base font-medium text-ink">Popular Chinese Phrases</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            <Link className="text-accent underline-offset-4 hover:underline" href="/how-to-say-thank-you-in-chinese">
              How to say &ldquo;Thank you&rdquo; in Chinese
            </Link>
          </li>
          <li>
            <Link className="text-accent underline-offset-4 hover:underline" href="/how-to-say-hello-in-chinese">
              How to say &ldquo;Hello&rdquo; in Chinese
            </Link>
          </li>
        </ul>
      </section>

      <section className="mt-8 rounded-2xl border border-line bg-card p-5">
        <h2 className="text-base font-medium text-ink">Chinese phrases by situation</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {CATEGORIES.map((category) => (
            <li key={category.id}>
              <Link
                className="text-accent underline-offset-4 hover:underline"
                href={`/${category.seoSlug}`}
              >
                Chinese phrases for {category.forLabel}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="sr-only">{SITE_TAGLINE}</p>
    </main>
  );
}
