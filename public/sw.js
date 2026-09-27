// 极简 service worker：让站点真的能离线（首页文案里承诺了 "works offline"）。
// 策略：导航请求 **network-first**（见下方注释，这是为了避开「旧 HTML 引用已删除的 chunk」导致的白屏）；
//       静态资源 cache-first；整句音频在安装后后台预缓存，装完就敢不联网用。
//       改版只需改 CACHE 名即可整体失效。
const CACHE = "cq-2026-09-26e";
const SHELL = ["/", "/manifest.webmanifest", "/logo.png", "/og.png"];

// 音频体积小但要一条条取，用受限并发而不是 cache.addAll ——
// addAll 是原子的，188 条里失败一条就整批回滚。
const AUDIO_MANIFEST = "/audio/manifest.json";
const AUDIO_CONCURRENCY = 4;

async function precacheAudio() {
  let list;
  try {
    const res = await fetch(AUDIO_MANIFEST, { cache: "no-cache" });
    if (!res.ok) return;
    list = await res.json();
  } catch {
    return;
  }
  if (!Array.isArray(list) || !list.length) return;

  const cache = await caches.open(CACHE);
  let cursor = 0;
  const worker = async () => {
    while (cursor < list.length) {
      const url = list[cursor++];
      try {
        if (await cache.match(url)) continue;
        const res = await fetch(url, { cache: "no-cache" });
        if (res && res.ok) await cache.put(url, res);
      } catch {
        // 单条失败不影响其余条目
      }
    }
  };
  await Promise.all(Array.from({ length: AUDIO_CONCURRENCY }, worker));
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
      .then(() => precacheAudio())
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
        .catch(() => caches.match(req).then((cached) => cached || caches.match("/")))
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
