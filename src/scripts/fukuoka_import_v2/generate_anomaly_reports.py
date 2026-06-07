#!/usr/bin/env python3
"""
Anomaly / Normal CSV + FIX_GUIDE 生成スクリプト
==============================================

Phase 5 を一時中断、ヒロが Excel を手直しするための分析資料を作る。

出力:
  docs/sheets/_anomaly/<store_code>_anomaly.csv      ヒロが目視で照合する用
  docs/sheets/_anomaly/FIX_GUIDE_<store_code>.md     店舗別の修正方針
  docs/sheets/_anomaly/RESTART_GUIDE.md              再取り込み手順
  docs/sheets/_normal/<store_code>_normal.csv        完璧店舗の参考CSV
"""
from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path


# 入力
PARSED_JSONL = Path("src/scripts/fukuoka_import_v2/output_v4/parsed_rows_v4.jsonl")
SUMMARY_JSON = Path("src/scripts/fukuoka_import_v2/output_v4/dry_run_summary_v4.json")
FILE_MAP = Path("src/scripts/fukuoka_import_v2/file_map.json")

# 出力
OUT_ANOMALY = Path("docs/sheets/_anomaly")
OUT_NORMAL = Path("docs/sheets/_normal")

CSV_COLUMNS = [
    "patrol_date", "booth_number",
    "machine_name", "machine_area", "unit_index",
    "in_meter", "out_meter",
    "theoretical_stock", "prize_restock_count",
    "prize_name", "prize_cost", "note",
    "r_number",
    "source_row", "sheet_name",
    "is_anomaly", "anomaly_reason",
    "file_name",
]


def load_rows() -> list[dict]:
    rows = []
    with open(PARSED_JSONL, encoding="utf-8") as f:
        for line in f:
            rows.append(json.loads(line))
    return rows


