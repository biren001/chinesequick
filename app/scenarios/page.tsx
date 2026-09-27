import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/components/JsonLd";
import { SCENARIOS, SCENARIO_STEP_TOTAL } from "@/lib/scenarios";
import { CHECKLIST_TOTAL } from "@/lib/checklistItems";
import { breadcrumbSchema, scenarioHubSchema, urlOf } from "@/lib/jsonld";
import { SITE_NAME } from "@/lib/site";

const META_TITLE = "Chinese phrase guides for real situations";
const META_DESCRIPTION =
  "Step-by-step Chinese phrase guides for the situations you actually hit in China: airport, taxi, hotel, restaurants, paying and getting around.";

export const metadata: Metadata = {
  title: { absolute: META_TITLE },
  description: META_DESCRIPTION,
  alternates: { canonical: urlOf("/scenarios") },
  openGraph: {
    title: META_TITLE,
    description: META_DESCRIPTION,
    url: urlOf("/scenarios"),
    // 覆盖 openGraph 会整体替换父级配置，images 必须显式带上，否则分享卡片无图
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Chinese phrases by situation — ChineseQuick",
      },
    ],
  },
};

/**
 * 场景总览页：Scenario Mode 的入口。
 * 存在的意义是把「分类集合页」（按词性/主题切）和「场景流程页」（按真实顺序切）
 * 连起来 —— 后者更贴近搜索意图（how to order food in Chinese），
 * 前者更适合系统学。两者互为对方的分发渠道。
 */
export default function ScenariosPage() {
  return (
    <main className="mx-auto max-w-md px-5 pt-8 pb-16">
      <JsonLd
        schema={[
          breadcrumbSchema([{ name: "Situation guides", path: "/scenarios" }]),
          scenarioHubSchema(SCENARIOS),
        ]}
      />

      <nav className="mb-6">
        <Link
          href="/"
          className="text-sm text-muted underline underline-offset-4"
        >
          {SITE_NAME}
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl leading-tight font-semibold tracking-tight text-ink">
          What to say, in the order you&apos;ll need it
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          The phrase lists tell you what exists. These walk you through a real
          situation from beginning to end — what you say, what the other person
          is likely to say back, and what usually goes wrong. Everything here
          uses phrases you can already hear on this site, so nothing is new
          vocabulary.
        </p>
        <p className="mt-3 text-sm text-muted">
          {SCENARIOS.length} situations · {SCENARIO_STEP_TOTAL} steps · no
          sign-up
        </p>
      </header>

      <ol className="space-y-3">
        {SCENARIOS.map((s, i) => (
          <li key={s.slug}>
            <Link
              href={`/scenarios/${s.slug}`}
              className="flex items-start gap-4 rounded-2xl border border-line bg-card px-5 py-4 transition hover:border-accent active:scale-[0.99]"
            >
              <span className="text-3xl" aria-hidden="true">
                {s.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-muted">
                  Step {i + 1}
                </span>
                <span className="mt-0.5 block text-lg font-medium text-ink">
                  {s.name}
                </span>
                <span className="mt-0.5 block text-sm text-muted">
                  {s.blurb}
                </span>
                <span className="mt-1 block text-xs text-muted">
                  {s.steps.length} steps
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <section className="mt-10 rounded-2xl border border-line bg-card p-5">
        <h2 className="text-base font-medium text-ink">Before you fly</h2>
        <p className="mt-1.5 text-sm text-muted">
          The {CHECKLIST_TOTAL}-point checklist covers the paperwork, payments
          and data you should sort out at home — the things no phrase can fix
          once you&apos;ve landed.
        </p>
        <Link
          href="/china-travel-checklist"
          className="mt-4 inline-block w-full rounded-xl bg-accent px-5 py-3 text-center text-base font-medium text-white transition hover:opacity-90 active:scale-[0.98]"
        >
          Start the China travel checklist
        </Link>
      </section>

      <p className="mt-6 text-center text-sm text-muted">
        <Link
          href="/chinese-numbers"
          className="text-accent underline-offset-4 hover:underline"
        >
          Chinese numbers 0–10,000
        </Link>
        <span aria-hidden="true"> · </span>
        <Link
          href="/saved"
          className="text-accent underline-offset-4 hover:underline"
        >
          Your saved phrases
        </Link>
      </p>
    </main>
  );
}
