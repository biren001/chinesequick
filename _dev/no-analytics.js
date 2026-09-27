/**
 * 让验证脚本不再往 GA 里灌假数据。
 *
 * 问题：这些脚本用真机 Chrome 打开**线上域名**，GA 脚本会照常执行，
 * 并按本机 IP（中国）记成一次真实访客。一轮下来：
 *   check-errors-live  12 页 × 2 次加载 ≈ 24
 *   verify-saved       12 步            ≈ 12
 *   verify-audio-live  逐页点音频       ≈ 10
 *   repro-client-error 6 组 × 2         ≈ 12
 * 合计 60+ 次 page_view，而 28 天真实总量只有 152 次 —— 我们自己占了约四分之一。
 * 结果是「该不该做词条页」这类判断会建立在假数据上。
 *
 * 做法：CDP 的 Network.setBlockedURLs 直接掐断统计域名。
 *
 * 两个坑：
 *  1. 被拦的请求会以 Network.loadingFailed(net::ERR_BLOCKED_BY_CLIENT) 出现，
 *     而 check-errors-live 把这些当"线上异常"计数 —— 必须一并忽略，
 *     否则一开拦截就会自己报一堆异常。
 *  2. 光数 requestWillBeSent 证明不了拦截生效（被拦的请求同样会发一次）。
 *     真正的证据是 responseReceived 为 0 —— 请求根本没出去。
 *
 * 不适用于 check-ga.js / check-ga-live.js：那两个脚本的职责就是检查 GA 有没有注入。
 */
const PATTERNS = [
  '*://*.googletagmanager.com/*',
  '*://*.google-analytics.com/*',
  '*://analytics.google.com/*',
];

const ANALYTICS_RE = /googletagmanager\.com|google-analytics\.com/;

function createAnalyticsFilter() {
  /** requestId → url，用来把 loadingFailed 归因到具体请求 */
  const urlById = new Map();
  let attempts = 0;
  let responses = 0;

  return {
    /**
     * 在 CDP 消息处理器最前面调用。
     * 返回 true = 这条消息属于统计脚本，跳过它（不要计进异常）。
     */
    observe(msg) {
      const p = msg.params || {};
      const method = msg.method;

      if (method === 'Network.requestWillBeSent') {
        const u = (p.request && p.request.url) || '';
        if (ANALYTICS_RE.test(u)) {
          attempts += 1;
          urlById.set(p.requestId, u);
        }
        return false;
      }

      if (method === 'Network.responseReceived') {
        const u = (p.response && p.response.url) || '';
        if (ANALYTICS_RE.test(u)) {
          responses += 1;
          return true;
        }
        return urlById.has(p.requestId);
      }

      if (method === 'Network.loadingFailed') {
        return urlById.has(p.requestId);
      }

      if (method === 'Log.entryAdded') {
        const e = p.entry || {};
        return ANALYTICS_RE.test(e.url || '') || ANALYTICS_RE.test(e.text || '');
      }

      if (method === 'Runtime.consoleAPICalled') {
        const txt = (p.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
        return ANALYTICS_RE.test(txt);
      }

      if (method === 'Runtime.exceptionThrown') {
        const d = p.exceptionDetails || {};
        const txt = `${d.url || ''} ${d.text || ''} ${(d.exception && d.exception.description) || ''}`;
        return ANALYTICS_RE.test(txt);
      }

      return false;
    },

    /** 掐断统计域名。返回是否成功（失败不致命，只是拦截没生效）。 */
    async block(send) {
      try {
        await send('Network.setBlockedURLs', { urls: PATTERNS });
        return true;
      } catch {
        return false;
      }
    },

    /** 写进报告：responses 必须为 0，否则说明拦截没生效。 */
    stats() {
      return { attempts, responses, blocked: responses === 0 };
    },
  };
}

module.exports = { createAnalyticsFilter, ANALYTICS_RE, ANALYTICS_PATTERNS: PATTERNS };
