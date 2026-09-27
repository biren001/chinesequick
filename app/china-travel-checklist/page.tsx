import type { Metadata } from "next";
import Link from "next/link";
import ChecklistTool from "@/components/ChecklistTool";
import JsonLd from "@/components/JsonLd";
import { CATEGORIES } from "@/lib/categories";
import { CHECKLIST_LAST_CHECKED, CHECKLIST_TOTAL } from "@/lib/checklistItems";
import { breadcrumbSchema, faqSchema, urlOf } from "@/lib/jsonld";
import { PHRASES } from "@/lib/phrases";

const PATH = "/china-travel-checklist";
// 标题含品牌后缀（模板会补 " | ChineseQuick"）后要控制在 60 字内，
// 否则 SERP 会截断 —— 同站单句页 43 字、分类页 54 字，别做异类。
const TITLE = "China Travel Checklist Before Your Trip";
const DESCRIPTION = `A ${CHECKLIST_TOTAL}-point checklist for your first trip to China: passport and entry rules, Alipay and WeChat Pay, mobile data, and the Chinese phrases you'll actually need.`;

const FAQ = [
  {
    q: "What should I prepare before travelling to China?",
    a: `Three stages, in the order you actually have to do them. Two to four weeks out: passport validity, entry rules for your nationality, accommodation that can register foreign guests, setting up Alipay or WeChat Pay, and telling your bank. About a week out: mobile data, checking which apps may not be reachable, offline maps, and the Chinese you will use most — everyday words, numbers, restaurant, taxi and train, and emergency phrases. The day before: cash as backup, a power bank and plug adapter, a photo of your passport, and your hotel's address saved in Chinese. That is the ${CHECKLIST_TOTAL}-point checklist on this page.`,
  },
  {
    q: "Can I use my credit card in China?",
    a: "Sometimes — hotels, airports and large stores usually take cards. For everything else, from taxis to small restaurants to convenience stores, people pay by scanning a QR code with Alipay or WeChat Pay. Both apps now accept international cards, and setting them up before you fly is much easier than sorting it out after you land.",
  },
  {
    q: "Do I need a visa to visit China?",
    a: "It depends on your passport. Many nationalities can enter China visa-free for short trips, and there is a separate rule for transit passengers. These rules change often, so confirm on the Chinese embassy or consulate site for your nationality before you book anything non-refundable.",
  },
  {
    q: "Do I need to speak Chinese to travel in China?",
    a: "In big-city hotels and airports you can often get by in English. Taxis, small restaurants, shops and train stations are a different story — there is frequently no English at all. A few dozen phrases cover almost every situation, which is what this site is for: every phrase comes with Chinese characters, pinyin and audio that works offline.",
  },
  {
    q: "How many Chinese phrases do I need for a trip?",
    a: `Around 30 everyday phrases (hello, thank you, yes, no, excuse me, I don't understand) plus 10 to 15 in each situation you expect — restaurant, taxi and train, hotel, shopping and emergencies. This site has ${PHRASES.length} free phrases across those six situations, all with audio and pinyin.`,
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
    // 子页自定义 openGraph 必须显式带 images —— Next 不会继承父级的 OG 图
    images: ["/og.png"],
  },
};

export default function ChinaTravelChecklistPage() {
  return (
    <main className="mx-auto max-w-md px-5 pt-8 pb-16">
      <JsonLd
        schema={[
          breadcrumbSchema([{ name: "China travel checklist", path: PATH }]),
          faqSchema(FAQ),
        ]}
      />

      <nav className="mb-6">
        <Link href="/" className="text-sm text-muted underline underline-offset-4">
          ChineseQuick
        </Link>
      </nav>

      <header className="mb-6">
        <span className="text-4xl" aria-hidden="true">
          🇨🇳
        </span>
        <h1 className="mt-2 text-3xl leading-tight font-semibold tracking-tight text-ink">
          China travel checklist: {CHECKLIST_TOTAL} things to do before you go
        </h1>
        <p className="mt-3 text-base text-muted">
          Everything on this list is something you cannot fix from the airport, or cannot fix
          cheaply once you land. It is ordered by when to do it: the items with waiting times
          first, the setup that needs your own wifi next, and the packing last. Tick items off as
          you go and your progress is saved on your own device, so you can come back to it over
          the next few weeks.
        </p>
        <p className="mt-3 text-xs text-muted">
          Entry rules, payment apps and mobile data change often. Items that link to an official
          source were last checked on {CHECKLIST_LAST_CHECKED}.
        </p>
      </header>

      <ChecklistTool />

      <section className="mt-10">
        <h2 className="text-base font-medium text-ink">While you&apos;re in China</h2>
        <p className="mt-2 text-sm text-muted">
          Once the admin is done, the day-to-day part is a few phrases in the right situation.
          These {PHRASES.length} phrases are grouped by where you&apos;ll be standing when you need
          them.
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {CATEGORIES.map((c) => (
            <li key={c.id}>
              <Link
                className="text-accent underline-offset-4 hover:underline"
                href={`/${c.seoSlug}`}
              >
                {c.emoji} Chinese phrases for {c.forLabel}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-medium text-ink">Questions people ask before a trip</h2>
        <div className="mt-4 space-y-3">
          {FAQ.map((entry) => (
            <details key={entry.q} className="rounded-2xl border border-line bg-card p-4">
              <summary className="cursor-pointer text-base font-medium text-ink">
                {entry.q}
              </summary>
              <p className="mt-2 text-sm text-muted">{entry.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="mt-10 rounded-2xl bg-accent-soft p-5 text-center">
        <p className="text-base font-medium text-ink">
          Start with the phrases you&apos;ll use on day one
        </p>
        <Link
          href="/learn/everyday"
          className="mt-3 inline-block w-full rounded-xl bg-accent px-5 py-3 text-base font-medium text-white transition hover:opacity-90 active:scale-[0.98]"
        >
          Learn the everyday phrases
        </Link>
      </div>

      <p className="mt-8 text-sm text-muted">
        <Link className="text-accent underline-offset-4 hover:underline" href="/">
          ← Back to all phrases
        </Link>
      </p>
    </main>
  );
}
