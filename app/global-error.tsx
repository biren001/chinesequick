"use client";

/**
 * 最外层兜底：连根布局（含页脚、埋点）都崩了时的最后一层。
 *
 * 这里刻意只用行内样式——global-error 会替换整个根布局，无法保证 globals.css 已经生效，
 * 用 Tailwind 类名有可能渲染成一坨无样式的纯文本。
 * 目标只有一个：任何情况下用户都能看到一个**看得懂、点得动**的页面，而不是白屏。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" translate="no">
      <body
        style={{
          margin: 0,
          background: "#faf9f7",
          color: "#1c1917",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        }}
      >
        <main
          data-error-boundary
          style={{
            maxWidth: 440,
            margin: "0 auto",
            padding: "40px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            justifyContent: "center",
            minHeight: "100dvh",
          }}
        >
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#b45309" }}>
            Something went wrong
          </p>
          <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.3, fontWeight: 500 }}>
            This page stopped working.
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "#57534e" }}>
            Reloading usually fixes it. Your saved phrases and progress are stored on this device and
            were not affected.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                border: "none",
                borderRadius: 12,
                background: "#b45309",
                color: "#fff",
                padding: "12px 20px",
                fontSize: 16,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Reload the page
            </button>
            <button
              type="button"
              onClick={reset}
              style={{
                borderRadius: 12,
                border: "1px solid #e7e5e4",
                background: "#fff",
                color: "#1c1917",
                padding: "12px 16px",
                fontSize: 16,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 14, color: "#57534e" }}>
            <a href="/" style={{ color: "#1c1917" }}>
              Go back to all phrases
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
