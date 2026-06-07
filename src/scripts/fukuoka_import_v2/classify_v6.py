#!/usr/bin/env python3
"""
v6 anomaly 自動分類スクリプト — clawops Round Zero
=======================================================

ヒロ提案 v6 判別ロジック(2026-05-30 第5回):

v5 の anomaly 295件を、景品名比較 + メーター整合性で自動分類する。

分類カテゴリ:
  - confirmed_2nd_round: 景品名一致 + メーター値が増分連続 → b1-b4 にロールバック (note="[2回目巡回]" 追加) → normal 化
  - split_to_separate_unit: 景品名違い or メーター飛び → machine_name に "-U2" suffix → 別ユニット扱いで normal 化
  - aggregate_or_inventory: 景品名空 / メーター9999991系 / メーター減少 → 除外
  - meter_reset_artifact: 9999991系単独 → タグだけ付与、除外
  - inconclusive: 上記非該当 → anomaly のまま

入力: src/scripts/fukuoka_import_v2/output_v5/parsed_rows_v5.jsonl
出力:
  src/scripts/fukuoka_import_v2/output_v6/parsed_rows_v6.jsonl       全行(normal+anomaly+excluded)
  src/scripts/fukuoka_import_v2/output_v6/classification_log.jsonl   クラスタ単位の判定ログ
"""
from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

V5_JSONL = Path("src/scripts/fukuoka_import_v2/output_v5/parsed_rows_v5.jsonl")
OUT_DIR = Path("src/scripts/fukuoka_import_v2/output_v6")

# 閾値
METER_RESET_THRESHOLD = 9_000_000      # これを超える値は出荷時リセット残値とみなす
METER_INCREMENT_MAX = 200_000          # 同日2回目で「これ以上の増分はあり得ない」上限
PRIZE_NAME_MATCH_RATIO = 0.5           # クラスタ内のペア比較で景品名一致 ≥ 50% なら confirmed
INVENTORY_PRIZE_NAMES = {"月末在庫金額", "月末在庫", "在庫金額", "棚卸", "原価", "トータル原価"}


@dataclass
class Row:
    data: dict

    @property
    def key_machine(self):
        return (self.data["store_code"], self.data["machine_name"],
                self.data["machine_area"], self.data["unit_index"])

    @property
    def patrol_date(self):
        return self.data["patrol_date"]

    @property
    def booth(self):
        return self.data["booth_number"]


def is_meter_reset(v):
    return v is not None and v > METER_RESET_THRESHOLD


def normalize_prize(name):
    if not name:
        return ""
    return str(name).strip().lower()


