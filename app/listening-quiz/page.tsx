import type { Metadata } from "next";
import Link from "next/link";
import ListeningQuiz from "@/components/ListeningQuiz";
import JsonLd from "@/components/JsonLd";
import { PHRASES } from "@/lib/phrases";
import { SITE_NAME } from "@/lib/site";
import { breadcrumbSchema, faqSchema, urlOf } from "@/lib/jsonld";

const PATH = "/listening-quiz";
const TITLE = "Chinese Listening Quiz: Hear It, Pick It";
const DESCRIPTION = `A free Chinese listening quiz: hear a real recording of one of ${PHRASES.length} everyday phrases and pick what it means. Made for travellers — no characters needed to start.`;

const FAQ = [
  {
    q: "How can I practise listening to Chinese as a beginner?",
    a: "Short and repeated is what works: hear one real phrase, guess what it means, then check yourself and hear it again. This quiz does exactly that with everyday travel phrases — each one is a recording you can replay as many times as you need, and the answer reveals the characters and pinyin after you guess, so your ear learns before your eyes do.",
  },
  {
    q: "Do I need to read Chinese characters to play?",
    a: "No. You hear a phrase and choose from four English meanings, so the quiz works from day one. After each answer you see the characters and pinyin together with the audio — that is how the shapes start sticking, without ever being the entry requirement.",
  },
  {
    q: "Which phrases are in the quiz?",
    a: `The same ${PHRASES.length} phrases as the rest of the site: greetings, restaurant and food, taxis and trains, hotels, shopping, money and emergencies. Every question links to the full phrase page with a word-by-word breakdown and the situations you would use it in.`,
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

export default function ListeningQuizPage() {
  return (
    <main className="mx-auto max-w-md px-5 pt-8 pb-16">
      <JsonLd
        schema={[
          breadcrumbSchema([{ name: "Listening quiz", path: PATH }]),
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
          🎧
        </span>
        <h1 className="mt-2 text-3xl leading-tight font-semibold tracking-tight text-ink">
          Chinese listening quiz
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Train your ear with the same phrases you will actually use in China:
          hear a phrase in Mandarin and pick what it means. No characters
          needed to start — the answer shows them after you guess.
        </p>
      </header>

      <ListeningQuiz />

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
              href="/7-day-chinese-course/"
              className="text-accent underline underline-offset-4"
            >
              Learn Chinese in 7 days
            </Link>
          </li>
          <li>
            <Link
              href="/scenarios/"
              className="text-accent underline underline-offset-4"
            >
              Step-by-step situation guides
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
        </ul>
      </section>
    </main>
  );
}
