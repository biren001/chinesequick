import type { ComponentProps } from "react";

/**
 * 服务端直接输出 JSON-LD。静态导出模式下不需要 next/script ——
 * 构建时写进 HTML，爬虫拿到就是完整的。
 *
 * 注意：script 内容不转义 < > & ，但 JSON.stringify 后的结构化数据里
 * 若出现 "</script>" 会截断标签，所以统一把 < 转义掉（JSON.parse 结果不受影响）。
 */
export default function JsonLd({
  schema,
  ...rest
}: { schema: unknown | unknown[] } & Omit<
  ComponentProps<"script">,
  "dangerouslySetInnerHTML" | "type" | "children"
>) {
  const payload = Array.isArray(schema)
    ? { "@context": "https://schema.org", "@graph": schema }
    : { "@context": "https://schema.org", ...(schema as object) };

  const json = JSON.stringify(payload).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
      {...rest}
    />
  );
}
