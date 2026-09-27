"""用神经语音把全部短语与词汇预生成为静态 mp3。

为什么预生成而不是浏览器实时合成：见 docs/audio-and-voice-plan-2026-09-26.md ——
设备的系统语音合成在大量机型上要么没有中文音色（按钮静默失效），要么有语言错误。
静态文件不依赖设备，且现有 sw.js 对同源 GET 已是 cache-first，听过一次即离线可用。

产物：
  public/audio/<id>.mp3          整句（正常语速）
  public/audio/slow/<id>.mp3     整句（慢速，rate -30%，比播放器变速更自然）
  public/audio/words/<slug>.mp3  逐词表中的每个词
  public/audio/numbers/<slug>.mp3 数字表（/chinese-numbers/ 专页用）
  lib/audio.ts                   路径清单（唯一事实来源，供组件引用）

用法：
  <managed venv>/Scripts/python.exe _dev/make-audio.py            # 只补缺失的
  <managed venv>/Scripts/python.exe _dev/make-audio.py --force    # 全部重生成
"""
from __future__ import annotations

import asyncio
import json
import pathlib
import sys
import unicodedata

import edge_tts

ROOT = pathlib.Path(__file__).resolve().parent.parent
PUB = ROOT / "public" / "audio"
OUT_TS = ROOT / "lib" / "audio.ts"

VOICE = "zh-CN-XiaoxiaoNeural"
SLOW_RATE = "-30%"
CONCURRENCY = 4

FORCE = "--force" in sys.argv


def slugify(text: str) -> str:
    """拼音 → ASCII slug：去掉声调符号，只留字母数字。"""
    decomposed = unicodedata.normalize("NFKD", text)
    ascii_only = "".join(c for c in decomposed if not unicodedata.combining(c))
    cleaned = "".join(c for c in ascii_only.lower() if c.isalnum())
    return cleaned or "x"


async def synth(text: str, out: pathlib.Path, rate: str, sem: asyncio.Semaphore) -> bool:
    if out.exists() and out.stat().st_size > 1000 and not FORCE:
        return True
    out.parent.mkdir(parents=True, exist_ok=True)
    async with sem:
        for attempt in range(3):
            try:
                await edge_tts.Communicate(text, VOICE, rate=rate).save(str(out))
                if out.exists() and out.stat().st_size > 1000:
                    return True
            except Exception as exc:  # noqa: BLE001
                if attempt == 2:
                    print(f"  FAIL [{rate}] {text}: {exc}", file=sys.stderr)
                else:
                    await asyncio.sleep(1 + attempt)
    return False


