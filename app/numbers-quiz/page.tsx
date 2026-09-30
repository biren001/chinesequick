import type { Metadata } from "next";
import Link from "next/link";
import NumberQuiz from "@/components/NumberQuiz";
import JsonLd from "@/components/JsonLd";
import { NUMBERS } from "@/lib/numbers";
import { SITE_NAME } from "@/lib/site";
import { breadcrumbSchema, faqSchema, urlOf } from "@/lib/jsonld";

const PATH = "/numbers-quiz";
const TITLE = "Chinese Numbers Listening Quiz: Hear It, Pick It";
const DESCRIPTION = `A free Chinese number listening quiz: hear one of ${NUMBERS.length} number and money sounds with real audio and pick the one you heard. Trains the 四 vs 十 ear you need for prices.`;

const FAQ = [
  {
    q: "Why is it hard to hear Chinese numbers?",
    a: "Because the confusions are between whole syllables that differ only in tone: 四 (sì, four) and 十 (shí, ten) sound almost the same, and 七 (qī, seven) sits between them. At a market the difference is money — 三十 (thirty) versus 十三 (thirteen) is a haggling conversation, not a spelling mistake.",
  },
  {
    q: "How do I tell 四 (sì) and 十 (shí) apart?",
    a: "By tone and vowel: 四 is a sharp falling tone on an \"s\" sound, 十 is a rising tone on \"sh\". You cannot think your way there in a conversation — the fix is hearing both many times until the difference is automatic, which is exactly what this quiz drills: replay the sound as often as you need, then pick what you heard.",
  },
  {
    q: "What sounds are in the quiz?",
    a: `The ${NUMBERS.length} number and money sounds from the numbers guide: 零 to 十, 十一 and 二十, 一百 / 一千 / 一万, the money units 块 元 角 分, plus 两, 半, 点 and 号. Every question links back to the full numbers page, where each sound sits with its character, pinyin and how it is used.`,
  },
  {
    q: "Will this help me at markets and shops?",
    a: "Yes — prices are where number listening pays off. Sellers answer 多少钱 with a bare number plus 块, spoken fast, and quoting back the wrong 四 or 十 is how tourists overpay. A few minutes of this quiz before a market day makes the numbers arrive in your head before the seller's hand does.",
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

export default function NumbersQuizPage() {
  return (
    <main className="mx-auto max-w-md px-5 pt-8 pb-16">
      <JsonLd
        schema={[
          breadcrumbSchema([{ name: "Numbers listening quiz", path: PATH }]),
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
          🔢
        </span>
        <h1 className="mt-2 text-3xl leading-tight font-semibold tracking-tight text-ink">
          Chinese numbers listening quiz
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Numbers are the first thing anyone says at you at full speed — and
          the difference between 四 (four) and 十 (ten) is real money. Hear a
          number, pick what you heard. The answer reveals the meaning after
          you guess.
        </p>
      </header>

      <NumberQuiz />

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
              href="/chinese-numbers/"
              className="text-accent underline underline-offset-4"
            >
              Chinese numbers with audio
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
          <li>
            <Link
              href="/scenarios/bargaining-at-a-market/"
              className="text-accent underline underline-offset-4"
            >
              Bargaining at a market
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