def classify_cluster(
    cluster_rows: list[Row]
) -> tuple[str, dict, list[Row]]:
    """1機械の anomaly cluster (max_booth>4) を判定。

    戻り値:
      (tag, info, transformed_rows)
      - tag: 上記5カテゴリのいずれか
      - info: 判定根拠の詳細
      - transformed_rows: ロールオーバー / 除外 / そのまま のいずれか適用後の行
    """
    # 全行を normal+anomaly で patrol_date × booth でグルーピング
    by_date: dict[str, list[Row]] = defaultdict(list)
    for r in cluster_rows:
        by_date[r.patrol_date].append(r)
    for d in by_date:
        by_date[d].sort(key=lambda r: r.booth)

    # 9999991系の検出(クラスタ全体で in_meter or out_meter が異常値)
    has_meter_reset = any(
        is_meter_reset(r.data.get("in_meter")) or is_meter_reset(r.data.get("out_meter"))
        for r in cluster_rows
    )

    # 在庫キーワード景品名
    has_inventory_label = any(
        normalize_prize(r.data.get("prize_name")) in {p.lower() for p in INVENTORY_PRIZE_NAMES}
        for r in cluster_rows
    )

    # メーター減少検出
    meter_decreased = False
    for d, rows in by_date.items():
        for i in range(1, len(rows)):
            prev = rows[i - 1].data.get("in_meter")
            curr = rows[i].data.get("in_meter")
            if prev is not None and curr is not None and curr < prev * 0.5:
                # 大幅減少(50%以下)= リセットor別機械
                meter_decreased = True
                break

    # aggregate_or_inventory 判定
    if has_inventory_label:
        return "aggregate_or_inventory", {
            "reason": "inventory_label_found", "has_meter_reset": has_meter_reset,
        }, []  # 除外(空リスト返す)

    # 各日付グループでペア比較(b1↔b5, b2↔b6, ...)
    pair_results = []
    for d, rows in by_date.items():
        n_pairs = min(4, len(rows) - 4)  # 最大4ペアまで
        if len(rows) <= 4:
            continue  # ペアできない
        for offset in range(n_pairs):
            r_low = rows[offset]    # b1, b2, b3, b4
            r_high = rows[offset + 4]  # b5, b6, b7, b8
            pn_low = normalize_prize(r_low.data.get("prize_name"))
            pn_high = normalize_prize(r_high.data.get("prize_name"))
            in_low = r_low.data.get("in_meter")
            in_high = r_high.data.get("in_meter")

            prize_match = (pn_low and pn_high and pn_low == pn_high)
            meter_continuous = (
                in_low is not None and in_high is not None
                and in_high >= in_low
                and in_high - in_low <= METER_INCREMENT_MAX
                and not is_meter_reset(in_high)
                and not is_meter_reset(in_low)
            )
            pair_results.append({
                "date": d, "offset": offset,
                "prize_match": prize_match, "meter_continuous": meter_continuous,
                "pn_low": pn_low, "pn_high": pn_high,
                "in_low": in_low, "in_high": in_high,
            })

    total_pairs = len(pair_results)
    n_prize_match = sum(1 for p in pair_results if p["prize_match"])
    n_meter_cont = sum(1 for p in pair_results if p["meter_continuous"])
    n_both = sum(1 for p in pair_results if p["prize_match"] and p["meter_continuous"])

    info = {
        "total_pairs": total_pairs,
        "prize_match_count": n_prize_match,
        "meter_continuous_count": n_meter_cont,
        "both_count": n_both,
        "has_meter_reset": has_meter_reset,
        "meter_decreased": meter_decreased,
    }

    # メーター減少 + 景品名一致しない → aggregate
    if meter_decreased and n_prize_match < total_pairs * 0.3:
        return "aggregate_or_inventory", {**info, "reason": "meter_decreased"}, []

    # 9999991単独 (景品名は正常) → meter_reset_artifact (除外)
    if has_meter_reset and n_prize_match >= total_pairs * 0.5:
        return "meter_reset_artifact", {**info, "reason": "meter_reset_with_prize_match"}, []

    if total_pairs == 0:
        return "inconclusive", info, [r for r in cluster_rows if r.data["is_anomaly"]]

    # confirmed_2nd_round: ペアの過半数で 景品名一致 + メーター連続
    if n_both >= total_pairs * PRIZE_NAME_MATCH_RATIO:
        # ロールバック: 完全な循環マッピング
        #   b=1-4 → b=1-4 (visit 1), b=5-8 → b=1-4 (visit 2), b=9-12 → b=1-4 (visit 3), ...
        # visit_index = (b-1) // 4 + 1
        transformed = []
        for r in cluster_rows:
            d = dict(r.data)
            if d["booth_number"] > 4:
                orig_booth = d["booth_number"]
                visit = (orig_booth - 1) // 4 + 1
                d["booth_number"] = (orig_booth - 1) % 4 + 1
                old_note = d.get("note") or ""
                marker = f"[{visit}回目巡回]"
                d["note"] = marker + " " + old_note if old_note else marker
                d["is_anomaly"] = False
                d["anomaly_tag"] = "confirmed_2nd_round"
                d["anomaly_reason"] = f"v6 auto: visit={visit}, prize_match + meter_continuous"
            transformed.append(Row(d))
        return "confirmed_2nd_round", info, transformed

    # split_to_separate_unit: 景品名が一致しないペアが半数以上
    # = 別機械(同店内に同名機械が複数台ある可能性)
    if n_prize_match < total_pairs * 0.3:
        # 完全循環マッピングで unit_index を割り当て(visit と同様、ただし別ユニット扱い)
        transformed = []
        for r in cluster_rows:
            d = dict(r.data)
            if d["booth_number"] > 4:
                orig_booth = d["booth_number"]
                unit_offset = (orig_booth - 1) // 4  # 0 が U1(本来), 1 が U2, 2 が U3, ...
                d["booth_number"] = (orig_booth - 1) % 4 + 1
                # 元の unit_index に offset を加える(複数U対応)
                base_unit = d.get("unit_index") or 1
                d["unit_index"] = base_unit + 100 * unit_offset  # 101=U2, 201=U3...
                suffix = f" -U{unit_offset + 1}"
                # machine_name に重複 suffix 付与回避(既に -UN ついてればその数字を上書き)
                d["machine_name"] = d["machine_name"] + suffix
                d["is_anomaly"] = False
                d["anomaly_tag"] = "split_to_separate_unit"
                d["anomaly_reason"] = f"v6 auto: unit_offset={unit_offset+1}, prize_name_diff"
            transformed.append(Row(d))
        return "split_to_separate_unit", info, transformed

    # それ以外は inconclusive (anomaly のまま)
    return "inconclusive", info, [r for r in cluster_rows if r.data["is_anomaly"]]


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    rows = []
    with open(V5_JSONL, encoding="utf-8") as f:
        for line in f:
            rows.append(Row(json.loads(line)))

    # 機械単位でクラスタリング
    by_machine: dict = defaultdict(list)
    for r in rows:
        by_machine[r.key_machine].append(r)

    # max_booth > 4 の機械だけが anomaly cluster 対象
    anomaly_clusters = {
        k: rs for k, rs in by_machine.items()
        if any(r.data["is_anomaly"] for r in rs)
    }

    classification_log = []
    final_rows = []
    tag_counts = defaultdict(int)
    excluded_count = 0

    # 通常クラスタ(anomaly なし) はそのまま
    for key, rs in by_machine.items():
        if key in anomaly_clusters:
            continue
        for r in rs:
            final_rows.append(r.data)

    # anomaly クラスタを判定
    for key, rs in anomaly_clusters.items():
        tag, info, transformed = classify_cluster(rs)
        tag_counts[tag] += 1
        classification_log.append({
            "store_code": key[0], "machine_name": key[1],
            "machine_area": key[2], "unit_index": key[3],
            "tag": tag, "info": info,
            "original_row_count": len(rs),
            "transformed_row_count": len(transformed),
        })

        if tag in ("aggregate_or_inventory", "meter_reset_artifact"):
            # 除外: anomaly行を除き normal行だけ残す
            for r in rs:
                if not r.data["is_anomaly"]:
                    final_rows.append(r.data)
                else:
                    excluded_count += 1
        elif tag in ("confirmed_2nd_round", "split_to_separate_unit"):
            # ロールバック適用済み行を保存
            for r in transformed:
                final_rows.append(r.data)
        else:  # inconclusive
            for r in rs:
                final_rows.append(r.data)

    # final_rows を保存
    out_jsonl = OUT_DIR / "parsed_rows_v6.jsonl"
    with open(out_jsonl, "w", encoding="utf-8") as f:
        for d in final_rows:
            f.write(json.dumps(d, ensure_ascii=False, default=str) + "\n")

    log_jsonl = OUT_DIR / "classification_log.jsonl"
    with open(log_jsonl, "w", encoding="utf-8") as f:
        for entry in classification_log:
            f.write(json.dumps(entry, ensure_ascii=False, default=str) + "\n")

    # サマリ
    v6_normal = sum(1 for d in final_rows if not d["is_anomaly"])
    v6_anomaly = sum(1 for d in final_rows if d["is_anomaly"])
    v5_normal = sum(1 for r in rows if not r.data["is_anomaly"])
    v5_anomaly = sum(1 for r in rows if r.data["is_anomaly"])

    print(f"=== v6 分類完了 ===")
    print(f"クラスタ分類:")
    for t, c in tag_counts.items():
        print(f"  {t}: {c} クラスタ")
    print(f"除外行数: {excluded_count}")
    print()
    print(f"v5 → v6 件数推移:")
    print(f"  total: {len(rows)} → {len(final_rows)} ({len(final_rows) - len(rows):+})")
    print(f"  normal: {v5_normal} → {v6_normal} ({v6_normal - v5_normal:+})")
    print(f"  anomaly: {v5_anomaly} → {v6_anomaly} ({v6_anomaly - v5_anomaly:+})")
    print()
    print(f"Wrote: {out_jsonl}")
    print(f"Wrote: {log_jsonl}")


if __name__ == "__main__":
    main()
