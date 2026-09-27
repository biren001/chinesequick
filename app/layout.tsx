import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import FeedbackFooter from "@/components/FeedbackFooter";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";

/** 配置 NEXT_PUBLIC_GA_ID 即开启 Google Analytics，不配则站点功能完全不变。 */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — learn Chinese for everyday life in China`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "learn Chinese",
    "Chinese phrases",
    "Mandarin phrases",
    "Chinese for travel",
    "China travel phrases",
    "Chinese for everyday life",
    "Chinese restaurant phrases",
    "Chinese emergency phrases",
    "China trip checklist",
    "how to say thank you in Chinese",
    "how to say hello in Chinese",
    "pinyin",
  ],
  openGraph: {
    title: `${SITE_NAME} — the Chinese you'll actually use in China`,
    description: SITE_DESCRIPTION,
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — real phrases for everyday life and travel in China`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — the Chinese you'll actually use in China`,
    description: SITE_TAGLINE,
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
  // 与 <html translate="no"> 配套：告诉浏览器/翻译工具不要翻译本站。
  // 不这么做的话，浏览器翻译会在 React 之外改写 DOM，导致整页白屏（见 app/error.tsx 的说明）。
  other: { google: "notranslate" },
  manifest: "/manifest.webmanifest",
  applicationName: SITE_NAME,
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf9f7",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // translate="no" + 下面的 notranslate meta：**刻意关掉整站的浏览器自动翻译**。
    // 原因不是文案不想被翻译，而是浏览器翻译会在 React 之外改写 DOM（把文字节点包进 <font>），
    // 让 React 在 commit 阶段找不到锚点节点而抛 NotFoundError → 整页白屏。
    // 已用 _dev/repro-client-error.js 实测复现：只要 DOM 被这样改写，本页必抛 React #418。
    // 关掉翻译后这类改写从源头消失；用户仍可用扩展自行翻译（那是他们自担风险的显式选择）。
    <html lang="en" translate="no">
      <body className="min-h-dvh antialiased">
        {children}
        <FeedbackFooter />
      </body>
      {/* 离线支持：注册 /sw.js。注册失败不影响任何功能。 */}
      <Script id="sw-register" strategy="afterInteractive">
        {`
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function () {
              navigator.serviceWorker.register('/sw.js').catch(function () {});
            });
          }
        `}
      </Script>
      {GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `}
          </Script>
        </>
      )}
    </html>
  );
}
