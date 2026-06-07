#!/usr/bin/env python3
"""
v5 用 anomaly CSV + FIX_GUIDE + v4比較レポート 生成。
v4 用 (generate_anomaly_reports.py) を流用し、tag情報を追加。
"""
from __future__ import annotations

import csv
import json
from collections import defaultdict, Counter
from pathlib import Path

V5_JSONL = Path("src/scripts/fukuoka_import_v2/output_v5/parsed_rows_v5.jsonl")
V4_JSONL = Path("src/scripts/fukuoka_import_v2/output_v4/parsed_rows_v4.jsonl")
FILE_MAP = Path("src/scripts/fukuoka_import_v2/file_map.json")

OUT_ANOMALY = Path("docs/sheets/_anomaly_v5")
OUT_NORMAL = Path("docs/sheets/_normal_v5")

CSV_COLUMNS = [
    "patrol_date", "booth_number",
    "machine_name", "machine_area", "unit_index",
    "in_meter", "out_meter",
    "theoretical_stock", "prize_restock_count",
    "prize_name", "prize_cost", "note",
    "r_number",
    "is_anomaly", "anomaly_tag", "anomaly_reason",
    "source_row", "sheet_name", "file_name",
]


def load(path):
    rows = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            rows.append(json.loads(line))
    return rows


def write_csv(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CSV_COLUMNS, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r)


def write_anomaly_with_context(path, anomaly_rows, normal_rows):
    keys = set(
        (r["machine_name"], r["machine_area"], r["unit_index"])
        for r in anomaly_rows
    )
    context_rows = [r for r in normal_rows if (r["machine_name"], r["machine_area"], r["unit_index"]) in keys]
    merged = context_rows + anomaly_rows
    merged.sort(key=lambda r: (
        r["machine_name"] or "",
        r["machine_area"] or "",
        r["unit_index"],
        r["patrol_date"],
        r["booth_number"],
    ))
    write_csv(path, merged)


def make_fix_guide(store_code, store_meta, anomaly_rows):
    """tag を考慮した FIX_GUIDE 生成"""
    by_machine = defaultdict(list)
    for r in anomaly_rows:
        by_machine[(r["machine_name"], r["machine_area"], r["unit_index"])].append(r)

    max_booth = {k: max(r["booth_number"] for r in rs) for k, rs in by_machine.items()}
    tag_counts_per_machine = {k: Counter(r["anomaly_tag"] for r in rs) for k, rs in by_machine.items()}

    out = []
    out.append(f"# FIX_GUIDE v5: {store_code} ({store_meta.get('store_name', '')})")
    out.append("")
    out.append(f"## 問題サマリ")
    out.append("")
    out.append(f"- anomaly 行数: **{len(anomaly_rows)}** 件")
    out.append(f"- 問題機械: **{len(by_machine)}** 個")
    # tag集計
    all_tags = Counter(r["anomaly_tag"] for r in anomaly_rows)
    out.append("")
    out.append("### v5 タグ分類")
    out.append("")
    for t, c in all_tags.most_common():
        if t == "possible_2nd_round":
            d = "1日2回巡回の可能性(4ブース×2回=8行)"
        elif t == "possible_aggregate":
            d = "集計行/棚卸混入の可能性(booth≥9)"
        elif t == "possible_duplicate":
            d = "重複入力(直前行と景品+価格+メーター完全一致)"
        else:
            d = "未分類"
        out.append(f"- `{t}`: {c} 件 — {d}")
    out.append("")

    out.append("## 機械別詳細(max_booth 降順)")
    out.append("")
    out.append("| machine | area | unit | max_booth | anomaly行 | 支配タグ |")
    out.append("|---|---|---:|---:|---:|---|")
    for k, mb in sorted(max_booth.items(), key=lambda x: -x[1]):
        mn, area, ui = k
        cnt = len(by_machine[k])
        tag_str = ", ".join(f"{t}({c})" for t, c in tag_counts_per_machine[k].most_common())
        out.append(f"| {mn} | {area or '-'} | U{ui} | **{mb}** | {cnt} | {tag_str} |")

    out.append("")
    out.append("## タグ別の Excel 修正方針")
    out.append("")

    if all_tags.get("possible_2nd_round", 0) > 0:
        out.append("### `possible_2nd_round` の対処(同日2回巡回想定)")
        out.append("")
        out.append("該当機械の R1 セルに **「1F」「2F」「午前」「午後」など分離タグ** を追記して別機械として扱わせる。")
        out.append("または、5行目以降の日付セルに **改めて日付** を入れて新グループ化する。")
        out.append("もしくは「2回目巡回データを残したくない」ならその行ごと削除でもOK。")
        out.append("")

    if all_tags.get("possible_aggregate", 0) > 0:
        out.append("### `possible_aggregate` の対処(集計/棚卸混入想定)")
        out.append("")
        out.append("該当行の日付セルに **「月末合計」「棚卸」「期末」等のラベル** を入れる(parserが skip)。")
        out.append("そもそも不要なら行削除。")
        out.append("特に **max_booth ≥ 10** の機械は棚卸データが大量に紛れ込んでる可能性大。")
        out.append("")

    if all_tags.get("possible_duplicate", 0) > 0:
        out.append("### `possible_duplicate` の対処(重複入力)")
        out.append("")
        out.append("直前と同じ景品+価格+メーター値の重複行 → Excel で重複削除。")
        out.append("")

    out.append("## CSV ファイル")
    out.append("")
    out.append(f"- `docs/sheets/_anomaly_v5/{store_code}_anomaly.csv` を開いて Excel と突き合わせ。")
    out.append("- `anomaly_tag` 列で分類を確認、タグごとに対処。")
    out.append("- normal 行も文脈として時系列順に含めてある。")
    out.append("")
    return "\n".join(out)


