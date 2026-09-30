import type { Metadata } from "next";
import Link from "next/link";
import PriceQuiz from "@/components/PriceQuiz";
import JsonLd from "@/components/JsonLd";
import { SITE_NAME } from "@/lib/site";
import { breadcrumbSchema, faqSchema, urlOf } from "@/lib/jsonld";

const PATH = "/prices-quiz";
const TITLE = "Chinese Price Listening Quiz: Hear the Price, Pick It";
const DESCRIPTION =
  "A free Chinese price listening quiz: hear a full price — 三十五块五 and friends — played word by word with real audio, and pick the one you heard. Trains the ear you need the moment a seller answers 多少钱.";

const FAQ = [
  {
    q: "Why do I need to understand prices in Chinese?",
    a: "Because the price is the first full sentence anyone fires at you. You ask 多少钱 and the seller answers with a bare number plus 块, spoken at market speed, no hand gestures, no repetition. Understanding it on the first pass is the difference between paying the local price and paying the tourist price.",
  },
  {
    q: "How is this different from the numbers quiz?",
    a: "The numbers quiz drills single sounds — telling 四 from 十 in isolation. This quiz plays a whole price as one string: 三十五块五 is three words of number, the money word 块, and the 五角 ending, all run together. It is the listening version of reading digits versus reading a bill at a counter.",
  },
  {
    q: "What prices are in the quiz?",
    a: "Every whole price from one kuai to ninety-nine kuai, half of them with a 五角 (fifty cents) ending — so 三块, 十五块五, 二十块, 八十八块五 and everything between. Each price is played from real recorded audio of its words, back to back, exactly the way sellers say it.",
  },
  {
    q: "What confusions does it train?",
    a: "The expensive ones: 三十五 (thirty-five) versus 五十三 (fifty-three), where syllables swap; 四十五 (forty-five) versus 三十五, where sì and sān differ only in tone; and 三十五块 versus 三十五块五, where a missing 五角 quietly doubles the unit price. The wrong choices in each question are built from exactly these swaps.",
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

export default function PricesQuizPage() {
  return (
    <main className="mx-auto max-w-md px-5 pt-8 pb-16">
      <JsonLd
        schema={[
          breadcrumbSchema([{ name: "Price listening quiz", path: PATH }]),
          faqSchema(FAQ),
        ]}
      />

      <nav className="mb-6">
        <Link href="/" className="text-sm text-muted underline underline-offset-4">
          {SITE_NAME}
        </Link>
      </nav>

      <header className="mb-2">
        <span className="text-4xl" aria-hidden="true">
          💴
        </span>
        <h1 className="mt-2 text-3xl leading-tight font-semibold tracking-tight text-ink">
          Chinese price listening quiz
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          The seller answers 多少钱 with one string: 三十五块五 — no digits, no
          repetition, no slowing down. Hear a full price spoken word by word
          and pick what you heard. The answer reveals the meaning after you
          guess.
        </p>
      </header>

      <PriceQuiz />

      <section className="mb-8 mt-10">
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

      <section className="rounded-2xl border border-line bg-card p-5">
        <h2 className="text-base font-medium text-ink">Related</h2>
        <ul className="mt-2 space-y-1.5 text-sm">
          <li>
            <Link
              href="/numbers-quiz/"
              className="text-accent underline underline-offset-4"
            >
              Numbers listening quiz
            </Link>
          </li>
          <li>
            <Link
              href="/chinese-numbers/"
              className="text-accent underline underline-offset-4"
            >
              Chinese numbers with audio
            </Link>
          </li>
          <li>
            <Link
              href="/scenarios/bargaining-at-a-market/"
              className="text-accent underline underline-offset-4"
            >
              Bargaining at a market
            </Link>
          </li>
          <li>
            <Link
              href="/listening-quiz/"
              className="text-accent underline underline-offset-4"
            >
              Chinese listening quiz (phrases)
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
