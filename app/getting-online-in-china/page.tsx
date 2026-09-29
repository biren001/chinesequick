import type { Metadata } from "next";
import Link from "next/link";
import AudioButton from "@/components/AudioButton";
import JsonLd from "@/components/JsonLd";
import { audioForPhrase } from "@/lib/audio";
import { getPhraseById } from "@/lib/phrases";
import { phrasePath, phraseSlug } from "@/lib/slug";
import { SITE_NAME } from "@/lib/site";
import { breadcrumbSchema, faqSchema, urlOf } from "@/lib/jsonld";

const PATH = "/getting-online-in-china";
const TITLE = "Getting Online in China: eSIM, Wi-Fi and Data";
const DESCRIPTION =
  "How to get internet in China as a traveller: eSIM and roaming vs a local SIM, why hotel Wi-Fi asks for a Chinese number, which apps work, and the two phrases to ask for Wi-Fi.";

/**
 * 「哪些 App 能用」是会变的事实 → 按站规标注核对时间并 SSR 出来。
 * 规则出处：站规第 3 条（会变的事实配 Last checked 且必须 SSR）。
 */
const APPS_LAST_CHECKED = "29 September 2026";

const FAQ = [
  {
    q: "Does WhatsApp work in China?",
    a: "Not on the local Chinese network. Apps from outside China — WhatsApp, Instagram, Facebook, Google services including Gmail and Google Maps — are not reliably accessible in mainland China. If your usual apps matter to you, use an international data plan or a travel eSIM: your data then goes through your home carrier, so the apps on your phone behave the way they do at home. Whatever you choose, download offline maps and an offline Chinese translation pack before you fly.",
  },
  {
    q: "Can a foreigner buy a SIM card in China?",
    a: "Yes. Airport counters and phone shops sell tourist SIMs, and buying one requires your passport — China registers every SIM to a real name, so the process takes ten to twenty minutes rather than a vending machine minute. With a Chinese SIM you are on the Chinese network, so plan around the app list above.",
  },
  {
    q: "Is hotel Wi-Fi free in China?",
    a: "Usually yes — but the login page often asks for a Chinese mobile number to receive an SMS code. That is not a paywall; the front desk deals with it every day, so hand them your phone or ask at check-in. Café and airport Wi-Fi works the same way, and your hotel's Chinese address on the address card makes asking easy.",
  },
  {
    q: "Which apps should I install before going to China?",
    a: "Four cover almost everything: WeChat for chat and showing QR codes, Alipay for payments (it accepts international cards), Didi for rides, and Amap or Baidu Maps for directions — Google Maps is unreliable for walking directions in China. Add a translate app with an offline Chinese pack. Set them all up at home; doing it on airport Wi-Fi after a long flight is the hard way.",
  },
];

/** 页面上带音频的两条短语：直接复用已有句子，零新音频。 */
const PHRASE_IDS = [26, 57];

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

export default function GettingOnlinePage() {
  const phrases = PHRASE_IDS.map((id) => getPhraseById(id)).filter(
    (p): p is NonNullable<typeof p> => Boolean(p)
  );

  return (
    <main className="mx-auto max-w-md px-5 pt-8 pb-16">
      <JsonLd
        schema={[
          breadcrumbSchema([{ name: "Getting online in China", path: PATH }]),
          faqSchema(FAQ),
        ]}
      />

      <nav className="mb-6">
        <Link href="/" className="text-sm text-muted underline underline-offset-4">
          {SITE_NAME}
        </Link>
      </nav>

      <header className="mb-6">
        <span className="text-4xl" aria-hidden="true">
          📶
        </span>
        <h1 className="mt-2 text-3xl leading-tight font-semibold tracking-tight text-ink">
          Getting online in China
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          The one data decision that matters, you make before you fly: how your
          phone gets online in China decides which apps work when you land.
          Here are the three ways in, what each one means for your apps, and
          the two phrases for finding Wi-Fi once you are there.
        </p>
      </header>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-ink">Three ways to get data</h2>
        <div className="mt-3 space-y-3">
          <div className="rounded-2xl border border-line bg-card px-4 py-4">
            <p className="text-base font-medium text-ink">
              1. International roaming or a travel eSIM
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              You set it up at home, it activates when you land, and your data
              goes through your home carrier — so your usual apps keep working
              exactly as they do at home. It costs more per gigabyte than a
              local SIM, but for a one-to-two-week trip it is the simplest
              choice and there is nothing to sort out on arrival.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-card px-4 py-4">
            <p className="text-base font-medium text-ink">2. A local Chinese SIM</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              Cheapest data, bought at airport counters or phone shops. Bring
              your passport: every SIM in China is registered to a real name.
              You get a Chinese number, which also makes hotel Wi-Fi logins
              easier — but you are on the Chinese network, so the app list
              below applies in full.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-card px-4 py-4">
            <p className="text-base font-medium text-ink">3. Hotel and café Wi-Fi</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              Free and usually fast, but the login page often wants a Chinese
              mobile number for the SMS code. Not a paywall — the front desk
              sorts it out in a minute. Wi-Fi alone is a risky plan: you want
              maps and Didi working on the street, not just in the lobby.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-ink">
          Which apps work in China?
        </h2>
        <div className="mt-3 space-y-2">
          <div className="rounded-2xl border border-line bg-success-soft px-4 py-3">
            <p className="text-sm font-medium text-ink">
              Work normally: WeChat · Alipay · Didi · Amap · Baidu Maps
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              These are the apps daily life in China runs on — payments, rides,
              directions. All of them have English interfaces, and Alipay and
              WeChat Pay accept international cards.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-danger-soft px-4 py-3">
            <p className="text-sm font-medium text-ink">
              Not reliably accessible: Google services · WhatsApp · Instagram · Facebook
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              On the Chinese network these do not load dependably. On
              international roaming or a travel eSIM, your data goes through
              your home carrier instead, so they behave as they do at home.
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">
          App availability last checked {APPS_LAST_CHECKED} — it can change, so
          treat this list as a planning guide and download offline maps and an
          offline translation pack either way.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold text-ink">
          Two phrases for when you land
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          Tap to hear them — these are from the hotel and travel categories.
        </p>
        <ul className="mt-3 space-y-2">
          {phrases.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={phrasePath(phraseSlug(p))}
                  className="block text-lg leading-snug font-medium text-ink underline-offset-4 hover:underline"
                >
                  {p.chinese}
                </Link>
                <p className="text-sm text-muted">
                  {p.pinyin} · {p.english}
                </p>
              </div>
              <AudioButton text={p.chinese} src={audioForPhrase(p)} label="Listen" />
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8">
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
              href="/china-travel-checklist/"
              className="text-accent underline underline-offset-4"
            >
              The China travel checklist
            </Link>
          </li>
          <li>
            <Link
              href="/learn/hotel/"
              className="text-accent underline underline-offset-4"
            >
              All 10 hotel phrases
            </Link>
          </li>
          <li>
            <Link
              href="/address-card/"
              className="text-accent underline underline-offset-4"
            >
              The address card for taxis and Didi
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}
