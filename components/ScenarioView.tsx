import Link from "next/link";
import AudioButton from "./AudioButton";
import PlayAll from "./PlayAll";
import SaveButton from "./SaveButton";
import JsonLd from "./JsonLd";
import { audioForPhrase, slowAudioForPhrase } from "@/lib/audio";
import { getCategory } from "@/lib/categories";
import { getPhraseById } from "@/lib/phrases";
import { phrasePath, phraseSlug } from "@/lib/slug";
import { breadcrumbSchema, faqSchema, scenarioSchema, urlOf } from "@/lib/jsonld";
import { SCENARIOS } from "@/lib/scenarios";
import type { Category, Phrase, Scenario } from "@/lib/types";

/**
 * 场景流程页。
 *
 * 和分类页（SeoCategoryView）的区别，也是这个页面存在的全部理由：
 *  - 分类页答「有哪些句子」—— 一组并列的卡片，顺序无关紧要。
 *  - 这里答「先说什么、对方会回什么」—— 有序步骤 + `theySay` + 提醒。
 * 句子本身一条都不新增，全部复用 data/phrases.json，所以音频与单句页天然对齐。
 */
export default function ScenarioView({ scenario }: { scenario: Scenario }) {
  const steps = scenario.steps.map((step) => ({
    step,
    phrase: getPhraseById(step.sayId) as Phrase,
  }));
  const flowPhrases = steps.map((s) => s.phrase);
  const also = (scenario.alsoIds ?? [])
    .map((id) => getPhraseById(id))
    .filter((p): p is Phrase => Boolean(p));

  // 这个场景会用到哪些分类 —— 页面底部据此给出「去看该分类全部短语」的出口。
  const usedCategories: Category[] = Array.from(
    new Set([...flowPhrases, ...also].map((p) => p.category))
  )
    .map((id) => getCategory(id))
    .filter((c): c is Category => Boolean(c));

  const index = SCENARIOS.findIndex((s) => s.slug === scenario.slug);
  const next = SCENARIOS[(index + 1) % SCENARIOS.length];

  return (
    <main className="mx-auto max-w-md px-5 pt-8 pb-16">
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: "Situation guides", path: "/scenarios" },
            { name: scenario.name, path: `/scenarios/${scenario.slug}` },
          ]),
          scenarioSchema(scenario, flowPhrases),
          faqSchema(scenario.faq),
        ]}
      />

      <nav className="mb-6 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted underline underline-offset-4">
        <Link href="/">ChineseQuick</Link>
        <Link href="/scenarios">Situation guides</Link>
      </nav>

      <header className="mb-6">
        <span className="text-4xl" aria-hidden="true">
          {scenario.emoji}
        </span>
        <h1 className="mt-2 text-3xl leading-tight font-semibold tracking-tight text-ink">
          {scenario.h1}
        </h1>
        <div className="mt-3 space-y-3 text-base leading-relaxed text-muted">
          {scenario.intro.map((paragraph) => (
            <p key={paragraph.slice(0, 32)}>{paragraph}</p>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">
          {steps.length} steps · {flowPhrases.length} phrases · tap any phrase to hear it
        </p>
      </header>

      <PlayAll phrases={flowPhrases} className="mb-8" />

      <ol className="space-y-8">
        {steps.map(({ step, phrase }, i) => (
          <li key={phrase.id}>
            <div className="flex items-baseline gap-3">
              <span className="shrink-0 text-sm font-medium text-accent">
                {i + 1}
              </span>
              <h2 className="text-lg leading-snug font-medium text-ink">
                {step.title}
              </h2>
            </div>

            <div className="mt-3 rounded-2xl border border-line bg-card p-5">
              <p className="text-xs font-medium tracking-wide text-muted uppercase">
                You say
              </p>
              <p className="mt-1 text-[26px] leading-snug font-medium text-ink">
                {phrase.chinese}
              </p>
              <p className="mt-1 text-base text-accent">{phrase.pinyin}</p>
              <p className="mt-2 text-sm text-muted">{phrase.english}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <AudioButton
                  text={phrase.chinese}
                  src={audioForPhrase(phrase)}
                  label="Listen"
                  variant="accent"
                  repeats={3}
                />
                <AudioButton
                  text={phrase.chinese}
                  src={slowAudioForPhrase(phrase)}
                  rate={0.6}
                  label="Slow"
                />
                <SaveButton phraseId={phrase.id} />
                <Link
                  href={phrasePath(phraseSlug(phrase))}
                  className="inline-flex items-center rounded-xl border border-line px-3 py-2 text-sm font-medium text-ink transition hover:border-accent hover:text-accent"
                >
                  Details
                </Link>
              </div>
            </div>

            {step.theySay && (
              <div className="mt-2 rounded-2xl bg-accent-soft p-4">
                <p className="text-xs font-medium tracking-wide text-accent uppercase">
                  You may hear
                </p>
                <p className="mt-1 text-xl leading-snug text-ink">
                  {step.theySay.zh}
                </p>
                <p className="mt-0.5 text-sm text-accent">{step.theySay.py}</p>
                <p className="mt-1 text-sm text-muted">{step.theySay.en}</p>
              </div>
            )}

            {step.note && (
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.note}</p>
            )}
          </li>
        ))}
      </ol>

      {also.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-medium text-ink">
            Also worth having ready
          </h2>
          <p className="mt-1 text-sm text-muted">
            Not part of the flow, but the ones people wish they&apos;d
            practised before this situation.
          </p>
          <ul className="mt-3 space-y-2">
            {also.map((p) => (
              <li key={p.id}>
                <Link
                  href={phrasePath(phraseSlug(p))}
                  className="flex items-baseline justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3 transition hover:border-accent"
                >
                  <span className="text-base font-medium text-ink">
                    {p.chinese}
                  </span>
                  <span className="shrink-0 text-sm text-muted">{p.english}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-medium text-ink">Common questions</h2>
        <dl className="mt-3 space-y-4">
          {scenario.faq.map((item) => (
            <div
              key={item.q}
              className="rounded-2xl border border-line bg-card p-4"
            >
              <dt className="text-base font-medium text-ink">{item.q}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-muted">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {usedCategories.length > 0 && (
        <section className="mt-8 rounded-2xl border border-line bg-card p-5">
          <h2 className="text-base font-medium text-ink">
            Every phrase used here, in full
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {usedCategories.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/${c.seoSlug}`}
                  className="text-accent underline-offset-4 hover:underline"
                >
                  All Chinese phrases for {c.forLabel} →
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/chinese-numbers"
                className="text-accent underline-offset-4 hover:underline"
              >
                Chinese numbers 0–10,000 (for prices and times) →
              </Link>
            </li>
          </ul>
        </section>
      )}

      <section className="mt-6 rounded-2xl bg-accent-soft p-5">
        <p className="text-xs font-medium tracking-wide text-accent uppercase">
          Next situation
        </p>
        <p className="mt-1 text-lg font-medium text-ink">
          {next.emoji} {next.name}
        </p>
        <p className="mt-1 text-sm text-muted">{next.blurb}</p>
        <Link
          href={`/scenarios/${next.slug}`}
          className="mt-4 inline-block w-full rounded-xl bg-accent px-5 py-3 text-center text-base font-medium text-white transition hover:opacity-90 active:scale-[0.98]"
        >
          Walk through it
        </Link>
      </section>

      <p className="mt-6 text-center text-sm text-muted">
        <Link
          href="/scenarios"
          className="text-accent underline-offset-4 hover:underline"
        >
          All situation guides
        </Link>
      </p>
    </main>
  );
}

/** 供页面 metadata 复用的绝对 canonical。 */
export function scenarioCanonical(scenario: Scenario): string {
  return urlOf(`/scenarios/${scenario.slug}`);
}
