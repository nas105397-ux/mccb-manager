# 機器配置図(1-1002)から読み取った盤配置で、電気室の簡略SVGを生成する。
# 座標は元画像の該当部分を2倍に切り出した座標系。位置は目視の概略。
# 盤は <g id="盤ID">、盤内の区切りは <rect data-section="A"> で、アプリ側から強調表示する。
# 実行: python scripts/buildRoomMaps.py  → public/maps/1F.svg, 2F.svg
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "maps"

STYLE = """<style>
.wall{fill:#f8fafc;stroke:#334155;stroke-width:4}
.room-label{font:bold 26px sans-serif;fill:#94a3b8}
.panel{fill:#fff;stroke:#475569;stroke-width:2}
.dashed .panel,.dashed .section{stroke-dasharray:6 4}
.section{fill:#fff;stroke:#94a3b8;stroke-width:1}
.panel-label{font:13px sans-serif;fill:#1e293b;text-anchor:middle;dominant-baseline:central;pointer-events:none}
.section-label{font:10px sans-serif;fill:#334155;text-anchor:middle;dominant-baseline:central;pointer-events:none}
.caption{font:11px sans-serif;fill:#475569;text-anchor:middle;pointer-events:none}
.strand-band{opacity:.15}
.strand-label{font:bold 12px sans-serif;text-anchor:middle;dominant-baseline:central}
.legend{font:12px sans-serif;fill:#334155}
.door{font:bold 18px sans-serif;fill:#64748b;text-anchor:middle}
</style>"""


def P(pid, x, y, w, h, label, sections=None, dashed=False, stack=None, faces=None):
    # sections: 上→下(stack) / 左→右 の順。名前 / (名前, 幅比) / (名前, 幅比, 表示名)。
    # stack: 区切りを縦に積むか。省略時は盤の長辺方向。
    # faces: 盤をA・B等に2分割する(区切りと直交方向)。区切り名は "A-01" のようになる。
    return dict(id=pid, x=x, y=y, w=w, h=h, label=label, sections=sections or [], dashed=dashed,
                stack=h > w if stack is None else stack, faces=faces)


# ストランド色の初期値(アプリの区分初期色 DEFAULT_CATEGORY_COLOR_KEYS と同じ)。
# 帯・バッジに data-category を付け、地図画面で管理画面の区分色に塗り替える。
STRAND_COLORS = {1: ("#ffffff", "#111827"), 2: ("#111827", "#ffffff"), 3: ("#dc2626", "#ffffff"),
                 4: ("#2563eb", "#ffffff"), 5: ("#facc15", "#111827"), 6: ("#16a34a", "#ffffff")}


STR_MV = {1: "1MV04", 2: "1MV05", 3: "1MV06", 4: "1MV08", 5: "1MV09", 6: "1MV10"}
STR_ROW_Y = [250, 360, 490, 600, 712, 860]


def str_row(i, y):
    # 2F 一次切断制御盤 No.1〜6 STR 用の列(O/S・ベクトルINV・トーチ・V/F・電磁弁盤)
    return [
        P(f"MDOS-C{i}", 425, y + 12, 67, 28, "O/S", dashed=True),
        P(f"1VC{i + 4:02d}", 495, y, 47, 40, f"1VC{i + 4:02d}", ["B", "A"], stack=True),
        P(f"CM1-E{i}", 545, y + 12, 57, 28, "トーチ", dashed=True),
        P(f"VF0{i}", 605, y + 10, 115, 30, "V/F", ["-1", "-2", "-3"]),
        P(STR_MV[i], 722, y - 2, 48, 44, STR_MV[i]),
    ]


