import type { Metadata } from "next";
import Link from "next/link";
import AudioButton from "@/components/AudioButton";
import JsonLd from "@/components/JsonLd";
import { CourseDayNav, CourseResume, DayOpener, MarkDayDone } from "@/components/CourseTracker";
import { COURSE_DAYS, COURSE_PATH, getCourseDayPhrases } from "@/lib/course";
import { phraseAudio } from "@/lib/audio";
import { breadcrumbSchema, faqSchema, orgId, urlOf } from "@/lib/jsonld";
import { PHRASES } from "@/lib/phrases";
import { phrasePath, phraseSlug } from "@/lib/slug";

const TITLE = "Learn Chinese in 7 Days — Free Travel Course";
const DESCRIPTION = `A free 7-day Chinese course for your trip: 15 practical phrases a day with pinyin and audio, ordered the way a trip unfolds — greetings, food, taxis, hotels, shopping and emergencies.`;

const FAQ = [
  {
    q: "Can you really learn Chinese in 7 days?",
    a: "You will not be fluent in a week — nobody is. What seven days can do is put the right 105 phrases in your mouth, ordered the way a trip actually unfolds. That covers the situations where you cannot fall back on English: taxis, small restaurants, market stalls, pharmacy counters and emergencies. Every phrase here has been chosen because travelers use it more than once a day.",
  },
  {
    q: "How much time does each day take?",
    a: "About 20 to 30 minutes. Fifteen phrases, each with audio you can replay three times with one tap, plus one short mission that makes you use the day's phrases out loud. The mission matters more than the minutes: a phrase you have said once sticks far better than one you have only heard.",
  },
  {
    q: "Do I need to learn Chinese characters or tones?",
    a: "Not for this course. You learn by listening and speaking: every phrase shows pinyin with tone marks and plays real audio, so your mouth learns the tones without you studying them. Characters are there if you want them — recognizing 请 and 谢 on signs is a bonus, not a requirement.",
  },
  {
    q: "What if my trip starts sooner than seven days?",
    a: "Do the days in a different order. Day 1 and Day 2 are the universal kit — greetings and getting unstuck — and Day 7 is the safety kit. Those three days fit into one evening if needed, then add the days for the situations on your itinerary: Day 3 for food, Day 4 for taxis and trains, Day 5 for hotels, Day 6 for shopping.",
  },
  {
    q: "Is the course really free?",
    a: "Yes. All " + PHRASES.length + " phrases, the audio for every one of them, and the full seven-day plan are free on this site with no sign-up. Each phrase links to its own page with word-by-word breakdowns, common mistakes and what people will say back to you.",
  },
];

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: urlOf(COURSE_PATH) },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: urlOf(COURSE_PATH),
    // 子页自定义 openGraph 必须显式带 images —— Next 不会继承父级的 OG 图
    images: ["/og.png"],
  },
};

export default function SevenDayCoursePage() {
  return (
    <main className="mx-auto max-w-md px-5 pt-8 pb-16">
      <JsonLd
        schema={[
          breadcrumbSchema([{ name: "Learn Chinese in 7 days", path: COURSE_PATH }]),
          faqSchema(FAQ),
          {
            "@type": "Course",
            name: "Learn Chinese in 7 days — the free travel course",
            description: DESCRIPTION,
            provider: { "@id": orgId() },
            inLanguage: ["en", "zh-Hans"],
            isAccessibleForFree: true,
            hasCourseInstance: COURSE_DAYS.map((d) => ({
              "@type": "CourseInstance",
              name: `Day ${d.day}: ${d.title}`,
              courseMode: "online",
              courseWorkload: "PT20M",
            })),
            teaches: COURSE_DAYS.map((d) => d.title),
            url: urlOf(COURSE_PATH),
          },
        ]}
      />

      <nav className="mb-6">
        <Link href="/" className="text-sm text-muted underline underline-offset-4">
          ChineseQuick
        </Link>
      </nav>

      <header className="mb-8">
        <span className="text-4xl" aria-hidden="true">
          🗓️
        </span>
        <h1 className="mt-2 text-3xl leading-tight font-semibold tracking-tight text-ink">
          Learn Chinese in 7 days: the free travel course
        </h1>
        <p className="mt-3 text-base text-muted">
          Fifteen phrases a day, about twenty minutes, and no sign-up. The course walks through
          this site&apos;s {PHRASES.length} phrases in the order a trip unfolds — hello and thank
          you first, restaurants and taxis in the middle, emergencies last. Every phrase plays real
          audio and links to a full page with pinyin, word-by-word notes and common mistakes.
        </p>
        <p className="mt-3 text-xs text-muted">
          Listen on the page or install the app and take the whole course offline — the audio works
          without a network once the site is installed.
        </p>
      </header>

      {/* 进度卡片 + Day 快捷跳转：进度在本机，回来不用从头翻 */}
      <CourseResume titles={COURSE_DAYS.map((d) => d.title)} />
      <CourseDayNav names={COURSE_DAYS.map((d) => d.name)} />

      <div className="space-y-6">
        {COURSE_DAYS.map((d) => {
          const phrases = getCourseDayPhrases(d.ids);
          return (
            <section key={d.day} id={`day-${d.day}`} className="scroll-mt-6">
              {/* 默认折叠：整页不再是一眼望不到底的长卷，挂载时自动展开「当前该学的那天」 */}
              <details
                id={`course-day-${d.day}`}
                className="scroll-mt-6 rounded-2xl border border-line bg-card"
              >
                <summary className="cursor-pointer px-4 py-3">
                  <h2 className="text-xl font-semibold tracking-tight text-ink">
                    <span aria-hidden="true">{d.emoji}</span> Day {d.day} — {d.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {d.name} · {phrases.length} phrases · about 20 minutes
                  </p>
                </summary>
                <div className="px-4 pb-4">
                  <DayOpener day={d.day} />
                  <p className="text-sm text-muted">{d.intro}</p>

                  <ol className="mt-4 space-y-2">
                    {phrases.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <Link
                            href={phrasePath(phraseSlug(p))}
                            className="block text-base font-medium text-ink underline-offset-4 hover:underline"
                          >
                            {p.chinese}
                          </Link>
                          <span className="block text-sm text-muted">
                            {p.pinyin} — {p.english}
                          </span>
                        </div>
                        <AudioButton
                          text={p.chinese}
                          src={phraseAudio[String(p.id)] ?? null}
                          label="Listen"
                          repeats={3}
                        />
                      </li>
                    ))}
                  </ol>

                  <p className="mt-3 rounded-xl bg-accent-soft px-4 py-3 text-sm text-ink">
                    <span className="font-medium">Today&apos;s mission: </span>
                    {d.mission}
                  </p>

                  <MarkDayDone day={d.day} />
                </div>
              </details>
            </section>
          );
        })}
      </div>

      <section className="mt-10">
        <h2 className="text-base font-medium text-ink">Questions about the course</h2>
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
        <p className="text-base font-medium text-ink">Twenty minutes today is enough</p>
        <Link
          href="#day-1"
          className="mt-3 inline-block w-full rounded-xl bg-accent px-5 py-3 text-base font-medium text-white transition hover:opacity-90 active:scale-[0.98]"
        >
          Start with Day 1
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