def write_csv(path: Path, rows: list[dict]):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        # utf-8-sig で Excel が日本語を文字化けせず開く
        w = csv.DictWriter(f, fieldnames=CSV_COLUMNS, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow(r)


def write_anomaly_with_context(path: Path, anomaly_rows: list[dict], normal_rows: list[dict]):
    """anomaly行だけだと文脈が分からないので、同じ機械の normal行も近傍に並べて出力。

    並び順: 機械名 → unit_index → patrol_date → booth_number
    各機械ごとに normal + anomaly を時系列で並べる。
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    # 同店舗の同じ(machine_name, area, unit_index)グループを取り出し
    anomaly_keys = set(
        (r["machine_name"], r["machine_area"], r["unit_index"])
        for r in anomaly_rows
    )
    # contextとして、anomalyに属する機械の normal行を集める
    context_rows = [
        r for r in normal_rows
        if (r["machine_name"], r["machine_area"], r["unit_index"]) in anomaly_keys
    ]
    merged = context_rows + anomaly_rows
    merged.sort(key=lambda r: (
        r["machine_name"] or "",
        r["machine_area"] or "",
        r["unit_index"],
        r["patrol_date"],
        r["booth_number"],
    ))
    write_csv(path, merged)


def make_fix_guide(store_code: str, store_meta: dict, anomaly_rows: list[dict]) -> str:
    """店舗別の修正方針メモ Markdown を生成"""
    # 機械別の集計
    by_machine = defaultdict(list)
    for r in anomaly_rows:
        key = (r["machine_name"], r["machine_area"], r["unit_index"])
        by_machine[key].append(r)

    # 機械別 max_booth
    max_booth_per_machine = {}
    for k, rs in by_machine.items():
        max_booth_per_machine[k] = max(r["booth_number"] for r in rs)

    out = []
    out.append(f"# FIX_GUIDE: {store_code} ({store_meta.get('store_name', '')})")
    out.append("")
    out.append(f"## 問題サマリ")
    out.append("")
    out.append(f"- anomaly 行数: **{len(anomaly_rows)}** 件")
    out.append(f"- 問題のある機械: **{len(by_machine)}** 個")
    out.append("")
    out.append("## 問題機械リスト(max_booth 降順)")
    out.append("")
    out.append("| machine_name | area | unit | max_booth | anomaly行 | 想定問題 |")
    out.append("|---|---|---:|---:|---:|---|")

    for k, mb in sorted(max_booth_per_machine.items(), key=lambda x: -x[1]):
        mn, area, ui = k
        rs = by_machine[k]
        # 推定原因
        if mb == 8:
            hyp = "同日2回読み or 1F/2F merge(エリア表記なし時)"
        elif mb == 12:
            hyp = "同日3回読み or 設置場所×3"
        elif mb >= 20:
            hyp = "棚卸/履歴データ混入"
        elif mb in (5, 6, 7):
            hyp = "日付記入漏れで継承暴走"
        else:
            hyp = "不明"
        out.append(f"| {mn} | {area or '-'} | U{ui} | **{mb}** | {len(rs)} | {hyp} |")

    out.append("")
    out.append("## 想定される修正方針(Excel側で)")
    out.append("")

    # max=8 が多ければ
    n_8 = sum(1 for mb in max_booth_per_machine.values() if mb == 8)
    n_high = sum(1 for mb in max_booth_per_machine.values() if mb >= 10)
    n_low = sum(1 for mb in max_booth_per_machine.values() if mb in (5, 6, 7))

    if n_8 >= 2:
        out.append("### 1. max_booth=8 の機械が複数(エリア表記不足の可能性)")
        out.append("")
        out.append("該当機械の R1 セルに **「1F」「2F」など設置場所** を追記すると parser が別機械として分離する。")
        out.append("または、同日付の連続8行が「巡回1回目4行 + 2回目4行」なら、5行目以降の日付セルに **改めて日付** を入れて新グループ化する。")
        out.append("")

    if n_high >= 1:
        out.append("### 2. max_booth ≥ 10 の異常(棚卸/履歴データ混入の可能性)")
        out.append("")
        out.append("該当機械の異常行(下の CSV で `booth_number >= 10`)を Excel で目視確認、")
        out.append("- 集計行/棚卸行なら「日付列に『月末合計』『棚卸』等のラベル」を入れる(parserがskip)")
        out.append("- そもそも不要なら行削除")
        out.append("")

    if n_low >= 1:
        out.append("### 3. max_booth=5〜7 の軽微異常(日付記入漏れの可能性)")
        out.append("")
        out.append("該当行で「本来別日のデータなのに日付セルが空 → 前日付を継承してブース番号がズレた」可能性。")
        out.append("Excel で「同じ日付の連続行が4を超える箇所」を見つけて、5行目以降の日付セルに正しい日付を入れる。")
        out.append("")

    out.append("## 確認用 CSV")
    out.append("")
    out.append(f"- `{OUT_ANOMALY}/{store_code}_anomaly.csv` 開いて、Excel ファイルと突き合わせ。")
    out.append("- anomaly 行のうち `booth_number>=5` の行を Excel で見つけて、上記方針で修正。")
    out.append("- CSV には文脈用に **同機械の normal 行も含めて** ある(時系列順)。")
    out.append("")
    return "\n".join(out)


def make_restart_guide(anomaly_store_codes: list[str], normal_store_codes: list[str]) -> str:
    out = []
    out.append("# 再取り込み手順 (RESTART_GUIDE)")
    out.append("")
    out.append("ヒロが Excel を手直ししたあと、ここから再開する手順。")
    out.append("")
    out.append("## 前提状態")
    out.append("")
    out.append("- meter_readings の source='import_fukuoka_2026'(旧 v1 汚染データ)は既に削除済み")
    out.append("- 昨日生成の booths(56) / machines(56) / prize_masters(235) も削除済み")
    out.append("- stores テーブルは change org 下 12 店舗が維持されている(削除しない)")
    out.append("")
    out.append("## 完璧店舗(無修正でOK)")
    out.append("")
    for sc in normal_store_codes:
        out.append(f"- {sc}")
    out.append("")
    out.append("## 修正対象店舗(Excel手直し後に再 dry-run)")
    out.append("")
    out.append("優先順位(anomaly行数が多い順):")
    out.append("")
    out.append("| 店舗 | anomaly行 | FIX_GUIDE |")
    out.append("|---|---:|---|")
    return out  # 続きは main で店舗を渡してから埋める


def main():
    rows = load_rows()
    with open(FILE_MAP, encoding="utf-8") as f:
        file_map = json.load(f)
    # store_code → meta 逆引き
    store_meta_by_code: dict[str, dict] = {}
    for fname, meta in file_map.items():
        store_meta_by_code[meta["store_code"]] = {**meta, "file_name": fname}

    # 店舗別に分割
    by_store: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_store[r["store_code"]].append(r)

    OUT_ANOMALY.mkdir(parents=True, exist_ok=True)
    OUT_NORMAL.mkdir(parents=True, exist_ok=True)

    anomaly_store_codes = []
    normal_store_codes = []
    anomaly_counts = {}

    for sc, store_rows in by_store.items():
        anomaly_rows = [r for r in store_rows if r["is_anomaly"]]
        normal_rows = [r for r in store_rows if not r["is_anomaly"]]

        if anomaly_rows:
            anomaly_store_codes.append(sc)
            anomaly_counts[sc] = len(anomaly_rows)
            # anomaly行 + 文脈normal を結合した CSV
            csv_path = OUT_ANOMALY / f"{sc}_anomaly.csv"
            write_anomaly_with_context(csv_path, anomaly_rows, normal_rows)
            # 店舗別 FIX_GUIDE
            guide_path = OUT_ANOMALY / f"FIX_GUIDE_{sc}.md"
            guide_text = make_fix_guide(sc, store_meta_by_code.get(sc, {}), anomaly_rows)
            guide_path.write_text(guide_text, encoding="utf-8")
        else:
            normal_store_codes.append(sc)
            # 完璧店舗の normal CSV
            csv_path = OUT_NORMAL / f"{sc}_normal.csv"
            write_csv(csv_path, sorted(
                normal_rows,
                key=lambda r: (
                    r["machine_name"] or "",
                    r["machine_area"] or "",
                    r["unit_index"],
                    r["patrol_date"],
                    r["booth_number"],
                ),
            ))

    # 全 anomaly 店舗の normal CSV も出す(参考用、後で本投入時に使える)
    for sc in anomaly_store_codes:
        store_rows = by_store[sc]
        normal_rows = [r for r in store_rows if not r["is_anomaly"]]
        if normal_rows:
            csv_path = OUT_NORMAL / f"{sc}_normal.csv"
            write_csv(csv_path, sorted(
                normal_rows,
                key=lambda r: (
                    r["machine_name"] or "",
                    r["machine_area"] or "",
                    r["unit_index"],
                    r["patrol_date"],
                    r["booth_number"],
                ),
            ))

    # RESTART_GUIDE
    guide_lines = []
    guide_lines.append("# 再取り込み手順 (RESTART_GUIDE)")
    guide_lines.append("")
    guide_lines.append("ヒロが Excel を手直ししたあと、ここから再開する手順。")
    guide_lines.append("")
    guide_lines.append("## 前提状態 (2026-05-30 時点)")
    guide_lines.append("")
    guide_lines.append("- meter_readings の source='import_fukuoka_2026'(旧 v1 汚染データ)は既に **削除済み**")
    guide_lines.append("- 昨日生成の booths(56) / machines(56) / prize_masters(235) も **削除済み**")
    guide_lines.append("- stores テーブルは change org 下 **12店舗** が維持されている(削除しない)")
    guide_lines.append("- 本番 INSERT は **まだ実施していない**(待機状態)")
    guide_lines.append("")
    guide_lines.append("## 完璧店舗(無修正でOK、いつでも投入可)")
    guide_lines.append("")
    for sc in normal_store_codes:
        meta = store_meta_by_code.get(sc, {})
        normal_count = sum(1 for r in by_store[sc] if not r["is_anomaly"])
        guide_lines.append(f"- **{sc}** ({meta.get('store_name', '')}): normal {normal_count} 行")
    guide_lines.append("")
    guide_lines.append("## 修正対象店舗(Excel手直し後に再 dry-run)")
    guide_lines.append("")
    guide_lines.append("優先順位(anomaly行数の少ない=直しやすい順):")
    guide_lines.append("")
    guide_lines.append("| 順 | 店舗 | anomaly行 | FIX_GUIDE |")
    guide_lines.append("|---:|---|---:|---|")
    for i, (sc, cnt) in enumerate(sorted(anomaly_counts.items(), key=lambda x: x[1]), 1):
        meta = store_meta_by_code.get(sc, {})
        guide_lines.append(f"| {i} | {sc} ({meta.get('store_name', '')}) | {cnt} | `_anomaly/FIX_GUIDE_{sc}.md` |")
    guide_lines.append("")
    guide_lines.append("## 修正後の再 dry-run コマンド")
    guide_lines.append("")
    guide_lines.append("ヒロが Excel を直したら、clawops リポジトリ root で:")
    guide_lines.append("")
    guide_lines.append("```bash")
    guide_lines.append("# 全12ファイル再 dry-run")
    guide_lines.append("python3 src/scripts/fukuoka_import_v2/parser_v4.py --mode emit")
    guide_lines.append("")
    guide_lines.append("# 特定店舗のみ再 dry-run(例: 唐津)")
    guide_lines.append("python3 src/scripts/fukuoka_import_v2/parser_v4.py \\")
    guide_lines.append("  --only '★唐津　クレーン売上表.xlsx' --mode emit")
    guide_lines.append("")
    guide_lines.append("# anomaly CSV 再生成")
    guide_lines.append("python3 src/scripts/fukuoka_import_v2/generate_anomaly_reports.py")
    guide_lines.append("```")
    guide_lines.append("")
    guide_lines.append("## 確認ポイント")
    guide_lines.append("")
    guide_lines.append("- 全店舗で anomaly=0 になっているか")
    guide_lines.append("- max_booths_seen が 1/2/4 のいずれかに収まっているか")
    guide_lines.append("- 機械名+エリア の組み合わせが実機と合っているか")
    guide_lines.append("")
    guide_lines.append("## 本番投入手順(全 anomaly が消えてから)")
    guide_lines.append("")
    guide_lines.append("Claude Code に以下を依頼:")
    guide_lines.append("")
    guide_lines.append("> 福岡 v2 取り込み Phase 5 再開。")
    guide_lines.append("> dry-run v4 で anomaly=0 確認済み。本番INSERT実行。")
    guide_lines.append("> ")
    guide_lines.append("> 投入手順:")
    guide_lines.append("> 1. machines / booths / prize_masters のマスタ整備(機械名+エリアで unique)")
    guide_lines.append("> 2. meter_readings に source='import_fukuoka_2026_v2' で200件ずつ batch INSERT")
    guide_lines.append("> 3. Round Zero Dashboard で 12店舗が正しく表示されることを確認")
    guide_lines.append("")
    guide_lines.append("## parser バージョン履歴")
    guide_lines.append("")
    guide_lines.append("- v1: 5/29 旧スクリプト(import_fukuoka_meter_readings.mjs) — 汚染あり、削除済み")
    guide_lines.append("- v2 (parser.py): 列方向ブース解釈 → ヒロ修正で廃止")
    guide_lines.append("- v3 (parser_v3.py): 行方向ブース解釈 + R1空無視")
    guide_lines.append("- v4 (parser_v4.py): + エリア分離 + 100円厳密数値 + anomaly フラグ ← **最新**")
    guide_lines.append("")

    (OUT_ANOMALY / "RESTART_GUIDE.md").write_text("\n".join(guide_lines), encoding="utf-8")

    print(f"=== 出力完了 ===")
    print(f"完璧店舗 normal CSV: {len(normal_store_codes)} 店舗 → {OUT_NORMAL}/")
    for sc in normal_store_codes:
        print(f"  {sc}_normal.csv")
    print(f"\n問題店舗 anomaly CSV + FIX_GUIDE: {len(anomaly_store_codes)} 店舗 → {OUT_ANOMALY}/")
    for sc in sorted(anomaly_store_codes, key=lambda x: anomaly_counts[x]):
        print(f"  {sc}_anomaly.csv (anomaly: {anomaly_counts[sc]})")
        print(f"  FIX_GUIDE_{sc}.md")
    print(f"\nRESTART_GUIDE.md → {OUT_ANOMALY}/RESTART_GUIDE.md")


if __name__ == "__main__":
    main()
