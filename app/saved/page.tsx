import type { Metadata } from "next";
import Link from "next/link";
import SavedList from "@/components/SavedList";

/**
 * 收藏页。内容是「本地设备上」的，对爬虫永远是空的，
 * 所以 noindex + follow，并且不进 sitemap。
 */
export const metadata: Metadata = {
  title: "My saved phrases",
  description:
    "The Chinese phrases you saved for later — with audio, pinyin and English. Stored on your device only.",
  robots: { index: false, follow: true },
};

export default function SavedPage() {
  return (
    <main className="mx-auto max-w-md px-5 pt-10 pb-16">
      <nav className="mb-6">
        <Link href="/" className="text-sm text-muted underline underline-offset-4">
          ChineseQuick
        </Link>
      </nav>

      <header className="mb-6">
        <h1 className="text-3xl leading-tight font-semibold tracking-tight text-ink">
          My phrases
        </h1>
        <p className="mt-2 text-base text-muted">
          The phrases you saved for later — ready when you actually need them.
        </p>
      </header>

      <SavedList />
    </main>
  );
}
