import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";

// 这是「断网兜底页」：Service Worker 在离线且页面没有缓存时，会把它返回给用户，
// 而不是返回首页内容（那样 URL 与内容对不上，用户会以为页面坏了）。
// 它不是一个内容页 → 明确 noindex，且**不进 sitemap**（sitemap.ts 是显式列表，天然不含它）。
export const metadata: Metadata = {
  title: "You're offline",
  description:
    "ChineseQuick works offline — but only the pages your device has already stored. Here is what is available right now.",
  robots: { index: false, follow: true },
};

export default function OfflinePage() {
  return (
    <main className="mx-auto max-w-md px-5 pt-14 pb-16">
      <h1 className="text-3xl leading-tight font-semibold tracking-tight text-ink">
        You&rsquo;re offline
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted">
        That page isn&rsquo;t stored on this device yet. Everything below is — open it with no
        connection at all.
      </p>

      <section className="mt-8">
        <h2 className="text-base font-medium text-ink">Works without a connection</h2>
        <ul className="mt-3 space-y-2.5 text-sm text-muted">
          <li>
            <Link className="text-accent underline-offset-4 hover:underline" href="/">
              All 105 phrases
            </Link>{" "}
            — search by English, pinyin or Chinese
          </li>
          <li>
            <Link
              className="text-accent underline-offset-4 hover:underline"
              href="/china-travel-checklist"
            >
              Trip checklist
            </Link>{" "}
            — the 17 things to sort out before you fly
          </li>
          <li>
            <Link className="text-accent underline-offset-4 hover:underline" href="/scenarios">
              Situations
            </Link>{" "}
            — what to say, and what you&rsquo;ll hear back
          </li>
          <li>
            <Link className="text-accent underline-offset-4 hover:underline" href="/chinese-numbers">
              Numbers
            </Link>{" "}
            — with audio
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-medium text-ink">By category</h2>
        <p className="mt-3 flex flex-wrap gap-x-3 gap-y-2 text-sm">
          {CATEGORIES.map((c) => (
            <Link
              key={c.id}
              className="text-accent underline-offset-4 hover:underline"
              href={`/${c.seoSlug}`}
            >
              {c.name}
            </Link>
          ))}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-base font-medium text-ink">Audio</h2>
        <p className="mt-3 text-sm text-muted">
          All 401 audio files are saved on your device the first time you open the site, so tapping{" "}
          <strong className="font-medium text-ink">Listen</strong> works with the network switched
          off. If a phrase page won&rsquo;t open, it simply hasn&rsquo;t been stored yet — connect
          once, open the pages you want for the trip, and they&rsquo;ll work offline from then on.
        </p>
      </section>
    </main>
  );
}
