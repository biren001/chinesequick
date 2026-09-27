/**
 * 全站音频互斥总线。
 *
 * 为什么需要它：一个分类页上会同时挂几十个播放器（每条短语的 Listen / Slow、
 * 逐词表里的小喇叭，再加上「连续朗读」）。没有协调的话会有两个问题：
 *
 *   ① 点第二个播放器时，第一个只是被 `pause()`，它的 `ended` 永远不会触发，
 *      按钮状态就一直停在「正在播放」——页面上会亮起一排停止图标，看着像卡住了。
 *   ② 「连续朗读」会和单句播放叠在一起，两条音轨同时响。
 *
 * 做法：每个播放器把自己「怎么停下来」注册进来；任何一个开始播之前，
 * 先让其他所有播放器停下来。模块级、无依赖、SSR 安全（不在导入期碰 window）。
 */
type Stopper = () => void;

const stoppers = new Set<Stopper>();

/** 注册一个「停下来」的回调，返回注销函数（直接拿去当 useEffect 的清理函数）。 */
export function registerStopper(stop: Stopper): () => void {
  stoppers.add(stop);
  return () => {
    stoppers.delete(stop);
  };
}

/** 让除 `keep` 之外的所有播放器停下；不传 `keep` 就是全部停下。 */
export function stopOthers(keep?: Stopper): void {
  // 复制一份再遍历：stopper 内部可能触发状态更新，避免边遍历边改集合
  for (const stop of Array.from(stoppers)) {
    if (stop === keep) continue;
    try {
      stop();
    } catch {
      // 某一个播放器出错不能连累其他播放器
    }
  }
}
