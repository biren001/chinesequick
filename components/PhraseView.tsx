import Link from "next/link";
import AudioButton from "./AudioButton";
import SaveButton from "./SaveButton";
import JsonLd from "./JsonLd";
import { audioForPhrase, audioForWord, slowAudioForPhrase } from "@/lib/audio";
import { getCategory } from "@/lib/categories";
import { getPhrasesByCategory, pinyinInline } from "@/lib/phrases";
import { phrasePath, phraseSlug } from "@/lib/slug";
import { breadcrumbSchema, faqSchema, phraseFaqEntries, urlOf } from "@/lib/jsonld";
import { scenariosUsingPhrase } from "@/lib/scenarios";
import type { Phrase } from "@/lib/types";

export function cleanEnglish(english: string): string {
  return english.replace(/\.$/, "");
}

export default function PhraseView({ phrase }: { phrase: Phrase }) {
  const category = getCategory(phrase.category);
  const english = cleanEnglish(phrase.english);
  // 轮转取同分类的 4 条，而不是固定取前 4 条 ——
  // 否则分类里靠后的短语永远拿不到「相关短语」的入链，形成低优先级页。
  const siblings = category ? getPhrasesByCategory(category.id) : [];
  const start = siblings.findIndex((p) => p.id === phrase.id);
  const related: Phrase[] =
    start < 0
      ? []
      : [1, 2, 3, 4]
          .map((k) => siblings[(start + k) % siblings.length])
          .filter((p) => p.id !== phrase.id)
          .slice(0, 4);
  const faq = phraseFaqEntries(phrase, english, category);
  // 深度内容块（data/deep.json，按 id 挂载；没写就走原来的渲染）
  const deep = phrase.deep;
  // 这条短语在哪些真实场景里会用到（含「顺手也带上」的引用）。
  const scenarios = scenariosUsingPhrase(phrase.id);

  return (
    <main className="mx-auto max-w-md px-5 pt-8 pb-16">
      <JsonLd
        schema={[
          breadcrumbSchema([
            ...(category ? [{ name: `${category.name} Chinese`, path: `/${category.seoSlug}` }] : []),
            { name: `"${english}" in Chinese`, path: `/${seoPath(phrase)}` },
          ]),
          faqSchema(faq),
        ]}
      />

      {/* 面包屑与 JSON-LD 的 BreadcrumbList 保持一致，避免结构化数据与可见内容不符 */}
      <nav className="mb-6 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted underline underline-offset-4">
        <Link href="/">ChineseQuick</Link>
        {category && (
          <Link href={`/${category.seoSlug}`}>{category.name} Chinese phrases</Link>
        )}
      </nav>

      <header className="mb-5">
        <h1 className="text-2xl leading-snug font-semibold tracking-tight text-ink">
          How to say &ldquo;{english}&rdquo; in Chinese
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          &ldquo;{english}&rdquo; in Chinese is{" "}
          <strong className="font-medium text-ink">{phrase.chinese}</strong>, written in
          pinyin as <span className="text-accent">{pinyinInline(phrase.pinyin)}</span>.
        </p>
      </header>

      <section className="rounded-2xl border border-line bg-card p-6 text-center">
        <p className="text-4xl leading-snug font-medium text-ink">{phrase.chinese}</p>
        <p className="mt-2 text-lg text-accent">{phrase.pinyin}</p>
        <p className="mt-2 text-sm text-muted">{phrase.english}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
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
          <SaveButton phraseId={phrase.id} withLabel />
        </div>
      </section>

      {phrase.words && phrase.words.length > 1 && (
        <section className="mt-8">
          <h2 className="text-lg font-medium text-ink">Word by word</h2>
          <p className="mt-1 text-sm text-muted">
            What each part of {phrase.chinese} actually means.
          </p>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {phrase.words.map((w) => (
              <li key={w.zh} className="flex items-center gap-3 px-4 py-3">
                <span className="w-20 shrink-0 text-lg font-medium text-ink">{w.zh}</span>
                <span className="w-20 shrink-0 text-sm text-accent">{w.py}</span>
                <span className="min-w-0 flex-1 text-sm text-muted">{w.en}</span>
                <AudioButton text={w.zh} src={audioForWord(w.zh)} variant="ghost" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-medium text-ink">When you use it</h2>
        {deep?.when && deep.when.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {deep.when.map((s) => (
              <li key={s} className="flex gap-2.5 text-base leading-relaxed text-ink">
                <span
                  aria-hidden="true"
                  className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        ) : (
          phrase.tip && (
            <p className="mt-2 text-base leading-relaxed text-ink">{phrase.tip}</p>
          )
        )}
        <p className="mt-2 text-base leading-relaxed text-muted">
          {category
            ? `Use ${phrase.chinese} in ${category.name.toLowerCase()} situations. ${category.blurb}`
            : "An everyday phrase you will hear constantly in Chinese."}
        </p>
      </section>

      {deep?.variants && deep.variants.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-medium text-ink">Other ways people say it</h2>
          <p className="mt-1 text-sm text-muted">
            The same idea, said differently. Roughly in the order you&apos;ll hear
            them.
          </p>
          <ul className="mt-3 space-y-2">
            {deep.variants.map((v) => (
              <li
                key={v.zh}
                className="rounded-2xl border border-line bg-card p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-lg leading-snug font-medium text-ink">
                      {v.zh}
                    </p>
                    <p className="mt-0.5 text-sm text-accent">
                      {pinyinInline(v.py)}
                    </p>
                    <p className="mt-1 text-sm text-muted">{v.en}</p>
                  </div>
                  {/* 不传 src：走 AudioButton 已有的浏览器语音兜底。
                      刻意不给变体录 mp3 —— 站点包已 4.88 MB 且手动上传 CF。 */}
                  <AudioButton text={v.zh} variant="ghost" />
                </div>
                {v.note && (
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {v.note}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {deep?.mistakes && deep.mistakes.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-medium text-ink">
            What usually trips people up
          </h2>
          <ul className="mt-2 space-y-2">
            {deep.mistakes.map((m) => (
              <li
                key={m}
                className="rounded-2xl border border-line bg-card p-4 text-base leading-relaxed text-ink"
              >
                {m}
              </li>
            ))}
          </ul>
        </section>
      )}

      {deep?.replies && deep.replies.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-medium text-ink">What you might hear back</h2>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {deep.replies.map((r) => (
              <li key={r.zh} className="flex items-center gap-3 px-4 py-3">
                <span className="w-28 shrink-0 text-base font-medium text-ink">
                  {r.zh}
                </span>
                <span className="w-32 shrink-0 text-sm text-accent">
                  {pinyinInline(r.py)}
                </span>
                <span className="min-w-0 flex-1 text-sm text-muted">{r.en}</span>
                <AudioButton text={r.zh} variant="ghost" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-medium text-ink">Common questions</h2>
        <dl className="mt-3 space-y-4">
          {faq.map((item) => (
            <div key={item.q} className="rounded-2xl border border-line bg-card p-4">
              <dt className="text-base font-medium text-ink">{item.q}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-muted">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {scenarios.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-medium text-ink">Where you&apos;ll use it</h2>
          <p className="mt-1 text-sm text-muted">
            {phrase.chinese} comes up in these situations, in this order.
          </p>
          <ul className="mt-3 space-y-2">
            {scenarios.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/scenarios/${s.slug}`}
                  className="flex items-baseline justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3 transition hover:border-accent"
                >
                  <span className="text-base font-medium text-ink">
                    {s.emoji} {s.name}
                  </span>
                  <span className="shrink-0 text-sm text-muted">
                    {s.steps.length} steps
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {related.length > 0 && category && (
        <section className="mt-8">
          <h2 className="text-lg font-medium text-ink">
            More {category.name} phrases
          </h2>
          <ul className="mt-3 space-y-2">
            {related.map((p) => (
              <li key={p.id}>
                <Link
                  href={phrasePath(phraseSlug(p))}
                  className="flex items-baseline justify-between gap-3 rounded-xl border border-line bg-card px-4 py-3 transition hover:border-accent"
                >
                  <span className="text-base font-medium text-ink">{p.chinese}</span>
                  <span className="shrink-0 text-sm text-muted">{p.english}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {category && (
        <div className="mt-8 rounded-2xl bg-accent-soft p-5 text-center">
          <p className="text-base font-medium text-ink">
            Learn all {getPhrasesByCategory(category.id).length} {category.name}{" "}
            phrases
          </p>
          <Link
            href={`/learn/${category.id}`}
            className="mt-3 inline-block w-full rounded-xl bg-accent px-5 py-3 text-base font-medium text-white transition hover:opacity-90 active:scale-[0.98]"
          >
            Start learning
          </Link>
        </div>
      )}
    </main>
  );
}

/** 该短语的 SEO 路径（不含域名），canonical 与 JSON-LD 共用。 */
function seoPath(phrase: Phrase): string {
  return `how-to-say-${phraseSlug(phrase)}-in-chinese`;
}

/** 供页面 metadata 复用的绝对 canonical。 */
export function phraseCanonical(phrase: Phrase): string {
  return urlOf(`/${seoPath(phrase)}`);
}
