import zipfile

z = zipfile.ZipFile("deploy-chinesequick.zip")
names = z.namelist()
aud = [n for n in names if n.startswith("audio/")]
tot = sum(z.getinfo(n).file_size for n in aud)

print("总条目:", len(names))
print("音频条目:", len(aud), "| 解压后字节:", tot)

for want in [
    "audio/manifest.json",
    "audio/1.mp3",
    "audio/slow/1.mp3",
    "audio/words/duoshao.mp3",
    "sw.js",
    "index.html",
]:
    print(" ", want.ljust(28), "YES " + str(z.getinfo(want).file_size) if want in names else "NO")

zero = [n for n in names if z.getinfo(n).file_size == 0]
print("零字节条目:", zero if zero else "(无)")

BS = chr(92)
bad = [n for n in aud if BS in n or n.startswith("./")]
print("音频路径异常:", bad if bad else "(无)")

import collections

print("顶层目录样例:", sorted({n.split("/")[0] for n in names})[:12])