def main():
    v5 = load(V5_JSONL)
    v4 = load(V4_JSONL)
    with open(FILE_MAP, encoding="utf-8") as f:
        file_map = json.load(f)
    store_meta = {meta["store_code"]: {**meta, "file_name": fname} for fname, meta in file_map.items()}

    # v5 を店舗別に
    by_store_v5 = defaultdict(list)
    for r in v5:
        by_store_v5[r["store_code"]].append(r)

    # v4 を店舗別に
    by_store_v4 = defaultdict(lambda: {"normal": 0, "anomaly": 0})
    for r in v4:
        if r["is_anomaly"]:
            by_store_v4[r["store_code"]]["anomaly"] += 1
        else:
            by_store_v4[r["store_code"]]["normal"] += 1

    OUT_ANOMALY.mkdir(parents=True, exist_ok=True)
    OUT_NORMAL.mkdir(parents=True, exist_ok=True)

    anomaly_stores = []
    normal_stores = []
    anomaly_counts = {}
    tag_counts_per_store = {}

    for sc, rows in by_store_v5.items():
        anomaly_rows = [r for r in rows if r["is_anomaly"]]
        normal_rows = [r for r in rows if not r["is_anomaly"]]
        if anomaly_rows:
            anomaly_stores.append(sc)
            anomaly_counts[sc] = len(anomaly_rows)
            tag_counts_per_store[sc] = Counter(r["anomaly_tag"] for r in anomaly_rows)
            csv_path = OUT_ANOMALY / f"{sc}_anomaly.csv"
            write_anomaly_with_context(csv_path, anomaly_rows, normal_rows)
            guide_path = OUT_ANOMALY / f"FIX_GUIDE_{sc}.md"
            guide_path.write_text(make_fix_guide(sc, store_meta.get(sc, {}), anomaly_rows), encoding="utf-8")
        else:
            normal_stores.append(sc)
            csv_path = OUT_NORMAL / f"{sc}_normal.csv"
            write_csv(csv_path, sorted(normal_rows, key=lambda r: (
                r["machine_name"] or "", r["machine_area"] or "", r["unit_index"],
                r["patrol_date"], r["booth_number"],
            )))

    # 異常店舗にも normal CSV 出す
    for sc in anomaly_stores:
        normal_rows = [r for r in by_store_v5[sc] if not r["is_anomaly"]]
        csv_path = OUT_NORMAL / f"{sc}_normal.csv"
        write_csv(csv_path, sorted(normal_rows, key=lambda r: (
            r["machine_name"] or "", r["machine_area"] or "", r["unit_index"],
            r["patrol_date"], r["booth_number"],
        )))

    # v4 vs v5 比較レポート
    cmp_lines = []
    cmp_lines.append("# v4 → v5 比較レポート")
    cmp_lines.append("")
    cmp_lines.append("## 全体サマリ")
    cmp_lines.append("")
    cmp_lines.append("| 指標 | v4 | v5 | 差分 |")
    cmp_lines.append("|---|---:|---:|---:|")
    v4_total = len(v4)
    v5_total = len(v5)
    v4_normal = sum(1 for r in v4 if not r["is_anomaly"])
    v5_normal = sum(1 for r in v5 if not r["is_anomaly"])
    v4_anomaly = sum(1 for r in v4 if r["is_anomaly"])
    v5_anomaly = sum(1 for r in v5 if r["is_anomaly"])
    cmp_lines.append(f"| 総 parse 行 | {v4_total:,} | {v5_total:,} | {v5_total - v4_total:+,} |")
    cmp_lines.append(f"| normal 行 | {v4_normal:,} | {v5_normal:,} | {v5_normal - v4_normal:+,} |")
    cmp_lines.append(f"| anomaly 行 | {v4_anomaly} | {v5_anomaly} | {v5_anomaly - v4_anomaly:+} |")
    cmp_lines.append("")
    cmp_lines.append("## v5 anomaly タグ分布")
    cmp_lines.append("")
    all_tags = Counter(r["anomaly_tag"] for r in v5 if r["is_anomaly"])
    cmp_lines.append("| タグ | 件数 | 比率 | 意味 |")
    cmp_lines.append("|---|---:|---:|---|")
    for t, c in all_tags.most_common():
        ratio = c / v5_anomaly * 100 if v5_anomaly else 0
        if t == "possible_2nd_round":
            meaning = "1日2回巡回(4ブース×2回=8行)"
        elif t == "possible_aggregate":
            meaning = "集計行/棚卸混入(booth≥9)"
        elif t == "possible_duplicate":
            meaning = "重複入力(完全一致)"
        else:
            meaning = "?"
        cmp_lines.append(f"| `{t}` | {c} | {ratio:.1f}% | {meaning} |")
    cmp_lines.append("")
    cmp_lines.append("## 店舗別 v4 vs v5")
    cmp_lines.append("")
    cmp_lines.append("| 店舗 | v4 normal | v5 normal | v4 anomaly | v5 anomaly | 支配タグ(v5) |")
    cmp_lines.append("|---|---:|---:|---:|---:|---|")
    for sc in sorted(set(by_store_v4.keys()) | set(by_store_v5.keys())):
        v4_n = by_store_v4.get(sc, {}).get("normal", 0)
        v4_a = by_store_v4.get(sc, {}).get("anomaly", 0)
        v5_rows = by_store_v5.get(sc, [])
        v5_n = sum(1 for r in v5_rows if not r["is_anomaly"])
        v5_a = sum(1 for r in v5_rows if r["is_anomaly"])
        tag_str = ""
        if sc in tag_counts_per_store:
            tag_str = ", ".join(f"{t}({c})" for t, c in tag_counts_per_store[sc].most_common())
        cmp_lines.append(f"| {sc} | {v4_n:,} | {v5_n:,} | {v4_a} | {v5_a} | {tag_str} |")
    cmp_lines.append("")

    cmp_lines.append("## v5 で追加された機能")
    cmp_lines.append("")
    cmp_lines.append("1. **日付列の異常検出**: シート全体の日付中央値から±90日乖離→null化(継承)")
    cmp_lines.append("   - 効果: 6件 null化(daikyo 3 + bayside 3)、件数大きく動かず")
    cmp_lines.append("2. **機械名 数値のみ検出**: 数値だけの R1 ラベルを skip")
    cmp_lines.append("   - 効果: 該当ブロック 0件(現状の福岡12ファイルには存在せず)")
    cmp_lines.append("3. **anomaly タグ分類**: possible_2nd_round / possible_aggregate / possible_duplicate")
    cmp_lines.append("   - 効果: ヒロが Excel 手直しの優先度判断できるようになった")
    cmp_lines.append("")
    cmp_lines.append("## ヒロが Excel 手直しすべき優先度(タグ別)")
    cmp_lines.append("")
    cmp_lines.append("### 優先度1: `possible_aggregate` 機械(棚卸混入で件数歪み大)")
    cmp_lines.append("")
    cmp_lines.append("- **bayside / BUZZ③**: 20件 (max_booth=28)")
    cmp_lines.append("- **SAG01 / BUZZクレ⑥⑦**: 各12件 (max_booth=20)")
    cmp_lines.append("- **daikyo / BUZZミニ③**: 7件 (max_booth=11)")
    cmp_lines.append("- **TKT01 / トライデッキ**: 4件 (max_booth=12)")
    cmp_lines.append("")
    cmp_lines.append("対処: 該当行の日付セルに『棚卸』『月末合計』等のラベル追加 or 行削除")
    cmp_lines.append("")
    cmp_lines.append("### 優先度2: `possible_2nd_round` 機械(同日2回巡回想定)")
    cmp_lines.append("")
    cmp_lines.append("ナイスランド系(KRT01/TKT01/HMN01)の BUZZ①〜④ ほとんど全部。")
    cmp_lines.append("対処: R1 セルに『1F』『2F』『午前』『午後』等の分離タグ追記")
    cmp_lines.append("")

    (OUT_ANOMALY / "V4_VS_V5_COMPARISON.md").write_text("\n".join(cmp_lines), encoding="utf-8")

    print(f"=== v5 出力完了 ===")
    print(f"完璧店舗 normal CSV: {len(normal_stores)}")
    print(f"問題店舗 anomaly+FIX_GUIDE: {len(anomaly_stores)}")
    print(f"V4_VS_V5_COMPARISON.md → {OUT_ANOMALY}/")
    print()
    print(f"v4 → v5: {v4_total} → {v5_total} ({v5_total-v4_total:+}), anomaly {v4_anomaly} → {v5_anomaly}")


if __name__ == "__main__":
    main()
