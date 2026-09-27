"use client";

import Link from "next/link";
import { EVENTS, track } from "@/lib/analytics";

export default function StartLearning() {
  return (
    <Link
      href="/learn/everyday"
      onClick={() => track(EVENTS.startLearning)}
      className="mt-7 inline-block w-full rounded-2xl bg-accent px-6 py-4 text-lg font-medium text-white shadow-sm transition hover:opacity-90 active:scale-[0.99]"
    >
      Start Learning Free
    </Link>
  );
}