async def main() -> None:
    phrases = json.loads((ROOT / "data" / "phrases.json").read_text(encoding="utf-8"))
    # 数字表与短语分开存：它同时被 TS 侧渲染（/chinese-numbers/ 专页），
    # 放在这里现读同一份 JSON，避免两边各写一遍然后慢慢漂移。
    numbers = json.loads((ROOT / "data" / "numbers.json").read_text(encoding="utf-8"))
    sem = asyncio.Semaphore(CONCURRENCY)

    # ---- 逐词表：先算 slug，处理同名冲突 ----
    word_slugs: dict[str, str] = {}
    used: dict[str, str] = {}
    for p in phrases:
        for w in p.get("words", []):
            zh = w["zh"]
            if zh in word_slugs:
                continue
            base = slugify(w["py"])
            slug = base
            n = 2
            while used.get(slug) not in (None, zh):
                slug = f"{base}-{n}"
                n += 1
            used[slug] = zh
            word_slugs[zh] = slug

    # ---- 组任务 ----
    tasks = []
    for p in phrases:
        pid = p["id"]
        tasks.append(("phrase", pid, p["chinese"], PUB / f"{pid}.mp3", "+0%"))
        tasks.append(("slow", pid, p["chinese"], PUB / "slow" / f"{pid}.mp3", SLOW_RATE))
    for zh, slug in word_slugs.items():
        tasks.append(("word", zh, zh, PUB / "words" / f"{slug}.mp3", "+0%"))

    # 数字表：单字/单词，同样走正常语速。刻意不生成慢速版 —— 数字本来就短，
    # 神经语音在 rate -30% 下会把两音节拖得发闷，反而不好跟读。
    number_slugs: dict[str, str] = {}
    for n in numbers:
        slug = slugify(n["py"])
        number_slugs[n["zh"]] = slug
        tasks.append(("number", n["zh"], n["zh"], PUB / "numbers" / f"{slug}.mp3", "+0%"))

    print(
        f"语音：{VOICE}　任务：{len(tasks)} 条"
        f"（整句 {len(phrases)} × 2 + 词 {len(word_slugs)} + 数字 {len(number_slugs)}）"
    )
    results = await asyncio.gather(
        *(synth(text, path, rate, sem) for _, _, text, path, rate in tasks)
    )

    ok = sum(1 for r in results if r)
    failed = [t[1] for t, r in zip(tasks, results) if not r]
    print(f"完成 {ok}/{len(tasks)}")

    # ---- 写 lib/audio.ts ----
    phrase_map = {str(p["id"]): f"/audio/{p['id']}.mp3" for p in phrases}
    slow_map = {str(p["id"]): f"/audio/slow/{p['id']}.mp3" for p in phrases}
    word_map = {zh: f"/audio/words/{slug}.mp3" for zh, slug in word_slugs.items()}
    number_map = {zh: f"/audio/numbers/{slug}.mp3" for zh, slug in number_slugs.items()}

    def dump(name: str, mapping: dict[str, str]) -> str:
        body = ",\n".join(f'  {json.dumps(k, ensure_ascii=False)}: {json.dumps(v)}' for k, v in mapping.items())
        return f"export const {name}: Record<string, string> = {{\n{body},\n}};\n"

    OUT_TS.write_text(
        "// 本文件由 _dev/make-audio.py 生成，不要手改。\n"
        f"// 语音：{VOICE}（神经合成，预生成为静态 mp3）\n"
        '// 想换成真人录音：把文件覆盖到同名路径即可，代码不用动。\n\n'
        + dump("phraseAudio", phrase_map)
        + "\n"
        + dump("slowAudio", slow_map)
        + "\n"
        + dump("wordAudio", word_map)
        + "\n"
        + dump("numberAudio", number_map)
        + """
/** 整句音频：手写的 data/phrases.json 里 audio 字段优先（留给真人录音覆盖）。 */
export function audioForPhrase(p: { id: number; audio?: string | null }): string | null {
  return p.audio ?? phraseAudio[String(p.id)] ?? null;
}

/** 整句慢速音频；没有就退回 null（组件会退回实时合成的慢速）。 */
export function slowAudioForPhrase(p: { id: number }): string | null {
  return slowAudio[String(p.id)] ?? null;
}

/** 单个词/字的音频。 */
export function audioForWord(zh: string): string | null {
  return wordAudio[zh] ?? null;
}

/** 数字表里的单字音频（/chinese-numbers/ 专页用）。 */
export function audioForNumber(zh: string): string | null {
  return numberAudio[zh] ?? null;
}
""",
        encoding="utf-8",
    )

    # ---- 离线预缓存清单：service worker 后台把这些句子存起来 ----
    # 只列入正常语速的整句（约 350 KB）。慢速版与词条按需缓存，避免首次访问下载过重。
    manifest = [phrase_map[str(p["id"])] for p in phrases]
    (PUB / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False), encoding="utf-8"
    )

    total = sum(f.stat().st_size for f in PUB.rglob("*.mp3"))
    print(f"音频总体积 {total / 1024 / 1024:.2f} MB（{len(list(PUB.rglob('*.mp3')))} 个文件）")
    print(f"离线清单 {len(manifest)} 条 → public/audio/manifest.json")
    print(f"路径清单写入 {OUT_TS.relative_to(ROOT)}")

    if failed:
        print("失败条目：" + ", ".join(map(str, failed)), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
