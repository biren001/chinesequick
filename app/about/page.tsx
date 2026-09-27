import type { Metadata } from "next";
import Link from "next/link";
import FeedbackLink from "@/components/FeedbackLink";
import { CATEGORIES } from "@/lib/categories";
import { PHRASES } from "@/lib/phrases";
import { urlOf } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "About ChineseQuick",
  description:
    "ChineseQuick is a free helper for life and travel in China — Mandarin phrases with audio for everyday situations, plus a pre-trip checklist. No sign-up, no ads.",
  alternates: { canonical: urlOf("/about") },
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-md px-5 pt-14 pb-16">
      <h1 className="text-3xl leading-tight font-semibold tracking-tight text-ink">
        About ChineseQuick
      </h1>
      <p className="mt-3 text-base text-muted">
        {PHRASES.length} Mandarin phrases for the moments you actually run into — ordering food,
        getting a taxi, checking in, paying, and getting through the day.
      </p>

      <section className="mt-8">
        <h2 className="text-base font-medium text-ink">How the phrases are chosen</h2>
        <ul className="mt-3 space-y-2.5 text-sm text-muted">
          <li className="flex gap-3">
            <span aria-hidden="true">📍</span>
            <span>
              <span className="text-ink">Situation first.</span> Every phrase belongs to a real
              moment, not to a textbook chapter.
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true">🗣</span>
            <span>
              <span className="text-ink">What people actually say.</span> Short, natural, safe to
              use with strangers.
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true">🔤</span>
            <span>
              <span className="text-ink">Always with pinyin.</span> So you can read it out loud
              even before you know characters.
            </span>
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-medium text-ink">Audio, and why it works offline</h2>
        <p className="mt-3 text-sm text-muted">
          Every phrase ships with its own recording, played from this site — not from your
          device&rsquo;s speech engine. That matters more than it sounds: phones and laptops often
          have no Chinese voice installed at all, and when they don&rsquo;t, a text-to-speech button
          simply does nothing. Ours always plays.
        </p>
        <p className="mt-3 text-sm text-muted">
          Each clip is small (a few kilobytes), so the phrases you open are cached and keep working
          on a plane, in a basement restaurant, or anywhere else with no signal. Install the site to
          your home screen and it behaves like an app.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-medium text-ink">How the audio is made</h2>
        <p className="mt-3 text-sm text-muted">
          The current clips are generated with a neural Chinese voice (Microsoft zh-CN-Xiaoxiao).
          They are clear and consistent, but they are synthetic. Recording every phrase with a
          native speaker is on the roadmap — when that happens, no code changes are needed
          underneath, and we&rsquo;ll say so here.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-medium text-ink">What this is not</h2>
        <p className="mt-3 text-sm text-muted">
          Not a full course, not a dictionary, and not an exam-prep tool. There is no HSK track, no
          grammar lessons, no login and no subscription — just the sentences you need next.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-medium text-ink">Start with a situation</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {CATEGORIES.map((c) => (
            <li key={c.id}>
              <Link
                className="text-accent underline-offset-4 hover:underline"
                href={`/learn/${c.id}`}
              >
                {c.emoji} {c.name} — {c.blurb}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-medium text-ink">Saved phrases, and what we don&rsquo;t collect</h2>
        <p className="mt-3 text-sm text-muted">
          Tapping the heart on a phrase saves it to <strong className="font-medium text-ink">your
          own device</strong> — the list lives in your browser&rsquo;s local storage and is never sent
          anywhere. There is no account, no email, no server. Learning progress (what you marked as
          learned, your quiz scores, your streak) is stored the same way, which is also why the site
          keeps working with no connection.
        </p>
        <p className="mt-3 text-sm text-muted">
          The{" "}
          <Link className="text-accent underline-offset-4 hover:underline" href="/privacy">
            Privacy Policy
          </Link>{" "}
          spells out exactly what is and isn&rsquo;t collected.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-medium text-ink">Who makes this</h2>
        <p className="mt-3 text-sm text-muted">
          ChineseQuick is an independent, ad-free project. If a phrase is wrong, unnatural, or
          missing, tell us — corrections are the most useful thing you can send.
        </p>
        <div className="mt-4">
          <FeedbackLink />
        </div>
      </section>

      <p className="mt-10 text-sm text-muted">
        <Link className="text-accent underline-offset-4 hover:underline" href="/">
          ← Back to all phrases
        </Link>
      </p>
    </main>
  );
}
