"""生成神经语音样本，供人工试听后决定是否采用。

输出：
  _dev/audio-samples/<voice>/<id>.mp3
  _dev/audio-samples/samples.html   （自包含播放器，mp3 以 base64 内联）

用法：
  <venv>/Scripts/python.exe _dev/make-tts-samples.py
"""
import asyncio
import base64
import json
import pathlib
import sys

import edge_tts

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "_dev" / "audio-samples"

VOICES = [
    ("zh-CN-XiaoxiaoNeural", "Xiaoxiao · 女声，最自然、最常用"),
    ("zh-CN-XiaoyiNeural", "Xiaoyi · 女声，年轻活泼"),
    ("zh-CN-YunxiNeural", "Yunxi · 男声，年轻"),
    ("zh-CN-YunyangNeural", "Yunyang · 男声，播音腔"),
    ("zh-CN-XiaomoNeural", "Xiaomo · 女声，偏成熟"),
    ("zh-CN-YunxiaNeural", "Yunxia · 男声，偏低沉"),
]

# 取数据里最像“真实场景”的几句
PICK = ["多少钱？", "可以打包吗？", "洗手间在哪里？"]


async def synth(text: str, voice: str, out: pathlib.Path, rate: str = "+0%") -> bool:
    out.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(3):
        try:
            comm = edge_tts.Communicate(text, voice, rate=rate)
            await comm.save(str(out))
            if out.exists() and out.stat().st_size > 1000:
                return True
        except Exception as exc:  # noqa: BLE001
            if attempt == 2:
                print(f"  FAIL {voice} {text}: {exc}", file=sys.stderr)
    return False


async def main() -> None:
    phrases = json.loads((ROOT / "data" / "phrases.json").read_text(encoding="utf-8"))
    picked = [p for p in phrases if p["chinese"] in PICK][:3]
    while len(picked) < 3:
        picked.append(next(p for p in phrases if p not in picked))

    rows = []
    for voice, label in VOICES:
        items = []
        for p in picked:
            target = OUT / voice / f"{p['id']}.mp3"
            ok = await synth(p["chinese"], voice, target)
            if ok:
                items.append((p, target))
        if items:
            rows.append({"voice": voice, "label": label, "items": items})
        print(f"{voice}: {len(items)}/{len(picked)}")

    # 慢速版（展示 playbackRate 之外的原生慢读能力）
    slow = OUT / "slow" / "1.mp3"
    await synth(picked[0]["chinese"], "zh-CN-XiaoxiaoNeural", slow, rate="-30%")

    def b64(path: pathlib.Path) -> str:
        return base64.b64encode(path.read_bytes()).decode("ascii")

    cards = []
    for r in rows:
        cells = []
        for p, path in r["items"]:
            cells.append(
                f'<div class="cell">'
                f'<div class="zh">{p["chinese"]}</div>'
                f'<div class="py">{p["pinyin"]}</div>'
                f'<div class="en">{p["english"]}</div>'
                f'<audio controls preload="none" src="data:audio/mpeg;base64,{b64(path)}"></audio>'
                f'</div>'
            )
        cards.append(
            f'<section class="voice"><h2>{r["label"]}</h2>'
            f'<code>{r["voice"]}</code>'
            f'<div class="row">{"".join(cells)}</div></section>'
        )

    slow_html = ""
    if slow.exists():
        slow_html = (
            '<section class="voice"><h2>Xiaoxiao · 慢速版（rate -30%）</h2>'
            '<code>zh-CN-XiaoxiaoNeural</code>'
            f'<div class="row"><div class="cell"><div class="zh">{picked[0]["chinese"]}</div>'
            f'<div class="py">{picked[0]["pinyin"]}</div>'
            f'<div class="en">slow reading</div>'
            f'<audio controls preload="none" src="data:audio/mpeg;base64,{b64(slow)}"></audio>'
            "</div></div></section>"
        )

    # 竞品路线演示：用开源「词级真人录音」拼出句子（audio-cmn, CC BY-SA 3.0）
    splice = OUT / "word-splice" / "splice.mp3"
    splice_html = ""
    if splice.exists():
        splice_html = (
            '<section class="voice" style="border-color:#f0997b;background:#fffaf7">'
            '<h2>对照：用「词级真人录音」拼出来的句子</h2>'
            '<code>audio-cmn（Yue Tan 录音，CC BY-SA 3.0）· 多少 + 钱 直接拼接</code>'
            '<p style="font-size:13px;color:#555;margin:10px 0 0">'
            '这就是竞品那 8,500 条真人录音的用法 —— 它们是<b>词</b>，不是<b>句</b>。'
            '拼起来听：词与词之间的停顿、语调衔接都是断的，所以整句朗读还得靠合成。</p>'
            f'<div class="row"><div class="cell"><div class="zh">多少钱？</div>'
            f'<div class="py">Duōshao qián?</div>'
            f'<div class="en">word-spliced, not recorded as a sentence</div>'
            f'<audio controls preload="none" src="data:audio/mpeg;base64,{b64(splice)}"></audio>'
            "</div></div></section>"
        )

    html = f"""<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>神经语音样本对比 · Real-Life Chinese</title>
<style>
  :root {{ color-scheme: light; }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; padding: 28px 20px 56px; background: #fbfbf9;
         font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
         color: #1a1a1a; line-height: 1.6; }}
  .wrap {{ max-width: 980px; margin: 0 auto; }}
  h1 {{ font-size: 22px; font-weight: 600; margin: 0 0 6px; }}
  .sub {{ font-size: 14px; color: #666; margin: 0 0 26px; }}
  section.voice {{ background: #fff; border: 1px solid #e6e4dd; border-radius: 12px;
                   padding: 18px 20px 20px; margin-bottom: 16px; }}
  section.voice h2 {{ font-size: 15px; font-weight: 600; margin: 0 0 2px; }}
  code {{ font-size: 12px; color: #7a7770; }}
  .row {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 14px; margin-top: 14px; }}
  .cell {{ border: 1px solid #eeede7; border-radius: 10px; padding: 12px 14px; background: #fdfdfc; }}
  .zh {{ font-size: 20px; font-weight: 600; }}
  .py {{ font-size: 13px; color: #a05a2c; }}
  .en {{ font-size: 13px; color: #555; margin-bottom: 10px; }}
  audio {{ width: 100%; height: 34px; }}
  .note {{ font-size: 13px; color: #555; background: #fff8e6; border: 1px solid #f0e0b8;
           border-radius: 10px; padding: 12px 14px; margin-bottom: 22px; }}
</style></head>
<body><div class="wrap">
<h1>神经语音样本 · 同一句话、6 个音色</h1>
<p class="sub">全部为预生成静态 mp3（非浏览器实时合成）。请戴上耳机对比，重点听：语调是否自然、句尾语气、多音字（重/行/了）读得对不对。</p>
<div class="note">听完请告诉我：<b>能不能接受</b>？如果仍然觉得"机器味"，我们就走真人录音那条路。</div>
{"".join(cards)}
{slow_html}
{splice_html}
</div></body></html>
"""
    (OUT / "samples.html").write_text(html, encoding="utf-8")
    total = sum(len(r["items"]) for r in rows)
    print(f"\n生成 {total} 条，播放器写入 {OUT / 'samples.html'}")


if __name__ == "__main__":
    asyncio.run(main())
