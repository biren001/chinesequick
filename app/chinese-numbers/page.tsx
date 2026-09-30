import type { Metadata } from "next";
import Link from "next/link";
import AudioButton from "@/components/AudioButton";
import JsonLd from "@/components/JsonLd";
import { audioForNumber } from "@/lib/audio";
import { CATEGORIES } from "@/lib/categories";
import { breadcrumbSchema, faqSchema, urlOf } from "@/lib/jsonld";
import { NUMBERS, numbersBySection, type NumberItem } from "@/lib/numbers";
import { PHRASES } from "@/lib/phrases";

const PATH = "/chinese-numbers";
// 标题含品牌后缀（模板会补 " | ChineseQuick"）后要控制在 60 字内。
const TITLE = "Chinese numbers: how to count to 10,000";
const DESCRIPTION =
  "Chinese numbers from 0 to 10,000 with audio: the ten characters to learn first, how 11–99 are built, what 百 and 万 mean, and how prices are read out in 块.";

const FAQ = [
  {
    q: "How do you say numbers in Chinese?",
    a: "Chinese numbers 0 to 10 are 零 一 二 三 四 五 六 七 八 九 十 (líng, yī, èr, sān, sì, wǔ, liù, qī, bā, jiǔ, shí). Every other number is built by stacking those ten characters: 11 is 十一 (ten-one), 20 is 二十 (two-ten) and 55 is 五十五 (five-ten-five). There are no separate words to memorise for 11, 12 or 20.",
  },
  {
    q: "How do you say 100, 1,000 and 10,000 in Chinese?",
    a: "100 is 一百 (yì bǎi), 1,000 is 一千 (yì qiān) and 10,000 is 一万 (yí wàn). The big difference from English is 万: Chinese groups large numbers in units of ten thousand, not thousands. So 20,000 is 两万 (two 万), 100,000 is 十万 (ten 万) and 1,000,000 is 一百万.",
  },
  {
    q: "How do you say prices in Chinese?",
    a: "The unit is 块 (kuài) when you speak and 元 (yuán) on signs, menus and receipts — same money, two words. Prices are read straight through: 十块五 is 10.50 yuan, 两百块 is 200 yuan. Ten 分 (fēn) make a 角 (jiǎo) and ten 角 make a 块, but 角 is rare on modern prices.",
  },
  {
    q: "When do you use 两 instead of 二 for two?",
    a: "二 (èr) is two as a number — counting, phone numbers, dates. 两 (liǎng) is used before a measure word: 两个人 (two people), 两百 (200 yuan), 两万 (20,000). Saying 二百 in speech sounds like you are reading a form out loud, so 两百 is what you want at a till.",
  },
  {
    q: "How do you ask how much something costs in Chinese?",
    a: "多少钱？ (Duōshao qián?) is the phrase — it needs no grammar to work, and pointing at the item is enough. Add a word in front to be specific: 这个多少钱？ (how much is this one?) or 一共多少钱？ (how much altogether?).",
  },
];

/** 数字小卡片：字大、拼音小，右下角一个只显示图标的小喇叭。 */
function NumberChip({ item }: { item: NumberItem }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-2 py-3 text-center">
      <p className="text-2xl leading-tight font-medium text-ink">{item.zh}</p>
      <p className="mt-0.5 text-xs text-accent">{item.py}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-muted">{item.en}</p>
      <AudioButton
        text={item.zh}
        src={audioForNumber(item.zh)}
        variant="ghost"
        className="mt-1"
      />
    </div>
  );
}

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

