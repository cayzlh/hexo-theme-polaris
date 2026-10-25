#!/usr/bin/env python3
"""Build the self-hosted web fonts shipped with the Polaris theme.

Source of truth: subframe7536/maple-font — MapleMono-NF-CN v7.9 (OFL-1.1).
The upstream TTFs are ~20 MB each (full GB18030 ideograph set + Nerd Font PUA),
so they cannot be shipped as-is. This script slices them into chunks that the
browser can fetch on demand:

  maple-latin-<weight>.woff2   U+0000-024F + punctuation + arrows + math +
                              box drawing + geometric shapes (no CJK).
  maple-sym-<weight>.woff2    U+2190-2BFF / U+2E00-2E7F / U+3000-303F /
                              U+FE10-FE4F / U+FF00-FFEF (CJK punctuation,
                              fullwidth forms, arrows, math, symbols).
  maple-cjk-<weight>.woff2    Only the ideographs actually used by this blog,
                              plus a safety margin. font-display: swap means an
                              unseen ideograph falls back to the system CJK font
                              instead of waiting for a download.

`unicode-range` is generated in lockstep with every chunk, so the browser
downloads a chunk only when a page contains a character it covers.

Ligatures
---------
The font carries its operator ligatures (`->` `=>` `!=` `==` …) in `calt`, the
substitution table browsers apply by default to *every* text run. The theme
wants them in code only, so every chunk keeps `calt` and CSS turns it off
globally (`font-variant-ligatures: none`) and back on for code contexts.
`liga` is not in the font, so a `<prose>` run can never be re-ligated by
accident.

Usage
-----
    python3 tools/build-fonts.py --src /path/to/extracted/MapleMono-NF-CN
    python3 tools/build-fonts.py --src ... --extra-cjk ../source  # widen coverage

Requires: pip install fonttools brotli
"""

from __future__ import annotations

import argparse
import json
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

# Only the weights the theme actually uses. CJK ideographs are shipped for the
# two roman weights only: Chinese has no italic form, and synthesising a slant
# for a ~1 MB ideograph chunk is not worth the bytes.
WEIGHTS = {
    "regular": ("MapleMono-NF-CN-Regular.ttf", 400, "normal", True),
    "italic": ("MapleMono-NF-CN-Italic.ttf", 400, "italic", False),
    "medium": ("MapleMono-NF-CN-Medium.ttf", 500, "normal", False),
    "bold": ("MapleMono-NF-CN-Bold.ttf", 700, "normal", True),
    "bolditalic": ("MapleMono-NF-CN-BoldItalic.ttf", 700, "italic", False),
}

# Ranges that make up each non-CJK chunk. Latin comes first so the critical
# first paint is one small file.
LATIN = [
    (0x0000, 0x00FF),  # Basic Latin + Latin-1 Supplement
    (0x0100, 0x017F),  # Latin Extended-A
    (0x0180, 0x024F),  # Latin Extended-B
    (0x02B0, 0x02FF),  # Spacing Modifier Letters
    (0x0300, 0x036F),  # Combining Diacritical Marks
    (0x1E00, 0x1EFF),  # Latin Extended Additional
    (0x2000, 0x206F),  # General Punctuation
    (0x20A0, 0x20CF),  # Currency Symbols
    (0x2100, 0x214F),  # Letterlike Symbols
    (0x2190, 0x21FF),  # Arrows
    (0x2200, 0x22FF),  # Mathematical Operators
    (0x2460, 0x24FF),  # Enclosed Alphanumerics
    (0x2500, 0x257F),  # Box Drawing
    (0x2580, 0x259F),  # Block Elements
    (0x25A0, 0x25FF),  # Geometric Shapes
    (0x2600, 0x26FF),  # Miscellaneous Symbols
    (0x2700, 0x27BF),  # Dingbats
    (0x2B00, 0x2BFF),  # Miscellaneous Symbols and Arrows
]

SYMBOLS = [
    (0x2300, 0x23FF),  # Miscellaneous Technical (⌘ ⏎ ⏳ …)
    (0x2800, 0x28FF),  # Braille Patterns (progress spinners in TUIs)
    (0x2900, 0x297F),  # Supplemental Arrows-B
    (0x2A00, 0x2AFF),  # Supplemental Mathematical Operators
    (0x2E00, 0x2E7F),  # Supplemental Punctuation
    (0x3000, 0x303F),  # CJK Symbols and Punctuation (、。「」【】)
    (0xFE10, 0xFE1F),  # Vertical Forms
    (0xFE30, 0xFE4F),  # CJK Compatibility Forms
    (0xFF00, 0xFFEF),  # Halfwidth and Fullwidth Forms
]

