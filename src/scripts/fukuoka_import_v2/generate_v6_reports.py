#!/usr/bin/env python3
"""
v6 用 最終レポート + CSV出力。
"""
from __future__ import annotations

import csv
import json
import re
from collections import defaultdict, Counter
from pathlib import Path

V6_JSONL = Path("src/scripts/fukuoka_import_v2/output_v6/parsed_rows_v6.jsonl")
V5_JSONL = Path("src/scripts/fukuoka_import_v2/output_v5/parsed_rows_v5.jsonl")
LOG_JSONL = Path("src/scripts/fukuoka_import_v2/output_v6/classification_log.jsonl")
FILE_MAP = Path("src/scripts/fukuoka_import_v2/file_map.json")

OUT_FINAL = Path("docs/sheets/_final_v6")

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


def main():
    v6 = load(V6_JSONL)
    v5 = load(V5_JSONL)
    log = load(LOG_JSONL)
    with open(FILE_MAP, encoding="utf-8") as f:
        file_map = json.load(f)
    store_meta = {meta["store_code"]: {**meta, "file_name": fname} for fname, meta in file_map.items()}

    OUT_FINAL.mkdir(parents=True, exist_ok=True)

    # 店舗別 CSV
    by_store = defaultdict(list)
    for r in v6:
        by_store[r["store_code"]].append(r)

    for sc, rows in by_store.items():
        normal_rows = [r for r in rows if not r["is_anomaly"]]
        anomaly_rows = [r for r in rows if r["is_anomaly"]]
        # normal CSV
        write_csv(OUT_FINAL / f"{sc}_normal.csv", sorted(normal_rows, key=lambda r: (
            r["machine_name"] or "", r["machine_area"] or "",
            r["unit_index"], r["patrol_date"], r["booth_number"],
        )))
        # anomaly CSV (inconclusive のみ残ってる場合)
        if anomaly_rows:
            write_csv(OUT_FINAL / f"{sc}_inconclusive.csv", sorted(anomaly_rows, key=lambda r: (
                r["machine_name"] or "", r["machine_area"] or "",
                r["unit_index"], r["patrol_date"], r["booth_number"],
            )))

    # 統計
    v6_normal = sum(1 for r in v6 if not r["is_anomaly"])
    v6_anomaly = sum(1 for r in v6 if r["is_anomaly"])
    v5_normal = sum(1 for r in v5 if not r["is_anomaly"])
    v5_anomaly = sum(1 for r in v5 if r["is_anomaly"])

    # visit_index 分布
    visit_marks = Counter()
    for r in v6:
        note = r.get("note") or ""
        m = re.search(r"\[(\d+)回目巡回\]", note)
        if m:
            visit_marks[int(m.group(1))] += 1

    # 機械別 max_booth
    machines = defaultdict(lambda: defaultdict(int))
    for r in v6:
        key = (r["machine_name"], r["machine_area"], r["unit_index"])
        if r["booth_number"] > machines[r["store_code"]][key]:
            machines[r["store_code"]][key] = r["booth_number"]
    booth_dist = Counter()
    for sc, ms in machines.items():
        for k, mb in ms.items():
            booth_dist[mb] += 1

    # クラスタ分類サマリ
    by_tag = defaultdict(list)
    for entry in log:
        by_tag[entry["tag"]].append(entry)

    # final report
    out = []
    out.append("# v6 最終レポート — 福岡取り込み自動分類完了")
    out.append("")
    out.append("## 件数推移(v5 → v6)")
    out.append("")
    out.append("| 指標 | v5 | v6 | 差分 | 改善率 |")
    out.append("|---|---:|---:|---:|---:|")
    out.append(f"| total | {len(v5):,} | {len(v6):,} | {len(v6)-len(v5):+,} | -|")
    out.append(f"| normal | {v5_normal:,} | {v6_normal:,} | {v6_normal-v5_normal:+,} | +{(v6_normal-v5_normal)/v5_normal*100:.2f}% |")
    out.append(f"| **anomaly** | **{v5_anomaly}** | **{v6_anomaly}** | **{v6_anomaly-v5_anomaly:+}** | **{(v5_anomaly-v6_anomaly)/v5_anomaly*100:.1f}% 削減** |")
    out.append("")
    out.append("## クラスタ分類結果(37 クラスタ)")
    out.append("")
    for tag in ["confirmed_2nd_round", "split_to_separate_unit", "aggregate_or_inventory", "inconclusive"]:
        entries = by_tag.get(tag, [])
        if tag == "confirmed_2nd_round":
            desc = "景品名一致+メーター連続 → ロールバックして normal化"
        elif tag == "split_to_separate_unit":
            desc = "景品名違い → 別ユニット(U2/U3) として normal化"
        elif tag == "aggregate_or_inventory":
            desc = "棚卸/集計混入 → 除外"
        else:
            desc = "判定不能 → anomaly 維持、ヒロ目視確認"
        out.append(f"### {tag} ({len(entries)} クラスタ) — {desc}")
        out.append("")
        if entries:
            out.append("| store | machine | area | pairs | prize_match | meter_cont | 備考 |")
            out.append("|---|---|---|---:|---:|---:|---|")
            for e in entries:
                info = e["info"]
                area = e.get("machine_area") or "-"
                reason = info.get("reason", "")
                out.append(
                    f"| {e['store_code']} | {e['machine_name']} | {area} | "
                    f"{info.get('total_pairs', 0)} | {info.get('prize_match_count', 0)} | "
                    f"{info.get('meter_continuous_count', 0)} | {reason} |"
                )
        out.append("")

    out.append("## 巡回回数分布(visit_index)")
    out.append("")
    out.append("ロールバック後、note に `[N回目巡回]` マーカーが付与された行数:")
    out.append("")
    for v, c in sorted(visit_marks.items()):
        out.append(f"- {v}回目: {c} 行")
    out.append("")

    out.append("## 最終 機械×ブース 分布")
    out.append("")
    out.append("| max_booth | 機械数 |")
    out.append("|---:|---:|")
    for n in sorted(booth_dist):
        out.append(f"| {n} | {booth_dist[n]} |")
    out.append("")
    total_machines = sum(booth_dist.values())
    normal_machines = sum(c for n, c in booth_dist.items() if n <= 4)
    out.append(f"合計 {total_machines} 機械(U2/U3 unit含む)、うち **{normal_machines} 機械が max_booth ≤ 4 で完全正常({normal_machines/total_machines*100:.1f}%)**")
    out.append("")

    out.append("## ⚠️ inconclusive 4 機械(ヒロ目視確認待ち)")
    out.append("")
    inc_entries = by_tag.get("inconclusive", [])
    out.append("これらは「景品名は一部一致するがメーター連続性が不完全」「景品名違いだがメーター連続」等で")
    out.append("v6 ロジックでは確定判定できなかった機械。")
    out.append("")
    out.append("| store | machine | pairs | prize_match | meter_cont | anomaly行 |")
    out.append("|---|---|---:|---:|---:|---:|")
    inc_rows_per_machine = defaultdict(int)
    for r in v6:
        if r["is_anomaly"]:
            key = (r["store_code"], r["machine_name"], r["machine_area"], r["unit_index"])
            inc_rows_per_machine[key] += 1
    for e in inc_entries:
        info = e["info"]
        key = (e["store_code"], e["machine_name"], e["machine_area"], e["unit_index"])
        cnt = inc_rows_per_machine.get(key, 0)
        out.append(
            f"| {e['store_code']} | {e['machine_name']} | "
            f"{info.get('total_pairs', 0)} | {info.get('prize_match_count', 0)} | "
            f"{info.get('meter_continuous_count', 0)} | {cnt} |"
        )
    out.append("")
    out.append("**Excel で見るべき箇所**: `docs/sheets/_final_v6/<store>_inconclusive.csv` を開き、")
    out.append("元 Excel ファイルの該当機械列の 5行目以降と突き合わせ → 2回目巡回 or 別ユニット or 棚卸 の判断。")
    out.append("")

    out.append("## ロールバック例(confirmed_2nd_round / split_to_separate_unit)")
    out.append("")
    # サンプル5件
    rollback_samples = [
        r for r in v6
        if r.get("anomaly_tag") in ("confirmed_2nd_round", "split_to_separate_unit")
    ][:8]
    if rollback_samples:
        out.append("| store | machine | area | unit | booth | date | tag | note |")
        out.append("|---|---|---|---:|---:|---|---|---|")
        for r in rollback_samples:
            out.append(
                f"| {r['store_code']} | {r['machine_name']} | {r['machine_area'] or '-'} | "
                f"U{r['unit_index']} | b{r['booth_number']} | {r['patrol_date']} | "
                f"{r['anomaly_tag']} | {r.get('note', '') or ''} |"
            )
    out.append("")

    out.append("## 本投入準備状況")
    out.append("")
    out.append(f"- normal {v6_normal:,} 行 → `source='import_fukuoka_2026_v2'` で投入候補")
    out.append(f"- inconclusive {v6_anomaly} 行 → ヒロ判定後、必要なら `source='import_fukuoka_2026_v2_manual'` で別途投入")
    out.append(f"- 除外 114 行(aggregate_or_inventory + meter_reset_artifact)→ 投入しない")
    out.append("")
    out.append("INSERT は **未実行**(`generate_v6_reports.py` は CSV/レポート出力のみ)。")
    out.append("")

    (OUT_FINAL / "V6_FINAL_REPORT.md").write_text("\n".join(out), encoding="utf-8")
    print(f"=== レポート生成完了 ===")
    print(f"  CSVs: {OUT_FINAL}/ (12 normal + inconclusive 数件)")
    print(f"  Final Report: {OUT_FINAL}/V6_FINAL_REPORT.md")


if __name__ == "__main__":
    main()
