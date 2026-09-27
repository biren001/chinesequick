import type { Metadata } from "next";
import Link from "next/link";
import { urlOf } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What ChineseQuick stores, what it sends, and what it never collects. No accounts, no email, no tracking beyond anonymous analytics.",
  alternates: { canonical: urlOf("/privacy") },
};

/** 最后更新日期：改动本页内容时手工改这里（不要把构建时间写进去，否则每次构建都像"刚改过"） */
const UPDATED = "September 26, 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-md px-5 pt-14 pb-16">
      <h1 className="text-3xl leading-tight font-semibold tracking-tight text-ink">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-muted">Last updated: {UPDATED}</p>

      <p className="mt-5 text-base leading-relaxed text-muted">
        ChineseQuick is a free phrasebook. There is no account, no login and no newsletter, so
        there is no personal profile to collect. This page describes the little that does happen.
      </p>

      <section className="mt-8">
        <h2 className="text-base font-medium text-ink">What stays on your device</h2>
        <p className="mt-3 text-sm text-muted">
          Two things are saved in your browser&rsquo;s local storage, and they are{" "}
          <strong className="font-medium text-ink">never uploaded to us</strong>:
        </p>
        <ul className="mt-3 space-y-2.5 text-sm text-muted">
          <li className="flex gap-3">
            <span aria-hidden="true">📈</span>
            <span>
              <strong className="font-medium text-ink">Learning progress</strong> — which phrases
              you marked as learned, your quiz scores and your streak (key{" "}
              <code className="text-xs">rlc-progress-v1</code>).
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true">♡</span>
            <span>
              <strong className="font-medium text-ink">Saved phrases</strong> — the phrases you
              tapped the heart on (key <code className="text-xs">rlc-saved-v1</code>).
            </span>
          </li>
        </ul>
        <p className="mt-3 text-sm text-muted">
          Both live only in this browser on this device. Clearing your browser data, using private
          mode or switching device removes them, and we have no copy to restore.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-medium text-ink">Analytics</h2>
        <p className="mt-3 text-sm text-muted">
          The site uses Google Analytics 4 to understand which phrases and situations people
          actually use — for example which category gets opened and whether quizzes are finished.
          This sets cookies (<code className="text-xs">_ga</code>) and records an approximate
          location derived from your IP address, plus pages viewed and events such as
          &ldquo;phrase saved&rdquo;. It is not used to identify you, and it is not linked to any
          account, because there are no accounts.
        </p>
        <p className="mt-3 text-sm text-muted">
          If you would rather not be counted, a browser with tracking protection, private mode, or
          any content blocker will prevent it — the site works exactly the same without analytics.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-medium text-ink">What we never do</h2>
        <ul className="mt-3 space-y-2.5 text-sm text-muted">
          <li className="flex gap-3">
            <span aria-hidden="true">🚫</span>
            <span>No accounts, no email collection, no passwords.</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true">🚫</span>
            <span>No selling or sharing of data with advertisers or data brokers.</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true">🚫</span>
            <span>
              No third-party fonts, scripts, CDNs or ad networks. Audio is served from this site, not
              streamed from somewhere else.
            </span>
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-medium text-ink">Feedback forms</h2>
        <p className="mt-3 text-sm text-muted">
          The Feedback link goes to an external form (Tally). Nothing is sent until you open it and
          type something yourself, and anything you write there is used only to fix the site.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-medium text-ink">Children</h2>
        <p className="mt-3 text-sm text-muted">
          This site is not directed at children under 13 and knowingly collects nothing from them.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-medium text-ink">Changes</h2>
        <p className="mt-3 text-sm text-muted">
          If this policy changes, the date at the top of this page changes with it. Questions or
          anything that looks wrong? Use the{" "}
          <Link className="text-accent underline-offset-4 hover:underline" href="/contact">
            contact page
          </Link>
          .
        </p>
      </section>

      <p className="mt-10 text-sm text-muted">
        <Link className="text-accent underline-offset-4 hover:underline" href="/">
          ← Back to all phrases
        </Link>
      </p>
    </main>
  );
}
