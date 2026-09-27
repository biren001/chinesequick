import Link from "next/link";
import AudioButton from "./AudioButton";
import PlayAll from "./PlayAll";
import SaveButton from "./SaveButton";
import { audioForPhrase, slowAudioForPhrase } from "@/lib/audio";
import { CHECKLIST_TOTAL } from "@/lib/checklistItems";
import JsonLd from "./JsonLd";
import { getPhrasesByCategory } from "@/lib/phrases";
import { phrasePath, phraseSlug } from "@/lib/slug";
import { breadcrumbSchema, itemListSchema, urlOf } from "@/lib/jsonld";
import { scenariosForCategory } from "@/lib/scenarios";
import type { Category } from "@/lib/types";

export default function SeoCategoryView({ category }: { category: Category }) {
  const phrases = getPhrasesByCategory(category.id);
  // 分类页答「有哪些句子」，场景页答「先说什么、对方回什么」—— 两条出口互为分发。
  const scenarios = scenariosForCategory(category.id);

  return (
    <main className="mx-auto max-w-md px-5 pt-8 pb-16">
      <JsonLd
        schema={[
          breadcrumbSchema([{ name: `${category.name} Chinese`, path: `/${category.seoSlug}` }]),
          itemListSchema(category, phrases),
        ]}
      />

      <nav className="mb-6">
        <Link href="/" className="text-sm text-muted underline underline-offset-4">
          ChineseQuick
        </Link>
      </nav>

      <header className="mb-6">
        <span className="text-4xl" aria-hidden="true">
          {category.emoji}
        </span>
        <h1 className="mt-2 text-3xl leading-tight font-semibold tracking-tight text-ink">
          {phrases.length} Chinese {category.name} Phrases
        </h1>
        <p className="mt-2 text-base text-muted">
          The {category.name.toLowerCase()} Chinese you&apos;ll actually hear and
          say. Tap any phrase to hear it.
        </p>
        {category.guide && (
          <Link
            href={category.guide.href}
            className="mt-3 inline-block text-sm text-accent underline-offset-4 hover:underline"
          >
            {category.guide.label} →
          </Link>
        )}
      </header>

      <PlayAll phrases={phrases} className="mb-6" />

      {scenarios.length > 0 && (
        <div className="mb-6 rounded-2xl bg-accent-soft px-4 py-3">
          <p className="text-sm text-ink">
            Prefer them in the order you&apos;ll need them?{" "}
            {scenarios.map((s, i) => (
              <span key={s.slug}>
                {i > 0 && <span aria-hidden="true"> · </span>}
                <Link
                  href={`/scenarios/${s.slug}`}
                  className="text-accent underline-offset-4 hover:underline"
                >
                  {s.emoji} {s.name}
                </Link>
              </span>
            ))}
          </p>
        </div>
      )}

      <ol className="space-y-3">
        {phrases.map((phrase, i) => (
          <li key={phrase.id} className="rounded-2xl border border-line bg-card p-5">
            <p className="text-xs font-medium text-muted">{i + 1}.</p>
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
          </li>
        ))}
      </ol>

      <p className="mt-8 text-sm text-muted">
        Travelling soon?{" "}
        <Link
          href="/china-travel-checklist"
          className="text-accent underline-offset-4 hover:underline"
        >
          {CHECKLIST_TOTAL}-point checklist for your first trip to China
        </Link>
      </p>

      <div className="mt-6 rounded-2xl bg-accent-soft p-5 text-center">
        <p className="text-base font-medium text-ink">
          Practice these {phrases.length} phrases
        </p>
        <Link
          href={`/learn/${category.id}`}
          className="mt-3 inline-block w-full rounded-xl bg-accent px-5 py-3 text-base font-medium text-white transition hover:opacity-90 active:scale-[0.98]"
        >
          Start learning {category.name}
        </Link>
      </div>
    </main>
  );
}
