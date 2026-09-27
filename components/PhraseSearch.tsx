"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import AudioButton from "@/components/AudioButton";
import SaveButton from "@/components/SaveButton";
import { audioForPhrase } from "@/lib/audio";
import { PHRASES } from "@/lib/phrases";
import { phrasePath, phraseSlug } from "@/lib/slug";
import { CATEGORIES } from "@/lib/categories";

/** 去声调 + 去大小写 + 压缩空白，让用户敲 "xiexie" 也能搜到 "Xièxie"。 */
function norm(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const CATEGORY_EMOJI = new Map(CATEGORIES.map((c) => [c.id, c.emoji] as const));

export default function PhraseSearch() {
  const [query, setQuery] = useState("");
  const q = norm(query);
  const typed = query.trim();

  const results = useMemo(() => {
    if (q.length < 2 && typed.length < 1) return [];
    return PHRASES.filter(
      (p) =>
        norm(p.english).includes(q) ||
        norm(p.pinyin).includes(q) ||
        p.chinese.includes(typed)
    ).slice(0, 6);
  }, [q, typed]);

  return (
    <div className="mt-8 rounded-2xl border border-line bg-card p-4 text-left">
      <label htmlFor="phrase-search" className="block text-sm font-medium text-ink">
        Find a phrase
      </label>
      <p className="mt-0.5 text-xs text-muted">
        Type in English, pinyin or Chinese — results appear instantly.
      </p>
      <input
        id="phrase-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="e.g. how much, xiexie, 谢谢"
        autoComplete="off"
        className="mt-3 w-full rounded-xl border border-line bg-white px-4 py-3 text-base text-ink placeholder:text-muted focus:border-accent focus:outline-none"
      />

      {q.length >= 2 || typed.length >= 1 ? (
        results.length ? (
          <ul className="mt-3 space-y-2">
            {results.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <Link
                      href={phrasePath(phraseSlug(p))}
                      className="text-lg font-medium text-ink hover:text-accent"
                    >
                      {p.chinese}
                    </Link>
                    <span className="text-xs text-muted" aria-hidden="true">
                      {CATEGORY_EMOJI.get(p.category)}
                    </span>
                  </span>
                  <span className="block text-sm text-accent">{p.pinyin}</span>
                  <span className="block text-sm text-muted">{p.english}</span>
                </span>
                <AudioButton
                  text={p.chinese}
                  src={audioForPhrase(p)}
                  label="Play"
                  className="shrink-0"
                  repeats={3}
                />
                <SaveButton phraseId={p.id} className="shrink-0" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">
            No match. Try a simpler word, or pick a situation below.
          </p>
        )
      ) : null}
    </div>
  );
}
