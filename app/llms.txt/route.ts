import { CATEGORIES } from "@/lib/categories";
import { CHECKLIST_TOTAL } from "@/lib/checklistItems";
import { SCENARIOS } from "@/lib/scenarios";
import { NUMBERS, numbersBySection } from "@/lib/numbers";
import { getPhrasesByCategory, PHRASES } from "@/lib/phrases";
import { phrasePath, phraseSlug } from "@/lib/slug";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

/**
 * llms.txt —— 给 AI 引擎看的站点目录。
 * 现实预期：目前只有少数 AI 爬虫会真的读它，主要价值是低成本兜底，
 * 真正决定能否被引用的是 robots 里的爬虫授权 + 页面上的结构化数据。
 */
export function GET() {
  const lines: string[] = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_TAGLINE} ${PHRASES.length} free Mandarin Chinese phrases for travel, food, shopping, hotels, everyday conversation and emergencies. No sign-up required.`,
    "",
    `This site helps English speakers get by in China — travelling, eating, shopping, staying in hotels, paying and handling everyday situations. Every phrase comes with Simplified Chinese characters, Hanyu Pinyin (with tone marks) and an English translation.`,
    "",
    "## Trip preparation",
    "",
    `- [Learn Chinese in 7 days](${SITE_URL}/7-day-chinese-course/): a free course — 15 phrases a day built from this site's ${PHRASES.length} phrases, ordered the way a trip unfolds from greetings to emergencies.`,
    `- [China travel checklist](${SITE_URL}/china-travel-checklist/): ${CHECKLIST_TOTAL} things to prepare before a trip to China — passport and entry rules, payments, data, and which phrases to learn first.`,
    `- [Chinese numbers](${SITE_URL}/chinese-numbers/): how to count from 0 to 10,000 — ${NUMBERS.length} number sounds with audio, how ${numbersBySection("building").map((n) => n.zh).join("/")} are built, and how prices are read out in 块.`,
    `- [Emergency card](${SITE_URL}/emergency-card/): the 110/120/119/122 numbers, six help phrases with audio, and a fill-in card with blood type, allergies and emergency contact — printable, saved on the visitor's own device.`,
    `- [Address card](${SITE_URL}/address-card/): a fill-in card with the hotel's Chinese name and address to show taxi and Didi drivers, plus the phrase 请带我去这个地址 — printable, saved on the visitor's own device.`,
    `- [Getting online in China](${SITE_URL}/getting-online-in-china/): eSIM and roaming vs a local SIM, why hotel Wi-Fi asks for a Chinese mobile number, which apps work in mainland China, and the two Wi-Fi phrases with audio.`,
    "",
    "## Situation guides (step by step)",
    "",
  ];

  for (const s of SCENARIOS) {
    lines.push(
      `- [${s.name}](${SITE_URL}/scenarios/${s.slug}/): ${s.steps.length} steps in the order you'll use them — ${s.blurb}`
    );
  }

  lines.push("", "## Learn by situation", "");

  for (const c of CATEGORIES) {
    const phrases = getPhrasesByCategory(c.id);
    lines.push(
      `- [${c.name} Chinese](${SITE_URL}/${c.seoSlug}/): ${phrases.length} phrases — ${c.blurb}`
    );
  }

  lines.push("", "## Individual phrases", "");

  for (const p of PHRASES) {
    const url = `${SITE_URL}${phrasePath(phraseSlug(p))}/`;
    lines.push(`- [${p.chinese}](${url}): ${p.pinyin} — ${p.english}`);
  }

  lines.push("", "## Usage notes", "", `- Source: ${SITE_URL}/`, `- Sitemap: ${SITE_URL}/sitemap.xml`, "");

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
