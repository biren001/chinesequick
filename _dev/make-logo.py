# -*- coding: utf-8 -*-
"""生成方形品牌图标 512x512：用于 schema.org logo 与 apple-touch-icon。"""
from PIL import Image, ImageDraw, ImageFont

S = 512
ACCENT = (228, 87, 46)
WHITE = (255, 255, 255)
ZH_B = "C:/Windows/Fonts/msyhbd.ttc"

img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle([0, 0, S - 1, S - 1], radius=112, fill=ACCENT)

f = ImageFont.truetype(ZH_B, 268)
bbox = d.textbbox((0, 0), "中", font=f)
w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
d.text(((S - w) / 2 - bbox[0], (S - h) / 2 - bbox[1] - 8), "中", font=f, fill=WHITE)

img.save("public/logo.png", "PNG", optimize=True)
img.convert("RGB").save("app/apple-icon.png", "PNG", optimize=True)
print("saved public/logo.png + app/apple-icon.png")