def strand_bands():
    # 各STR列の背景帯と、列の下に No.n STR のラベル
    out = []
    for i, y in enumerate(STR_ROW_Y, 1):
        bg, fg = STRAND_COLORS[i]
        cat = f'data-category="{i}スト"'
        out.append(f'<rect class="strand-band" {cat} x="418" y="{y - 22}" width="358" height="70" '
                   f'fill="{bg if i != 1 else "#e5e7eb"}"/>')
        out.append(f'<rect class="strand-badge" {cat} x="430" y="{y + 50}" width="80" height="20" rx="4" '
                   f'fill="{bg}" stroke="#111827"/>')
        out.append(f'<text class="strand-label" {cat} x="470" y="{y + 60}" fill="{fg}">No.{i} STR</text>')
    return out


LEGEND_2F = ["① (P-No15) TDSパワーユニット", "② (P-No1) TDSコントローラー", "③ (P-No3) マニプレーター制御盤",
             "④ PRSD-01 No.6 P/R分配盤", "⑤ 1AMPR-01 比例電磁弁盤", "⑥ 1KKAN トーチ切込装置制御盤"]


FLOORS = {
    "1F": {
        "size": (960, 1320),
        "rooms": [
            ("1階電気室", [(80, 65), (462, 65), (462, 1275), (80, 1275)]),
            ("1階高圧電気室", [(462, 65), (915, 65), (915, 1275), (462, 1275)]),
        ],
        "doors": [(265, 1265, "入口")],
        "panels": [
            P("STDP01", 125, 305, 137, 150, "T/Dプラズマ\nヒーター電源盤", dashed=True),
            P("MOS-01", 290, 305, 55, 85, "O/S油圧\n制御盤", dashed=True),
            P("EMS", 160, 505, 58, 175, "EMS", dashed=True),
            P("1MCC01", 182, 680, 28, 170, "1MCC01", ["-06", "-05", "-04", "-03", "-02", "-01"]),
            P("1MCC03", 182, 870, 28, 105, "1MCC03", ["-03", "-02", "-01"]),
            P("2MCC01", 182, 985, 28, 130, "2MCC01", ["-03", "-02", "-01"]),
            P("2VC", 345, 410, 60, 195, "INV 2VC", ["-01", "-02", "-03", "-04", "-05"], faces=("A", "B")),
            P("2VF01", 345, 635, 37, 85, "2VF01", ["-1", "-2", "-3"]),
            P("2VF02", 338, 740, 44, 230, "V/F 2VF02", ["-1", "-2", "-3", "-4", "-5", "-6", "-7"]),
            P("1MCC02", 338, 975, 27, 75, "1MCC02", ["-01", "-02"]),
            P("1CF", 412, 215, 43, 155, "UPS・バッテリー分電盤", ["1CF01", "1CF02", "1CF03"]),
            P("3LP201", 465, 545, 25, 155, "照明用分電盤", dashed=True),
            P("1LC05", 525, 220, 75, 112, "1LC05", ["C", "B", "A"]),
            P("1LC03", 525, 335, 75, 115, "1LC03", ["C", "B", "A"]),
            P("1LC02", 705, 220, 75, 115, "1LC02", ["A", "B", "C"]),
            P("1LC04", 705, 338, 75, 115, "1LC04", ["A", "B", "C"]),
            P("1LC01", 705, 456, 75, 115, "1LC01", ["A", "B", "C"]),
            P("1BT", 550, 455, 55, 45, "バッテリー", ["01", "02"], stack=True),
            P("1FF04", 545, 505, 25, 55, "1FF04"),
            P("1FPB01", 545, 560, 55, 145, "1FPB01", ["C", "B", "A"]),
            P("1CB", 705, 585, 115, 200, "3.3kV Comb Str",
              [(f"1CB0{n}{s}", 1, f"1CB0{n}{s}({pos})") for n in (3, 2, 1) for s, pos in zip("ABC", "上中下")]),
            P("1MS03-08", 705, 790, 115, 290, "3.3kV MCS",
              [(f"1MS0{n}{s}", 1, f"1MS0{n}{s}({pos})") for n in range(8, 2, -1) for s, pos in zip("AB", "上下")]),
            P("1MS01-02", 655, 1088, 160, 170, "33kV MCS", ["1MS02 受電盤", "1MS01 引込盤"]),
        ],
    },
    "2F": {
        "size": (920, 1280),
        "rooms": [
            # 左上の前室は除外
            ("2階電気室", [(160, 40), (865, 40), (865, 1235), (40, 1235), (40, 165), (160, 165)]),
        ],
        "doors": [(280, 1225, "入口")],
        "panels": [
            P("TB-CCER01", 335, 55, 80, 20, "TB-CCER01"),
            P("1-ITVH", 455, 55, 90, 35, "ITV制御盤"),
            P("1CV", 98, 245, 200, 45, "本体用共通CONV", [("01", 2), "02", "03", "04"]),
            P("1FB02", 330, 235, 45, 55, "1FB02"),
            P("SEQ", 150, 375, 35, 25, "シーケンサー", dashed=True),
            P("TDPH", 190, 360, 112, 38, "T/Dプラズマヒーター", ["①", "②", "③"], dashed=True),
            P("1VF07", 304, 370, 78, 28, "TDカー用", ["-1", "-2"]),
            P("1VC", 145, 487, 145, 48, "共通INV", ["01", ("02", 2), ("03", 2), ("04", 2)], faces=("B", "A")),
            P("1BR", 295, 487, 90, 48, "ブレーキ盤", ["01", "02"]),
            P("TDSN", 158, 594, 222, 48, "T/Dカー S/N制御盤", ["01-TDSN", "02-TDSN"], dashed=True),
            P("INV", 114, 720, 36, 32, "インバータ", dashed=True),
            P("IO", 152, 720, 36, 32, "入出力", dashed=True),
            P("1RY01-04", 205, 712, 170, 40, "リレー盤", ["1RY01", "1RY02", "1RY03", "1RY04"]),
            P("1KKAN", 114, 852, 32, 40, "⑥", dashed=True),
            P("PRSD-01", 148, 846, 44, 28, "④", dashed=True),
            P("1AMPR-01", 148, 876, 44, 24, "⑤", dashed=True),
            P("1SD01-02", 200, 850, 85, 45, "変換器盤", ["1SD01", "1SD02"]),
            P("1EM01-02", 290, 850, 85, 45, "非常引抜盤", ["1EM01", "1EM02"]),
            P("CAS10", 123, 983, 60, 34, "添加剤盤"),
            P("CP1", 223, 977, 170, 43, "T/D多数回制御盤", ["01-CP1", "02-CP1"], dashed=True),
            P("1LV01-02", 470, 973, 90, 47, "検出器盤", ["1LV01", "1LV02"]),
            P("1IF01-03", 561, 973, 132, 47, "インターフェイス盤", ["1IF01", "1IF02", "1IF03"]),
            P("1DL01-03", 695, 973, 135, 47, "ドライブリンケージ盤", ["1DL01", "1DL02", "1DL03"]),
            P("1PUA", 107, 1087, 113, 45, "パウダー供給盤", dashed=True),
            P("1MV-STR", 223, 1087, 170, 45, "電磁弁盤(1〜6STR)", ["1MV07", "1MV11", "1MV12", "1MV13"]),
            P("EMS-C01", 493, 1087, 60, 36, "EMS制御盤", dashed=True),
            P("01-TDCA", 553, 1087, 97, 36, "01-TDCA", dashed=True),
            P("1MV-POUR", 693, 1087, 137, 45, "電磁弁盤(鋳込床)", ["1MV03", "1MV02", "1MV01"]),
            P("1FP", 447, 1180, 186, 24, "制御分電盤", ["1FP01", "1FP02", "1FPT-01"]),
        ] + [p for i, y in enumerate(STR_ROW_Y, 1) for p in str_row(i, y)],
        "under": strand_bands,
        "legend": (590, 70, LEGEND_2F),
    },
}


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;")


