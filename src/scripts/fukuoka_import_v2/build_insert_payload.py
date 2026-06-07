#!/usr/bin/env python3
"""
v6 normal → INSERT用ペイロード生成

machines / booths / prize_masters / meter_readings の SQL用JSON を組み立てる。
insert は別スクリプトで batch 実行する。
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

V6_JSONL = Path("src/scripts/fukuoka_import_v2/output_v6/parsed_rows_v6.jsonl")
OUT_DIR = Path("src/scripts/fukuoka_import_v2/insert_payload")
OUT_DIR.mkdir(parents=True, exist_ok=True)

ORG_CHANGE = "01cf7a5e-6971-4ae1-918d-8e5981780a95"


def safe(s: str) -> str:
    """機械名から SQL/コード用安全な文字列を作る(空白を _ に、長すぎる場合切り詰め等)"""
    if not s:
        return ""
    s = re.sub(r"\s+", "_", s.strip())
    return s


def build_machine_code(store_code: str, machine_name: str, area: str | None, unit_index: int) -> str:
    parts = [store_code, safe(machine_name)]
    if area:
        parts.append(safe(area))
    if unit_index and unit_index > 1:
        parts.append(f"U{unit_index}")
    return "::".join(parts)


def build_booth_code(machine_code: str, booth_number: int) -> str:
    return f"{machine_code}::B{booth_number}"


def visit_index_from_note(note: str | None) -> int:
    if not note:
        return 1
    m = re.search(r"\[(\d+)回目巡回\]", note)
    if not m:
        return 1
    return int(m.group(1))


def main():
    rows = []
    with open(V6_JSONL, encoding="utf-8") as f:
        for line in f:
            rows.append(json.loads(line))

    # normal だけ取り出す
    normal_rows = [r for r in rows if not r["is_anomaly"]]

    # ===== machines =====
    machines: dict[str, dict] = {}
    for r in normal_rows:
        mc = build_machine_code(r["store_code"], r["machine_name"], r["machine_area"], r["unit_index"])
        if mc not in machines:
            machines[mc] = {
                "machine_code": mc,
                "store_code": r["store_code"],
                "machine_name": r["machine_name"],
                "floor": r["machine_area"],
                "organization_id": ORG_CHANGE,
                "ownership_type": "purchased",  # R番号付きは後で UPDATE で DFX 所有に変える
                "is_active": True,
                "notes": f"fukuoka v2 import / r_number={r['r_number']}" if r["r_number"] else "fukuoka v2 import",
            }
        # R番号情報あれば DFX 所有候補としてマーク
        if r["r_number"]:
            machines[mc]["r_number_hint"] = r["r_number"]

    # ===== booths =====
    booths: dict[str, dict] = {}
    for r in normal_rows:
        mc = build_machine_code(r["store_code"], r["machine_name"], r["machine_area"], r["unit_index"])
        bc = build_booth_code(mc, r["booth_number"])
        if bc not in booths:
            booths[bc] = {
                "booth_code": bc,
                "machine_code": mc,
                "store_code": r["store_code"],
                "booth_number": r["booth_number"],
                "is_active": True,
                "play_price": 100,
            }

    # ===== prize_masters =====
    prize_names = set()
    for r in normal_rows:
        pn = r.get("prize_name")
        if pn:
            prize_names.add(pn.strip())

    # 既存DBのprize_master と突合は SQL 側で実施(prize_name 一致で prize_id 取得)
    # ここでは「新規追加候補」のリストだけ作る
    new_prizes = []
    for name in sorted(prize_names):
        new_prizes.append({
            "prize_id": f"FUKUOKA-V2-{safe(name)[:60]}",  # 60文字制限保険
            "prize_name": name,
            "organization_id": ORG_CHANGE,
            "phase": "active",
            "notes": "fukuoka v2 import (景品名のみ、原価は meter_readings.prize_cost を参照)",
        })

    # ===== meter_readings =====
    meter_rows = []
    for r in normal_rows:
        mc = build_machine_code(r["store_code"], r["machine_name"], r["machine_area"], r["unit_index"])
        bc = build_booth_code(mc, r["booth_number"])
        vi = visit_index_from_note(r.get("note"))
        meter_rows.append({
            "booth_id": bc,
            "store_code": r["store_code"],
            "machine_code": mc,
            "booth_code": bc,
            "full_booth_code": bc,
            "patrol_date": r["patrol_date"],
            "in_meter": r["in_meter"],
            "out_meter": r["out_meter"],
            "prize_restock_count": r["prize_restock_count"],
            "prize_stock_count": r["theoretical_stock"],
            "prize_name": r["prize_name"],
            "prize_cost": r["prize_cost"],
            "note": r.get("note"),
            "set_o": None,
            "source": "import_fukuoka_2026_v2",
            "input_method": "import",
            "organization_id": ORG_CHANGE,
            "created_by": "fukuoka_v2_import",
            "entry_type": "patrol",
            "visit_index": vi,
        })

    # 出力
    with open(OUT_DIR / "machines.json", "w", encoding="utf-8") as f:
        json.dump(list(machines.values()), f, ensure_ascii=False, indent=2)
    with open(OUT_DIR / "booths.json", "w", encoding="utf-8") as f:
        json.dump(list(booths.values()), f, ensure_ascii=False, indent=2)
    with open(OUT_DIR / "prize_masters.json", "w", encoding="utf-8") as f:
        json.dump(new_prizes, f, ensure_ascii=False, indent=2)
    with open(OUT_DIR / "meter_readings.json", "w", encoding="utf-8") as f:
        json.dump(meter_rows, f, ensure_ascii=False, indent=2)

    print(f"=== build complete ===")
    print(f"  machines:       {len(machines)}")
    print(f"  booths:         {len(booths)}")
    print(f"  new prize_ids:  {len(new_prizes)} (新規候補、既存DBと突合は SQL で)")
    print(f"  meter_readings: {len(meter_rows)}")
    print(f"  visit_index distribution:")
    vc = defaultdict(int)
    for m in meter_rows:
        vc[m["visit_index"]] += 1
    for v, c in sorted(vc.items()):
        print(f"    visit={v}: {c} 行")


if __name__ == "__main__":
    main()
