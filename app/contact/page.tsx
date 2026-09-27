import type { Metadata } from "next";
import Link from "next/link";
import FeedbackLink from "@/components/FeedbackLink";
import { FEEDBACK_URL } from "@/lib/site";
import { urlOf } from "@/lib/jsonld";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "How to report a wrong or unnatural Chinese phrase, a missing situation, an audio problem or a bug. No email required.",
  alternates: { canonical: urlOf("/contact") },
};

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-md px-5 pt-14 pb-16">
      <h1 className="text-3xl leading-tight font-semibold tracking-tight text-ink">Contact</h1>
      <p className="mt-3 text-base leading-relaxed text-muted">
        ChineseQuick is a small independent project. Corrections are the most useful thing you
        can send — they go straight into the phrase list.
      </p>

      <section className="mt-8">
        <h2 className="text-base font-medium text-ink">Most useful messages</h2>
        <ul className="mt-3 space-y-2.5 text-sm text-muted">
          <li className="flex gap-3">
            <span aria-hidden="true">✏️</span>
            <span>
              <strong className="font-medium text-ink">A phrase is wrong or unnatural.</strong> If
              you speak Chinese, tell us what a local would actually say instead.
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true">🧭</span>
            <span>
              <strong className="font-medium text-ink">A situation is missing.</strong> The gap
              that made you leave the site is exactly what should be added next.
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true">🔊</span>
            <span>
              <strong className="font-medium text-ink">The audio sounds off.</strong> Slow, clipped
              or wrong tone — say which phrase.
            </span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true">🐞</span>
            <span>
              <strong className="font-medium text-ink">Something is broken.</strong> Which page,
              which device, what you expected.
            </span>
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-medium text-ink">Send it</h2>
        {FEEDBACK_URL ? (
          <>
            <p className="mt-3 text-sm text-muted">
              The form takes a minute and needs no account. There is no email address to remember and
              no newsletter.
            </p>
            <div className="mt-4">
              <FeedbackLink />
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-muted">
            The feedback form is not configured on this deployment — if you are running the site
            yourself, set <code className="text-xs">NEXT_PUBLIC_FEEDBACK_URL</code> to enable it.
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-base font-medium text-ink">What happens to your message</h2>
        <p className="mt-3 text-sm text-muted">
          It is read by the person who maintains the phrase list and used to fix the site. Nothing
          is published with your name attached, and no email is stored unless you choose to leave one
          so we can reply. See the{" "}
          <Link className="text-accent underline-offset-4 hover:underline" href="/privacy">
            Privacy Policy
          </Link>{" "}
          for the detail.
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