def text(cls, x, y, s, rotate=False, fit=None, max_size=13):
    rot = f' transform="rotate(-90 {x} {y})"' if rotate else ""
    # fit: 収める幅。全角1文字≒1em として文字サイズを縮める
    size = ""
    if fit:
        em = sum(1 if ord(c) > 0xFF else 0.6 for c in s)
        size = f' style="font-size:{min(max_size, (fit - 4) / em):.1f}px"'
    return f'<text class="{cls}" x="{x:g}" y="{y:g}"{rot}{size}>{esc(s)}</text>'


def render_panel(p):
    x, y, w, h = p["x"], p["y"], p["w"], p["h"]
    vertical = h > w
    cls = "panel-group dashed" if p["dashed"] else "panel-group"
    out = [f'<g id="{p["id"]}" class="{cls}"><title>{esc(p["label"].replace(chr(10), " "))}</title>',
           f'<rect class="panel" x="{x}" y="{y}" width="{w}" height="{h}"/>']
    secs = [(s, 1, s) if isinstance(s, str) else (*s, s[0])[:3] for s in p["sections"]]
    if secs:
        total = sum(r for _, r, _ in secs)
        faces = p["faces"] or [""]
        for fi, face in enumerate(faces):
            # 面ごとに区切りと直交方向へ等分した範囲に、区切りを並べる
            fx, fy, fw, fh = ((x + w * fi / len(faces), y, w / len(faces), h) if p["stack"]
                              else (x, y + h * fi / len(faces), w, h / len(faces)))
            pos = fy if p["stack"] else fx
            for name, r, shown in secs:
                size = (fh if p["stack"] else fw) * r / total
                sx, sy, sw, sh = (fx, pos, fw, size) if p["stack"] else (pos, fy, size, fh)
                out.append(f'<rect class="section" data-section="{esc(face + name)}" '
                           f'x="{sx:g}" y="{sy:g}" width="{sw:g}" height="{sh:g}"/>')
                out.append(text("section-label", sx + sw / 2, sy + sh / 2, face + shown,
                                fit=sw, max_size=min(13, sh * 0.85)))
                pos += size
        # 区切りがある盤は盤名を外側に出す(縦長は左側に縦書き、横長は上側)
        caption = p["label"].replace("\n", " ")
        out.append(text("caption", x - 5, y + h / 2, caption, rotate=True) if vertical
                   else text("caption", x + w / 2, y - 4, caption))
    else:
        rotate = h > w * 2.5
        lines = [p["label"].replace("\n", " ")] if rotate else p["label"].split("\n")
        cy = y + h / 2 - (len(lines) - 1) * 8
        out += [text("panel-label", x + w / 2, cy + i * 16, s, rotate, h if rotate else w) for i, s in enumerate(lines)]
    out.append("</g>")
    return "".join(out)


def build(name, f):
    W, H = f["size"]
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}">', STYLE]
    for room, pts in f["rooms"]:
        pts_s = " ".join(f"{px},{py}" for px, py in pts)
        parts.append(f'<polygon class="wall" data-room="{room}" points="{pts_s}"/>')
        x0 = min(px for px, _ in pts)
        y0 = min(py for _, py in pts)
        parts.append(text("room-label", x0 + 14 + (120 if name == "2F" else 0), y0 + 36, room))
    parts += f.get("under", list)()
    for x, y, s in f["doors"]:
        parts.append(text("door", x, y, f"▲{s}"))
    parts += [render_panel(p) for p in f["panels"]]
    if "legend" in f:
        lx, ly, rows = f["legend"]
        parts += [text("legend", lx, ly + i * 20, r) for i, r in enumerate(rows)]
    parts.append("</svg>")
    (OUT / f"{name}.svg").write_text("\n".join(parts), encoding="utf-8")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, f in FLOORS.items():
        ids = [p["id"] for p in f["panels"]]
        assert len(ids) == len(set(ids)), f"{name}: 盤IDが重複"
        build(name, f)
    print("generated", list(FLOORS))