export default function ChineseNumbersPage() {
  return (
    <main className="mx-auto max-w-md px-5 pt-8 pb-16">
      <JsonLd
        schema={[
          breadcrumbSchema([{ name: "Chinese numbers", path: PATH }]),
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
          🔢
        </span>
        <h1 className="mt-2 text-3xl leading-tight font-semibold tracking-tight text-ink">
          Chinese numbers: how to count to 10,000
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          Chinese numbers are built from ten characters, and once you have those you can say any
          price, floor, platform or phone number you will meet in China. There is no separate word
          for eleven, twelve or twenty — you stack the ten.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="mb-3 text-base font-medium text-ink">0 to 10 — learn these first</h2>
        <div className="grid grid-cols-3 gap-2">
          {numbersBySection("basics").map((n) => (
            <NumberChip key={n.zh} item={n} />
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">
          Tap any character to hear it. These eleven are the whole foundation: everything below is
          assembled from them.
        </p>
        <p className="mt-3 text-sm text-muted">
          Think you can tell 四 from 十 by ear?{" "}
          <Link
            href="/numbers-quiz"
            className="text-accent underline underline-offset-4 hover:underline"
          >
            Take the numbers listening quiz
          </Link>
          .
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-base font-medium text-ink">
          How every other number is built
        </h2>
        <ol className="space-y-3 text-sm text-muted">
          <li className="rounded-2xl border border-line bg-card p-4">
            <p className="text-sm font-medium text-ink">11–19: ten, then the unit</p>
            <p className="mt-1.5">
              十一 (11), 十二 (12), 十九 (19). Literally “ten-one”, “ten-two”, “ten-nine”.
            </p>
          </li>
          <li className="rounded-2xl border border-line bg-card p-4">
            <p className="text-sm font-medium text-ink">20–99: unit, ten, unit</p>
            <p className="mt-1.5">
              二十 (20), 三十五 (35), 九十九 (99). No 和 or “and” anywhere — the characters run
              straight together.
            </p>
          </li>
          <li className="rounded-2xl border border-line bg-card p-4">
            <p className="text-sm font-medium text-ink">Zero holds an empty place: 零</p>
            <p className="mt-1.5">
              105 is 一百零五 (one hundred, <em>zero</em>, five). The 零 keeps the tens slot from
              collapsing — drop it and it reads like 一百五, which people hear as 150.
            </p>
          </li>
          <li className="rounded-2xl border border-line bg-card p-4">
            <p className="text-sm font-medium text-ink">百, 千 and the 万 that changes everything</p>
            <p className="mt-1.5">
              一百 (100), 一千 (1,000), 一万 (10,000). Chinese counts in ten-thousands where
              English counts in thousands: 20,000 is 两万, 100,000 is 十万, 1,000,000 is 一百万.
            </p>
          </li>
          <li className="rounded-2xl border border-line bg-card p-4">
            <p className="text-sm font-medium text-ink">Speakers drop the last zero</p>
            <p className="mt-1.5">
              3,500 is usually 三千五, not 三千五百. Short and long forms both exist, so 一千五
              can mean 1,500 — context, and a written price, settle it.
            </p>
          </li>
        </ol>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {numbersBySection("building").map((n) => (
            <NumberChip key={n.zh} item={n} />
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-base font-medium text-ink">Saying prices</h2>
        <div className="grid grid-cols-3 gap-2">
          {numbersBySection("money").map((n) => (
            <NumberChip key={n.zh} item={n} />
          ))}
        </div>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          <li>
            <span className="text-ink">块 and 元 are the same yuan.</span> 块 is what people say,
            元 is what receipts print. 十块 = 十元 = 10 yuan.
          </li>
          <li>
            <span className="text-ink">Decimals run straight on.</span> 十块五 = 10.5 yuan, 三块二 =
            3.2 yuan. No word for “point” in everyday speech.
          </li>
          <li>
            <span className="text-ink">两百, not 二百.</span> Before a unit, two becomes 两 — 两百块
            (200 yuan), 两万 (20,000).
          </li>
          <li>
            <span className="text-ink">半 is half.</span> 半块 is half a yuan, 三点半 is half past
            three.
          </li>
        </ul>
        <p className="mt-4 text-sm text-muted">
          To actually ask the price you need one sentence:{" "}
          <Link
            href="/how-to-say-how-much-in-chinese"
            className="text-accent underline-offset-4 hover:underline"
          >
            多少钱？ (How much?)
          </Link>
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-base font-medium text-ink">Time and dates</h2>
        <div className="grid grid-cols-3 gap-2">
          {numbersBySection("time").map((n) => (
            <NumberChip key={n.zh} item={n} />
          ))}
        </div>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          <li>
            <span className="text-ink">Time:</span> 三点 (3:00), 三点半 (3:30), 三点十五 (3:15).
            Minutes are just the number after 点.
          </li>
          <li>
            <span className="text-ink">Dates:</span> month first, then 号 — 五月八号 is 8 May. To
            ask the date, say 今天几号？
          </li>
          <li>
            <span className="text-ink">Where you will actually need this:</span> platform and seat
            numbers, hotel floors, taxi fares, and the price of everything.
          </li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-base font-medium text-ink">Questions about Chinese numbers</h2>
        <div className="space-y-3">
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

      <section className="mb-10">
        <h2 className="mb-3 text-base font-medium text-ink">Use them in the wild</h2>
        <p className="text-sm text-muted">
          Numbers show up in every situation on this site — these {PHRASES.length} phrases are
          grouped by where you will be standing when you need them.
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

      <div className="rounded-2xl bg-accent-soft p-5 text-center">
        <p className="text-base font-medium text-ink">Going to China?</p>
        <p className="mt-1.5 text-sm text-muted">
          {NUMBERS.length} number sounds are the start. The rest is a short list you can work
          through before you fly.
        </p>
        <Link
          href="/china-travel-checklist"
          className="mt-4 inline-block rounded-xl bg-accent px-5 py-3 text-base font-medium text-white transition hover:opacity-90 active:scale-[0.98]"
        >
          China travel checklist
        </Link>
      </div>
    </main>
  );
}