# Layout features worth carrying: ccmp/locl/mark are required for correct
# shaping; calt carries the operator ligatures; zero/tnum for tabular figures.
FEATURES = ["calt", "ccmp", "locl", "mark", "mkmk", "zero", "tnum"]

# Ideographs guaranteed to be included even if the corpus forgets them:
# common blog vocabulary + numerals/units that show up in code samples.
SAFETY_CJK = (
    "的一是在不了有和人这中大为上个国我以要他时来用们生到作地于出就分对成会可主发年动"
    "同工也能下过子说产种面而方后多定行学法所民得经十三之进着等部度家电力里如水化高自"
    "二理起小物现实加量都两体制机当使点从业本去把性好应开它合还因由其些然前外天政四日"
    "那社义事平形相全表间样与关各重新线内数正心反你明看原又么利比或但质气第向道命此变"
    "条只没结解问意建月公无系军很情者最立代想已通并提直题党程展五果料象员革位入常文总"
    "次品式活设及管特件长求老头基资边流路级少图山统接知较将组见计别她手角期根论运农指"
    "几九区强放决西被干做必战先回则任取据处队南给色光门即保治北造百规热领七海口东导器"
    "压志世金增争济阶油思术极交受联什认六共权收证改清己美再采转更单风切打白教速花带安"
    "场身车例真务具万每目至达走积示议声报斗完类八离华名确才科张信马节话米整空元况今集"
    "温传土许步群广石记需段研界拉林律叫且究观越织装影算低持音众书布复容儿须际商非验连"
    "断深难近矿千周委素技备半办青省列习响约支般史感劳便团往酸历市克何除消构府称太准精"
    "值号率族维划选标写存候毛亲快效斯院查江型眼王按格养易置派层片始却专状育厂京识适属"
    "圆包火住调满县局照参红细引听该铁价严首底液官德随病苏失尔死讲配女黄推显谈罪神艺呢"
    "席含企望密批营项防举球英氧势告李台落木帮轮破亚师围注远字材排供河态封另施减树溶怎"
    "止案言士均武固叶鱼波视仅费紧爱左章早朝害续轻服试食充兵源判护司足某练差致板田降黑"
    "犯负击范继兴似余坚曲输修故城夫够送笔船占右财吃富春职觉汉画功巴跟虽杂飞检吸助升阳"
    "互初创抗考投坏策古径换未跑留钢曾端责站简述钱副尽帝射草冲承独令限阿宣环双请超微让"
    "控州良轴找否纪益依优顶础载倒房突坐粉敌略客袁冷胜绝析块剂测丝协诉念陈仍罗盐友洋错"
    "苦夜刑移频逐靠混母短皮终聚汽村云哪既距卫停烈央察烧迅境若印洲刻括激孔搞甚室待核校"
    "散侵吧甲游久菜味旧模湖货损预阻毫普稳乙妈植息扩银语挥酒守拿序纸医缺雨吗针刘啊急唱"
    "误训愿审附获茶鲜粮斤孩脱硫肥善龙演父渐血欢械掌歌沙著刚攻谓盾讨晚粒乱燃矛乎杀药宁"
    "鲁贵钟煤读班伯香介迫句丰培握兰担弦蛋沉假穿执答乐谁顺烟缩征脸喜松脚困异免背星福买"
    "染井概慢怕磁倍祖皇促静补评翻肉践尼衣宽扬棉希伤操垂秋宜氢套督振架亮末宪庆编牛触映"
    "雷销诗座居抓裂胞呼娘景威绿晶厚盟衡鸡孙延危胶屋乡临陆顾掉呀灯岁措束耐剧玉赵跳哥季"
    "课凯胡额款绍卷齐伟蒸殖永宗苗川炉岩弱零杨奏沿露杆探滑镇饭浓航怀赶库夺伊灵税途灭赛"
    "归召鼓播盘裁险康唯录菌纯借糖盖横符私努堂域枪润幅哈竟熟虫泽脑振聪竹洛匹伐督符"
    "代码示例文件配置说明测试运行命令输出结果函数参数返回值异常处理接口请求响应数据表格"
    "服务器部署容器镜像日志监控版本分支提交合并冲突回滚发布性能优化缓存并发线程事务锁"
)

DEFAULT_CORPUS = [
    "source/_posts",
    "_config.yml",
]

BANNER = """/*
 * Maple Mono NF CN v7.9 — self-hosted subset
 * Copyright 2022 The Maple Mono Project Authors (https://github.com/subframe7536/maple-font)
 * Licensed under the SIL Open Font License, Version 1.1 — see LICENSE-MapleMono.txt
 * Generated by themes/polaris/tools/build-fonts.py — do not edit by hand.
 */
"""


