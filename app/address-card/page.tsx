import type { Metadata } from "next";
import Link from "next/link";
import AudioButton from "@/components/AudioButton";
import JsonLd from "@/components/JsonLd";
import { AddressCardTool } from "@/components/TripCardTools";
import { audioForPhrase } from "@/lib/audio";
import { getPhraseById } from "@/lib/phrases";
import { phrasePath, phraseSlug } from "@/lib/slug";
import { SITE_NAME } from "@/lib/site";
import { breadcrumbSchema, faqSchema, urlOf } from "@/lib/jsonld";

const PATH = "/address-card";
const TITLE = "Address Card for China: Show Taxi Drivers Where to Go";
const DESCRIPTION =
  "A free address card for China: paste your hotel's Chinese name and address once, and show the card to any taxi or Didi driver — printable, saved on your own device, works offline.";

const FAQ = [
  {
    q: "How do I show a taxi driver an address in China?",
    a: "Show the Chinese characters and say 请带我去这个地址 (please take me to this address). Drivers read the characters in about two seconds; a spoken English or romanised address can take minutes and still fail. This page turns your hotel's booking details into exactly that card.",
  },
  {
    q: "Why don't Chinese taxi drivers understand spoken addresses?",
    a: "Three reasons pile up: Chinese addresses run from largest to smallest (city, district, street, building) which is the reverse of English, street and hotel names have many near-identical sounds, and your accent reorders the tones. Every local solves this the same way — by showing text, not speaking it.",
  },
  {
    q: "What do I do if the driver can't find my hotel?",
    a: "Show the phone number on the card — the driver calls the front desk, and the front desk explains in Chinese. That is why the phone line is on the card. If the driver still can't place it, head for the backup destination (a landmark or metro station nearby) and navigate the last stretch on foot.",
  },
  {
    q: "Does the address card work offline?",
    a: "Yes. The card is saved on your own device, not on a server, and this site works offline after your first visit — which is exactly when you need it, standing outside a station with no signal.",
  },
];

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: urlOf(PATH) },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: urlOf(PATH),
    images: ["/og.png"],
  },
};

export default function AddressCardPage() {
  const phrase = getPhraseById(55)!;

  return (
    <main className="mx-auto max-w-md px-5 pt-8 pb-16">
      <JsonLd
        schema={[
          breadcrumbSchema([{ name: "Address card", path: PATH }]),
          faqSchema(FAQ),
        ]}
      />

      <nav className="mb-6 print:hidden">
        <Link href="/" className="text-sm text-muted underline underline-offset-4">
          {SITE_NAME}
        </Link>
      </nav>

      <header className="mb-6">
        <span className="text-4xl" aria-hidden="true">
          🏨
        </span>
        <h1 className="mt-2 text-3xl leading-tight font-semibold tracking-tight text-ink">
          Address card for China: show the driver where to go
        </h1>
        {/* 纸上是给司机看的：只留短语和卡片本体，这段说明不上纸 */}
        <p className="print:hidden mt-3 text-base leading-relaxed text-muted">
          The first ten seconds of every taxi ride in China are the hard part:
          the driver needs your destination in Chinese, and a spoken street
          address usually means nothing. Locals don't speak addresses either —
          they show them. Paste your hotel's Chinese details once, and this
          card is ready for every ride.
        </p>
      </header>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-ink">
          The one sentence that goes with it
        </h2>
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-lg leading-snug font-medium text-ink">
              {phrase.chinese}
            </p>
            <p className="text-sm text-muted">
              {phrase.pinyin} · {phrase.english}
            </p>
          </div>
          <AudioButton text={phrase.chinese} src={audioForPhrase(phrase)} label="Listen" />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Show the card first, then say it. If the driver asks something back
          you can't follow, point at the card again — that is the whole
          protocol.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-ink">Your card</h2>
        <p className="mt-1.5 text-sm text-muted">
          Copy the Chinese name and address from your booking page or the
          hotel's own website. It is saved on your own device, and it also
          fills in the hotel lines of the{" "}
          <Link href="/emergency-card/" className="text-accent underline underline-offset-4">
            emergency card
          </Link>
          .
        </p>
        <div className="mt-4">
          <AddressCardTool />
        </div>
      </section>

      <section className="print:hidden mb-8">
        <h2 className="text-xl font-semibold text-ink">Three habits that make it work</h2>
        <ol className="mt-3 space-y-2.5 text-base leading-relaxed text-muted">
          <li>
            <strong className="text-ink">Fill it in before you fly</strong>,
            while you still have your booking email open — hotel Wi-Fi may not
            reach it.
          </li>
          <li>
            <strong className="text-ink">Screenshot the card</strong> and keep
            it in your phone's favourites so it opens without unlocking
            anything.
          </li>
          <li>
            <strong className="text-ink">When you check out</strong>, ask the
            front desk for a card with the hotel's Chinese address — paper
            still beats screens when your phone battery is at 5%.
          </li>
        </ol>
      </section>

      <section className="print:hidden mb-8">
        <h2 className="text-xl font-semibold text-ink">Questions</h2>
        <div className="mt-3 space-y-4">
          {FAQ.map((f) => (
            <div key={f.q}>
              <h3 className="text-base font-medium text-ink">{f.q}</h3>
              <p className="mt-1 text-base leading-relaxed text-muted">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-card p-5 print:hidden">
        <h2 className="text-base font-medium text-ink">Related</h2>
        <ul className="mt-2 space-y-1.5 text-sm">
          <li>
            <Link
              href={phrasePath(phraseSlug(phrase))}
              className="text-accent underline underline-offset-4"
            >
              How to say “please take me to this address” in Chinese
            </Link>
          </li>
          <li>
            <Link
              href="/scenarios/taking-a-taxi/"
              className="text-accent underline underline-offset-4"
            >
              Taking a taxi: the full step-by-step guide
            </Link>
          </li>
          <li>
            <Link
              href="/emergency-card/"
              className="text-accent underline underline-offset-4"
            >
              The emergency card
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
