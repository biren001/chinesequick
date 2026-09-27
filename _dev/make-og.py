# -*- coding: utf-8 -*-
"""生成 OG 分享图 1200x630。本地 PIL 渲染，色板与站点一致。

品牌与文案统一为 ChineseQuick + 「到中国生活旅游的助手」定位，
条数从 data/phrases.json 现读 —— 避免像上一版那样把「50 useful phrases」印死后过期。
"""
import json
import pathlib

from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
PAPER = (250, 249, 247)
INK = (27, 26, 24)
MUTED = (107, 106, 102)
LINE = (232, 229, 224)
ACCENT = (228, 87, 46)
WHITE = (255, 255, 255)

EN_B = "C:/Windows/Fonts/arialbd.ttf"
EN = "C:/Windows/Fonts/arial.ttf"
ZH_B = "C:/Windows/Fonts/msyhbd.ttc"

ROOT = pathlib.Path(__file__).resolve().parent.parent
PHRASE_COUNT = len(json.loads((ROOT / "data" / "phrases.json").read_text(encoding="utf-8")))

img = Image.new("RGB", (W, H), PAPER)
d = ImageDraw.Draw(img)

f_tag = ImageFont.truetype(EN_B, 25)
f_h1 = ImageFont.truetype(EN_B, 78)
f_sub = ImageFont.truetype(EN, 32)
f_cz = ImageFont.truetype(ZH_B, 36)
f_cp = ImageFont.truetype(EN, 21)
f_meta = ImageFont.truetype(EN, 24)
f_domain = ImageFont.truetype(EN_B, 25)

LX = 88            # 左栏起点
RX, RW = 748, 352  # 右栏

# ── 左栏：文案。品牌名与域名一致，主文案讲「在中国过日子/旅行」。 ──
d.text((LX, 86), "C H I N E S E Q U I C K", font=f_tag, fill=MUTED)

y = 152
d.text((LX, y), "Get by in China", font=f_h1, fill=INK)
y += 92
d.text((LX, y), "in Chinese.", font=f_h1, fill=ACCENT)

d.text((LX, 384), "Real phrases for restaurants,", font=f_sub, fill=MUTED)
d.text((LX, 424), "taxis, hotels and emergencies.", font=f_sub, fill=MUTED)

# ── 右栏：三张短语卡，体现场景覆盖 ──
cards = [
    ("多少钱？", "Duōshao qián?  ·  How much?"),
    ("厕所在哪里？", "Cèsuǒ zài nǎlǐ?"),
    ("谢谢。", "Xièxie.  ·  Thank you."),
]
CH = 104
GAP = 26
TOP = 106
for i, (zh, py) in enumerate(cards):
    cy = TOP + i * (CH + GAP)
    d.rounded_rectangle([RX, cy, RX + RW, cy + CH], radius=18, fill=WHITE, outline=LINE, width=2)
    d.rectangle([RX, cy + 20, RX + 5, cy + CH - 20], fill=ACCENT)
    d.text((RX + 28, cy + 16), zh, font=f_cz, fill=INK)
    d.text((RX + 28, cy + 66), py, font=f_cp, fill=MUTED)

# ── 底部一行 ──
d.line([LX, 536, W - 88, 536], fill=LINE, width=2)
d.text((LX, 562), "chinesequick.com", font=f_domain, fill=INK)
meta = f"{PHRASE_COUNT} useful phrases  ·  no sign-up  ·  works offline"
mw = d.textbbox((0, 0), meta, font=f_meta)[2]
d.text((W - 88 - mw, 563), meta, font=f_meta, fill=MUTED)

out = ROOT / "public" / "og.png"
img.save(out, "PNG", optimize=True)
print("saved", out, img.size, "| phrases:", PHRASE_COUNT)
