"""生成 app/favicon.ico。

为什么需要：浏览器（以及部分扩展）会独立请求 /favicon.ico，
项目只有 icon.svg / apple-icon.png 时这个请求必然 404 —— 每个访客的控制台里
都会有一条红色报错，既浪费一次请求，也让人误以为站点有问题。
Next.js 只要在 app/ 下看到 favicon.ico 就会自动生成该路由与 <link rel="icon">。

用法: python _dev/make-favicon.py
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "app" / "apple-icon.png"
DST = ROOT / "app" / "favicon.ico"
SIZES = [(16, 16), (32, 32), (48, 48)]


def main() -> int:
    if not SRC.exists():
        print(f"缺少源图 {SRC}")
        return 1

    img = Image.open(SRC).convert("RGBA")
    print(f"源图 {SRC.name} 尺寸 {img.size[0]}x{img.size[1]}")

    # ICO 每个尺寸单独给一张提前缩放好的图，浏览器才不会自己乱缩
    frames = [img.resize(size, Image.LANCZOS) for size in SIZES]
    frames[0].save(DST, format="ICO", sizes=[s for s in SIZES])
    print(f"已写出 {DST} ({DST.stat().st_size} 字节), 内含 {len(SIZES)} 个尺寸")
    return 0


if __name__ == "__main__":
    sys.exit(main())