def ranges_to_unicode_range(ranges):
    parts = []
    for start, end in ranges:
        parts.append("U+%04X-%04X" % (start, end) if start != end else "U+%04X" % start)
    return ", ".join(parts)


def expand(ranges):
    out = []
    for start, end in ranges:
        out.extend(range(start, end + 1))
    return out


def collect_cjk(corpus_paths):
    chars = set(SAFETY_CJK)
    for path in corpus_paths:
        if not os.path.exists(path):
            continue
        walk = [path] if os.path.isfile(path) else [
            os.path.join(dp, fn) for dp, _, fns in os.walk(path) for fn in fns
        ]
        for file in walk:
            if os.path.getsize(file) > 40_000_000:
                continue
            if not file.endswith((".md", ".yml", ".yaml", ".json", ".ejs", ".html", ".txt")):
                continue
            try:
                with open(file, encoding="utf-8", errors="ignore") as fh:
                    chars.update(fh.read())
            except OSError:
                continue
    return {ord(c) for c in chars if "\u4e00" <= c <= "\u9fff"}


def make_options():
    opts = subset.Options()
    opts.layout_features = FEATURES
    # Keep the family/style names intact so `font-weight` and `font-style`
    # matching works, but drop the long designer/URL metadata.
    opts.name_IDs = ["1", "2", "3", "4", "5", "6"]
    opts.name_languages = [0x409]
    opts.notdef_outline = True
    opts.recommended_glyphs = True
    opts.drop_tables += ["meta"]
    opts.flavor = "woff2"
    return opts


def build_chunk(src, cps, out_path, opts):
    font = subset.load_font(src, opts)
    subsetter = subset.Subsetter(options=opts)
    subsetter.populate(unicodes=set(cps))
    subsetter.subset(font)
    subset.save_font(font, out_path, opts)
    return os.path.getsize(out_path)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="directory with MapleMono-NF-CN-*.ttf")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "source", "fonts"))
    ap.add_argument("--extra-cjk", nargs="*", default=[], help="extra files/dirs to scan for ideographs")
    ap.add_argument("--root", default=os.path.join(os.path.dirname(__file__), "..", "..", ".."),
                    help="blog root, used to locate the content corpus")
    args = ap.parse_args()

    out_dir = os.path.abspath(args.out)
    os.makedirs(out_dir, exist_ok=True)

    corpus = [os.path.join(os.path.abspath(args.root), p) for p in DEFAULT_CORPUS] + \
             [os.path.abspath(p) for p in args.extra_cjk]
    cjk = collect_cjk(corpus)
    print("ideographs to embed: %d" % len(cjk))

    opts = make_options()
    manifest = {"family": "Maple Mono NF CN", "version": "7.9", "chunks": {}}

    latin_cps = expand(LATIN)
    symbol_cps = expand(SYMBOLS)
    cjk_cps = sorted(cjk)

    for slug, (filename, weight, style, with_cjk) in WEIGHTS.items():
        src = os.path.join(args.src, filename)
        if not os.path.exists(src):
            print("  ! missing %s, skipped" % filename, file=sys.stderr)
            continue

        chunks = [
            ("latin", latin_cps, LATIN),
            ("sym", symbol_cps, SYMBOLS),
        ]
        if with_cjk:
            chunks.append(("cjk", cjk_cps, [(cjk_cps[0], cjk_cps[-1])] if cjk_cps else []))
        for name, cps, ranges in chunks:
            out_name = "maple-%s-%s.woff2" % (name, slug)
            size = build_chunk(src, cps, os.path.join(out_dir, out_name), opts)
            print("  %-32s %7.1f KB" % (out_name, size / 1024))
            manifest["chunks"].setdefault(name, {})[slug] = {
                "file": out_name,
                "size": size,
                "unicodeRange": ranges_to_unicode_range(ranges),
                "weight": weight,
                "style": style,
            }

    with open(os.path.join(out_dir, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=2)

    css = [BANNER]
    for name in ("latin", "sym", "cjk"):
        if name not in manifest["chunks"]:
            continue
        for slug, entry in manifest["chunks"][name].items():
            css.append(
                "@font-face{font-family:'Maple Mono NF CN';"
                "src:url('../fonts/%s') format('woff2');"
                "font-weight:%d;font-style:%s;font-display:swap;"
                "unicode-range:%s}"
                % (entry["file"], entry["weight"], entry["style"], entry["unicodeRange"])
            )
    with open(os.path.join(out_dir, "..", "css", "fonts.css"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(css) + "\n")

    total = sum(e["size"] for group in manifest["chunks"].values() for e in group.values())
    print("total woff2: %.1f MB" % (total / 1024 / 1024))


if __name__ == "__main__":
    main()
