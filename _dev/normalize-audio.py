"""把音频统一处理成「干净、等响、首尾无静音」的可发布文件。

为什么需要这一步：
  神经语音对短文本会补上大量首尾静音 —— 实测「多少」(2 音节) 与「多少钱？」都是 1.87 秒，
  单字播放时会明显发钝。另外各条响度不一时，连播会忽大忽小。

处理链（ffmpeg，全离线）：
  去首尾静音 → 补 30ms 头 / 60ms 尾 → EBU R128 响度统一(-16 LUFS) → 单声道 24kHz 64kbps mp3

同样的脚本可直接用于真人录音（把 wav 丢进同一目录再跑一遍即可）。

用法：
  <python> _dev/normalize-audio.py                       # 处理 public/audio 下全部
  <python> _dev/normalize-audio.py --only-raw            # 只处理刚生成、还没归一化的
  <python> _dev/normalize-audio.py --src recordings --dest public/audio
"""
from __future__ import annotations

import argparse
import pathlib
import shutil
import subprocess
import sys
import tempfile

FFMPEG = pathlib.Path(r"C:\ffmpeg-2026-08-09-git-6bbc22dc09-essentials_build\bin\ffmpeg.exe")
FFPROBE = FFMPEG.with_name("ffprobe.exe")

ROOT = pathlib.Path(__file__).resolve().parent.parent
IN_EXTS = {".mp3", ".wav", ".m4a", ".ogg", ".opus", ".flac", ".webm", ".aac"}

# 去静音 → 补头尾 → 响度统一
FILTER = (
    "silenceremove=start_periods=1:start_duration=0:start_threshold=-50dB:detection=peak,"
    "areverse,"
    "silenceremove=start_periods=1:start_duration=0:start_threshold=-50dB:detection=peak,"
    "areverse,"
    "adelay=30:all=1,apad=pad_dur=0.06,"
    "loudnorm=I=-16:TP=-1.5:LRA=11"
)
ENCODE = ["-c:a", "libmp3lame", "-b:a", "64k", "-ac", "1", "-ar", "24000"]


def duration(path: pathlib.Path) -> float:
    try:
        out = subprocess.run(
            [str(FFPROBE), "-v", "error", "-show_entries", "format=duration",
             "-of", "default=nw=1:nk=1", str(path)],
            capture_output=True, text=True, timeout=30,
        )
        return float(out.stdout.strip())
    except Exception:  # noqa: BLE001
        return 0.0


def bit_rate(path: pathlib.Path) -> int:
    try:
        out = subprocess.run(
            [str(FFPROBE), "-v", "error", "-show_entries", "format=bit_rate",
             "-of", "default=nw=1:nk=1", str(path)],
            capture_output=True, text=True, timeout=30,
        )
        return int(float(out.stdout.strip()))
    except Exception:  # noqa: BLE001
        return 0


def is_raw(path: pathlib.Path) -> bool:
    """判断是不是 make-audio.py 刚生成、还没进过这个脚本的文件。

    edge-tts 固定输出 24kHz / 48kbps，而本脚本固定输出 64kbps —— 实测码率是
    稳定的判别依据（已处理过的文件会报 68k～76k，含容器开销）。用它来避免
    每次新增几条音频就把全部文件重新编码一遍：既慢，又是一次多余的转码损耗。
    """
    return bit_rate(path) == 48000


def process(src: pathlib.Path, dest: pathlib.Path) -> bool:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        out = pathlib.Path(tmp) / "out.mp3"
        proc = subprocess.run(
            [str(FFMPEG), "-y", "-v", "error", "-i", str(src),
             "-af", FILTER, *ENCODE, str(out)],
            capture_output=True, text=True, timeout=120,
        )
        if proc.returncode != 0 or not out.exists() or out.stat().st_size < 800:
            print(f"  FAIL {src.name}: {proc.stderr.strip()[:120]}", file=sys.stderr)
            return False
        # 裁得太狠（低于 0.12s）说明这本来就是个静音垃圾，保留原样更安全
        if duration(out) < 0.12:
            print(f"  SKIP {src.name}: 处理后过短，保留原文件", file=sys.stderr)
            return False
        shutil.move(str(out), str(dest))
    return True


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=str(ROOT / "public" / "audio"))
    ap.add_argument("--dest", default=None, help="默认原地覆盖（先写临时目录再替换）")
    ap.add_argument(
        "--only-raw",
        action="store_true",
        help="只处理还没归一化的文件（码率 48k = make-audio.py 的原始输出）",
    )
    args = ap.parse_args()

    src_dir = pathlib.Path(args.src)
    all_files = sorted(p for p in src_dir.rglob("*") if p.suffix.lower() in IN_EXTS and p.is_file())
    files = [p for p in all_files if not args.only_raw or is_raw(p)]
    if not files:
        print(f"没有可处理的音频：{src_dir}（已归一化 {len(all_files)} 个）")
        return
    if args.only_raw:
        print(f"--only-raw：跳过已归一化 {len(all_files) - len(files)} 个，待处理 {len(files)} 个")

    before_total = sum(p.stat().st_size for p in files)
    before_dur = sum(duration(p) for p in files)
    print(f"待处理 {len(files)} 个（{before_total / 1024 / 1024:.2f} MB，合计 {before_dur:.1f} 秒）")

    ok = 0
    for i, f in enumerate(files, 1):
        dest = pathlib.Path(args.dest) / f.relative_to(src_dir) if args.dest else f
        if process(f, dest):
            ok += 1
        if i % 40 == 0:
            print(f"  … {i}/{len(files)}")

    # 体积/时长只统计「这一轮真正处理过的文件」。以前这里用全目录重算，
    # 配上 --only-raw 会打印出「0.70 MB → 2.89 MB」这种看着像体积暴涨的假数字。
    written = [
        pathlib.Path(args.dest) / f.relative_to(src_dir) if args.dest else f for f in files
    ]
    written = [p for p in written if p.exists()]
    after_total = sum(p.stat().st_size for p in written)
    after_dur = sum(duration(p) for p in written)

    print(f"\n成功 {ok}/{len(files)}")
    print(f"体积 {before_total / 1024 / 1024:.2f} MB → {after_total / 1024 / 1024:.2f} MB（本轮处理的文件）")
    print(f"总时长 {before_dur:.1f} 秒 → {after_dur:.1f} 秒（平均 {before_dur / len(files):.2f}s → {after_dur / max(len(written), 1):.2f}s）")
    if ok != len(files):
        sys.exit(1)


if __name__ == "__main__":
    main()
