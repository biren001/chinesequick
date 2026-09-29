// Service Worker：让站点真的能离线（首页承诺了 "works offline"，也承诺了装成 App 能用）。
//
// 策略：
//   导航请求 **network-first**（注释见下，这是为了避开「旧 HTML 引用已删除的 chunk」导致的白屏）；
//   静态资源 cache-first；
//   装好之后按 /sw-precache.json **后台预缓存**：关键页 + 全部 JS/CSS + 全部音频 →
//   之后断网也能打开主要入口、点了 Listen 也能响。
//   改版只需改 CACHE 名即可整体失效。
const CACHE = "cq-2026-09-29a";
const SHELL = ["/", "/offline/", "/manifest.webmanifest", "/logo.png", "/og.png"];

// 预缓存清单由 _dev/pack.js 在**构建后**生成（chunk 名带内容哈希，构建前拿不到）。
// 清单读不到就退化成「只缓存 105 条主音频」，宁可少缓存也不能让 SW 挂掉。
const PRECACHE = "/sw-precache.json";
const AUDIO_FALLBACK = "/audio/manifest.json";
const CONCURRENCY = 4;

async function readPrecache() {
  try {
    const res = await fetch(PRECACHE, { cache: "no-cache" });
    if (res.ok) {
      const data = await res.json();
      const audio = Array.isArray(data.audio) ? data.audio : [];
      const assets = Array.isArray(data.assets) ? data.assets : [];
      const pages = Array.isArray(data.pages) ? data.pages : [];
      if (audio.length || assets.length || pages.length) return { audio, assets, pages };
    }
  } catch {}
  // 退化路径：老清单只有主音频
  try {
    const res = await fetch(AUDIO_FALLBACK, { cache: "no-cache" });
    if (res.ok) {
      const audio = await res.json();
      if (Array.isArray(audio) && audio.length) return { audio, assets: [], pages: [] };
    }
  } catch {}
  return { audio: [], assets: [], pages: [] };
}

// 一条条抓，受限并发 —— 不用 cache.addAll：它是原子的，几百条里失败一条就整批回滚。
async function precacheAll() {
  const { audio, assets, pages } = await readPrecache();
  // 顺序有讲究：先页面和脚本（决定「能不能打开」），再音频（决定「能不能听」）。
  const list = [...pages, ...assets, ...audio];
  if (!list.length) return;

  const cache = await caches.open(CACHE);
  let cursor = 0;
  const worker = async () => {
    while (cursor < list.length) {
      const url = list[cursor++];
      try {
        if (!(await cache.match(url))) {
          const res = await fetch(url, { cache: "no-cache" });
          if (res && res.ok) await cache.put(url, res);
        }
      } catch {
        // 单条失败不影响其余条目
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => precacheAll())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  const put = (request, response) =>
    caches
      .open(CACHE)
      .then((cache) => cache.put(request, response))
      .catch(() => {});

  if (req.mode === "navigate") {
    // 导航一律「网络优先」，成功再写缓存，断网才回落到缓存。
    //
    // 为什么不用 stale-while-revalidate：Next 导出的 chunk 文件名带内容哈希，
    // 而我们每次重新部署，旧 chunk 文件就从服务器上消失了。一旦把「上一版的 HTML」
    // 先给用户看，它引用的旧 chunk 就会 404 → 脚本全挂 → 白屏 / 报客户端异常。
    // 网络优先后在线用户永远拿到与当前 chunk 匹配的 HTML；离线仍能用（读缓存）。
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) put(req, res.clone());
          return res;
        })
        .catch(async () => {
          // 断网：① 这个 URL 本身缓存过 → 直接用
          const hit = await caches.match(req);
          if (hit) return hit;
          // ② 站内 URL 统一带尾斜杠，补一个再试（离线时拿不到 308）
          if (!url.pathname.endsWith("/")) {
            const slash = await caches.match(url.pathname + "/");
            if (slash) return slash;
          }
          // ③ 都没有 → 断网兜底页（说清楚「这页没存、下面是存了的」），
          //    别回落到首页 —— 那样 URL 是短语页、内容却是首页，用户只会以为坏了。
          const offline = await caches.match("/offline/");
          if (offline) return offline;
          return caches.match("/");
        })
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req)
          .then((res) => {
            if (res && res.ok) put(req, res.clone());
            return res;
          })
          .catch(() => hit)
    )
  );
});
