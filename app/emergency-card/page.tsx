import type { Metadata } from "next";
import Link from "next/link";
import AudioButton from "@/components/AudioButton";
import JsonLd from "@/components/JsonLd";
import { EmergencyCardTool } from "@/components/TripCardTools";
import { audioForPhrase } from "@/lib/audio";
import { getPhraseById } from "@/lib/phrases";
import { phrasePath, phraseSlug } from "@/lib/slug";
import { SITE_NAME } from "@/lib/site";
import { breadcrumbSchema, faqSchema, urlOf } from "@/lib/jsonld";

const PATH = "/emergency-card";
const TITLE = "Emergency Card for China: Fill It In Before You Fly";
const DESCRIPTION =
  "A free emergency card for travellers in China: the 110/120/119 numbers, the six phrases that get help, and a card with your blood type, allergies and emergency contact — printable, works offline.";

/** 稳定到几乎不会变的事实，但按站规还是标注核对时间（SSR，AI 引用时可见）。 */
const NUMBERS_LAST_CHECKED = "29 September 2026";

const FAQ = [
  {
    q: "What is the emergency number in China?",
    a: "110 is the police, 120 is an ambulance, 119 is fire, and 122 is road traffic accidents. The numbers are the same across the whole country and are answered in Chinese — say the place you are at, or just stay on the line while they trace the call.",
  },
  {
    q: "How do I call an ambulance in China?",
    a: "Dial 120. Say your address first if you can — 大堂前台 means the hotel front desk, and handing the phone to the desk is often faster than speaking. Ambulances in China are run by hospitals and usually take payment at the hospital, so bring your phone or some cash.",
  },
  {
    q: "Should I carry an emergency card in China?",
    a: "Yes. In a real emergency you will not want to construct sentences, and the person helping you may not speak English. A card with your blood type, allergies, medications and emergency contact — plus your hotel's Chinese address — turns a stressful conversation into something you can just hand over.",
  },
  {
    q: "What medical information should the card include?",
    a: "Your name as your passport spells it, your nationality, your blood type, any drug allergies (penicillin matters most — it is the default first choice here), medications you take, and one emergency contact with the international dialling code. That is exactly the set on this page.",
  },
];

/** 卡上的固定短语：直接复用 emergency 分类里已有的句子和音频。 */
const CARD_PHRASE_IDS = [82, 85, 84, 88, 89, 86];

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

export default function EmergencyCardPage() {
  const phrases = CARD_PHRASE_IDS.map((id) => getPhraseById(id)).filter(
    (p): p is NonNullable<typeof p> => Boolean(p)
  );

  return (
    <main className="mx-auto max-w-md px-5 pt-8 pb-16">
      <JsonLd
        schema={[
          breadcrumbSchema([{ name: "Emergency card", path: PATH }]),
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
          🚨
        </span>
        <h1 className="mt-2 text-3xl leading-tight font-semibold tracking-tight text-ink">
          Emergency card for China: fill it in before you fly
        </h1>
        {/* 纸上是给别人看的：只留号码、短语和卡片本体，这段说明不上纸 */}
        <p className="print:hidden mt-3 text-base leading-relaxed text-muted">
          In a real emergency nobody constructs sentences — you point, you hand
          something over, or you dial. This page gives you all three: the
          numbers that work anywhere in China, the six phrases that summon
          help, and a card with your own medical details that you can show,
          screenshot or print.
        </p>
      </header>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-ink">The four numbers</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {[
            { n: "110", zh: "警察", en: "Police" },
            { n: "120", zh: "救护车", en: "Ambulance" },
            { n: "119", zh: "火警", en: "Fire" },
            { n: "122", zh: "交通事故", en: "Traffic accident" },
          ].map((x) => (
            <div
              key={x.n}
              className="rounded-2xl border border-line bg-card px-4 py-3"
            >
              <p className="text-2xl font-semibold tabular-nums text-ink">
                {x.n}
              </p>
              <p className="mt-0.5 text-lg leading-snug text-ink">{x.zh}</p>
              <p className="text-sm text-muted">{x.en}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Numbers last checked {NUMBERS_LAST_CHECKED}. They are the same in
          every Chinese city and are free from any phone, including a locked
          one.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-ink">
          Six phrases that get help
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          These are the same phrases from the emergency category — tap to hear
          them.
        </p>
        <ul className="mt-3 space-y-2">
          {phrases.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-lg leading-snug font-medium text-ink">
                  {p.chinese}
                </p>
                <p className="text-sm text-muted">
                  {p.pinyin} · {p.english}
                </p>
              </div>
              <AudioButton
                text={p.chinese}
                src={audioForPhrase(p)}
                label="Listen"
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-ink">Your card</h2>
        <p className="mt-1.5 text-sm text-muted">
          Fill it in once — it is saved on your own device and shows up on the{" "}
          <Link href="/address-card/" className="text-accent underline underline-offset-4">
            address card
          </Link>{" "}
          too. The hotel lines come from the address card automatically.
        </p>
        <div className="mt-4">
          <EmergencyCardTool />
        </div>
      </section>

      <section className="print:hidden mb-8">
        <h2 className="text-xl font-semibold text-ink">How to use it</h2>
        <ol className="mt-3 space-y-2.5 text-base leading-relaxed text-muted">
          <li>
            <strong className="text-ink">Fill it in now, at home.</strong> The
            whole point is that you do this calmly, before anything happens.
          </li>
          <li>
            <strong className="text-ink">Screenshot the card</strong> so it
            shows even with your phone locked and offline.
          </li>
          <li>
            <strong className="text-ink">Hand the phone over.</strong> Show the
            card to a pharmacist, a hotel desk or a police officer — reading is
            always faster than translating.
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
              href={phrasePath(phraseSlug(getPhraseById(85)!))}
              className="text-accent underline underline-offset-4"
            >
              How to say “please call an ambulance” in Chinese
            </Link>
          </li>
          <li>
            <Link
              href="/chinese-emergency-phrases/"
              className="text-accent underline underline-offset-4"
            >
              All 13 emergency phrases
            </Link>
          </li>
          <li>
            <Link
              href="/china-travel-checklist/"
              className="text-accent underline underline-offset-4"
            >
              The China travel checklist
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
