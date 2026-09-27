import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CategoryLearner from "@/components/CategoryLearner";
import JsonLd from "@/components/JsonLd";
import { CATEGORIES, getCategory } from "@/lib/categories";
import { getPhrasesByCategory } from "@/lib/phrases";
import { breadcrumbSchema, courseSchema, urlOf } from "@/lib/jsonld";

interface PageProps {
  params: Promise<{ category: string }>;
}

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: categoryId } = await params;
  const category = getCategory(categoryId);
  if (!category) return { title: "Category not found" };

  const count = getPhrasesByCategory(category.id).length;
  return {
    title: `${count} ${category.name} phrases in Chinese`,
    description: `Learn ${count} practical Chinese ${category.name.toLowerCase()} phrases with pinyin, English and audio. ${category.blurb}`,
    keywords: [
      `Chinese ${category.name.toLowerCase()} phrases`,
      `${category.name.toLowerCase()} in Chinese`,
      "learn Chinese",
      "Mandarin phrases",
      "Chinese pinyin",
    ],
    alternates: { canonical: urlOf(`/learn/${category.id}`) },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { category: categoryId } = await params;
  const category = getCategory(categoryId);
  if (!category) notFound();

  const phrases = getPhrasesByCategory(category.id);

  return (
    <main className="mx-auto max-w-md px-5 pt-8 pb-16">
      <JsonLd
        schema={[
          breadcrumbSchema([{ name: `${category.name} Chinese`, path: `/learn/${category.id}` }]),
          courseSchema(category, phrases),
        ]}
      />
      <nav className="mb-6">
        <Link href="/" className="text-sm text-muted underline underline-offset-4">
          ChineseQuick
        </Link>
      </nav>

      <header className="mb-6">
        <span className="text-4xl" aria-hidden="true">
          {category.emoji}
        </span>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">
          {category.name}
        </h1>
        <p className="mt-1 text-base text-muted">{category.blurb}</p>
      </header>

      <CategoryLearner category={category} phrases={phrases} />
    </main>
  );
}
