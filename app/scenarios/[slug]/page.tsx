import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ScenarioView, { scenarioCanonical } from "@/components/ScenarioView";
import { getScenario, SCENARIOS } from "@/lib/scenarios";
import type { Scenario } from "@/lib/types";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** 全部场景在构建期预渲染；未知 slug 直接 404（静态导出下也不会走到这里）。 */
export function generateStaticParams() {
  return SCENARIOS.map((s) => ({ slug: s.slug }));
}

export const dynamicParams = false;

function metaTitleOf(scenario: Scenario): string {
  return scenario.metaTitle;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const scenario = getScenario(slug);
  if (!scenario) return { title: "Page not found" };

  return {
    // absolute 去掉站点后缀 —— 场景页的标题本身已经是完整长尾词，
    // 再接 " | ChineseQuick" 会被搜索结果截断。
    title: { absolute: metaTitleOf(scenario) },
    description: scenario.description,
    alternates: { canonical: scenarioCanonical(scenario) },
    openGraph: {
      title: metaTitleOf(scenario),
      description: scenario.description,
      url: scenarioCanonical(scenario),
      // 覆盖 openGraph 会整体替换父级配置，images 必须显式带上
      images: [
        {
          url: "/og.png",
          width: 1200,
          height: 630,
          alt: `${scenario.name} — Chinese phrases step by step`,
        },
      ],
    },
  };
}

export default async function ScenarioPage({ params }: PageProps) {
  const { slug } = await params;
  const scenario = getScenario(slug);
  if (!scenario) notFound();

  return <ScenarioView scenario={scenario} />;
}
