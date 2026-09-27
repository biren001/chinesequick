import type { Metadata } from "next";
import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";

/** 表单提交后的落地页，本身没有 SEO 价值，明确不收录。 */
export const metadata: Metadata = {
  title: "Thank you",
  robots: { index: false, follow: false },
};

export default function ThankYouPage() {
  return (
    <main className="mx-auto max-w-md px-5 pt-16 pb-16 text-center">
      <div className="text-5xl" aria-hidden="true">
        🙏
      </div>

      <h1 className="mt-5 text-3xl leading-tight font-semibold tracking-tight text-ink">
        Thanks — you just made this better.
      </h1>
      <p className="mt-3 text-base text-muted">
        Your message goes straight to me. I read every one and use them to
        decide what to fix next.
      </p>

      <Link
        href="/learn/everyday"
        className="mt-8 inline-block w-full rounded-2xl bg-accent px-6 py-4 text-lg font-medium text-white shadow-sm transition hover:opacity-90 active:scale-[0.99]"
      >
        Continue learning
      </Link>

      <p className="mt-5 text-sm text-muted">Or jump back to a situation:</p>

      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {CATEGORIES.map((category) => (
          <Link
            key={category.id}
            href={`/learn/${category.id}`}
            className="rounded-full border border-line bg-card px-4 py-2 text-sm text-ink transition hover:border-accent active:scale-[0.99]"
          >
            <span aria-hidden="true">{category.emoji}</span> {category.name}
          </Link>
        ))}
      </div>
    </main>
  );
}
