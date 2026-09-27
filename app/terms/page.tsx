import type { Metadata } from "next";
import Link from "next/link";
import { urlOf } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "The plain-language terms for using ChineseQuick: free to use, provided as is, and not a substitute for a doctor, a translator or an official source.",
  alternates: { canonical: urlOf("/terms") },
};

const UPDATED = "September 26, 2026";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-md px-5 pt-14 pb-16">
      <h1 className="text-3xl leading-tight font-semibold tracking-tight text-ink">Terms of Use</h1>
      <p className="mt-2 text-sm text-muted">Last updated: {UPDATED}</p>

      <p className="mt-5 text-base leading-relaxed text-muted">
        Short version: it&rsquo;s free, it&rsquo;s a phrasebook, and it can be wrong. Read on for the
        detail.
      </p>

      <section className="mt-8">
        <h2 className="text-base font-medium text-ink">Using the site</h2>
        <p className="mt-3 text-sm text-muted">
          ChineseQuick is free to use for personal, non-commercial purposes. You can link to any
          page. You may not bulk-copy the phrase list, the audio files or the explanations and
          republish them as your own product — that includes feeding the whole site into another
          site or app.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-medium text-ink">Accuracy — please read this one</h2>
        <p className="mt-3 text-sm text-muted">
          Every phrase is checked by hand, but languages are full of context: what is polite in a
          Chengdu noodle shop may be odd in a Shanghai hotel. The pronunciation is synthesized, and
          regional accents vary. Treat this site as a helpful starting point, not the final word.
        </p>
      </section>

      <section className="mt-8 rounded-2xl border border-line bg-card p-5">
        <h2 className="text-base font-medium text-ink">Emergencies and medical situations</h2>
        <p className="mt-3 text-sm text-muted">
          The phrases in the Emergency section are there to help you be understood — they are not
          emergency services, professional translation or medical advice. In a real emergency call
          the local number directly (110 police, 120 ambulance, 119 fire in mainland China) or ask a
          person nearby for help. Do not rely on this site alone for anything involving health,
          safety, medication or the law.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-medium text-ink">No warranty</h2>
        <p className="mt-3 text-sm text-muted">
          The site is provided &ldquo;as is&rdquo;, without warranties of any kind. To the extent
          permitted by law, no liability is accepted for any loss arising from use of the site —
          including a misunderstanding in a shop, a restaurant or a taxi.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-medium text-ink">Content and copyright</h2>
        <p className="mt-3 text-sm text-muted">
          The phrase list, the English explanations, the page design and the generated audio belong
          to this project. Chinese characters and pinyin themselves are nobody&rsquo;s property, and
          neither is the language.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-medium text-ink">Changes</h2>
        <p className="mt-3 text-sm text-muted">
          These terms may be updated as the site grows; the date at the top will change when they do.
          Continuing to use the site means you accept the current version.
        </p>
      </section>

      <p className="mt-8 text-sm text-muted">
        See also the{" "}
        <Link className="text-accent underline-offset-4 hover:underline" href="/privacy">
          Privacy Policy
        </Link>{" "}
        and the{" "}
        <Link className="text-accent underline-offset-4 hover:underline" href="/contact">
          contact page
        </Link>
        .
      </p>

      <p className="mt-6 text-sm text-muted">
        <Link className="text-accent underline-offset-4 hover:underline" href="/">
          ← Back to all phrases
        </Link>
      </p>
    </main>
  );
}
